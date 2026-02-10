<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getRemotePlayers } from '../stores/players.svelte.js'
  import { POND_CENTER, POND_RADIUS } from '../utils/pond.js'
  import { resolveCollision, isInBarnZone } from '../utils/obstacles.js'
  import { loadModel } from '../utils/modelLoader.js'
  import { isMuted } from '../stores/sound.svelte.js'

  const horseGltf = loadModel('/Horse.glb')
  const whiteHorseGltf = loadModel('/White Horse.glb')
  const remotePlayers = $derived(getRemotePlayers())

  // Running sound — audible when fleeing near the player
  const HEAR_DIST = 25
  const runAudio = new Audio('/sounds/grass_running.mp3')
  runAudio.loop = true
  runAudio.volume = 0
  let audioPlaying = false
  let pitchTimer = 0

  $effect(() => {
    if (isMuted()) {
      if (audioPlaying) {
        runAudio.pause()
        runAudio.currentTime = 0
        audioPlaying = false
      }
    }
  })

  const COUNT = 5
  const WALK_SPEED = 2.0
  const RUN_SPEED = 14
  const FIELD_LIMIT = 230
  const WANDER_RADIUS = 30
  const MIN_SEPARATION = 3
  const FLEE_DIST = 12
  const SAFE_DIST = 25

  // Migrating herd center — slowly roams across the map
  let herdCenter = { x: 120, z: 120 }
  let herdTarget = { x: 120, z: 120 }
  let herdMoveTimer = 0

  let seed = 137
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  let horses = []

  function clampToField(x, z) {
    x = Math.max(-FIELD_LIMIT, Math.min(FIELD_LIMIT, x))
    z = Math.max(-FIELD_LIMIT, Math.min(FIELD_LIMIT, z))
    // Push out of pond
    const dx = x - POND_CENTER[0]
    const dz = z - POND_CENTER[1]
    const pd = Math.sqrt(dx * dx + dz * dz)
    if (pd < POND_RADIUS + 3) {
      const push = (POND_RADIUS + 3) / pd
      x = POND_CENTER[0] + dx * push
      z = POND_CENTER[1] + dz * push
    }
    return { x, z }
  }

  function pickHerdTarget() {
    const angle = rand() * Math.PI * 2
    const dist = 40 + rand() * (FIELD_LIMIT - 50)
    const pos = clampToField(Math.cos(angle) * dist, Math.sin(angle) * dist)
    herdTarget.x = pos.x
    herdTarget.z = pos.z
  }

  function pickTarget(h) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = rand() * Math.PI * 2
      const dist = 5 + rand() * WANDER_RADIUS
      const pos = clampToField(herdCenter.x + Math.cos(angle) * dist, herdCenter.z + Math.sin(angle) * dist)
      if (!isInBarnZone(pos.x, pos.z)) {
        h.targetX = pos.x
        h.targetZ = pos.z
        return
      }
    }
    h.targetX = herdCenter.x
    h.targetZ = herdCenter.z
  }

  function initHorse(index) {
    const angle = rand() * Math.PI * 2
    const dist = 5 + rand() * WANDER_RADIUS
    let x = herdCenter.x + Math.cos(angle) * dist
    let z = herdCenter.z + Math.sin(angle) * dist
    const clamped = clampToField(x, z)
    x = clamped.x
    z = clamped.z
    const h = {
      x,
      z,
      rotY: rand() * Math.PI * 2,
      state: 'idle',
      timer: 2 + rand() * 5,
      mixer: null,
      actions: {},
      currentAction: null,
      targetX: x,
      targetZ: z,
      group: null,
      innerGroup: null,
      walkTime: 0,
      isWhite: rand() < 0.4, // ~40% white horses
    }
    pickTarget(h)
    return h
  }

  for (let i = 0; i < COUNT; i++) {
    horses.push(initHorse(i))
  }

  function playAction(h, name) {
    if (h.currentAction === name) return
    const prev = h.actions[h.currentAction]
    const next = h.actions[name]
    if (!next) return
    next.reset().play()
    if (prev) prev.crossFadeTo(next, 0.3, true)
    h.currentAction = name
  }

  function setupHorse(h, gltfData, scene) {
    h.mixer = new THREE.AnimationMixer(scene)
    for (const clip of gltfData.animations) {
      // Skip AnimalArmature| prefixed duplicates
      if (clip.name.includes('|')) continue
      h.actions[clip.name] = h.mixer.clipAction(clip)
    }
    playAction(h, 'Idle')
  }

  function getClosestPlayerDist(h) {
    let minDist = Infinity
    let closestX = 0
    let closestZ = 0

    const lx = localPlayerPos.x - h.x
    const lz = localPlayerPos.z - h.z
    const ld = Math.sqrt(lx * lx + lz * lz)
    if (ld < minDist) {
      minDist = ld
      closestX = localPlayerPos.x
      closestZ = localPlayerPos.z
    }

    for (const [, rp] of remotePlayers) {
      const rx = rp.curr.x - h.x
      const rz = rp.curr.z - h.z
      const rd = Math.sqrt(rx * rx + rz * rz)
      if (rd < minDist) {
        minDist = rd
        closestX = rp.curr.x
        closestZ = rp.curr.z
      }
    }

    return { dist: minDist, px: closestX, pz: closestZ }
  }

  useTask((delta) => {
    // Migrate herd center across the map
    herdMoveTimer -= delta
    if (herdMoveTimer <= 0) {
      pickHerdTarget()
      herdMoveTimer = 30 + rand() * 60
    }
    const herdSpeed = 1.5 * delta
    const hdx = herdTarget.x - herdCenter.x
    const hdz = herdTarget.z - herdCenter.z
    const hdd = Math.sqrt(hdx * hdx + hdz * hdz)
    if (hdd > 1) {
      herdCenter.x += (hdx / hdd) * herdSpeed
      herdCenter.z += (hdz / hdd) * herdSpeed
    }

    for (let i = 0; i < horses.length; i++) {
      const h = horses[i]
      if (!h.mixer) continue
      h.mixer.update(delta)

      const player = getClosestPlayerDist(h)
      const fleeSpeed = RUN_SPEED

      // Flee if a player is close
      if (player.dist < FLEE_DIST) {
        if (h.state !== 'fleeing') {
          h.state = 'fleeing'
          playAction(h, 'Gallop')
        }

        const awayX = h.x - player.px
        const awayZ = h.z - player.pz
        const awayDist = Math.sqrt(awayX * awayX + awayZ * awayZ)
        if (awayDist > 0.01) {
          const nx = awayX / awayDist
          const nz = awayZ / awayDist
          const jx = nx + (rand() - 0.5) * 0.3
          const jz = nz + (rand() - 0.5) * 0.3

          h.x += jx * fleeSpeed * delta
          h.z += jz * fleeSpeed * delta

          const targetRotY = Math.atan2(jx, jz)
          let dAngle = targetRotY - h.rotY
          if (dAngle > Math.PI) dAngle -= 2 * Math.PI
          if (dAngle < -Math.PI) dAngle += 2 * Math.PI
          h.rotY += dAngle * Math.min(1, 8 * delta)
        }

        const clamped = clampToField(h.x, h.z)
        h.x = clamped.x
        h.z = clamped.z
      }
      // Transition out of fleeing when safe
      else if (h.state === 'fleeing') {
        if (player.dist > SAFE_DIST) {
          h.state = 'idle'
          h.timer = 1 + rand() * 3
          playAction(h, 'Idle')
        } else {
          const awayX = h.x - player.px
          const awayZ = h.z - player.pz
          const awayDist = Math.sqrt(awayX * awayX + awayZ * awayZ)
          if (awayDist > 0.01) {
            const nx = awayX / awayDist
            const nz = awayZ / awayDist
            h.x += nx * fleeSpeed * delta
            h.z += nz * fleeSpeed * delta

            const targetRotY = Math.atan2(nx, nz)
            let dAngle = targetRotY - h.rotY
            if (dAngle > Math.PI) dAngle -= 2 * Math.PI
            if (dAngle < -Math.PI) dAngle += 2 * Math.PI
            h.rotY += dAngle * Math.min(1, 8 * delta)
          }
          const clamped = clampToField(h.x, h.z)
          h.x = clamped.x
          h.z = clamped.z
        }
      }
      // Normal behavior
      else {
        h.timer -= delta

        if (h.state === 'idle') {
          if (h.timer <= 0) {
            const r = rand()
            if (r < 0.3) {
              h.state = 'eating'
              h.timer = 4 + rand() * 6
              playAction(h, 'Eating')
            } else if (r < 0.5) {
              playAction(h, rand() < 0.5 ? 'Idle_2' : 'Idle_Headlow')
              h.timer = 3 + rand() * 4
            } else {
              h.state = 'walking'
              pickTarget(h)
              playAction(h, 'Walk')
            }
          }
        } else if (h.state === 'eating') {
          if (h.timer <= 0) {
            h.state = 'idle'
            h.timer = 3 + rand() * 5
            playAction(h, 'Idle')
          }
        } else if (h.state === 'walking') {
          h.walkTime += delta
          const dx = h.targetX - h.x
          const dz = h.targetZ - h.z
          const dist = Math.sqrt(dx * dx + dz * dz)

          if (dist < 1 || h.walkTime > 12) {
            h.state = 'idle'
            h.timer = 4 + rand() * 8
            h.walkTime = 0
            playAction(h, 'Idle')
          } else {
            const targetRotY = Math.atan2(dx, dz)
            let dAngle = targetRotY - h.rotY
            if (dAngle > Math.PI) dAngle -= 2 * Math.PI
            if (dAngle < -Math.PI) dAngle += 2 * Math.PI
            h.rotY += dAngle * Math.min(1, 3 * delta)

            h.x += (dx / dist) * WALK_SPEED * delta
            h.z += (dz / dist) * WALK_SPEED * delta
          }
        }
      }

      // Soft separation from other horses
      if (h.state === 'walking' || h.state === 'fleeing') {
        for (const other of horses) {
          if (other === h) continue
          const sx = h.x - other.x
          const sz = h.z - other.z
          const sd = Math.sqrt(sx * sx + sz * sz)
          if (sd < MIN_SEPARATION && sd > 0.01) {
            const push = (MIN_SEPARATION - sd) * 0.5 * delta
            h.x += (sx / sd) * push
            h.z += (sz / sd) * push
          }
        }
      }

      // Push out of barn/windmill obstacles
      const resolved = resolveCollision(h.x, h.z, 1)
      h.x = resolved.x
      h.z = resolved.z

      // Update Three.js positions
      if (h.group) {
        const y = getTerrainHeight(h.x, h.z)
        h.group.position.set(h.x, y, h.z)
      }
      if (h.innerGroup) {
        h.innerGroup.rotation.y = h.rotY
      }
    }

    // Running sound — volume based on closest fleeing horse
    let closestFleeingDist = Infinity
    for (const h of horses) {
      if (h.state !== 'fleeing') continue
      const ddx = h.x - localPlayerPos.x
      const ddz = h.z - localPlayerPos.z
      const dd = Math.sqrt(ddx * ddx + ddz * ddz)
      if (dd < closestFleeingDist) closestFleeingDist = dd
    }

    if (closestFleeingDist < HEAR_DIST && !isMuted()) {
      const vol = 0.3 * (1 - closestFleeingDist / HEAR_DIST)
      runAudio.volume = Math.max(0, vol)
      if (!audioPlaying) {
        runAudio.playbackRate = 1.3 + Math.random() * 0.2
        runAudio.play().catch(() => {})
        audioPlaying = true
      }
      pitchTimer -= delta
      if (pitchTimer <= 0) {
        runAudio.playbackRate = 1.2 + Math.random() * 0.4
        pitchTimer = 0.2 + Math.random() * 0.15
      }
    } else {
      if (audioPlaying) {
        runAudio.pause()
        runAudio.currentTime = 0
        audioPlaying = false
      }
    }
  })

  let modelsReady = $state(false)
  let horseModel = $state(null)
  let whiteHorseModel = $state(null)

  Promise.all([horseGltf, whiteHorseGltf]).then(([h, wh]) => {
    horseModel = h
    whiteHorseModel = wh
    modelsReady = true
  })
</script>

{#if modelsReady}
  {#each horses as h}
    {@const gltfData = h.isWhite ? whiteHorseModel : horseModel}
    {@const scene = cloneSkeleton(gltfData.scene)}
    <T.Group
      position.x={h.x}
      position.y={getTerrainHeight(h.x, h.z)}
      position.z={h.z}
      oncreate={(ref) => { h.group = ref }}
    >
      <T.Group
        rotation.y={h.rotY}
        oncreate={(ref) => { h.innerGroup = ref }}
      >
        <T
          is={scene}
          scale={1}
          oncreate={() => setupHorse(h, gltfData, scene)}
        />
      </T.Group>
    </T.Group>
  {/each}
{/if}
