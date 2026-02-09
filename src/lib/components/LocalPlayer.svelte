<script>
  import { T, useTask } from '@threlte/core'
  import { RigidBody, Collider } from '@threlte/rapier'
  import * as THREE from 'three'
  import { resolveCollision } from '../utils/obstacles.js'
  import { sendState } from '../network.js'
  import { animToShort } from '../stores/players.svelte.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getSelectedCharacter } from '../stores/character.svelte.js'
  import { touchInput } from '../stores/input.js'
  import { loadModel } from '../utils/modelLoader.js'
  import { getFarmerChat } from '../stores/farmerChat.svelte.js'

  let { onready } = $props()

  const selectedChar = $derived(getSelectedCharacter())

  // Cinematic camera mode (add ?cinematic to URL to use)
  const cinematic = new URLSearchParams(window.location.search).has('cinematic')
  const cinematicPos = new THREE.Vector3(10, 30, 70)
  const cinematicLook = new THREE.Vector3(30, 5, -15)

  // Animation
  let mixer = null
  let actions = {}
  let currentAction = null

  function setupAnimations(gltfData) {
    mixer = new THREE.AnimationMixer(gltfData.scene)
    actions = {}
    for (const clip of gltfData.animations) {
      actions[clip.name] = mixer.clipAction(clip)
    }
    currentAction = null
    playAction('Idle')
    onready?.()
  }

  function playAction(name) {
    if (currentAction === name) return
    const prev = actions[currentAction]
    const next = actions[name]
    if (!next) return

    next.reset().play()
    if (prev) {
      prev.crossFadeTo(next, 0.3, true)
    }
    currentAction = name
  }

  // Camera (smooth third-person)
  const idealOffset = new THREE.Vector3(0, 3, -6)
  const idealLookat = new THREE.Vector3(0, 2, 6)
  // Initialize camera to starting player position to avoid lerp-from-origin
  const _initQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
  const currentPosition = new THREE.Vector3().copy(idealOffset).applyQuaternion(_initQuat).add(new THREE.Vector3(55, 0, -40))
  const currentLookat = new THREE.Vector3().copy(idealLookat).applyQuaternion(_initQuat).add(new THREE.Vector3(55, 0, -40))

  // Reusable vectors (avoid GC pressure)
  const _dir = new THREE.Vector3()
  const _up = new THREE.Vector3(0, 1, 0)
  const _playerPos = new THREE.Vector3()
  const _offset = new THREE.Vector3()
  const _lookat = new THREE.Vector3()

  // Movement
  const speed = 10
  const rotSpeed = 3
  const jumpForce = 8
  const gravity = 20
  const keys = {}
  const playerQuat = new THREE.Quaternion()
  let rotation = $state(Math.PI)
  let rigidBody
  let isGrounded = true
  let landingTimer = 0
  let playerX = 55
  let playerY = 0
  let playerZ = -40
  let velocityY = 0

  function onKeyDown(e) {
    if (getFarmerChat().open) return
    keys[e.code] = true
    if (e.code === 'Space' && isGrounded) {
      velocityY = jumpForce
      isGrounded = false
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false
    if (e.code === 'Space' && !isGrounded && velocityY > 0) {
      velocityY *= 0.4
    }
  }

  let camera

  useTask((delta) => {
    if (!rigidBody) return

    if (mixer) mixer.update(delta)

    // Handle stun (cow kick): 3s on ground + 1.5s getting up
    if (localPlayerPos.stunTimer > 0) {
      localPlayerPos.stunTimer -= delta
      if (localPlayerPos.stunTimer > 1.5) {
        // Falling / on the ground
        if (currentAction !== 'Death') {
          const deathAction = actions['Death']
          if (deathAction) {
            deathAction.loop = THREE.LoopOnce
            deathAction.clampWhenFinished = true
          }
          playAction('Death')
        }
      } else if (localPlayerPos.stunTimer > 0) {
        // Getting up slowly
        if (currentAction !== 'Jump_ToIdle') {
          const getUpAction = actions['Jump_ToIdle']
          if (getUpAction) {
            getUpAction.loop = THREE.LoopOnce
            getUpAction.clampWhenFinished = true
          }
          const prev = actions['Death']
          const next = actions['Jump_ToIdle']
          if (next) {
            next.reset().play()
            if (prev) prev.crossFadeTo(next, 0.8, true)
            currentAction = 'Jump_ToIdle'
          }
        }
      } else {
        localPlayerPos.stunTimer = 0
        playAction('Idle')
      }
      // Still update camera and network while stunned, but skip movement
      playerQuat.setFromAxisAngle(_up, rotation)
      if (camera) {
        _playerPos.set(playerX, playerY, playerZ)
        _offset.copy(idealOffset).applyQuaternion(playerQuat).add(_playerPos)
        _lookat.copy(idealLookat).applyQuaternion(playerQuat).add(_playerPos)
        const t = 1.0 - Math.pow(0.01, delta)
        currentPosition.lerp(_offset, t)
        currentLookat.lerp(_lookat, t)
        camera.position.copy(currentPosition)
        camera.lookAt(currentLookat)
      }
      sendState({
        x: Math.round(playerX * 100) / 100,
        y: Math.round(playerY * 100) / 100,
        z: Math.round(playerZ * 100) / 100,
        ry: Math.round(rotation * 1000) / 1000,
        anim: animToShort(currentAction),
        grounded: isGrounded,
        char: selectedChar.id,
      })
      return
    }

    // Touch jump edge detection
    if (touchInput.jump && !touchInput._prevJump && isGrounded) {
      velocityY = jumpForce
      isGrounded = false
    }
    if (!touchInput.jump && touchInput._prevJump && !isGrounded && velocityY > 0) {
      velocityY *= 0.4
    }
    touchInput._prevJump = touchInput.jump

    if (keys['KeyA'] || keys['ArrowLeft']) rotation += rotSpeed * delta
    else if (touchInput.left) rotation += rotSpeed * touchInput.leftAmount * delta
    if (keys['KeyD'] || keys['ArrowRight']) rotation -= rotSpeed * delta
    else if (touchInput.right) rotation -= rotSpeed * touchInput.rightAmount * delta

    _dir.set(0, 0, 0)
    let touchMoveScale = 1
    if (keys['KeyW'] || keys['ArrowUp']) _dir.z += 1
    else if (touchInput.forward) { _dir.z += 1; touchMoveScale = touchInput.forwardAmount }
    if (keys['KeyS'] || keys['ArrowDown']) _dir.z -= 1
    else if (touchInput.backward) { _dir.z -= 1; touchMoveScale = touchInput.backwardAmount }

    const isMoving = _dir.lengthSq() > 0
    const isSprinting = keys['ShiftLeft'] || keys['ShiftRight'] || touchInput.sprint
    const currentSpeed = isMoving ? (isSprinting ? speed * 2 : speed) * touchMoveScale : 0

    if (isMoving) {
      _dir.normalize()
      _dir.applyAxisAngle(_up, rotation)
    }

    // Move horizontally
    playerX += _dir.x * currentSpeed * delta
    playerZ += _dir.z * currentSpeed * delta

    // Resolve collisions with environment obstacles
    const resolved = resolveCollision(playerX, playerZ, 0.4)
    playerX = resolved.x
    playerZ = resolved.z

    // Clamp to fence perimeter
    const FENCE_LIMIT = 178
    playerX = Math.max(-FENCE_LIMIT, Math.min(FENCE_LIMIT, playerX))
    playerZ = Math.max(-FENCE_LIMIT, Math.min(FENCE_LIMIT, playerZ))

    // Get terrain height at current position
    const groundY = getTerrainHeight(playerX, playerZ) + 1.5

    if (isGrounded) {
      playerY = groundY
    } else {
      velocityY -= gravity * delta
      playerY += velocityY * delta

      // Land when falling and at or below ground
      if (velocityY <= 0 && playerY <= groundY) {
        playerY = groundY
        velocityY = 0
        isGrounded = true
        landingTimer = 0.35
      }
    }

    // Share position with grass shader
    localPlayerPos.x = playerX
    localPlayerPos.y = playerY
    localPlayerPos.z = playerZ
    localPlayerPos.grounded = isGrounded

    // Update rigid body position (for network/rendering only)
    rigidBody.setTranslation({ x: playerX, y: playerY, z: playerZ }, true)
    rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)

    if (landingTimer > 0) {
      landingTimer -= delta
      if (!isMoving) landingTimer = 0
    } else if (!isGrounded) {
      playAction('Gallop_Jump')
    } else if (isMoving) {
      playAction(isSprinting ? 'Gallop' : 'Walk')
    } else {
      playAction('Idle')
    }

    // Camera
    playerQuat.setFromAxisAngle(_up, rotation)
    if (camera) {
      if (cinematic) {
        camera.position.copy(cinematicPos)
        camera.lookAt(cinematicLook)
      } else {
        _playerPos.set(playerX, playerY, playerZ)
        _offset.copy(idealOffset).applyQuaternion(playerQuat).add(_playerPos)
        _lookat.copy(idealLookat).applyQuaternion(playerQuat).add(_playerPos)
        const t = 1.0 - Math.pow(0.01, delta)
        currentPosition.lerp(_offset, t)
        currentLookat.lerp(_lookat, t)
        camera.position.copy(currentPosition)
        camera.lookAt(currentLookat)
      }
    }

    // Send state to network (throttled internally by network.js)
    sendState({
      x: Math.round(playerX * 100) / 100,
      y: Math.round(playerY * 100) / 100,
      z: Math.round(playerZ * 100) / 100,
      ry: Math.round(rotation * 1000) / 1000,
      anim: animToShort(currentAction),
      grounded: isGrounded,
      char: selectedChar.id,
    })
  })
</script>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />

<T.PerspectiveCamera
  makeDefault
  fov={50}
  near={0.3}
  far={2000}
  bind:ref={camera}
/>

<T.Group visible={!cinematic}>
  <RigidBody
    type="kinematicPosition"
    bind:rigidBody
  >
    <Collider shape="capsule" args={[1.0, 0.5]} friction={0} restitution={0} />

    <T.Group rotation.y={rotation}>
      {#key selectedChar.id}
        {#await loadModel(selectedChar.model) then value}
          <T
            is={value.scene}
            scale={1}
            position.y={-1.5}
            oncreate={() => setupAnimations(value)}
          />
        {/await}
      {/key}
    </T.Group>
  </RigidBody>
</T.Group>
