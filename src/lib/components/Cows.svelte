<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos, stunPlayer } from '../utils/playerPosition.js'
  import { loadModel } from '../utils/modelLoader.js'
  import { isMuted } from '../stores/sound.svelte.js'

  const gltf = loadModel('/Cow.gltf')

  // Cow sounds — each cow gets its own Audio with random moo intervals
  const COW_HEAR_DIST = 30
  const cowAudios = []
  for (let i = 0; i < 4; i++) {
    const audio = new Audio('/sounds/cow.mp3')
    audio.volume = 0
    cowAudios.push(audio)
  }

  const COW_COUNT = 4
  const WALK_SPEED = 1.5
  const GROUP_CENTER = { x: 30, z: -25 }
  const WANDER_RADIUS = 15
  const MIN_SEPARATION = 5

  let seed = 42
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  let groupRef
  let cows = []

  function pickTarget(cow) {
    const angle = rand() * Math.PI * 2
    const dist = rand() * WANDER_RADIUS
    cow.targetX = GROUP_CENTER.x + Math.cos(angle) * dist
    cow.targetZ = GROUP_CENTER.z + Math.sin(angle) * dist
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
      mooTimer: 5 + rand() * 15,
    }
    pickTarget(cow)
    return cow
  }

  for (let i = 0; i < COW_COUNT; i++) {
    cows.push(initCow(i))
  }

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
        const dx = cow.targetX - cow.x
        const dz = cow.targetZ - cow.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist < 0.5) {
          cow.state = 'idle'
          cow.timer = 4 + rand() * 8
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

      // Detect player lingering near this cow
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
            // Turn toward the player before kicking
            cow.rotY = Math.atan2(-(px), -(pz))
            playAction(cow, 'Attack_Kick')
            cow.behindTimer = 0
          }
        } else {
          cow.behindTimer = Math.max(0, cow.behindTimer - delta)
        }
      }

      // Kicking state: delay stun until kick connects
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
</script>

{#await gltf then value}
  {#each cows as cow, i}
    {@const scene = cloneSkeleton(value.scene)}
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
          oncreate={() => setupCow(cow, value, scene)}
        />
      </T.Group>
    </T.Group>
  {/each}
{/await}
