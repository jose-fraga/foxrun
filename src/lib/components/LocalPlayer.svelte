<script>
  import { T, useTask } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import { RigidBody, Collider } from '@threlte/rapier'
  import * as THREE from 'three'
  import { resolveCollision } from '../utils/obstacles.js'
  import { sendState } from '../network.js'
  import { animToShort } from '../stores/players.svelte.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'

  const gltf = useGltf('/Fox.gltf')

  // Animation
  let mixer = null
  let actions = {}
  let currentAction = null

  function setupAnimations(gltfData) {
    mixer = new THREE.AnimationMixer(gltfData.scene)
    for (const clip of gltfData.animations) {
      actions[clip.name] = mixer.clipAction(clip)
    }
    playAction('Idle')
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
  const currentPosition = new THREE.Vector3()
  const currentLookat = new THREE.Vector3()

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
  let rotation = 0
  let rigidBody
  let isGrounded = true
  let landingTimer = 0
  let playerX = 0
  let playerY = 0
  let playerZ = 0
  let velocityY = 0

  function onKeyDown(e) {
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

    if (keys['KeyA'] || keys['ArrowLeft']) rotation += rotSpeed * delta
    if (keys['KeyD'] || keys['ArrowRight']) rotation -= rotSpeed * delta

    _dir.set(0, 0, 0)
    if (keys['KeyW'] || keys['ArrowUp']) _dir.z += 1
    if (keys['KeyS'] || keys['ArrowDown']) _dir.z -= 1

    const isMoving = _dir.lengthSq() > 0
    const isSprinting = keys['ShiftLeft'] || keys['ShiftRight']
    const currentSpeed = isMoving ? (isSprinting ? speed * 2 : speed) : 0

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
      _playerPos.set(playerX, playerY, playerZ)
      _offset.copy(idealOffset).applyQuaternion(playerQuat).add(_playerPos)
      _lookat.copy(idealLookat).applyQuaternion(playerQuat).add(_playerPos)
      const t = 1.0 - Math.pow(0.01, delta)
      currentPosition.lerp(_offset, t)
      currentLookat.lerp(_lookat, t)
      camera.position.copy(currentPosition)
      camera.lookAt(currentLookat)
    }

    // Send state to network (throttled internally by network.js)
    sendState({
      x: Math.round(playerX * 100) / 100,
      y: Math.round(playerY * 100) / 100,
      z: Math.round(playerZ * 100) / 100,
      ry: Math.round(rotation * 1000) / 1000,
      anim: animToShort(currentAction),
      grounded: isGrounded,
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

<T.Group>
  <RigidBody
    type="kinematicPosition"
    bind:rigidBody
  >
    <Collider shape="capsule" args={[1.0, 0.5]} friction={0} restitution={0} />

    <T.Group rotation.y={rotation}>
      {#await gltf then value}
        <T
          is={value.scene}
          scale={1}
          position.y={-1.5}
          oncreate={() => setupAnimations(value)}
        />
      {/await}
    </T.Group>
  </RigidBody>
</T.Group>
