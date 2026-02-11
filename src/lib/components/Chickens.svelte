<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { loadModel } from '../utils/modelLoader.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getRemotePlayers } from '../stores/players.svelte.js'
  import { resolveCollision } from '../utils/obstacles.js'
  import { POND_CENTER, POND_RADIUS } from '../utils/pond.js'
  import { isMuted } from '../stores/sound.svelte.js'

  const gltf = loadModel('/chicken_new.glb')
  const remotePlayers = $derived(getRemotePlayers())

  // Chicken cluck sound — plays occasionally when player is nearby
  const HEAR_DIST = 60
  const cluckAudio = new Audio('/sounds/chicken.mp3')
  cluckAudio.volume = 0.15
  let cluckCooldown = 1 + Math.random() * 2

  $effect(() => {
    if (isMuted()) {
      cluckAudio.pause()
      cluckAudio.currentTime = 0
    }
  })

  const COOP_X = -150
  const COOP_Z = 40
  const COUNT = 5
  const WANDER_RADIUS = 18
  const WALK_SPEED = 3
  const RUN_SPEED = 20
  const FLEE_DIST = 28
  const SAFE_DIST = 35
  const FIELD_LIMIT = 230
  const SCALE = 0.5
  const Y_OFFSET = 1

  let seed = 333
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  let chickens = []

  function pickTarget(c) {
    const angle = rand() * Math.PI * 2
    const dist = 3 + rand() * WANDER_RADIUS
    c.targetX = COOP_X + Math.cos(angle) * dist
    c.targetZ = COOP_Z + Math.sin(angle) * dist
  }

  for (let i = 0; i < COUNT; i++) {
    const angle = rand() * Math.PI * 2
    const dist = 2 + rand() * WANDER_RADIUS
    const c = {
      x: COOP_X + Math.cos(angle) * dist,
      z: COOP_Z + Math.sin(angle) * dist,
      rotY: rand() * Math.PI * 2,
      targetRotY: 0,
      targetX: 0,
      targetZ: 0,
      state: 'idle',
      timer: 1 + rand() * 3,
      group: null,
      innerGroup: null,
      mixer: null,
      actions: {},
      currentAction: null,
    }
    c.targetRotY = c.rotY
    pickTarget(c)
    chickens.push(c)
  }

  function clampToField(x, z) {
    x = Math.max(-FIELD_LIMIT, Math.min(FIELD_LIMIT, x))
    z = Math.max(-FIELD_LIMIT, Math.min(FIELD_LIMIT, z))
    const dx = x - POND_CENTER[0]
    const dz = z - POND_CENTER[1]
    const pd = Math.sqrt(dx * dx + dz * dz)
    if (pd < POND_RADIUS + 2) {
      const push = (POND_RADIUS + 2) / pd
      x = POND_CENTER[0] + dx * push
      z = POND_CENTER[1] + dz * push
    }
    return { x, z }
  }

  function getClosestPlayerDist(c) {
    let minDist = Infinity
    let px = 0, pz = 0
    const lx = localPlayerPos.x - c.x
    const lz = localPlayerPos.z - c.z
    const ld = Math.sqrt(lx * lx + lz * lz)
    if (ld < minDist) { minDist = ld; px = localPlayerPos.x; pz = localPlayerPos.z }
    for (const [, rp] of remotePlayers) {
      const rx = rp.curr.x - c.x
      const rz = rp.curr.z - c.z
      const rd = Math.sqrt(rx * rx + rz * rz)
      if (rd < minDist) { minDist = rd; px = rp.curr.x; pz = rp.curr.z }
    }
    return { dist: minDist, px, pz }
  }

  function startTurning(c) {
    const dx = c.targetX - c.x
    const dz = c.targetZ - c.z
    c.targetRotY = Math.atan2(dx, dz)
    c.state = 'turning'
    c.timer = 0.3 + rand() * 0.3
  }

  function playAction(c, name) {
    if (c.currentAction === name) return
    const prev = c.actions[c.currentAction]
    const next = c.actions[name]
    if (!next) return
    next.reset().play()
    if (prev) prev.crossFadeTo(next, 0.3, true)
    c.currentAction = name
  }

  function pickIdleAnim(c) {
    const names = Object.keys(c.actions)
    const idle = names.find(n => /idle/i.test(n))
    const twerk = names.find(n => /twerk/i.test(n))
    const candidates = [idle, twerk].filter(Boolean)
    if (candidates.length === 0) return names[0]
    return candidates[Math.floor(rand() * candidates.length)]
  }

  // Sharp 2-band gradient for punchier toon shading
  const toonGrad = new THREE.DataTexture(
    new Uint8Array([100, 100, 100, 255, 255, 255, 255, 255]),
    2, 1, THREE.RGBAFormat
  )
  toonGrad.minFilter = THREE.NearestFilter
  toonGrad.magFilter = THREE.NearestFilter
  toonGrad.needsUpdate = true

  function enhanceToon(scene) {
    scene.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of mats) {
        if (mat.isMeshToonMaterial) {
          mat.gradientMap = toonGrad
          mat.emissiveIntensity = 0.3
          if (mat.normalMap) { mat.normalMap.dispose(); mat.normalMap = null }
          if (mat.bumpMap) { mat.bumpMap.dispose(); mat.bumpMap = null }
          if (mat.roughnessMap) { mat.roughnessMap.dispose(); mat.roughnessMap = null }
          mat.needsUpdate = true
        }
      }
    })
  }

  function setupChicken(c, gltfData, scene) {
    enhanceToon(scene)
    c.mixer = new THREE.AnimationMixer(scene)
    for (const clip of gltfData.animations) {
      c.actions[clip.name] = c.mixer.clipAction(clip)
    }
    const startAnim = pickIdleAnim(c)
    if (startAnim) playAction(c, startAnim)
  }

  useTask((delta) => {
    for (const c of chickens) {
      if (!c.group) continue
      if (c.mixer) c.mixer.update(delta)
      c.timer -= delta

      const player = getClosestPlayerDist(c)

      // Flee if player is close
      if (player.dist < FLEE_DIST && c.state !== 'fleeing') {
        c.state = 'fleeing'
        const walkName = Object.keys(c.actions).find(n => /walk/i.test(n))
        if (walkName) {
          playAction(c, walkName)
          if (c.actions[walkName]) c.actions[walkName].timeScale = 2
        }
      }

      if (c.state === 'fleeing') {
        if (player.dist > SAFE_DIST) {
          c.state = 'idle'
          c.timer = 1 + rand() * 2
          const anim = pickIdleAnim(c)
          if (anim) playAction(c, anim)
        } else {
          const awayX = c.x - player.px
          const awayZ = c.z - player.pz
          const awayDist = Math.sqrt(awayX * awayX + awayZ * awayZ)
          if (awayDist > 0.01) {
            const nx = awayX / awayDist + (rand() - 0.5) * 0.4
            const nz = awayZ / awayDist + (rand() - 0.5) * 0.4
            c.x += nx * RUN_SPEED * delta
            c.z += nz * RUN_SPEED * delta

            const targetRot = Math.atan2(nx, nz)
            let dAngle = targetRot - c.rotY
            if (dAngle > Math.PI) dAngle -= 2 * Math.PI
            if (dAngle < -Math.PI) dAngle += 2 * Math.PI
            c.rotY += dAngle * Math.min(1, 8 * delta)
          }

          const clamped = clampToField(c.x, c.z)
          c.x = clamped.x
          c.z = clamped.z
        }
      } else if (c.state === 'idle') {
        if (c.timer <= 0) {
          // Randomly switch idle anim or start walking
          if (rand() < 0.4) {
            const anim = pickIdleAnim(c)
            if (anim) playAction(c, anim)
            c.timer = 3 + rand() * 5
          } else {
            pickTarget(c)
            startTurning(c)
          }
        }
      } else if (c.state === 'turning') {
        let dAngle = c.targetRotY - c.rotY
        if (dAngle > Math.PI) dAngle -= 2 * Math.PI
        if (dAngle < -Math.PI) dAngle += 2 * Math.PI
        c.rotY += dAngle * Math.min(1, 6 * delta)

        if (Math.abs(dAngle) < 0.1 || c.timer <= 0) {
          c.rotY = c.targetRotY
          c.state = 'walking'
          const walkName = Object.keys(c.actions).find(n => /walk/i.test(n))
          if (walkName) {
            playAction(c, walkName)
            if (c.actions[walkName]) c.actions[walkName].timeScale = 1
          }
        }
      } else if (c.state === 'walking') {
        const dx = c.targetX - c.x
        const dz = c.targetZ - c.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist < 0.5) {
          c.state = 'idle'
          c.timer = 2 + rand() * 5
          const anim = pickIdleAnim(c)
          if (anim) playAction(c, anim)
        } else {
          c.x += (dx / dist) * WALK_SPEED * delta
          c.z += (dz / dist) * WALK_SPEED * delta

          const targetRot = Math.atan2(dx, dz)
          let dAngle = targetRot - c.rotY
          if (dAngle > Math.PI) dAngle -= 2 * Math.PI
          if (dAngle < -Math.PI) dAngle += 2 * Math.PI
          c.rotY += dAngle * Math.min(1, 3 * delta)
        }
      }

      // Soft separation from other chickens
      for (const other of chickens) {
        if (other === c) continue
        const sx = c.x - other.x
        const sz = c.z - other.z
        const sd = Math.sqrt(sx * sx + sz * sz)
        if (sd < 2 && sd > 0.01) {
          const push = (2 - sd) * 0.5 * delta
          c.x += (sx / sd) * push
          c.z += (sz / sd) * push
        }
      }

      // Push out of obstacles
      const resolved = resolveCollision(c.x, c.z, 0.5)
      c.x = resolved.x
      c.z = resolved.z

      // Apply transforms
      if (c.group) {
        const groundY = getTerrainHeight(c.x, c.z)
        c.group.position.set(c.x, groundY + Y_OFFSET, c.z)
      }
      if (c.innerGroup) {
        c.innerGroup.rotation.y = c.rotY
      }
    }

    // Chicken cluck — find closest chicken to player, play occasionally
    let closestDist = Infinity
    for (const c of chickens) {
      const dx = c.x - localPlayerPos.x
      const dz = c.z - localPlayerPos.z
      const d = Math.sqrt(dx * dx + dz * dz)
      if (d < closestDist) closestDist = d
    }

    if (closestDist < HEAR_DIST && !isMuted()) {
      cluckCooldown -= delta
      if (cluckCooldown <= 0) {
        const vol = 0.15 * (1 - closestDist / HEAR_DIST)
        cluckAudio.volume = Math.max(0.02, vol)
        cluckAudio.currentTime = 0
        cluckAudio.playbackRate = 0.9 + Math.random() * 0.3
        cluckAudio.play().catch(() => {})
        cluckCooldown = 6 + Math.random() * 10
      }
    } else {
      cluckCooldown = 2 + Math.random() * 3
    }
  })
</script>

{#await gltf then value}
  {#each chickens as c}
    {@const scene = cloneSkeleton(value.scene)}
    <T.Group
      position.x={c.x}
      position.y={getTerrainHeight(c.x, c.z)}
      position.z={c.z}
      oncreate={(ref) => { c.group = ref }}
    >
      <T.Group
        rotation.y={c.rotY}
        oncreate={(ref) => { c.innerGroup = ref }}
      >
        <T
          is={scene}
          scale={SCALE}
          oncreate={() => setupChicken(c, value, scene)}
        />
      </T.Group>
    </T.Group>
  {/each}
{/await}
