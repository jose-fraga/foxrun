<script>
  import { T } from '@threlte/core'
  import { addObstacle } from '../utils/obstacles.js'
  import { loadModel } from '../utils/modelLoader.js'

  const TX = 120
  const TZ = -120

  // Elongated collision — front, center, back along the tractor's angled body
  const cos = Math.cos(-0.4)
  const sin = Math.sin(-0.4)
  addObstacle(TX + sin * 4, TZ + cos * 4, 3.5)
  addObstacle(TX, TZ, 3.5)
  addObstacle(TX - sin * 4, TZ - cos * 4, 3.5)
  addObstacle(TX - sin * 8, TZ - cos * 8, 3.5)

  const gltf = loadModel('/Tractor.glb')

  function setupTractor(scene) {
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
    scale={1}
    rotation.y={-0.4}
    position={[TX, 0, TZ]}
    oncreate={() => setupTractor(value.scene)}
  />
{/await}
