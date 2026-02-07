<script>
  import { T } from '@threlte/core'
  import { useGltf } from '@threlte/extras'

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
