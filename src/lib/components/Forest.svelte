<script>
  import { T } from '@threlte/core'
  import { useGltf } from '@threlte/extras'

  const trees = {
    t1: useGltf('/nature-kit/CommonTree_1.gltf'),
    t2: useGltf('/nature-kit/CommonTree_2.gltf'),
    t3: useGltf('/nature-kit/CommonTree_3.gltf'),
    t4: useGltf('/nature-kit/CommonTree_4.gltf'),
    t5: useGltf('/nature-kit/CommonTree_5.gltf'),
  }

  const treeKeys = ['t1', 't2', 't3', 't4', 't5']

  // Seeded random for consistent placement
  let s = 42
  function rand() {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }

  function scatter(count, minRadius, maxRadius) {
    const items = []
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2
      const r = minRadius + rand() * (maxRadius - minRadius)
      items.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        rotY: rand() * Math.PI * 2,
        scale: 0.8 + rand() * 0.5,
      })
    }
    return items
  }

  const positions = scatter(300, 10, 190)
</script>

{#each positions as pos, i}
  {#await trees[treeKeys[i % 5]] then value}
    <T
      is={value.scene.clone()}
      position.x={pos.x}
      position.z={pos.z}
      rotation.y={pos.rotY}
      scale={pos.scale}
    />
  {/await}
{/each}
