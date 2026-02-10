<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { useThrelte } from '@threlte/core'
  import { dayNight } from '../stores/dayNight.js'

  const { isMobile, shadowMapSize } = $props()

  // --- Cycle timing ---
  // 5 min day + 30s transition + 2 min night + 30s transition = 480s
  const DAY_HOLD = 300   // 5 minutes
  const NIGHT_HOLD = 120 // 2 minutes
  const TRANSITION_DURATION = 30
  const CYCLE_DURATION = DAY_HOLD + NIGHT_HOLD + TRANSITION_DURATION * 2 // 480s

  // --- Color helpers ---
  const _c1 = new THREE.Color()
  const _c2 = new THREE.Color()

  function lerp(a, b, t) {
    return a + (b - a) * t
  }

  // --- Animated values ---
  let nightFactor = $state(0) // 0 = sunset, 1 = night

  // Sunset values (current look)
  const SUNSET = {
    sunIntensity: 6.5,
    sunColor: '#ffe0a0',
    hemiSkyColor: '#ffd4a8',
    hemiGroundColor: '#3a4a30',
    hemiIntensity: 0.2,
    ambientIntensity: 0.1,
    ambientColor: '#ffe0c0',
    skyElevation: 1,
    skyTurbidity: 12,
    skyRayleigh: 3,
    fogColor: '#c8dff5',
  }

  // Night values
  const NIGHT = {
    sunIntensity: 0.3,
    sunColor: '#4466aa',
    hemiSkyColor: '#0a0a2a',
    hemiGroundColor: '#0a0a10',
    hemiIntensity: 0.05,
    ambientIntensity: 0.03,
    ambientColor: '#1a1a3a',
    skyElevation: -5,
    skyTurbidity: 0.1,
    skyRayleigh: 0.1,
    fogColor: '#0a0a1a',
  }

  // Derived lerped values
  let sunIntensity = $derived(lerp(SUNSET.sunIntensity, NIGHT.sunIntensity, nightFactor))
  let hemiIntensity = $derived(lerp(SUNSET.hemiIntensity, NIGHT.hemiIntensity, nightFactor))
  let ambientIntensity = $derived(lerp(SUNSET.ambientIntensity, NIGHT.ambientIntensity, nightFactor))
  let starsVisible = $derived(nightFactor > 0.3)

  // --- Static white stars (custom Points, no library component) ---
  const STAR_COUNT = isMobile ? 1000 : 3000
  const STAR_RADIUS = 400
  const starPositions = new Float32Array(STAR_COUNT * 3)
  const starSizes = new Float32Array(STAR_COUNT)
  for (let i = 0; i < STAR_COUNT; i++) {
    // Distribute on upper hemisphere sphere shell
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random()) // 0 to PI/2 — upper hemisphere
    const r = STAR_RADIUS * (0.8 + Math.random() * 0.2)
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    starPositions[i * 3 + 1] = r * Math.cos(phi) // always positive (above)
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    starSizes[i] = 1 + Math.random() * 3
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1))
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1,
    sizeAttenuation: false,
    depthWrite: false,
    fog: false,
  })
  const starPoints = new THREE.Points(starGeometry, starMaterial)
  starPoints.renderOrder = 100
  starPoints.frustumCulled = false

  // --- Toon sky dome (crisp painted bands) ---
  const skyGeo = new THREE.SphereGeometry(500, 32, 16)
  const skyUniforms = { uNightFactor: { value: 0 } }
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
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

        // Sunset palette (3 smooth bands)
        vec3 dayLow  = vec3(1.0, 0.83, 0.66);
        vec3 dayMid  = vec3(0.53, 0.81, 0.92);
        vec3 dayHigh = vec3(0.36, 0.55, 0.78);

        // Night palette (3 smooth bands)
        vec3 nightLow  = vec3(0.04, 0.04, 0.16);
        vec3 nightMid  = vec3(0.02, 0.02, 0.12);
        vec3 nightHigh = vec3(0.01, 0.01, 0.08);

        vec3 dayColor = mix(dayLow, dayMid, smoothstep(0.0, 0.3, elev));
        dayColor = mix(dayColor, dayHigh, smoothstep(0.3, 0.7, elev));

        vec3 nightColor = mix(nightLow, nightMid, smoothstep(0.0, 0.3, elev));
        nightColor = mix(nightColor, nightHigh, smoothstep(0.3, 0.7, elev));

        vec3 sky = mix(dayColor, nightColor, uNightFactor);

        // Toon sun disc — sets below horizon at night
        float sunY = 6.0 - uNightFactor * 30.0;
        vec3 sunDir = normalize(vec3(0.0, sunY, -200.0));
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

  const { camera } = useThrelte()

  // Refs for objects that need imperative updates
  let hemiLight = $state(null)
  let fogRef = $state(null)
  let sunLight = $state(null)
  let ambientLight = $state(null)
  let starsGroup = $state(null)
  let skyDome = $state(null)

  // Skip redundant color updates during hold phases (50% of the cycle)
  let prevNightFactor = -1

  useTask((delta) => {
    const elapsed = (Date.now() - dayNight.cycleStartTime) / 1000
    const cycleTime = ((elapsed % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION

    // Phase boundaries (in seconds):
    // 0 – DAY_HOLD: day hold
    // DAY_HOLD – DAY_HOLD+TRANS: day → night
    // DAY_HOLD+TRANS – DAY_HOLD+TRANS+NIGHT_HOLD: night hold
    // DAY_HOLD+TRANS+NIGHT_HOLD – end: night → day
    const t1 = DAY_HOLD
    const t2 = t1 + TRANSITION_DURATION
    const t3 = t2 + NIGHT_HOLD
    // t4 = CYCLE_DURATION

    if (cycleTime < t1) {
      nightFactor = 0
    } else if (cycleTime < t2) {
      const t = (cycleTime - t1) / TRANSITION_DURATION
      nightFactor = t * t * (3 - 2 * t) // smoothstep
    } else if (cycleTime < t3) {
      nightFactor = 1
    } else {
      const t = (cycleTime - t3) / TRANSITION_DURATION
      nightFactor = 1 - t * t * (3 - 2 * t) // smoothstep reverse
    }

    dayNight.sunFactor = 1 - nightFactor

    // Only update colors/intensities when nightFactor actually changes
    if (nightFactor !== prevNightFactor) {
      prevNightFactor = nightFactor

      if (hemiLight) {
        _c1.set(SUNSET.hemiSkyColor).lerp(_c2.set(NIGHT.hemiSkyColor), nightFactor)
        hemiLight.color.copy(_c1)
        _c1.set(SUNSET.hemiGroundColor).lerp(_c2.set(NIGHT.hemiGroundColor), nightFactor)
        hemiLight.groundColor.copy(_c1)
        hemiLight.intensity = hemiIntensity
      }
      if (sunLight) {
        _c1.set(SUNSET.sunColor).lerp(_c2.set(NIGHT.sunColor), nightFactor)
        sunLight.color.copy(_c1)
      }
      if (ambientLight) {
        _c1.set(SUNSET.ambientColor).lerp(_c2.set(NIGHT.ambientColor), nightFactor)
        ambientLight.color.copy(_c1)
      }
      if (fogRef) {
        _c1.set(SUNSET.fogColor).lerp(_c2.set(NIGHT.fogColor), nightFactor)
        fogRef.color.copy(_c1)
      }
    }

    // Update toon sky dome
    skyUniforms.uNightFactor.value = nightFactor

    // Lock stars + sky dome to camera so they don't shift when moving
    if (camera.current) {
      const cam = camera.current
      if (starsGroup) {
        starsGroup.position.set(cam.position.x, cam.position.y, cam.position.z)
      }
      if (skyDome) {
        skyDome.position.set(cam.position.x, cam.position.y, cam.position.z)
      }
    }
  })
</script>

<!-- Directional sun/moon light -->
<T.DirectionalLight
  position={[0, 6, -200]}
  intensity={sunIntensity}
  castShadow
  shadow.mapSize.width={shadowMapSize}
  shadow.mapSize.height={shadowMapSize}
  shadow.camera.left={-60}
  shadow.camera.right={60}
  shadow.camera.top={60}
  shadow.camera.bottom={-60}
  shadow.camera.near={1}
  shadow.camera.far={400}
  shadow.bias={-0.0005}
  shadow.intensity={1}
  oncreate={(ref) => { sunLight = ref }}
/>

<!-- Hemisphere light -->
<T.HemisphereLight
  args={[0xffd4a8, 0x3a4a30, 0.2]}
  oncreate={(ref) => { hemiLight = ref }}
/>

<!-- Ambient fill -->
<T.AmbientLight
  intensity={ambientIntensity}
  oncreate={(ref) => { ambientLight = ref }}
/>

<!-- Toon sky dome -->
<T is={skyMesh} oncreate={(ref) => { skyDome = ref }} />

<!-- Stars (visible at night, locked to camera) -->
<T.Group oncreate={(ref) => { starsGroup = ref }} visible={starsVisible}>
  <T is={starPoints} />
</T.Group>

<!-- Fog -->
<T.FogExp2
  args={['#c8dff5', 0.0025]}
  attach="fog"
  oncreate={(ref) => { fogRef = ref }}
/>
