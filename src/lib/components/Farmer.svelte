<script>
  import { T, useTask } from '@threlte/core'
  import { useGltf, HTML } from '@threlte/extras'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { setNearFarmer, openChat, getFarmerChat } from '../stores/farmerChat.svelte.js'

  const gltf = useGltf('/Farmer.glb')

  const WALK_SPEED = 5
  const WANDER_RADIUS = 25
  const HOME = { x: -10, z: 10 }
  const INTERACT_DIST = 6
  const SCALE = 3.5
  const CHARS_PER_SEC = 40

  let seed = 999
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  let farmer = {
    x: HOME.x,
    z: HOME.z,
    rotY: 0,
    state: 'idle',
    timer: 3,
    targetX: HOME.x,
    targetZ: HOME.z,
    mixer: null,
    actions: {},
    currentAction: null,
    group: null,
    innerGroup: null,
  }

  // Speech bubble typing state
  let typingText = ''
  let typingIndex = 0
  let displayedText = ''
  let showBubble = false
  let bubbleTimer = 0
  let lastMsgCount = 0
  let isThinking = false

  function pickTarget() {
    const angle = rand() * Math.PI * 2
    const dist = 5 + rand() * WANDER_RADIUS
    farmer.targetX = HOME.x + Math.cos(angle) * dist
    farmer.targetZ = HOME.z + Math.sin(angle) * dist
  }

  function playAction(name) {
    if (farmer.currentAction === name) return
    const prev = farmer.actions[farmer.currentAction]
    const next = farmer.actions[name]
    if (!next) return
    next.reset().play()
    if (prev) prev.crossFadeTo(next, 0.4, true)
    farmer.currentAction = name
  }

  function setupFarmer(gltfData, scene) {
    farmer.mixer = new THREE.AnimationMixer(scene)
    for (const clip of gltfData.animations) {
      farmer.actions[clip.name] = farmer.mixer.clipAction(clip)
    }
    playAction('CharacterArmature|Idle')
  }

  useTask((delta) => {
    if (!farmer.mixer) return
    farmer.mixer.update(delta)

    const chat = getFarmerChat()

    // --- Speech bubble typing logic ---
    if (chat.messages.length > lastMsgCount) {
      const last = chat.messages[chat.messages.length - 1]
      if (last.role === 'farmer') {
        typingText = last.text
        typingIndex = 0
        isThinking = false
        showBubble = true
        bubbleTimer = 8
      }
      lastMsgCount = chat.messages.length
    }

    if (typingText && typingIndex < typingText.length) {
      typingIndex = Math.min(typingText.length, typingIndex + CHARS_PER_SEC * delta)
      displayedText = typingText.slice(0, Math.floor(typingIndex))
      showBubble = true
      bubbleTimer = 8
    } else if (chat.loading) {
      showBubble = true
      isThinking = true
      displayedText = '...'
    } else if (showBubble && (!typingText || typingIndex >= typingText.length)) {
      isThinking = false
      bubbleTimer -= delta
      if (bubbleTimer <= 0) {
        showBubble = false
        displayedText = ''
        typingText = ''
      }
    }

    // --- Distance to player ---
    const dx = localPlayerPos.x - farmer.x
    const dz = localPlayerPos.z - farmer.z
    const playerDist = Math.sqrt(dx * dx + dz * dz)

    // Player proximity
    if (playerDist < INTERACT_DIST) {
      if (!chat.nearFarmer) {
        setNearFarmer(true)
      }

      // Face the player
      const targetRotY = Math.atan2(dx, dz)
      let dAngle = targetRotY - farmer.rotY
      if (dAngle > Math.PI) dAngle -= 2 * Math.PI
      if (dAngle < -Math.PI) dAngle += 2 * Math.PI
      farmer.rotY += dAngle * Math.min(1, 5 * delta)

      // Stop walking
      if (farmer.state === 'walking') {
        farmer.state = 'idle'
        farmer.timer = 2
      }

      if (chat.open) {
        playAction('CharacterArmature|Idle')
      } else {
        playAction('CharacterArmature|Wave')
      }
    } else {
      if (chat.nearFarmer) {
        setNearFarmer(false)
      }

      // Normal wandering behavior
      farmer.timer -= delta

      if (farmer.state === 'idle') {
        playAction('CharacterArmature|Idle')
        if (farmer.timer <= 0) {
          farmer.state = 'walking'
          pickTarget()
          playAction('CharacterArmature|Walk')
        }
      } else if (farmer.state === 'walking') {
        const tx = farmer.targetX - farmer.x
        const tz = farmer.targetZ - farmer.z
        const dist = Math.sqrt(tx * tx + tz * tz)

        if (dist < 0.5) {
          farmer.state = 'idle'
          farmer.timer = 4 + rand() * 8
          playAction('CharacterArmature|Idle')
        } else {
          const targetRotY = Math.atan2(tx, tz)
          let dAngle = targetRotY - farmer.rotY
          if (dAngle > Math.PI) dAngle -= 2 * Math.PI
          if (dAngle < -Math.PI) dAngle += 2 * Math.PI
          farmer.rotY += dAngle * Math.min(1, 3 * delta)

          farmer.x += (tx / dist) * WALK_SPEED * delta
          farmer.z += (tz / dist) * WALK_SPEED * delta
        }
      }
    }

    // Update Three.js positions
    if (farmer.group) {
      const y = getTerrainHeight(farmer.x, farmer.z)
      farmer.group.position.set(farmer.x, y, farmer.z)
    }
    if (farmer.innerGroup) {
      farmer.innerGroup.rotation.y = farmer.rotY
    }
  })
</script>

{#await gltf then value}
  <T.Group
    position.x={farmer.x}
    position.y={getTerrainHeight(farmer.x, farmer.z)}
    position.z={farmer.z}
    oncreate={(ref) => { farmer.group = ref }}
  >
    <!-- Speech bubble above head -->
    {#if showBubble && displayedText}
      <HTML position.y={7} center pointerEvents="none">
        <div class="farmer-bubble" class:thinking={isThinking}>
          <p>{displayedText}</p>
          <div class="farmer-bubble-tail"></div>
        </div>
      </HTML>
    {/if}

    <T.Group
      rotation.y={farmer.rotY}
      oncreate={(ref) => { farmer.innerGroup = ref }}
    >
      <T
        is={value.scene}
        scale={SCALE}
        oncreate={() => setupFarmer(value, value.scene)}
      />
    </T.Group>
  </T.Group>
{/await}

<style>
  :global(.farmer-bubble) {
    background: rgba(255, 250, 235, 0.95);
    border-radius: 14px;
    padding: 8px 14px;
    max-width: 500px;
    min-width: 300px;
    font-family: sans-serif;
    font-size: 14px;
    color: #3a2a10;
    line-height: 1.35;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    position: relative;
    text-align: left;
    white-space: pre-wrap;
    word-wrap: break-word;
    pointer-events: none;
    user-select: none;
  }
  :global(.farmer-bubble p) {
    margin: 0;
  }
  :global(.farmer-bubble-tail) {
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid rgba(255, 250, 235, 0.95);
  }
  :global(.farmer-bubble.thinking p) {
    animation: farmer-dots 1.2s ease-in-out infinite;
    font-size: 18px;
    text-align: center;
    letter-spacing: 3px;
  }
  @keyframes farmer-dots {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
</style>
