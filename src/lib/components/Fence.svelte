<script>
  import { T } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'

  const gltf = useGltf('/Fence.glb')

  const HALF_SIZE = 180
  const SCALE = 3

  let fenceGroup = $state(null)

  function addFenceLine(group, scene, startX, startZ, endX, endZ, rotY, spacing, skipFirst, skipLast) {
    const dx = endX - startX
    const dz = endZ - startZ
    const length = Math.sqrt(dx * dx + dz * dz)
    const count = Math.round(length / spacing)

    const dirX = dx / length
    const dirZ = dz / length

    const totalUsed = count * spacing
    const offset = (length - totalUsed) / 2

    const iStart = skipFirst ? 1 : 0
    const iEnd = skipLast ? count - 1 : count

    for (let i = iStart; i <= iEnd; i++) {
      const t = offset + spacing * i
      const x = startX + dirX * t
      const z = startZ + dirZ * t
      const y = getTerrainHeight(x, z)

      const clone = scene.clone(true)
      clone.scale.setScalar(SCALE)
      clone.position.set(x, y, z)
      clone.rotation.y = rotY
      group.add(clone)
    }
  }

  function buildFenceSquare(scene) {
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    box.getSize(size)

    const panelWidth = size.x * SCALE
    const spacing = panelWidth * 0.95

    const group = new THREE.Group()
    const H = HALF_SIZE

    // South & North own the corners, East & West skip them
    addFenceLine(group, scene, -H, -H, H, -H, 0, spacing, false, false)              // South
    addFenceLine(group, scene, -H, H, H, H, Math.PI, spacing, false, false)           // North
    addFenceLine(group, scene, H, -H, H, H, Math.PI / 2, spacing, false, false)          // East
    addFenceLine(group, scene, -H, -H, -H, H, -Math.PI / 2, spacing, false, false)     // West

    fenceGroup = group
  }
</script>

{#await gltf then value}
  {#if !fenceGroup}
    <T is={new THREE.Object3D()} oncreate={() => buildFenceSquare(value.scene)} />
  {/if}
{/await}

{#if fenceGroup}
  <T is={fenceGroup} />
{/if}
