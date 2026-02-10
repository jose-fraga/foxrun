<script>
  import { T } from '@threlte/core'
  import { addObstacle } from '../utils/obstacles.js'
  import { loadModel } from '../utils/modelLoader.js'

  // Left wall (runs along Z at the barn's left edge)
  addObstacle(44, -28, 2)
  addObstacle(44, -32, 2)
  addObstacle(44, -36, 2)
  addObstacle(44, -40, 2)
  addObstacle(44, -44, 2)
  addObstacle(44, -48, 2)
  addObstacle(44, -52, 2)

  // Right wall (mirror of left wall)
  addObstacle(66, -28, 2)
  addObstacle(66, -32, 2)
  addObstacle(66, -36, 2)
  addObstacle(66, -40, 2)
  addObstacle(66, -44, 2)
  addObstacle(66, -48, 2)
  addObstacle(66, -52, 2)

  // Back wall (connects left and right walls)
  addObstacle(48, -29, 2)
  addObstacle(52, -29, 2)
  addObstacle(56, -29, 2)
  addObstacle(60, -29, 2)
  addObstacle(64, -29, 2)

  const gltf = loadModel('/OpenBarn.glb')

  function setupBarn(scene) {
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
    scale={5}
    rotation.y={Math.PI}
    position={[55, 0, -40]}
    oncreate={() => setupBarn(value.scene)}
  />
{/await}
