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

  const gltf = loadModel('/Hen.glb')
  const remotePlayers = $derived(getRemotePlayers())

  // Chicken cluck sound — plays occasionally when player is nearby
  const HEAR_DIST = 60
  const cluckAudio = new Audio('/sounds/chicken.mp3')
  cluckAudio.volume = 0.4
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
  const WALK_SPEED = 1.2
  const RUN_SPEED = 20
  const FLEE_DIST = 28
  const SAFE_DIST = 35
  const FIELD_LIMIT = 230
  const SCALE = 0.030
  const Y_OFFSET = 1.36
  const LEG_SWING = 0.4

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
      // Walking
      stepPhase: rand() * Math.PI * 2,
      yOffset: 0,
      // Head bob: offset the upper body forward/back
      headBob: 0,
      headBobTarget: 0,
      tiltX: 0,
      tiltZ: 0,
      group: null,
      bodyGroup: null,
      leftLeg: null,
      rightLeg: null,
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

  // Split hen mesh into body + left/right legs for procedural leg animation
  function setupChicken(c, scene) {
    const meshes = []
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        meshes.push(child)
      }
    })
    if (meshes.length === 0) return

    // Compute bounding box to find where legs end
    const box = new THREE.Box3()
    for (const mesh of meshes) box.expandByObject(mesh)
    const height = box.max.y - box.min.y
    const legCutoff = box.min.y + height * 0.28

    for (const mesh of meshes) {
      const geo = mesh.geometry
      const pos = geo.attributes.position
      const idx = geo.index
      const hasNormals = !!geo.attributes.normal
      const hasUV = !!geo.attributes.uv

      const bodyD = { v: [], n: [], uv: [] }
      const leftD = { v: [], n: [], uv: [] }
      const rightD = { v: [], n: [], uv: [] }

      const triCount = idx ? idx.count / 3 : pos.count / 3
      for (let t = 0; t < triCount; t++) {
        const i0 = idx ? idx.getX(t * 3) : t * 3
        const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
        const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
        const avgY = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3
        const avgX = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3
        const target = avgY < legCutoff ? (avgX >= 0 ? rightD : leftD) : bodyD

        for (const ii of [i0, i1, i2]) {
          target.v.push(pos.getX(ii), pos.getY(ii), pos.getZ(ii))
          if (hasNormals) {
            const nm = geo.attributes.normal
            target.n.push(nm.getX(ii), nm.getY(ii), nm.getZ(ii))
          }
          if (hasUV) {
            const uv = geo.attributes.uv
            target.uv.push(uv.getX(ii), uv.getY(ii))
          }
        }
      }

      mesh.visible = false

      // Rebuild body mesh in place
      if (bodyD.v.length > 0) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(bodyD.v, 3))
        if (bodyD.n.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(bodyD.n, 3))
        if (bodyD.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(bodyD.uv, 2))
        const m = new THREE.Mesh(g, mesh.material)
        m.castShadow = true
        mesh.parent.add(m)
      }

      // Create leg pivot groups at hip height
      for (const [data, side] of [[leftD, 'left'], [rightD, 'right']]) {
        if (data.v.length === 0) continue
        const pivot = new THREE.Group()
        pivot.position.y = legCutoff

        // Offset leg vertices relative to pivot
        const offsetV = [...data.v]
        for (let i = 1; i < offsetV.length; i += 3) {
          offsetV[i] -= legCutoff
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(offsetV, 3))
        if (data.n.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(data.n, 3))
        if (data.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2))
        const m = new THREE.Mesh(g, mesh.material)
        m.castShadow = true
        pivot.add(m)
        mesh.parent.add(pivot)

        if (side === 'left') c.leftLeg = pivot
        else c.rightLeg = pivot
      }
    }
  }

  useTask((delta) => {
    for (const c of chickens) {
      if (!c.group) continue
      c.timer -= delta

      const player = getClosestPlayerDist(c)

      // Flee if player is close
      if (player.dist < FLEE_DIST && c.state !== 'fleeing') {
        c.state = 'fleeing'
        c.stepPhase = 0
      }

      // Ease legs back to neutral when stationary
      const easeLegs = (c.state !== 'walking' && c.state !== 'fleeing')

      if (c.state === 'fleeing') {
        if (player.dist > SAFE_DIST) {
          c.state = 'idle'
          c.timer = 1 + rand() * 2
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

          // Chicken run animation
          c.stepPhase += delta * 24
          const step = Math.sin(c.stepPhase)
          const stepAbs = Math.abs(step)

          // Strong forward lean when sprinting
          c.tiltX += (0.25 - c.tiltX) * 6 * delta

          // Chicken head thrust: snaps forward then slowly retracts each stride
          const headCycle = Math.sin(c.stepPhase * 2)
          c.headBob = 0.08 + (headCycle > 0 ? headCycle * 0.2 : headCycle * 0.06)

          // Slight vertical bounce from push-off
          c.yOffset = stepAbs * 0.025

          // Alternating body waddle — tilts toward the planted foot
          c.tiltZ = step * 0.05

          // Asymmetric leg swing: fast forward, slower back (using clamped sine)
          const legPhase = Math.sin(c.stepPhase)
          const leftSwing = legPhase > 0 ? legPhase : legPhase * 0.5
          const rightSwing = -legPhase > 0 ? -legPhase : -legPhase * 0.5
          if (c.leftLeg) c.leftLeg.rotation.x = leftSwing * LEG_SWING * 1.8
          if (c.rightLeg) c.rightLeg.rotation.x = -rightSwing * LEG_SWING * 1.8

          const clamped = clampToField(c.x, c.z)
          c.x = clamped.x
          c.z = clamped.z
        }
      } else if (c.state === 'idle') {
        // Ease back to neutral
        c.tiltX += (0 - c.tiltX) * 6 * delta
        c.tiltZ += (0 - c.tiltZ) * 6 * delta
        c.yOffset += (0 - c.yOffset) * 6 * delta
        c.headBob += (0 - c.headBob) * 8 * delta

        if (c.timer <= 0) {
          pickTarget(c)
          startTurning(c)
        }
      } else if (c.state === 'turning') {
        let dAngle = c.targetRotY - c.rotY
        if (dAngle > Math.PI) dAngle -= 2 * Math.PI
        if (dAngle < -Math.PI) dAngle += 2 * Math.PI
        c.rotY += dAngle * Math.min(1, 6 * delta)

        if (Math.abs(dAngle) < 0.1 || c.timer <= 0) {
          c.rotY = c.targetRotY
          c.state = 'walking'
          c.stepPhase = 0
        }
      } else if (c.state === 'walking') {
        const dx = c.targetX - c.x
        const dz = c.targetZ - c.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist < 0.5) {
          c.state = 'idle'
          c.timer = 2 + rand() * 5
        } else {
          // Move forward
          c.x += (dx / dist) * WALK_SPEED * delta
          c.z += (dz / dist) * WALK_SPEED * delta

          // Slight forward lean while walking
          c.tiltX += (0.12 - c.tiltX) * 6 * delta

          // Step cycle
          c.stepPhase += delta * 10
          const step = Math.sin(c.stepPhase)

          // Chicken head thrust: extends forward then retracts each stride
          const headCycle = Math.sin(c.stepPhase * 2)
          c.headBob = 0.04 + (headCycle > 0 ? headCycle * 0.1 : headCycle * 0.03)

          // Gentle vertical bounce
          c.yOffset = Math.abs(step) * 0.015

          // Subtle side-to-side waddle
          c.tiltZ = step * 0.025

          // Asymmetric leg swing
          const legPhase = Math.sin(c.stepPhase)
          const leftW = legPhase > 0 ? legPhase : legPhase * 0.5
          const rightW = -legPhase > 0 ? -legPhase : -legPhase * 0.5
          if (c.leftLeg) c.leftLeg.rotation.x = leftW * LEG_SWING
          if (c.rightLeg) c.rightLeg.rotation.x = -rightW * LEG_SWING

          // Correct heading
          const targetRot = Math.atan2(dx, dz)
          let dAngle = targetRot - c.rotY
          if (dAngle > Math.PI) dAngle -= 2 * Math.PI
          if (dAngle < -Math.PI) dAngle += 2 * Math.PI
          c.rotY += dAngle * Math.min(1, 3 * delta)
        }
      }

      // Ease legs back to neutral when not walking
      if (easeLegs) {
        if (c.leftLeg) c.leftLeg.rotation.x += (0 - c.leftLeg.rotation.x) * 6 * delta
        if (c.rightLeg) c.rightLeg.rotation.x += (0 - c.rightLeg.rotation.x) * 6 * delta
      }

      // Push out of obstacles (chicken coop, barn, windmill, etc.)
      const resolved = resolveCollision(c.x, c.z, 0.5)
      c.x = resolved.x
      c.z = resolved.z

      // Apply transforms
      const groundY = getTerrainHeight(c.x, c.z)
      c.group.position.set(c.x, groundY + Y_OFFSET + c.yOffset, c.z)
      c.group.rotation.y = c.rotY

      if (c.bodyGroup) {
        c.bodyGroup.rotation.x = c.tiltX
        c.bodyGroup.rotation.z = c.tiltZ
        // Head bob shifts the body forward along its facing direction
        c.bodyGroup.position.z = c.headBob
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
        const vol = 0.4 * (1 - closestDist / HEAR_DIST)
        cluckAudio.volume = Math.max(0.05, vol)
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
      oncreate={(ref) => { c.group = ref }}
    >
      <T.Group oncreate={(ref) => { c.bodyGroup = ref }}>
        <T
          is={scene}
          scale={SCALE}
          rotation.y={0}
          oncreate={() => setupChicken(c, scene)}
        />
      </T.Group>
    </T.Group>
  {/each}
{/await}
