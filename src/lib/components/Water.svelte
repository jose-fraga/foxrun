<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { POND_CENTER, POND_RADIUS } from '../utils/pond.js'

  // --- Circular geometry with concentric rings (smooth edges + terrain conform) ---
  const WATER_LIFT = 0.5

  function createPondGeometry(radius, rings, segments) {
    const positions = []
    const uvs = []
    const indices = []

    const cx = POND_CENTER[0]
    const cz = POND_CENTER[1]
    positions.push(0, getTerrainHeight(cx, cz) + WATER_LIFT, 0)
    uvs.push(0.5, 0.5)

    for (let r = 1; r <= rings; r++) {
      const ringRadius = radius * (r / rings)
      const t = r / rings // 0 at center, 1 at edge
      const lift = WATER_LIFT * (1 - t * t) // quadratic falloff to ground at edge
      for (let s = 0; s < segments; s++) {
        const angle = (s / segments) * Math.PI * 2
        const lx = Math.cos(angle) * ringRadius
        const lz = Math.sin(angle) * ringRadius
        const wy = getTerrainHeight(cx + lx, cz + lz) + lift
        positions.push(lx, wy, lz)
        uvs.push(0.5 + (lx / radius) * 0.5, 0.5 + (lz / radius) * 0.5)
      }
    }

    for (let s = 0; s < segments; s++) {
      indices.push(0, 1 + s, 1 + ((s + 1) % segments))
    }
    for (let r = 1; r < rings; r++) {
      const inner = 1 + (r - 1) * segments
      const outer = 1 + r * segments
      for (let s = 0; s < segments; s++) {
        const n = (s + 1) % segments
        indices.push(inner + s, outer + s, outer + n)
        indices.push(inner + s, outer + n, inner + n)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }

  const finalGeo = createPondGeometry(POND_RADIUS, 10, 48)

  // --- Water material (cheapwater triple-rotated normal maps) ---
  const waterNormalMap = new THREE.TextureLoader().load('/water_normal.png', (tex) => {
    tex.flipY = false
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  })

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a7a6a,
    metalness: 0.6,
    roughness: 0.3,
    normalMap: waterNormalMap,
    normalMapType: THREE.ObjectSpaceNormalMap,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  })
  waterMaterial.normalMap.wrapS = THREE.RepeatWrapping
  waterMaterial.normalMap.wrapT = THREE.RepeatWrapping
  waterMaterial.normalMap.repeat.set(4, 4)

  const timeUniform = { value: 0 }

  let normalChunk = ''
  for (let dir = 0.1; dir < 2 * Math.PI; dir += (2 * Math.PI) / 3) {
    const c = Math.cos(dir).toFixed(6)
    const s = Math.sin(dir).toFixed(6)
    const ms = (-Math.sin(dir)).toFixed(6)
    normalChunk += `{
      mat2 rot2d = mat2(${c}, ${ms}, ${s}, ${c});
      vec3 subNormal = texture2D( normalMap, rot2d * vNormalMapUv + vec2(time*0.03, ${dir.toFixed(4)}) ).rgb * 2.0 - 1.0;
      subNormal.xy = rot2d * subNormal.xy;
      normal += subNormal;
    }`
  }

  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.time = timeUniform
    shader.fragmentShader =
      'uniform float time;\n' +
      shader.fragmentShader.replace(
        '\t#include <normal_fragment_maps>',
        normalChunk +
          `
          #ifdef FLIP_SIDED
            normal = - normal;
          #endif
          #ifdef DOUBLE_SIDED
            normal = normal * faceDirection;
          #endif
          normal = normalize( normalMatrix * normal );
          `
      )
  }

  waterMaterial.customProgramCacheKey = function () {
    return 'cheapwater'
  }

  const waterMesh = new THREE.Mesh(finalGeo, waterMaterial)
  waterMesh.position.set(POND_CENTER[0], 0, POND_CENTER[1])
  waterMesh.receiveShadow = true

  // --- Dark pond bed (hides terrain underneath) ---
  const bedGeo = createPondGeometry(POND_RADIUS, 10, 48)
  // Push bed vertices down to create depth
  const bedPos = bedGeo.getAttribute('position')
  for (let i = 0; i < bedPos.count; i++) {
    bedPos.setY(i, bedPos.getY(i) - 0.6)
  }
  bedPos.needsUpdate = true

  const bedMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a3a2a,
    roughness: 1.0,
    metalness: 0.0,
  })
  const bedMesh = new THREE.Mesh(bedGeo, bedMaterial)
  bedMesh.position.set(POND_CENTER[0], 0, POND_CENTER[1])

  // --- Per-frame update (animate flowing normals) ---
  useTask((delta) => {
    timeUniform.value += delta
  })
</script>

<T is={bedMesh} />
<T is={waterMesh} />
