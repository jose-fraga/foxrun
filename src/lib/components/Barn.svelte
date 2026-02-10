<script>
  import { T } from '@threlte/core'
  import { addObstacle } from '../utils/obstacles.js'
  import { loadModel } from '../utils/modelLoader.js'

  // Left wall (x=37, z from -20 to -60)
  for (let z = -20; z >= -60; z -= 4) addObstacle(37, z, 2)

  // Right wall (x=73, z from -20 to -60)
  for (let z = -20; z >= -60; z -= 4) addObstacle(73, z, 2)

  // Back wall (z=-20, x from 37 to 73)
  for (let x = 41; x <= 69; x += 4) addObstacle(x, -20, 2)

  const gltf = loadModel('/Big Barn.glb')

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
