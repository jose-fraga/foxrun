<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { loadModel } from '../utils/modelLoader.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getQuests, completeQuest } from '../stores/questProgress.svelte.js'
  import { getFarmerChat } from '../stores/farmerChat.svelte.js'
  import { setInteractionPrompt } from '../stores/interactionPrompt.svelte.js'

  const cropGltf = loadModel('/Crops.glb')

  const X = 95
  const Z = -40
  const Y = getTerrainHeight(X, Z)

  const INTERACT_DIST = 5
  const quests = $derived(getQuests())
  let nearCrops = $state(false)
  let burstActive = $state(false)
  let burstTimer = 0

  // Brown dirt patch that follows terrain contour
  const SOIL_SIZE = 20
  const SOIL_SEGS = 16
  const soilGeo = new THREE.PlaneGeometry(SOIL_SIZE, SOIL_SIZE, SOIL_SEGS, SOIL_SEGS)
  soilGeo.rotateX(-Math.PI / 2)
  const posAttr = soilGeo.attributes.position
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i) + X
    const vz = posAttr.getZ(i) + Z
    const terrainY = getTerrainHeight(vx, vz) - Y + 0.15
    posAttr.setY(i, terrainY)
  }
  posAttr.needsUpdate = true
  soilGeo.computeVertexNormals()
  const soilMat = new THREE.MeshLambertMaterial({ color: 0x8d6b27 })

  // Pickup burst particles
  const BURST_COUNT = 30
  const burstPositions = new Float32Array(BURST_COUNT * 3)
  const burstVelocities = []
  for (let i = 0; i < BURST_COUNT; i++) {
    burstPositions[i * 3] = 0
    burstPositions[i * 3 + 1] = 0
    burstPositions[i * 3 + 2] = 0
    const angle = Math.random() * Math.PI * 2
    const upSpeed = 2 + Math.random() * 3
    const outSpeed = 0.5 + Math.random() * 1.5
    burstVelocities.push({
      x: Math.cos(angle) * outSpeed,
      y: upSpeed,
      z: Math.sin(angle) * outSpeed,
    })
  }
  const burstGeo = new THREE.BufferGeometry()
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3))
  const burstMat = new THREE.PointsMaterial({
    color: 0xff4444,
    size: 0.3,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  })
  const burstPoints = new THREE.Points(burstGeo, burstMat)

  function handleKeydown(e) {
    if (e.code === 'KeyE' && nearCrops && !quests.tomatoes && !burstActive) {
      if (getFarmerChat().open) return
      burstActive = true
      burstTimer = 0
      setInteractionPrompt('')
      completeQuest('tomatoes')
    }
  }

  useTask((delta) => {
    // Proximity check
    const dx = localPlayerPos.x - X
    const dz = localPlayerPos.z - Z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const wasNear = nearCrops
    nearCrops = dist < INTERACT_DIST

    if (!quests.tomatoes) {
      if (nearCrops && !wasNear) setInteractionPrompt('pick')
      if (!nearCrops && wasNear) setInteractionPrompt('')
    }

    // Burst animation
    if (burstActive) {
      burstTimer += delta
      const pos = burstGeo.attributes.position.array
      for (let i = 0; i < BURST_COUNT; i++) {
        const v = burstVelocities[i]
        pos[i * 3] += v.x * delta
        pos[i * 3 + 1] += v.y * delta
        pos[i * 3 + 2] += v.z * delta
        v.y -= 6 * delta
      }
      burstGeo.attributes.position.needsUpdate = true
      burstMat.opacity = Math.max(0, 1 - burstTimer / 1.5)
      if (burstTimer > 1.5) burstActive = false
    }
  })

  function setupCrop(scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
      }
    })
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Brown soil patch -->
<T.Mesh geometry={soilGeo} material={soilMat} position={[X, Y + 0.05, Z]} />

{#await cropGltf then value}
  <T
    is={value.scene}
    position={[X, Y - 0, Z]}
    scale={10}
    rotation.y={Math.PI / 2}
    oncreate={() => setupCrop(value.scene)}
  />
{/await}

{#if burstActive}
  <T.Group position={[X, Y + 1, Z]}>
    <T is={burstPoints} />
  </T.Group>
{/if}
