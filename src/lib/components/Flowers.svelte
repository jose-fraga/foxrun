<script>
  import { T } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import * as THREE from 'three'
  import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { applyBrushPaintStyle } from '../utils/modelLoader.js'

  const gltf = useGltf('/Flowers.glb')

  // Small clusters scattered around the field
  const clusters = [
    // Near the pond (but outside it)
    { x: -42, z: -55, count: 4 },
    // Between windmill and barn
    { x: 25, z: -15, count: 3 },
    // North of the farmer
    { x: -20, z: 30, count: 5 },
    // East side open field
    { x: 80, z: 20, count: 3 },
    // South-west area
    { x: -40, z: -100, count: 4 },
    // Near the fence, north
    { x: 10, z: 100, count: 3 },
  ]

  let seed = 777
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  // Generate individual flower positions from clusters
  const flowers = []
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i++) {
      const angle = rand() * Math.PI * 2
      const dist = 1.5 + rand() * 4
      const x = cluster.x + Math.cos(angle) * dist
      const z = cluster.z + Math.sin(angle) * dist
      flowers.push({
        x,
        z,
        y: getTerrainHeight(x, z),
        rotY: rand() * Math.PI * 2,
        scale: 1.5 + rand() * 1.5,
      })
    }
  }

  // Merge all flower clones into minimal draw calls (one mesh per material)
  let mergedGroup = $state(null)

  gltf.then((value) => {
    applyBrushPaintStyle(value)
    const geosByMaterial = new Map()
    const dummy = new THREE.Object3D()

    for (const f of flowers) {
      const clone = value.scene.clone()
      dummy.position.set(f.x, f.y, f.z)
      dummy.rotation.set(0, f.rotY, 0)
      dummy.scale.setScalar(f.scale)
      dummy.updateMatrix()

      clone.applyMatrix4(dummy.matrix)
      clone.updateMatrixWorld(true)

      clone.traverse((child) => {
        if (!child.isMesh) return
        const matId = child.material.uuid
        if (!geosByMaterial.has(matId)) {
          geosByMaterial.set(matId, { material: child.material, geometries: [] })
        }
        const geo = child.geometry.clone()
        geo.applyMatrix4(child.matrixWorld)
        geosByMaterial.get(matId).geometries.push(geo)
      })
    }

    const group = new THREE.Group()
    for (const [, { material, geometries }] of geosByMaterial) {
      const merged = mergeGeometries(geometries, false)
      if (!merged) continue
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, material)
      group.add(mesh)
    }

    mergedGroup = group
  })
</script>

{#if mergedGroup}
  <T is={mergedGroup} />
{/if}
