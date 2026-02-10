<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { dayNight } from '../stores/dayNight.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { isMuted } from '../stores/sound.svelte.js'

  // Bird ambient sound — plays low when flocks are passing by
  const birdAudio = new Audio('/sounds/birds.mp3')
  birdAudio.loop = true
  birdAudio.volume = 0
  let birdAudioPlaying = false
  const BIRD_HEAR_DIST = 200

  $effect(() => {
    if (isMuted()) {
      birdAudio.volume = 0
      if (birdAudioPlaying) {
        birdAudio.pause()
        birdAudioPlaying = false
      }
    }
  })

  const birdMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
  })

  // Super low-poly wing: single triangle
  const wingGeo = new THREE.BufferGeometry()
  wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0.2,
    0, 0, -0.2,
    1.0, 0, 0,
  ]), 3))
  wingGeo.computeVertexNormals()

  // Body: 3-sided cone pointing forward
  const bodyGeo = new THREE.ConeGeometry(0.12, 0.7, 3)
  bodyGeo.rotateX(-Math.PI / 2)

  function createBird(phase) {
    const group = new THREE.Group()
    group.add(new THREE.Mesh(bodyGeo, birdMat))

    const left = new THREE.Mesh(wingGeo, birdMat)
    left.position.x = 0.08
    group.add(left)

    const right = new THREE.Mesh(wingGeo, birdMat)
    right.position.x = -0.08
    right.scale.x = -1
    group.add(right)

    return { group, left, right, phase }
  }

  let groupRef
  let flocks = []
  let nextFlockTime = 5
  let elapsed = 0

  const birdScale = 2.5
  const flockSpeed = 6
  const spawnDistance = 250
  const despawnDistance = 400
  const windAngle = 0
  const windSpread = Math.PI * 0.14

  let seed = 99
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  function spawnFlock() {
    if (!groupRef) return

    const birdCount = 5 + Math.floor(rand() * 4)
    const altitude = 80 + rand() * 40
    const flockAngle = windAngle + (rand() - 0.5) * 2 * windSpread
    const dirX = Math.sin(flockAngle)
    const dirZ = Math.cos(flockAngle)
    const lateralOffset = (rand() - 0.5) * spawnDistance * 1.2
    const startX = -dirX * spawnDistance + (-dirZ) * lateralOffset
    const startZ = -dirZ * spawnDistance + dirX * lateralOffset
    const rotY = Math.atan2(dirX, dirZ) + Math.PI

    const flock = {
      group: new THREE.Group(),
      dirX,
      dirZ,
      startX,
      startZ,
      birds: [],
    }

    flock.group.position.set(startX, altitude, startZ)
    groupRef.add(flock.group)

    for (let i = 0; i < birdCount; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const row = Math.ceil(i / 2)

      const perpX = side * row * 4 * (-dirZ)
      const perpZ = side * row * 4 * dirX
      const backX = -row * 2 * dirX
      const backZ = -row * 2 * dirZ

      const bird = createBird(rand() * Math.PI * 2)
      bird.group.scale.setScalar(birdScale)
      bird.group.position.set(perpX + backX, (rand() - 0.5) * 0.5, perpZ + backZ)
      bird.group.rotation.y = rotY
      bird.flapSpeed = 4 + rand() * 3

      flock.group.add(bird.group)
      flock.birds.push(bird)
    }

    flocks.push(flock)
  }

  useTask((delta) => {
    if (!groupRef) return

    elapsed += delta

    const isDay = dayNight.sunFactor > 0.5

    if (isDay && elapsed > nextFlockTime) {
      spawnFlock()
      nextFlockTime = elapsed + 15 + rand() * 30
    }

    for (let i = flocks.length - 1; i >= 0; i--) {
      const flock = flocks[i]
      flock.group.visible = isDay
      if (!isDay) continue

      flock.group.position.x += flock.dirX * flockSpeed * delta
      flock.group.position.z += flock.dirZ * flockSpeed * delta

      // Animate wing flapping
      for (const bird of flock.birds) {
        const flap = Math.sin(elapsed * bird.flapSpeed + bird.phase) * 0.6
        bird.left.rotation.z = flap
        bird.right.rotation.z = -flap
      }

      const dx = flock.group.position.x - flock.startX
      const dz = flock.group.position.z - flock.startZ
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist > despawnDistance) {
        groupRef.remove(flock.group)
        flocks.splice(i, 1)
      }
    }

    // Bird sound — volume based on closest flock distance to player
    let closestFlockDist = Infinity
    for (const flock of flocks) {
      if (!flock.group.visible) continue
      const fdx = flock.group.position.x - localPlayerPos.x
      const fdz = flock.group.position.z - localPlayerPos.z
      const fd = Math.sqrt(fdx * fdx + fdz * fdz)
      if (fd < closestFlockDist) closestFlockDist = fd
    }

    if (closestFlockDist < BIRD_HEAR_DIST && isDay && !isMuted()) {
      const vol = 0.15 * (1 - closestFlockDist / BIRD_HEAR_DIST)
      birdAudio.volume = Math.max(0, vol)
      if (!birdAudioPlaying) {
        birdAudio.play().catch(() => {})
        birdAudioPlaying = true
      }
    } else {
      birdAudio.volume = 0
      if (birdAudioPlaying) {
        birdAudio.pause()
        birdAudioPlaying = false
      }
    }
  })
</script>

<T.Group bind:ref={groupRef} />
