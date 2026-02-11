<script>
  import { T } from '@threlte/core'
  import * as THREE from 'three'
  import { addObstacle } from '../utils/obstacles.js'
  import { loadModel } from '../utils/modelLoader.js'
  import { getTerrainHeight } from '../utils/terrain.js'

  const gltf = loadModel('/ChickenCoop.glb')

  const CX = -150
  const CZ = 40
  const CY = getTerrainHeight(CX, CZ)

  addObstacle(CX, CZ, 4)

  const toonGrad = new THREE.DataTexture(
    new Uint8Array([100, 100, 100, 255, 255, 255, 255, 255]),
    2, 1, THREE.RGBAFormat
  )
  toonGrad.minFilter = THREE.NearestFilter
  toonGrad.magFilter = THREE.NearestFilter
  toonGrad.needsUpdate = true

  function setup(scene) {
    scene.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of mats) {
        if (mat.isMeshToonMaterial) {
          mat.gradientMap = toonGrad
          mat.emissiveIntensity = 0.3
          if (mat.normalMap) { mat.normalMap.dispose(); mat.normalMap = null }
          if (mat.bumpMap) { mat.bumpMap.dispose(); mat.bumpMap = null }
          if (mat.roughnessMap) { mat.roughnessMap.dispose(); mat.roughnessMap = null }
          mat.needsUpdate = true
        }
      }
    })
  }
</script>

{#await gltf then value}
  <T
    is={value.scene}
    position={[CX, CY, CZ]}
    scale={3}
    rotation.y={0.5}
    oncreate={() => setup(value.scene)}
  />
{/await}
