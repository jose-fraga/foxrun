<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { addObstacle } from '../utils/obstacles.js'
  import { loadModel } from '../utils/modelLoader.js'

  addObstacle(-100, 110, 3)

  const gltf = loadModel('/Windmill.glb')

  let blades = null
  let rotationSpeed = 1.2

  function setupWindmill(scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
      }
      const name = (child.name || '').toLowerCase()
      if (name.includes('blade') || name.includes('fan') || name.includes('rotor') || name.includes('wing') || name.includes('propeller') || name.includes('sail')) {
        blades = child
      }
    })
  }

  useTask((delta) => {
    if (blades) {
      blades.rotation.z += rotationSpeed * delta
    }
  })
</script>

{#await gltf then value}
  <T
    is={value.scene}
    scale={3}
    position={[-100, 0, 110]}
    oncreate={() => setupWindmill(value.scene)}
  />
{/await}
