<script>
  import { T, useTask } from '@threlte/core'
  import { Sky } from '@threlte/extras'
  import { useGltf } from '@threlte/extras'
  import * as THREE from 'three'

  // Fixed cinematic camera
  // Shifted right so windmill appears on the left side of screen
  let camera

  const camPos = new THREE.Vector3(40, 4, 25)
  const camLook = new THREE.Vector3(15, 20, 0)

  useTask(() => {
    if (camera) {
      camera.position.copy(camPos)
      camera.lookAt(camLook)
    }
  })

  // Windmill
  const windmillGltf = useGltf('/Windmill.glb')
  let blades = null

  function setupWindmill(scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
      const name = (child.name || '').toLowerCase()
      if (name.includes('blade') || name.includes('fan') || name.includes('rotor') || name.includes('wing') || name.includes('propeller') || name.includes('sail')) {
        blades = child
      }
    })
  }

  useTask((delta) => {
    if (blades) blades.rotation.z += 1.2 * delta
  })

  // --- Menu birds ---
  // Camera looks from (40,4,25) toward (15,20,0) — forward is roughly (-25,16,-25)
  // Birds fly along +Z to -Z, crossing the view at X=5..20 (where the camera looks)
  const birdGltf = useGltf('/flying_bird/scene.gltf')
  let birdData = null
  let birdsGroup
  let flocks = []
  let elapsed = 0
  let nextFlockTime = 3

  birdGltf.then((data) => { birdData = data })

  function spawnFlock() {
    if (!birdData || !birdsGroup) return

    const count = 3 + Math.floor(Math.random() * 4)
    const altitude = 18 + Math.random() * 18
    // Spawn behind the look target (high Z), fly toward -Z across the view
    const startX = 5 + Math.random() * 20
    const startZ = 50 + Math.random() * 20

    const flock = {
      group: new THREE.Group(),
      birds: [],
    }
    flock.group.position.set(startX, altitude, startZ)
    birdsGroup.add(flock.group)

    // Flying toward -Z with slight X drift
    const flyDirX = (Math.random() - 0.5) * 0.3
    const flyDirZ = -1
    flock.flyDirX = flyDirX
    flock.flyDirZ = flyDirZ

    const rotY = Math.atan2(flyDirX, flyDirZ) + Math.PI

    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const row = Math.ceil(i / 2)

      const birdScene = birdData.scene.clone()
      birdScene.scale.setScalar(2)
      birdScene.position.set(
        side * row * 2.5,
        (Math.random() - 0.5) * 0.5,
        -row * 3
      )
      birdScene.rotation.y = rotY

      const mixer = new THREE.AnimationMixer(birdScene)
      const clip = birdData.animations[0]
      if (clip) {
        const action = mixer.clipAction(clip)
        action.play()
        action.time = Math.random() * 2
      }

      flock.group.add(birdScene)
      flock.birds.push({ mixer })
    }

    flocks.push(flock)
  }

  useTask((delta) => {
    if (!birdsGroup) return
    elapsed += delta

    if (elapsed > nextFlockTime) {
      spawnFlock()
      nextFlockTime = elapsed + 8 + Math.random() * 15
    }

    for (let i = flocks.length - 1; i >= 0; i--) {
      const flock = flocks[i]
      flock.group.position.x += flock.flyDirX * 7 * delta
      flock.group.position.z += flock.flyDirZ * 7 * delta

      for (const bird of flock.birds) {
        bird.mixer.update(delta)
      }

      // Remove when far past
      if (flock.group.position.z < -60) {
        flock.group.traverse((child) => {
          if (child.isMesh) {
            child.geometry?.dispose()
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
            else child.material?.dispose()
          }
        })
        for (const bird of flock.birds) {
          bird.mixer.stopAllAction()
          bird.mixer.uncacheRoot(bird.mixer.getRoot())
        }
        birdsGroup.remove(flock.group)
        flocks.splice(i, 1)
      }
    }
  })

  // Sunset lighting
  const sunDir = new THREE.Vector3()
  const elevation = 8
  const phi = THREE.MathUtils.degToRad(90 - elevation)
  const theta = THREE.MathUtils.degToRad(180)
  sunDir.setFromSphericalCoords(1, phi, theta)
</script>

<T.PerspectiveCamera
  makeDefault
  fov={50}
  near={0.3}
  far={2000}
  bind:ref={camera}
/>

<!-- Sun light -->
<T.DirectionalLight
  intensity={2.5}
  position={[sunDir.x * 100, sunDir.y * 100, sunDir.z * 100]}
  color="#ffd4a0"
  castShadow
  shadow.mapSize.width={1024}
  shadow.mapSize.height={1024}
/>

<!-- Hemisphere light -->
<T.HemisphereLight
  skyColor="#c0546d"
  groundColor="#2d5a1e"
  intensity={0.6}
/>

<!-- Ambient -->
<T.AmbientLight intensity={0.3} color="#e8845c" />

<!-- Sky -->
<Sky
  elevation={elevation}
  turbidity={4}
  rayleigh={2}
  mieCoefficient={0.005}
  mieDirectionalG={0.8}
  azimuth={180}
/>

<!-- Fog -->
<T.FogExp2
  args={['#e8a07a', 0.003]}
  attach="fog"
/>

<!-- Windmill -->
{#await windmillGltf then value}
  <T
    is={value.scene}
    scale={3}
    position={[0, 0, 0]}
    oncreate={() => setupWindmill(value.scene)}
  />
{/await}

<!-- Birds -->
<T.Group bind:ref={birdsGroup} />
