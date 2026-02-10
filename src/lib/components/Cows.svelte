<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos, stunPlayer } from '../utils/playerPosition.js'
  import { loadModel } from '../utils/modelLoader.js'
  import { resolveCollision, isInBarnZone } from '../utils/obstacles.js'
  import { POND_CENTER, POND_RADIUS } from '../utils/pond.js'
  import { isMuted } from '../stores/sound.svelte.js'

  const cowGltf = loadModel('/Cow.gltf')
  const bullGltf = loadModel('/Bull.glb')

  // Cow sounds — each cow/bull gets its own Audio with random moo intervals
  const COW_HEAR_DIST = 30
  const cowAudios = []
  for (let i = 0; i < 4; i++) {
    const audio = new Audio('/sounds/cow.mp3')
    audio.volume = 0
    cowAudios.push(audio)
  }

  const COW_COUNT = 3 // 3 cows + 1 bull = 4 total
  const BULL_CHARGE_DIST = 18 // bull notices player within this range
  const BULL_HEADBUTT_DIST = 3 // bull headbutts when this close
  const BULL_RETURN_DIST = 35 // bull gives up chase beyond this from group
  const BULL_CHARGE_SPEED = 10
  const WALK_SPEED = 1.5
  const GROUP_CENTER = { x: -110, z: -90 }
  const WANDER_RADIUS = 45
  const MIN_SEPARATION = 8

  let seed = 42
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  let groupRef
  let cows = []

  function pickTarget(cow) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = rand() * Math.PI * 2
      const dist = rand() * WANDER_RADIUS
      const tx = GROUP_CENTER.x + Math.cos(angle) * dist
      const tz = GROUP_CENTER.z + Math.sin(angle) * dist
      const pdx = tx - POND_CENTER[0]
      const pdz = tz - POND_CENTER[1]
      const inPond = Math.sqrt(pdx * pdx + pdz * pdz) < POND_RADIUS + 3
      if (!isInBarnZone(tx, tz) && !inPond) {
        cow.targetX = tx
        cow.targetZ = tz
        return
      }
    }
    cow.targetX = GROUP_CENTER.x
    cow.targetZ = GROUP_CENTER.z
  }

  function initCow(index) {
    const angle = (index / COW_COUNT) * Math.PI * 2 + rand() * 0.5
    const dist = MIN_SEPARATION + rand() * 3
    const x = GROUP_CENTER.x + Math.cos(angle) * dist
    const z = GROUP_CENTER.z + Math.sin(angle) * dist
    const cow = {
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
      behindTimer: 0,
      kickDelay: 0,
      walkTime: 0,
      mooTimer: 5 + rand() * 15,
    }
    pickTarget(cow)
    return cow
  }

  for (let i = 0; i < COW_COUNT; i++) {
    cows.push(initCow(i))
  }

  // Add the bull — same init but flagged
  const bull = initCow(COW_COUNT)
  bull.isBull = true
  bull.headbuttDelay = 0
  cows.push(bull)

  function playAction(cow, name) {
    if (cow.currentAction === name) return
    const prev = cow.actions[cow.currentAction]
    const next = cow.actions[name]
    if (!next) return
    next.reset().play()
    if (prev) prev.crossFadeTo(next, 0.4, true)
    cow.currentAction = name
  }

  function setupCow(cow, gltfData, scene) {
    cow.mixer = new THREE.AnimationMixer(scene)
    for (const clip of gltfData.animations) {
      cow.actions[clip.name] = cow.mixer.clipAction(clip)
    }
    playAction(cow, 'Idle')
  }

  useTask((delta) => {
    for (let i = 0; i < cows.length; i++) {
      const cow = cows[i]
      if (!cow.mixer) continue
      cow.mixer.update(delta)
      cow.timer -= delta

      // Skip normal state machine during bull-specific states
      const inBullState = cow.state === 'charging' || cow.state === 'headbutting' || cow.state === 'returning'
      if (!inBullState) {
        if (cow.state === 'idle') {
          if (cow.timer <= 0) {
            const r = rand()
            if (r < 0.4) {
              cow.state = 'eating'
              cow.timer = 4 + rand() * 6
              playAction(cow, 'Eating')
            } else if (r < 0.7) {
              playAction(cow, rand() < 0.5 ? 'Idle_2' : 'Idle_Headlow')
              cow.timer = 3 + rand() * 4
            } else {
              cow.state = 'walking'
              pickTarget(cow)
              playAction(cow, 'Walk')
            }
          }
        } else if (cow.state === 'eating') {
          if (cow.timer <= 0) {
            cow.state = 'idle'
            cow.timer = 3 + rand() * 5
            playAction(cow, 'Idle')
          }
        } else if (cow.state === 'walking') {
          cow.walkTime += delta
          const dx = cow.targetX - cow.x
          const dz = cow.targetZ - cow.z
          const dist = Math.sqrt(dx * dx + dz * dz)

          if (dist < 0.5 || cow.walkTime > 12) {
            cow.state = 'idle'
            cow.timer = 4 + rand() * 8
            cow.walkTime = 0
            playAction(cow, 'Idle')
          } else {
            const targetRotY = Math.atan2(dx, dz)
            let dAngle = targetRotY - cow.rotY
            if (dAngle > Math.PI) dAngle -= 2 * Math.PI
            if (dAngle < -Math.PI) dAngle += 2 * Math.PI
            cow.rotY += dAngle * Math.min(1, 3 * delta)

            cow.x += (dx / dist) * WALK_SPEED * delta
            cow.z += (dz / dist) * WALK_SPEED * delta
          }
        }
      }

      // Soft separation from other cows
      for (const other of cows) {
        if (other === cow) continue
        const sx = cow.x - other.x
        const sz = cow.z - other.z
        const sd = Math.sqrt(sx * sx + sz * sz)
        if (sd < MIN_SEPARATION && sd > 0.01) {
          const push = (MIN_SEPARATION - sd) * 0.5 * delta
          cow.x += (sx / sd) * push
          cow.z += (sz / sd) * push
        }
      }

      // --- Bull charging behavior ---
      if (cow.isBull) {
        const px = localPlayerPos.x - cow.x
        const pz = localPlayerPos.z - cow.z
        const playerDist = Math.sqrt(px * px + pz * pz)

        // Distance from group center (to know when to give up)
        const gx = cow.x - GROUP_CENTER.x
        const gz = cow.z - GROUP_CENTER.z
        const groupDist = Math.sqrt(gx * gx + gz * gz)

        if (cow.state === 'charging') {
          // Chase the player
          if (playerDist < BULL_HEADBUTT_DIST && localPlayerPos.stunTimer <= 0) {
            // Close enough — headbutt!
            cow.state = 'headbutting'
            cow.timer = 1.2
            cow.headbuttDelay = 0.4
            cow.rotY = Math.atan2(px, pz)
            playAction(cow, 'Attack_Headbutt')
          } else if (playerDist > BULL_CHARGE_DIST + 5 || groupDist > BULL_RETURN_DIST) {
            // Player ran away or bull is too far from group — return
            cow.state = 'returning'
            cow.targetX = GROUP_CENTER.x
            cow.targetZ = GROUP_CENTER.z
            playAction(cow, 'Walk')
          } else {
            // Keep charging toward player
            const nx = px / playerDist
            const nz = pz / playerDist
            cow.x += nx * BULL_CHARGE_SPEED * delta
            cow.z += nz * BULL_CHARGE_SPEED * delta

            const targetRotY = Math.atan2(px, pz)
            let dAngle = targetRotY - cow.rotY
            if (dAngle > Math.PI) dAngle -= 2 * Math.PI
            if (dAngle < -Math.PI) dAngle += 2 * Math.PI
            cow.rotY += dAngle * Math.min(1, 8 * delta)
          }
        } else if (cow.state === 'headbutting') {
          if (cow.headbuttDelay > 0) {
            cow.headbuttDelay -= delta
            if (cow.headbuttDelay <= 0) {
              stunPlayer(4.5)
            }
          }
          if (cow.timer <= 0) {
            cow.state = 'idle'
            cow.timer = 3 + rand() * 3
            playAction(cow, 'Idle')
          }
        } else if (cow.state === 'returning') {
          const dx = cow.targetX - cow.x
          const dz = cow.targetZ - cow.z
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist < 2) {
            cow.state = 'idle'
            cow.timer = 2 + rand() * 4
            playAction(cow, 'Idle')
          } else {
            const targetRotY = Math.atan2(dx, dz)
            let dAngle = targetRotY - cow.rotY
            if (dAngle > Math.PI) dAngle -= 2 * Math.PI
            if (dAngle < -Math.PI) dAngle += 2 * Math.PI
            cow.rotY += dAngle * Math.min(1, 3 * delta)
            cow.x += (dx / dist) * WALK_SPEED * 2 * delta
            cow.z += (dz / dist) * WALK_SPEED * 2 * delta
          }
        } else if (cow.state !== 'headbutting') {
          // Idle/walking/eating — check if player is near the group
          if (playerDist < BULL_CHARGE_DIST && localPlayerPos.stunTimer <= 0) {
            cow.state = 'charging'
            playAction(cow, 'Gallop')
          }
        }
      }
      // --- Cow kicking behavior (cows only, not bull) ---
      else {
        if (cow.state !== 'kicking' && localPlayerPos.stunTimer <= 0) {
          const px = localPlayerPos.x - cow.x
          const pz = localPlayerPos.z - cow.z
          const playerDist = Math.sqrt(px * px + pz * pz)
          if (playerDist < 4) {
            cow.behindTimer += delta
            if (cow.behindTimer >= 1.5) {
              cow.state = 'kicking'
              cow.timer = 1.8
              cow.kickDelay = 0.6
              cow.rotY = Math.atan2(-(px), -(pz))
              playAction(cow, 'Attack_Kick')
              cow.behindTimer = 0
            }
          } else {
            cow.behindTimer = Math.max(0, cow.behindTimer - delta)
          }
        }

        if (cow.state === 'kicking') {
          if (cow.kickDelay > 0) {
            cow.kickDelay -= delta
            if (cow.kickDelay <= 0) {
              stunPlayer(4.5)
            }
          }
          if (cow.timer <= 0) {
            cow.state = 'idle'
            cow.timer = 3 + rand() * 5
            playAction(cow, 'Idle')
          }
        }
      }

      // Resolve barn collisions
      const resolved = resolveCollision(cow.x, cow.z, 1.5)
      cow.x = resolved.x
      cow.z = resolved.z

      // Update Three.js group positions directly
      if (cow.group) {
        const y = getTerrainHeight(cow.x, cow.z)
        cow.group.position.set(cow.x, y, cow.z)
      }
      if (cow.innerGroup) {
        cow.innerGroup.rotation.y = cow.rotY
      }

      // Cow moo sounds — play when near player, random intervals
      const cdx = localPlayerPos.x - cow.x
      const cdz = localPlayerPos.z - cow.z
      const cowDist = Math.sqrt(cdx * cdx + cdz * cdz)
      cow.mooTimer -= delta
      if (cow.mooTimer <= 0 && cowDist < COW_HEAR_DIST && !isMuted()) {
        const audio = cowAudios[i]
        audio.volume = Math.max(0, 0.25 * (1 - cowDist / COW_HEAR_DIST))
        audio.currentTime = 0
        audio.play().catch(() => {})
        cow.mooTimer = 20 + rand() * 40
      } else if (cow.mooTimer <= 0) {
        cow.mooTimer = 15 + rand() * 25
      }

    }
  })

  let modelsReady = $state(false)
  let cowModel = $state(null)
  let bullModel = $state(null)

  Promise.all([cowGltf, bullGltf]).then(([c, b]) => {
    cowModel = c
    bullModel = b
    modelsReady = true
  })
</script>

{#if modelsReady}
  {#each cows as cow, i}
    {@const gltfData = cow.isBull ? bullModel : cowModel}
    {@const scene = cloneSkeleton(gltfData.scene)}
    <T.Group
      position.x={cow.x}
      position.y={getTerrainHeight(cow.x, cow.z)}
      position.z={cow.z}
      oncreate={(ref) => { cow.group = ref }}
    >
      <T.Group
        rotation.y={cow.rotY}
        oncreate={(ref) => { cow.innerGroup = ref }}
      >
        <T
          is={scene}
          scale={1}
          oncreate={() => setupCow(cow, gltfData, scene)}
        />
      </T.Group>
    </T.Group>
  {/each}
{/if}
