<script>
  import { T } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'

  const gltf = useGltf('/Fence.glb')

  const HALF_SIZE = 180
  const SCALE = 3

  let instancedMeshes = $state(null)

  function collectTransforms() {
    // First, measure a panel to get spacing
    const tempScene = new THREE.Group()
    const box = new THREE.Box3()
    // We'll compute box from the gltf scene later
    return null
  }

  function computeFencePositions(panelWidth) {
    const spacing = panelWidth * 0.95
    const H = HALF_SIZE
    const transforms = []

    function addLine(startX, startZ, endX, endZ, rotY) {
      const dx = endX - startX
      const dz = endZ - startZ
      const length = Math.sqrt(dx * dx + dz * dz)
      const count = Math.round(length / spacing)
      const dirX = dx / length
      const dirZ = dz / length
      const totalUsed = count * spacing
      const offset = (length - totalUsed) / 2

      for (let i = 0; i <= count; i++) {
        const t = offset + spacing * i
        const x = startX + dirX * t
        const z = startZ + dirZ * t
        const y = getTerrainHeight(x, z)
        transforms.push({ x, y, z, rotY })
      }
    }

    addLine(-H, -H, H, -H, 0)                // South
    addLine(-H, H, H, H, Math.PI)            // North
    addLine(H, -H, H, H, Math.PI / 2)        // East
    addLine(-H, -H, -H, H, -Math.PI / 2)     // West

    return transforms
  }

  function buildInstancedFences(scene) {
    // Measure panel width from the source scene
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    box.getSize(size)
    const panelWidth = size.x * SCALE

    // Collect all fence panel transforms
    const transforms = computeFencePositions(panelWidth)
    const count = transforms.length

    // Find all meshes in the scene and create one InstancedMesh per mesh
    const meshes = []
    scene.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child)
      }
    })

    const dummy = new THREE.Object3D()
    const result = []

    for (const srcMesh of meshes) {
      const instMesh = new THREE.InstancedMesh(srcMesh.geometry, srcMesh.material, count)

      // Apply the source mesh's own local transform to each instance
      const srcMatrix = new THREE.Matrix4()
      srcMesh.updateWorldMatrix(true, false)
      srcMatrix.copy(srcMesh.matrixWorld)
      // Remove the scene root transform (we only want the mesh-local offset)
      const sceneInverse = new THREE.Matrix4().copy(scene.matrixWorld).invert()
      srcMatrix.premultiply(sceneInverse)

      const instanceMatrix = new THREE.Matrix4()

      for (let i = 0; i < count; i++) {
        const t = transforms[i]
        dummy.position.set(t.x, t.y, t.z)
        dummy.rotation.set(0, t.rotY, 0)
        dummy.scale.setScalar(SCALE)
        dummy.updateMatrix()

        // Combine: fence world transform × mesh local offset
        instanceMatrix.multiplyMatrices(dummy.matrix, srcMatrix)
        instMesh.setMatrixAt(i, instanceMatrix)
      }

      instMesh.instanceMatrix.needsUpdate = true
      instMesh.frustumCulled = false
      result.push(instMesh)
    }

    instancedMeshes = result
  }
</script>

{#await gltf then value}
  {#if !instancedMeshes}
    <T is={new THREE.Object3D()} oncreate={() => buildInstancedFences(value.scene)} />
  {/if}
{/await}

{#if instancedMeshes}
  {#each instancedMeshes as mesh}
    <T is={mesh} />
  {/each}
{/if}
