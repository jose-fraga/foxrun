<script>
  import { T } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import { addObstacle } from '../utils/obstacles.js'

  // Left wall (runs along Z at the barn's left edge)
  addObstacle(43, -28, 4)
  addObstacle(43, -34, 4)
  addObstacle(43, -40, 4)
  addObstacle(43, -46, 4)
  addObstacle(43, -52, 4)

  // Right wall (mirror of left wall)
  addObstacle(67, -28, 4)
  addObstacle(67, -34, 4)
  addObstacle(67, -40, 4)
  addObstacle(67, -46, 4)
  addObstacle(67, -52, 4)

  // Back wall (connects left and right walls)
  addObstacle(49, -28, 4)
  addObstacle(55, -28, 4)
  addObstacle(61, -28, 4)

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
