<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { dayNight } from '../stores/dayNight.js'
  import { getTerrainHeight } from '../utils/terrain.js'

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)

  const FLIES_PER_GROUP = isMobile ? 6 : 12
  const FLOAT_HEIGHT_MIN = 1.5
  const FLOAT_HEIGHT_MAX = 5
  const GROUP_SPREAD = 8

  // Cluster centers scattered around the field
  const clusters = [
    { x: -60, z: -50 },   // near the pond
    { x: -15, z: 25 },    // near the farmer
    { x: 30, z: -20 },    // near cows
    { x: 80, z: 30 },     // east field
    { x: -40, z: -90 },   // south-west
    { x: 10, z: 90 },     // north
    { x: -80, z: 10 },    // west
    { x: 50, z: 60 },     // north-east
  ]

  const COUNT = clusters.length * FLIES_PER_GROUP

  const basePositions = new Float32Array(COUNT * 3)
  const offsets = new Float32Array(COUNT * 3)
  const speeds = new Float32Array(COUNT)

  let seed = 314
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  let idx = 0
  for (const cluster of clusters) {
    for (let i = 0; i < FLIES_PER_GROUP; i++) {
      const angle = rand() * Math.PI * 2
      const dist = rand() * GROUP_SPREAD
      const x = cluster.x + Math.cos(angle) * dist
      const z = cluster.z + Math.sin(angle) * dist
      const groundY = getTerrainHeight(x, z)
      const floatY = groundY + FLOAT_HEIGHT_MIN + rand() * (FLOAT_HEIGHT_MAX - FLOAT_HEIGHT_MIN)

      basePositions[idx * 3] = x
      basePositions[idx * 3 + 1] = floatY
      basePositions[idx * 3 + 2] = z

      offsets[idx * 3] = rand() * Math.PI * 2
      offsets[idx * 3 + 1] = rand() * Math.PI * 2
      offsets[idx * 3 + 2] = rand() * Math.PI * 2

      speeds[idx] = 0.3 + rand() * 0.7
      idx++
    }
  }

  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(COUNT * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#ccff66') },
    },
    vertexShader: `
      varying float vAlpha;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 120.0 / -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        vAlpha = 1.0;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float glow = exp(-d * d * 3.0);
        if (glow < 0.01) discard;
        gl_FragColor = vec4(uColor, glow * uOpacity * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const points = new THREE.Points(geometry, material)

  let time = 0

  useTask((delta) => {
    const nightFactor = 1 - dayNight.sunFactor

    // Hide entirely during daytime to avoid a wasted draw call
    if (nightFactor < 0.01) {
      points.visible = false
      return
    }

    points.visible = true
    time += delta
    material.uniforms.uOpacity.value = nightFactor

    const posAttr = geometry.getAttribute('position')
    for (let i = 0; i < COUNT; i++) {
      const t = time * speeds[i]
      const ox = offsets[i * 3]
      const oy = offsets[i * 3 + 1]
      const oz = offsets[i * 3 + 2]

      posAttr.array[i * 3] = basePositions[i * 3] + Math.sin(t * 0.8 + ox) * 3
      posAttr.array[i * 3 + 1] = basePositions[i * 3 + 1] + Math.sin(t * 1.2 + oy) * 1
      posAttr.array[i * 3 + 2] = basePositions[i * 3 + 2] + Math.cos(t * 0.6 + oz) * 3
    }
    posAttr.needsUpdate = true
  })
</script>

<T is={points} />
