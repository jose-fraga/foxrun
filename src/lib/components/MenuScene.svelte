<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { loadModel } from '../utils/modelLoader.js'

  // Fixed cinematic camera
  let camera

  const camPos = new THREE.Vector3(40, 4, 25)
  const camLook = new THREE.Vector3(15, 20, 0)

  useTask(() => {
    if (camera) {
      camera.position.copy(camPos)
      camera.lookAt(camLook)
    }
  })

  // --- Toon sky dome (same shader as DayNightCycle, fixed at sunset) ---
  const skyGeo = new THREE.SphereGeometry(500, 32, 16)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uNightFactor: { value: 0 } },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uNightFactor;
      varying vec3 vWorldPosition;
      void main() {
        vec3 dir = normalize(vWorldPosition);
        float elev = max(dir.y, 0.0);

        vec3 dayLow  = vec3(1.0, 0.83, 0.66);
        vec3 dayMid  = vec3(0.53, 0.81, 0.92);
        vec3 dayHigh = vec3(0.36, 0.55, 0.78);

        vec3 sky = mix(dayLow, dayMid, smoothstep(0.0, 0.3, elev));
        sky = mix(sky, dayHigh, smoothstep(0.3, 0.7, elev));

        // Sun disc
        vec3 sunDir = normalize(vec3(0.0, 6.0, -200.0));
        float sunAngle = dot(dir, sunDir);
        float sunDisc = step(0.9995, sunAngle);
        vec3 sunCore = vec3(1.0, 0.95, 0.7);
        sky = mix(sky, sunCore, sunDisc);

        gl_FragColor = vec4(sky, 1.0);
      }
    `
  })
  const skyMesh = new THREE.Mesh(skyGeo, skyMat)
  skyMesh.frustumCulled = false

  // --- Windmill (brush-painted) ---
  const windmillGltf = loadModel('/Windmill.glb')
  let blades = null

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(300, 300)
  groundGeo.rotateX(-Math.PI / 2)
  const groundMat = new THREE.MeshBasicMaterial({
    color: 0x5a7a3a,
  })

  function setupWindmill(scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false
        child.receiveShadow = false
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

  // --- Procedural toon birds (same as game Birds.svelte) ---
  const birdMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
  })

  const wingGeo = new THREE.BufferGeometry()
  wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0.2,
    0, 0, -0.2,
    1.0, 0, 0,
  ]), 3))
  wingGeo.computeVertexNormals()

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

  let birdsGroup
  let flocks = []
  let nextFlockTime = 3
  let elapsed = 0

  let seed = 42
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  function spawnFlock() {
    if (!birdsGroup) return

    const count = 3 + Math.floor(rand() * 4)
    const altitude = 30 + rand() * 25
    const startX = 5 + rand() * 20
    const startZ = 50 + rand() * 20

    const flock = {
      group: new THREE.Group(),
      birds: [],
      flyDirX: (rand() - 0.5) * 0.3,
      flyDirZ: -1,
    }
    flock.group.position.set(startX, altitude, startZ)
    birdsGroup.add(flock.group)

    const rotY = Math.atan2(flock.flyDirX, flock.flyDirZ) + Math.PI

    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const row = Math.ceil(i / 2)

      const bird = createBird(rand() * Math.PI * 2)
      bird.group.scale.setScalar(2.5)
      bird.group.position.set(
        side * row * 2.5,
        (rand() - 0.5) * 0.5,
        row * 3,
      )
      bird.group.rotation.y = rotY
      bird.flapSpeed = 4 + rand() * 3

      flock.group.add(bird.group)
      flock.birds.push(bird)
    }

    flocks.push(flock)
  }

  useTask((delta) => {
    if (!birdsGroup) return
    elapsed += delta

    if (elapsed > nextFlockTime) {
      spawnFlock()
      nextFlockTime = elapsed + 8 + rand() * 15
    }

    for (let i = flocks.length - 1; i >= 0; i--) {
      const flock = flocks[i]
      flock.group.position.x += flock.flyDirX * 7 * delta
      flock.group.position.z += flock.flyDirZ * 7 * delta

      for (const bird of flock.birds) {
        const flap = Math.sin(elapsed * bird.flapSpeed + bird.phase) * 0.6
        bird.left.rotation.z = flap
        bird.right.rotation.z = -flap
      }

      if (flock.group.position.z < -150) {
        birdsGroup.remove(flock.group)
        flocks.splice(i, 1)
      }
    }
  })
</script>

<T.PerspectiveCamera
  makeDefault
  fov={50}
  near={0.3}
  far={2000}
  bind:ref={camera}
/>

<!-- Toon sky dome -->
<T is={skyMesh} />

<!-- Directional sun light (sunset values from DayNightCycle) -->
<T.DirectionalLight
  position={[0, 6, -200]}
  intensity={6.5}
  color="#ffe0a0"
/>

<!-- Hemisphere light -->
<T.HemisphereLight
  args={[0xffd4a8, 0x3a4a30, 0.2]}
/>

<!-- Ambient fill -->
<T.AmbientLight intensity={0.1} color="#ffe0c0" />

<!-- Fog -->
<T.FogExp2
  args={['#c8dff5', 0.003]}
  attach="fog"
/>

<!-- Ground -->
<T.Mesh geometry={groundGeo} material={groundMat} position.y={-4} />

<!-- Windmill (brush-painted) -->
{#await windmillGltf then value}
  <T
    is={value.scene}
    scale={3}
    position={[-5, -4, 0]}
    oncreate={() => setupWindmill(value.scene)}
  />
{/await}

<!-- Toon birds -->
<T.Group bind:ref={birdsGroup} />
