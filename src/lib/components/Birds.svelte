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
  const spawnDistance = 80
  const despawnDistance = 150

  // Seeded random
  let seed = 99
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  function spawnFlock() {
    if (!gltfData || !groupRef) return

    const birdCount = 5 + Math.floor(rand() * 4)
    const altitude = 15 + rand() * 15
    const angle = rand() * Math.PI * 2

    const startX = Math.cos(angle) * spawnDistance
    const startZ = Math.sin(angle) * spawnDistance
    const dirX = -Math.cos(angle)
    const dirZ = -Math.sin(angle)
    const rotY = Math.atan2(dirX, dirZ)

    const flock = {
      group: new THREE.Group(),
      dirX,
      dirZ,
      birds: [],
    }

    flock.group.position.set(startX, altitude, startZ)
    groupRef.add(flock.group)

    for (let i = 0; i < birdCount; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const row = Math.ceil(i / 2)

      const perpX = side * row * 2 * (-dirZ)
      const perpZ = side * row * 2 * dirX
      const backX = -row * 3 * dirX
      const backZ = -row * 3 * dirZ

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

      const pos = flock.group.position
      const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z)
      if (dist > despawnDistance) {
        groupRef.remove(flock.group)
        flocks.splice(i, 1)
      }
    }
  })
</script>

<T.Group bind:ref={groupRef} />
