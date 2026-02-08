<script>
  import { T, useTask } from '@threlte/core'
  import { Sky } from '@threlte/extras'
  import * as THREE from 'three'
  import { useThrelte } from '@threlte/core'
  import { dayNight } from '../stores/dayNight.js'

  const { isMobile, shadowMapSize } = $props()

  // --- Cycle timing ---
  // 5 min hold + 30s transition + 5 min hold + 30s transition = 660s
  const HOLD_DURATION = 300 // 5 minutes per state
  const TRANSITION_DURATION = 30
  const CYCLE_DURATION = (HOLD_DURATION + TRANSITION_DURATION) * 2 // 660s
  let cycleTime = HOLD_DURATION - 10 // start near end of sunset hold so night comes quickly

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
  let skyElevation = $derived(lerp(SUNSET.skyElevation, NIGHT.skyElevation, nightFactor))
  let skyTurbidity = $derived(lerp(SUNSET.skyTurbidity, NIGHT.skyTurbidity, nightFactor))
  let skyRayleigh = $derived(lerp(SUNSET.skyRayleigh, NIGHT.skyRayleigh, nightFactor))
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

  const { camera } = useThrelte()

  // Refs for objects that need imperative updates
  let hemiLight = $state(null)
  let fogRef = $state(null)
  let sunLight = $state(null)
  let ambientLight = $state(null)
  let starsGroup = $state(null)

  // Skip redundant color updates during hold phases (50% of the cycle)
  let prevNightFactor = -1

  useTask((delta) => {
    cycleTime = (cycleTime + delta) % CYCLE_DURATION

    // Phase boundaries (in seconds):
    // 0 – HOLD: sunset hold
    // HOLD – HOLD+TRANS: sunset → night
    // HOLD+TRANS – 2*HOLD+TRANS: night hold
    // 2*HOLD+TRANS – end: night → sunset
    const t1 = HOLD_DURATION
    const t2 = t1 + TRANSITION_DURATION
    const t3 = t2 + HOLD_DURATION
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

    // Lock stars to camera so they don't shift when moving
    if (starsGroup && camera.current) {
      const cam = camera.current
      starsGroup.position.set(cam.position.x, cam.position.y, cam.position.z)
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

<!-- Sky -->
<Sky
  elevation={skyElevation}
  turbidity={skyTurbidity}
  rayleigh={skyRayleigh}
  mieCoefficient={0.005}
  mieDirectionalG={0.8}
  azimuth={180}
/>

<!-- Stars (visible at night, locked to camera) -->
<T.Group oncreate={(ref) => { starsGroup = ref }} visible={starsVisible}>
  <T is={starPoints} />
</T.Group>

<!-- Fog -->
<T.FogExp2
  args={['#c8dff5', 0.004]}
  attach="fog"
  oncreate={(ref) => { fogRef = ref }}
/>
