<script>
  import { T } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import { addObstacle } from '../utils/obstacles.js'

  // Left wall (runs along Z at the barn's left edge)
  addObstacle(45, -30, 2.5)
  addObstacle(45, -35, 2.5)
  addObstacle(45, -40, 2.5)
  addObstacle(45, -45, 2.5)
  addObstacle(45, -50, 2.5)

  // Right wall (mirror of left wall)
  addObstacle(65, -30, 2.5)
  addObstacle(65, -35, 2.5)
  addObstacle(65, -40, 2.5)
  addObstacle(65, -45, 2.5)
  addObstacle(65, -50, 2.5)

  // Back wall (connects left and right walls)
  addObstacle(50, -30, 2.5)
  addObstacle(55, -30, 2.5)
  addObstacle(60, -30, 2.5)

  const gltf = useGltf('/OpenBarn.glb')

  function setupBarn(scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
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
