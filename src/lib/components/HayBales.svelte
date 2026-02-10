<script>
  import { T } from "@threlte/core";
  import { loadModel } from "../utils/modelLoader.js";
    import { getTerrainHeight } from "../utils/terrain.js";

  const gltf = loadModel("/Hay.glb");

  // Inside the barn, back-right corner (barn floor is at y=0)
  const bales = [
    { x: 65, z: -35, rotY: 0.3, scale: 50 },
  ];

  function setup(scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });
  }
</script>

{#await gltf then value}
  {#each bales as bale}
    <T
      is={value.scene.clone()}
      position={[bale.x, getTerrainHeight(bale.x, bale.z), bale.z]}
      rotation.y={bale.rotY}
      scale={bale.scale}
      oncreate={(ref) => setup(ref)}
    />
  {/each}
{/await}
