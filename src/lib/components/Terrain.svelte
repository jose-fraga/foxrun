<script>
  import { T } from '@threlte/core'
  import { Collider } from '@threlte/rapier'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'

  const SIZE = 800
  const SEGMENTS = 256

  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
  geometry.rotateX(-Math.PI / 2)

  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, getTerrainHeight(x, z))
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()

  // Build heightfield data for physics (row-major, matching Rapier expectations)
  const rows = SEGMENTS + 1
  const cols = SEGMENTS + 1
  const heights = new Float32Array(rows * cols)
  const step = SIZE / SEGMENTS
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -SIZE / 2 + c * step
      const z = -SIZE / 2 + r * step
      heights[r * cols + c] = getTerrainHeight(x, z)
    }
  }
</script>

<!-- Terrain mesh -->
<T.Mesh {geometry} receiveShadow>
  <T.MeshStandardMaterial color="#648f5a" />
</T.Mesh>

<!-- Physics heightfield collider -->
<Collider
  shape="heightfield"
  args={[SEGMENTS, SEGMENTS, heights, { x: SIZE, y: 1, z: SIZE }]}
/>
