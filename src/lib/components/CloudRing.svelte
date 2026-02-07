<script>
  import { T } from '@threlte/core'
  import * as THREE from 'three'
  import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

  let cloudRingScene = $state(null)

  const loader = new FBXLoader()
  const textureLoader = new THREE.TextureLoader()
  const texture = textureLoader.load('/polygon-starter/textures/PolygonStarter_Texture_01.png')

  loader.load('/polygon-starter/fbx/SM_Generic_CloudRing_01.fbx', (fbx) => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          fog: false,
        })
      }
    })
    cloudRingScene = fbx
  })
</script>

{#if cloudRingScene}
  <T is={cloudRingScene} scale={0.01} position.y={8} />
{/if}
