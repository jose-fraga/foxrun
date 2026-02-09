<script>
  import { T, useTask } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import * as THREE from 'three'

  const birdGltf = useGltf('/flying_bird/scene.gltf')

  let groupRef
  let gltfData = null
  let flocks = []
  let nextFlockTime = 5
  let elapsed = 0

  const birdScale = 2
  const flockSpeed = 6
  const spawnDistance = 250
  const despawnDistance = 400

  // Wind blows along +Z (windmill faces -Z into the wind, blades spin on Z-axis)
  // Birds fly downwind with slight per-flock variation (±25°)
  const windAngle = 0
  const windSpread = Math.PI * 0.14

  // Seeded random
  let seed = 99
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  function spawnFlock() {
    if (!gltfData || !groupRef) return

    const birdCount = 5 + Math.floor(rand() * 4)
    const altitude = 30 + rand() * 25

    // Each flock gets a slight direction variation around the wind
    const flockAngle = windAngle + (rand() - 0.5) * 2 * windSpread
    const dirX = Math.sin(flockAngle)
    const dirZ = Math.cos(flockAngle)

    // Spawn upwind with a lateral offset so flocks spread across the sky
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

      const birdScene = gltfData.scene.clone()
      birdScene.scale.setScalar(birdScale)
      birdScene.position.set(
        perpX + backX,
        (rand() - 0.5) * 0.5,
        perpZ + backZ
      )
      birdScene.rotation.y = rotY

      // Set up animation
      const mixer = new THREE.AnimationMixer(birdScene)
      const clip = gltfData.animations[0]
      if (clip) {
        const action = mixer.clipAction(clip)
        action.play()
        action.time = rand() * 2
      }

      flock.group.add(birdScene)
      flock.birds.push({ mixer })
    }

    flocks.push(flock)
  }

  birdGltf.then((data) => {
    gltfData = data
  })

  useTask((delta) => {
    if (!groupRef) return

    elapsed += delta

    if (elapsed > nextFlockTime) {
      spawnFlock()
      nextFlockTime = elapsed + 15 + rand() * 30
    }

    for (let i = flocks.length - 1; i >= 0; i--) {
      const flock = flocks[i]
      flock.group.position.x += flock.dirX * flockSpeed * delta
      flock.group.position.z += flock.dirZ * flockSpeed * delta

      for (const bird of flock.birds) {
        bird.mixer.update(delta)
      }

      const dx = flock.group.position.x - flock.startX
      const dz = flock.group.position.z - flock.startZ
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist > despawnDistance) {
        // Dispose geometry/materials to prevent memory leaks
        flock.group.traverse((child) => {
          if (child.isMesh) {
            child.geometry?.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose())
            } else {
              child.material?.dispose()
            }
          }
        })
        for (const bird of flock.birds) {
          bird.mixer.stopAllAction()
          bird.mixer.uncacheRoot(bird.mixer.getRoot())
        }
        groupRef.remove(flock.group)
        flocks.splice(i, 1)
      }
    }
  })
</script>

<T.Group bind:ref={groupRef} />
