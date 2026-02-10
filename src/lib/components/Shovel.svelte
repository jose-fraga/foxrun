<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { loadModel } from '../utils/modelLoader.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getQuests, completeQuest } from '../stores/questProgress.svelte.js'
  import { getFarmerChat } from '../stores/farmerChat.svelte.js'
  import { setInteractionPrompt } from '../stores/interactionPrompt.svelte.js'

  const shovelGltf = loadModel('/Shovel.glb')

  const INTERACT_DIST = 4
  const SX = 55
  const SZ = -14
  const SY = getTerrainHeight(SX, SZ)

  const quests = $derived(getQuests())
  const visible = $derived(quests.farmerInfo && !quests.shovel)
  let nearShovel = $state(false)
  let burstActive = $state(false)
  let burstTimer = 0

  // Pickup burst particles
  const BURST_COUNT = 25
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
    color: 0xcccccc,
    size: 0.25,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  })
  const burstPoints = new THREE.Points(burstGeo, burstMat)

  function handleKeydown(e) {
    if (e.code === 'KeyE' && nearShovel && visible && !burstActive) {
      if (getFarmerChat().open) return
      burstActive = true
      burstTimer = 0
      setInteractionPrompt('')
      completeQuest('shovel')
    }
  }

  useTask((delta) => {
    if (!visible && !burstActive) return

    // Proximity check
    const dx = localPlayerPos.x - SX
    const dz = localPlayerPos.z - SZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    const wasNear = nearShovel
    nearShovel = dist < INTERACT_DIST

    if (visible) {
      if (nearShovel && !wasNear) setInteractionPrompt('grab')
      if (!nearShovel && wasNear) setInteractionPrompt('')
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

  function setupShovel(scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
      }
    })
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible}
  {#await shovelGltf then value}
    <T
      is={value.scene}
      position={[SX, SY, SZ]}
      scale={3}
      rotation.z={0.3}
      oncreate={() => setupShovel(value.scene)}
    />
  {/await}
  <T.PointLight color="#ffffcc" intensity={1.5} distance={8} position={[SX, SY + 2, SZ]} />
{/if}

{#if burstActive}
  <T.Group position={[SX, SY + 1, SZ]}>
    <T is={burstPoints} />
  </T.Group>
{/if}
