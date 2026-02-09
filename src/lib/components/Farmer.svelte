<script>
  import { T, useTask } from '@threlte/core'
  import { HTML } from '@threlte/extras'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { setNearFarmer, openChat, getFarmerChat } from '../stores/farmerChat.svelte.js'
  import { farmerSync } from '../stores/farmerSync.js'
  import { sendFarmerState } from '../network.js'
  import { loadModel } from '../utils/modelLoader.js'

  const gltf = loadModel('/Farmer.glb')

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
  let hasGreeted = false
  let greetTimer = 0

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

    // --- Speech bubble typing logic (all clients) ---
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

    // --- Distance to local player (all clients, for chat UI) ---
    const dx = localPlayerPos.x - farmer.x
    const dz = localPlayerPos.z - farmer.z
    const playerDist = Math.sqrt(dx * dx + dz * dz)

    if (playerDist < INTERACT_DIST) {
      if (!chat.nearFarmer) setNearFarmer(true)
    } else {
      if (chat.nearFarmer) setNearFarmer(false)
      hasGreeted = false
      greetTimer = 0
    }

    // --- Host: run farmer AI and broadcast state ---
    if (farmerSync.isHost) {
      if (playerDist < INTERACT_DIST) {
        // Face the player
        const targetRotY = Math.atan2(dx, dz)
        let dAngle = targetRotY - farmer.rotY
        if (dAngle > Math.PI) dAngle -= 2 * Math.PI
        if (dAngle < -Math.PI) dAngle += 2 * Math.PI
        farmer.rotY += dAngle * Math.min(1, 5 * delta)

        if (farmer.state === 'walking') {
          farmer.state = 'idle'
          farmer.timer = 2
        }

        if (chat.open) {
          playAction('CharacterArmature|Idle')
        } else if (!hasGreeted) {
          playAction('CharacterArmature|Wave')
          greetTimer += delta
          if (greetTimer >= 1.5) {
            hasGreeted = true
          }
        } else {
          playAction('CharacterArmature|Idle')
        }
      } else {
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

      // Broadcast farmer state to other clients
      sendFarmerState({
        x: Math.round(farmer.x * 100) / 100,
        z: Math.round(farmer.z * 100) / 100,
        ry: Math.round(farmer.rotY * 1000) / 1000,
        anim: farmer.currentAction,
      })
    }
    // --- Non-host: interpolate from remote state ---
    else if (farmerSync.remote) {
      const t = 1 - Math.exp(-10 * delta)
      farmer.x += (farmerSync.remote.x - farmer.x) * t
      farmer.z += (farmerSync.remote.z - farmer.z) * t

      let dAngle = farmerSync.remote.ry - farmer.rotY
      if (dAngle > Math.PI) dAngle -= 2 * Math.PI
      if (dAngle < -Math.PI) dAngle += 2 * Math.PI
      farmer.rotY += dAngle * t

      playAction(farmerSync.remote.anim)
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
          <svg class="bubble-border" viewBox="0 0 400 120" preserveAspectRatio="none">
            <!-- Brush-painted bubble shape -->
            <path d="M12 12 Q20 5 80 8 Q160 3 200 6 Q280 3 340 8 Q380 5 388 12 Q394 30 392 55 Q394 80 388 95 Q380 102 340 99 Q280 104 220 100 L200 118 L185 100 Q120 104 60 99 Q20 102 12 95 Q6 80 8 55 Q6 30 12 12Z"
              stroke="rgba(120,90,40,0.4)" stroke-width="2" fill="rgba(255,250,235,0.95)" stroke-linejoin="round" stroke-linecap="round"/>
            <!-- Subtle highlight strokes -->
            <path d="M20 14 Q100 7 200 10 Q300 7 380 14"
              stroke="rgba(120,90,40,0.15)" stroke-width="1.2" fill="none" stroke-linecap="round"/>
          </svg>
          <p>{displayedText}</p>
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
    position: relative;
    max-width: 500px;
    min-width: 300px;
    pointer-events: none;
    user-select: none;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25));
  }
  :global(.farmer-bubble .bubble-border) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  :global(.farmer-bubble p) {
    margin: 0;
    position: relative;
    z-index: 1;
    padding: 14px 20px 22px;
    font-family: "permanent-marker", sans-serif;
    font-size: 14px;
    color: #3a2a10;
    line-height: 1.4;
    text-align: left;
    white-space: pre-wrap;
    word-wrap: break-word;
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
