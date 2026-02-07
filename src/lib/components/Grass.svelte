<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getRemotePlayers } from '../stores/players.svelte.js'
  import { POND_CENTER, POND_RADIUS } from '../utils/pond.js'

  const MAX_STOMPERS = 8

  const INSTANCE_COUNT = 650000
  const FIELD_SIZE = 700
  const FENCE_HALF = 180
  const FALLOFF_DIST = 100
  const BLADES_PER_CLUMP = 5
  const BLADE_HEIGHT = 0.8
  const BLADE_WIDTH = 0.1
  const SEGMENTS = 2

  // --- Procedural noise texture (FBM-based) ---
  function createNoiseTexture(size = 256) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(size, size)

    function hash(x, y) {
      let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
      return n - Math.floor(n)
    }

    function smoothNoise(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y)
      const fx = x - ix, fy = y - iy
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
      const a = hash(ix, iy), b = hash(ix + 1, iy)
      const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
    }

    function fbm(x, y) {
      let val = 0, amp = 1, freq = 1
      for (let i = 0; i < 4; i++) {
        val += smoothNoise(x * freq, y * freq) * amp
        amp *= 0.5
        freq *= 2
      }
      return val / 1.875
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / size * 8
        const ny = y / size * 8
        const idx = (y * size + x) * 4
        imageData.data[idx] = Math.floor(fbm(nx, ny) * 255)
        imageData.data[idx + 1] = Math.floor(fbm(nx + 100, ny + 100) * 255)
        imageData.data[idx + 2] = Math.floor(fbm(nx + 200, ny + 200) * 255)
        imageData.data[idx + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
  }

  // --- Procedural grass alpha texture (blade silhouette) ---
  function createGrassAlphaTexture() {
    const w = 64, h = 128
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)
    ctx.beginPath()
    ctx.moveTo(w * 0.2, h)
    ctx.lineTo(w * 0.8, h)
    ctx.quadraticCurveTo(w * 0.55, h * 0.3, w * 0.5, 0)
    ctx.quadraticCurveTo(w * 0.45, h * 0.3, w * 0.2, h)
    ctx.closePath()
    ctx.fillStyle = '#fff'
    ctx.fill()
    return new THREE.CanvasTexture(canvas)
  }

  // --- Grass clump geometry (multiple blades radiating outward) ---
  function createGrassClumpGeometry() {
    const positions = []
    const uvs = []
    const indices = []

    for (let b = 0; b < BLADES_PER_CLUMP; b++) {
      const angle = (b / BLADES_PER_CLUMP) * Math.PI * 2
      const ca = Math.cos(angle)
      const sa = Math.sin(angle)
      const baseIdx = b * (SEGMENTS + 1) * 2

      for (let s = 0; s <= SEGMENTS; s++) {
        const t = s / SEGMENTS // 0 at base, 1 at tip
        const width = BLADE_WIDTH * (1 - t * 0.85)
        const height = t * BLADE_HEIGHT
        const bend = t * t * 0.3 // outward lean

        // Left vertex
        positions.push(-width * ca + bend * ca, height, -width * sa + bend * sa)
        uvs.push(0, t)
        // Right vertex
        positions.push(width * ca + bend * ca, height, width * sa + bend * sa)
        uvs.push(1, t)
      }

      for (let s = 0; s < SEGMENTS; s++) {
        const i = baseIdx + s * 2
        indices.push(i, i + 2, i + 1)
        indices.push(i + 1, i + 2, i + 3)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }

  // --- Textures ---
  const noiseTexture = createNoiseTexture()
  const grassAlphaTexture = createGrassAlphaTexture()

  // --- Custom uniforms ---
  const grassUniforms = {
    uTime: { value: 0 },
    uNoiseTexture: { value: noiseTexture },
    uNoiseScale: { value: 1.5 },
    uGrassAlphaTexture: { value: grassAlphaTexture },
    uBaseColor: { value: new THREE.Color('#313f1b') },
    uTipColor1: { value: new THREE.Color('#9bd38d') },
    uTipColor2: { value: new THREE.Color('#1f352a') },
    uGrassLightIntensity: { value: 1.0 },
    uShadowDarkness: { value: 0.5 },
    uEnableShadows: { value: 1 },
    uStomperPositions: { value: Array.from({ length: MAX_STOMPERS }, () => new THREE.Vector3(9999, 0, 9999)) },
    uStomperActive: { value: new Float32Array(MAX_STOMPERS) },
    uStomperCount: { value: 0 },
    uStompRadius: { value: 3.0 },
  }

  // --- Material with onBeforeCompile (FluffyGrass approach) ---
  const material = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSide,
    color: 0x229944,
    transparent: true,
    alphaTest: 0.1,
    shadowSide: THREE.BackSide,
  })

  // Ensure uv attribute is declared in the shader prefix
  material.defines = material.defines || {}
  material.defines.USE_UV = ''

  // Unique cache key so this doesn't share programs with other LambertMaterials
  material.customProgramCacheKey = function () {
    return 'fluffy-grass'
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = grassUniforms.uTime
    shader.uniforms.uNoiseTexture = grassUniforms.uNoiseTexture
    shader.uniforms.uNoiseScale = grassUniforms.uNoiseScale
    shader.uniforms.uGrassAlphaTexture = grassUniforms.uGrassAlphaTexture
    shader.uniforms.uBaseColor = grassUniforms.uBaseColor
    shader.uniforms.uTipColor1 = grassUniforms.uTipColor1
    shader.uniforms.uTipColor2 = grassUniforms.uTipColor2
    shader.uniforms.uGrassLightIntensity = grassUniforms.uGrassLightIntensity
    shader.uniforms.uShadowDarkness = grassUniforms.uShadowDarkness
    shader.uniforms.uEnableShadows = grassUniforms.uEnableShadows
    shader.uniforms.uStomperPositions = grassUniforms.uStomperPositions
    shader.uniforms.uStomperActive = grassUniforms.uStomperActive
    shader.uniforms.uStomperCount = grassUniforms.uStomperCount
    shader.uniforms.uStompRadius = grassUniforms.uStompRadius

    shader.vertexShader = `
      #include <common>
      #include <fog_pars_vertex>
      #include <shadowmap_pars_vertex>

      uniform sampler2D uNoiseTexture;
      uniform float uNoiseScale;
      uniform float uTime;
      uniform vec3 uStomperPositions[8];
      uniform float uStomperActive[8];
      uniform int uStomperCount;
      uniform float uStompRadius;

      varying vec2 vGlobalUV;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        #include <begin_vertex>
        #include <project_vertex>
        #include <fog_vertex>
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <worldpos_vertex>
        #include <shadowmap_vertex>

        // Wind effect
        vec2 windDirection = normalize(vec2(1.0, 1.0));
        float windAmp = 0.1;
        float windFreq = 50.0;
        float windSpeed = 1.0;
        float noiseFactor = 5.5;
        float noiseSpeed = 0.001;

        vec4 modelPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);

        float terrainSize = 100.0;
        vGlobalUV = (terrainSize - vec2(modelPosition.xz)) / terrainSize;

        vec4 noise = texture2D(uNoiseTexture, vGlobalUV + uTime * noiseSpeed);

        float sinWave = sin(
          windFreq * dot(windDirection, vGlobalUV) +
          noise.g * noiseFactor +
          uTime * windSpeed
        ) * windAmp * uv.y;

        modelPosition.x += sinWave;
        modelPosition.z += sinWave;

        // Height variation from noise
        modelPosition.y += exp(texture2D(uNoiseTexture, vGlobalUV * uNoiseScale).r) * 0.5 * uv.y;

        // Player stomp: bend grass away from all players
        for (int i = 0; i < 8; i++) {
          if (i >= uStomperCount) break;
          if (uStomperActive[i] < 0.5) continue;
          vec2 toPlayer = modelPosition.xz - uStomperPositions[i].xz;
          float dist = length(toPlayer);
          if (dist < uStompRadius && dist > 0.01) {
            float influence = (1.0 - dist / uStompRadius) * 0.8 * uv.y;
            vec2 pushDir = normalize(toPlayer);
            modelPosition.x += pushDir.x * influence;
            modelPosition.z += pushDir.y * influence;
            modelPosition.y -= influence * 0.5;
          }
        }

        vec4 viewPosition = viewMatrix * modelPosition;
        gl_Position = projectionMatrix * viewPosition;

        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vViewPosition = mvPosition.xyz;
      }
    `

    shader.fragmentShader = `
      #include <alphatest_pars_fragment>
      #include <fog_pars_fragment>
      #include <common>
      #include <packing>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>

      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uTipColor1;
      uniform vec3 uTipColor2;
      uniform sampler2D uGrassAlphaTexture;
      uniform sampler2D uNoiseTexture;
      uniform float uNoiseScale;
      uniform int uEnableShadows;
      uniform float uGrassLightIntensity;
      uniform float uShadowDarkness;

      varying vec2 vUv;
      varying vec2 vGlobalUV;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec4 grassAlpha = texture2D(uGrassAlphaTexture, vUv);

        vec4 grassVariation = texture2D(uNoiseTexture, vGlobalUV * uNoiseScale);
        vec3 tipColor = mix(uTipColor1, uTipColor2, grassVariation.r);

        vec4 diffuseColor = vec4(
          mix(uBaseColor, tipColor, vUv.y),
          step(0.1, grassAlpha.r)
        );
        vec3 grassFinalColor = diffuseColor.rgb * uGrassLightIntensity;

        // Shadow calculation
        if (uEnableShadows == 1) {
          #if (NUM_DIR_LIGHTS > 0)
            DirectionalLight directionalLight;
            IncidentLight directLight;
            float shadow = 0.0;
            float currentShadow = 0.0;
            #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
              DirectionalLightShadow directionalLightShadow;
            #endif
            #pragma unroll_loop_start
            for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
              directionalLight = directionalLights[i];
              getDirectionalLightInfo(directionalLight, directLight);
              #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
                directionalLightShadow = directionalLightShadows[i];
                currentShadow = getShadow(
                  directionalShadowMap[i],
                  directionalLightShadow.shadowMapSize,
                  directionalLightShadow.shadowIntensity,
                  directionalLightShadow.shadowBias,
                  directionalLightShadow.shadowRadius,
                  vDirectionalShadowCoord[i]
                );
                currentShadow = all(bvec2(directLight.visible, receiveShadow))
                  ? currentShadow : 1.0;
                float weight = clamp(
                  pow(length(vDirectionalShadowCoord[i].xy * 2.0 - 1.0), 4.0),
                  0.0, 1.0
                );
                shadow += mix(currentShadow, 1.0, weight);
              #endif
            }
            #pragma unroll_loop_end
            grassFinalColor = mix(
              grassFinalColor,
              grassFinalColor * uShadowDarkness,
              1.0 - shadow
            );
          #endif
        }

        #include <alphatest_fragment>
        gl_FragColor = vec4(grassFinalColor, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `
  }

  // --- Create instanced mesh ---
  const geometry = createGrassClumpGeometry()
  const mesh = new THREE.InstancedMesh(geometry, material, INSTANCE_COUNT)
  mesh.receiveShadow = true
  mesh.frustumCulled = false

  const dummy = new THREE.Object3D()
  let placed = 0
  while (placed < INSTANCE_COUNT) {
    const x = Math.random() * FIELD_SIZE - FIELD_SIZE / 2
    const z = Math.random() * FIELD_SIZE - FIELD_SIZE / 2

    // Distance beyond fence (0 if inside)
    const beyondX = Math.max(0, Math.abs(x) - FENCE_HALF)
    const beyondZ = Math.max(0, Math.abs(z) - FENCE_HALF)
    const beyondDist = Math.max(beyondX, beyondZ)

    // Skip pond area
    const dxPond = x - POND_CENTER[0]
    const dzPond = z - POND_CENTER[1]
    if (dxPond * dxPond + dzPond * dzPond < (POND_RADIUS + 1) * (POND_RADIUS + 1)) continue

    // Inside fence: always place. Beyond: probability falls off with distance
    if (beyondDist > 0) {
      const keepProb = 1 - Math.min(1, beyondDist / FALLOFF_DIST)
      if (Math.random() > keepProb) continue
    }

    const y = getTerrainHeight(x, z)
    dummy.position.set(x, y, z)
    dummy.rotation.y = Math.random() * Math.PI * 2
    const s = 0.7 + Math.random() * 0.6
    dummy.scale.set(s, s, s)
    dummy.updateMatrix()
    mesh.setMatrixAt(placed, dummy.matrix)
    placed++
  }
  mesh.instanceMatrix.needsUpdate = true

  // --- Animate wind ---
  useTask((delta) => {
    grassUniforms.uTime.value += delta

    const positions = grassUniforms.uStomperPositions.value
    const active = grassUniforms.uStomperActive.value
    let idx = 0

    // Local player
    positions[0].set(localPlayerPos.x, localPlayerPos.y, localPlayerPos.z)
    active[0] = localPlayerPos.grounded ? 1.0 : 0.0
    idx = 1

    // Remote players
    const remotePlayers = getRemotePlayers()
    for (const [, ps] of remotePlayers) {
      if (idx >= MAX_STOMPERS) break
      positions[idx].set(ps.curr.x, ps.curr.y, ps.curr.z)
      active[idx] = ps.curr.grounded ? 1.0 : 0.0
      idx++
    }

    grassUniforms.uStomperCount.value = idx

    // Deactivate unused slots
    for (let i = idx; i < MAX_STOMPERS; i++) {
      active[i] = 0.0
    }
  })
</script>

<T is={mesh} />
