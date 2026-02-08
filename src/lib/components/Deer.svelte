<script>
  import { T, useTask } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import * as THREE from 'three'
  import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getRemotePlayers } from '../stores/players.svelte.js'
  import { POND_CENTER, POND_RADIUS } from '../utils/pond.js'

  const gltf = useGltf('/Deer.gltf')
  const remotePlayers = $derived(getRemotePlayers())

  const DEER_COUNT = 5
  const WALK_SPEED = 2.0
  const RUN_SPEED = 14
  const FIELD_LIMIT = 160
  const WANDER_RADIUS = 120
  const MIN_SEPARATION = 3
  const FLEE_DIST = 12
  const SAFE_DIST = 25
  const GROUP_COHESION = 0.02

  let seed = 137
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  let deer = []

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

  function pickTarget(d) {
    const angle = rand() * Math.PI * 2
    const dist = 20 + rand() * WANDER_RADIUS
    const pos = clampToField(Math.cos(angle) * dist, Math.sin(angle) * dist)
    d.targetX = pos.x
    d.targetZ = pos.z
  }

  function initDeer(index) {
    const angle = rand() * Math.PI * 2
    const dist = 30 + rand() * 80
    let x = Math.cos(angle) * dist
    let z = Math.sin(angle) * dist
    const clamped = clampToField(x, z)
    x = clamped.x
    z = clamped.z
    const d = {
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
    }
    pickTarget(d)
    return d
  }

  for (let i = 0; i < DEER_COUNT; i++) {
    deer.push(initDeer(i))
  }

  function playAction(d, name) {
    if (d.currentAction === name) return
    const prev = d.actions[d.currentAction]
    const next = d.actions[name]
    if (!next) return
    next.reset().play()
    if (prev) prev.crossFadeTo(next, 0.3, true)
    d.currentAction = name
  }

  function setupDeer(d, gltfData, scene) {
    d.mixer = new THREE.AnimationMixer(scene)
    for (const clip of gltfData.animations) {
      d.actions[clip.name] = d.mixer.clipAction(clip)
    }
    playAction(d, 'Idle')
  }

  function getClosestPlayerDist(d) {
    let minDist = Infinity
    let closestX = 0
    let closestZ = 0

    // Check local player
    const lx = localPlayerPos.x - d.x
    const lz = localPlayerPos.z - d.z
    const ld = Math.sqrt(lx * lx + lz * lz)
    if (ld < minDist) {
      minDist = ld
      closestX = localPlayerPos.x
      closestZ = localPlayerPos.z
    }

    // Check remote players
    for (const [, rp] of remotePlayers) {
      const rx = rp.curr.x - d.x
      const rz = rp.curr.z - d.z
      const rd = Math.sqrt(rx * rx + rz * rz)
      if (rd < minDist) {
        minDist = rd
        closestX = rp.curr.x
        closestZ = rp.curr.z
      }
    }

    return { dist: minDist, px: closestX, pz: closestZ }
  }

  // Group center for cohesion
  function getHerdCenter() {
    let cx = 0, cz = 0
    for (const d of deer) {
      cx += d.x
      cz += d.z
    }
    return { x: cx / deer.length, z: cz / deer.length }
  }

  useTask((delta) => {
    const herd = getHerdCenter()

    for (const d of deer) {
      if (!d.mixer) continue
      d.mixer.update(delta)

      const player = getClosestPlayerDist(d)

      // Flee if a player is close
      if (player.dist < FLEE_DIST) {
        if (d.state !== 'fleeing') {
          d.state = 'fleeing'
          playAction(d, 'Gallop')
        }

        // Run directly away from the closest player
        const awayX = d.x - player.px
        const awayZ = d.z - player.pz
        const awayDist = Math.sqrt(awayX * awayX + awayZ * awayZ)
        if (awayDist > 0.01) {
          const nx = awayX / awayDist
          const nz = awayZ / awayDist
          // Add slight random jitter so they scatter
          const jx = nx + (rand() - 0.5) * 0.3
          const jz = nz + (rand() - 0.5) * 0.3

          d.x += jx * RUN_SPEED * delta
          d.z += jz * RUN_SPEED * delta

          const targetRotY = Math.atan2(jx, jz)
          let dAngle = targetRotY - d.rotY
          if (dAngle > Math.PI) dAngle -= 2 * Math.PI
          if (dAngle < -Math.PI) dAngle += 2 * Math.PI
          d.rotY += dAngle * Math.min(1, 8 * delta)
        }

        const clamped = clampToField(d.x, d.z)
        d.x = clamped.x
        d.z = clamped.z
      }
      // Transition out of fleeing when safe
      else if (d.state === 'fleeing') {
        if (player.dist > SAFE_DIST) {
          d.state = 'idle'
          d.timer = 1 + rand() * 3
          playAction(d, 'Idle')
        } else {
          // Keep running until safe distance
          const awayX = d.x - player.px
          const awayZ = d.z - player.pz
          const awayDist = Math.sqrt(awayX * awayX + awayZ * awayZ)
          if (awayDist > 0.01) {
            const nx = awayX / awayDist
            const nz = awayZ / awayDist
            d.x += nx * RUN_SPEED * delta
            d.z += nz * RUN_SPEED * delta

            const targetRotY = Math.atan2(nx, nz)
            let dAngle = targetRotY - d.rotY
            if (dAngle > Math.PI) dAngle -= 2 * Math.PI
            if (dAngle < -Math.PI) dAngle += 2 * Math.PI
            d.rotY += dAngle * Math.min(1, 8 * delta)
          }
          const clamped = clampToField(d.x, d.z)
          d.x = clamped.x
          d.z = clamped.z
        }
      }
      // Normal behavior
      else {
        d.timer -= delta

        if (d.state === 'idle') {
          if (d.timer <= 0) {
            const r = rand()
            if (r < 0.3) {
              d.state = 'eating'
              d.timer = 4 + rand() * 6
              playAction(d, 'Eating')
            } else if (r < 0.5) {
              playAction(d, rand() < 0.5 ? 'Idle_2' : 'Idle_Headlow')
              d.timer = 3 + rand() * 4
            } else {
              d.state = 'walking'
              pickTarget(d)
              playAction(d, 'Walk')
            }
          }
        } else if (d.state === 'eating') {
          if (d.timer <= 0) {
            d.state = 'idle'
            d.timer = 3 + rand() * 5
            playAction(d, 'Idle')
          }
        } else if (d.state === 'walking') {
          const dx = d.targetX - d.x
          const dz = d.targetZ - d.z
          const dist = Math.sqrt(dx * dx + dz * dz)

          if (dist < 1) {
            d.state = 'idle'
            d.timer = 4 + rand() * 8
            playAction(d, 'Idle')
          } else {
            const targetRotY = Math.atan2(dx, dz)
            let dAngle = targetRotY - d.rotY
            if (dAngle > Math.PI) dAngle -= 2 * Math.PI
            if (dAngle < -Math.PI) dAngle += 2 * Math.PI
            d.rotY += dAngle * Math.min(1, 3 * delta)

            d.x += (dx / dist) * WALK_SPEED * delta
            d.z += (dz / dist) * WALK_SPEED * delta
          }
        }

        // Gentle pull toward herd center (cohesion)
        d.x += (herd.x - d.x) * GROUP_COHESION * delta
        d.z += (herd.z - d.z) * GROUP_COHESION * delta
      }

      // Soft separation from other deer
      for (const other of deer) {
        if (other === d) continue
        const sx = d.x - other.x
        const sz = d.z - other.z
        const sd = Math.sqrt(sx * sx + sz * sz)
        if (sd < MIN_SEPARATION && sd > 0.01) {
          const push = (MIN_SEPARATION - sd) * 0.5 * delta
          d.x += (sx / sd) * push
          d.z += (sz / sd) * push
        }
      }

      // Update Three.js positions
      if (d.group) {
        const y = getTerrainHeight(d.x, d.z)
        d.group.position.set(d.x, y, d.z)
      }
      if (d.innerGroup) {
        d.innerGroup.rotation.y = d.rotY
      }
    }
  })
</script>

{#await gltf then value}
  {#each deer as d, i}
    {@const scene = cloneSkeleton(value.scene)}
    <T.Group
      position.x={d.x}
      position.y={getTerrainHeight(d.x, d.z)}
      position.z={d.z}
      oncreate={(ref) => { d.group = ref }}
    >
      <T.Group
        rotation.y={d.rotY}
        oncreate={(ref) => { d.innerGroup = ref }}
      >
        <T
          is={scene}
          scale={1}
          oncreate={() => setupDeer(d, value, scene)}
        />
      </T.Group>
    </T.Group>
  {/each}
{/await}
