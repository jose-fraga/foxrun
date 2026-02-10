<script>
  import { T } from '@threlte/core'
  import { addObstacle } from '../utils/obstacles.js'
  import { loadModel } from '../utils/modelLoader.js'
  import { getTerrainHeight } from '../utils/terrain.js'

  const gltf = loadModel('/ChickenCoop.glb')

  const CX = -150
  const CZ = 40
  const CY = getTerrainHeight(CX, CZ)

  addObstacle(CX, CZ, 4)

  function setup(scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
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
