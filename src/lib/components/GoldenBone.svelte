<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getQuests, completeQuest } from '../stores/questProgress.svelte.js'
  import { getFarmerChat } from '../stores/farmerChat.svelte.js'

  const INTERACT_DIST = 4
  const boneX = $derived(getQuests().boneX)
  const boneZ = $derived(getQuests().boneZ)
  const boneY = $derived(getTerrainHeight(boneX, boneZ) + 0.1)
  const PARTICLE_COUNT = 30

  const quests = $derived(getQuests())
  let nearBone = $state(false)
  let digEffect = $state(false)
  let digTimer = 0

  // Glowing ground circle
  const circleGeo = new THREE.CircleGeometry(1.5, 32)
  circleGeo.rotateX(-Math.PI / 2)
  const circleMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  // Floating particles
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3)
  const particleSpeeds = new Float32Array(PARTICLE_COUNT)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.5 + Math.random() * 1.2
    particlePositions[i * 3] = Math.cos(angle) * radius
    particlePositions[i * 3 + 1] = Math.random() * 3
    particlePositions[i * 3 + 2] = Math.sin(angle) * radius
    particleSpeeds[i] = 0.3 + Math.random() * 0.7
  }
  const particleGeo = new THREE.BufferGeometry()
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
  const particleMat = new THREE.PointsMaterial({
    color: 0xffd700,
    size: 0.3,
    sizeAttenuation: true,
    transparent: false,
    depthWrite: true,
  })
  const particles = new THREE.Points(particleGeo, particleMat)

  // Dig burst particles
  const BURST_COUNT = 40
  const burstPositions = new Float32Array(BURST_COUNT * 3)
  const burstVelocities = []
  for (let i = 0; i < BURST_COUNT; i++) {
    burstPositions[i * 3] = 0
    burstPositions[i * 3 + 1] = 0
    burstPositions[i * 3 + 2] = 0
    const angle = Math.random() * Math.PI * 2
    const upSpeed = 2 + Math.random() * 4
    const outSpeed = 1 + Math.random() * 2
    burstVelocities.push({
      x: Math.cos(angle) * outSpeed,
      y: upSpeed,
      z: Math.sin(angle) * outSpeed,
    })
  }
  const burstGeo = new THREE.BufferGeometry()
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3))
  const burstMat = new THREE.PointsMaterial({
    color: 0xffd700,
    size: 0.35,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  })
  const burstPoints = new THREE.Points(burstGeo, burstMat)

  let pulseTime = 0

  function handleKeydown(e) {
    if (e.code === 'KeyE' && nearBone && !quests.bone && !digEffect) {
      if (getFarmerChat().open) return
      digEffect = true
      digTimer = 0
      completeQuest('bone')
    }
  }

  useTask((delta) => {
    if (quests.bone && !digEffect) return

    // Proximity check
    const dx = localPlayerPos.x - boneX
    const dz = localPlayerPos.z - boneZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    nearBone = dist < INTERACT_DIST

    // Pulse glow
    pulseTime += delta
    circleMat.opacity = 0.25 + Math.sin(pulseTime * 2) * 0.15

    // Animate floating particles
    if (!digEffect) {
      const pos = particleGeo.attributes.position.array
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos[i * 3 + 1] += particleSpeeds[i] * delta
        if (pos[i * 3 + 1] > 3) pos[i * 3 + 1] = 0
      }
      particleGeo.attributes.position.needsUpdate = true
    }

    // Dig burst animation
    if (digEffect) {
      digTimer += delta
      const pos = burstGeo.attributes.position.array
      for (let i = 0; i < BURST_COUNT; i++) {
        const v = burstVelocities[i]
        pos[i * 3] += v.x * delta
        pos[i * 3 + 1] += v.y * delta
        pos[i * 3 + 2] += v.z * delta
        v.y -= 6 * delta // gravity
      }
      burstGeo.attributes.position.needsUpdate = true
      burstMat.opacity = Math.max(0, 1 - digTimer / 1.5)

      if (digTimer > 1.5) {
        digEffect = false
      }
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !quests.bone}
  <T.Group position={[boneX, boneY, boneZ]}>
    <!-- Glowing circle on ground -->
    <T.Mesh geometry={circleGeo} material={circleMat} />

    <!-- Golden particles floating up -->
    <T is={particles} />

    <!-- Point light for glow -->
    <T.PointLight color="#ffd700" intensity={2} distance={10} position.y={1} />
  </T.Group>
{/if}

{#if digEffect}
  <T.Group position={[boneX, boneY, boneZ]}>
    <T is={burstPoints} />
  </T.Group>
{/if}

{#if nearBone && !quests.bone && !digEffect}
  <div class="prompt">
    Press <kbd>E</kbd> to dig
  </div>
{/if}

<style>
  .prompt {
    position: fixed;
    bottom: 18%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    font-family: "permanent-marker", sans-serif;
    font-size: 0.9rem;
    pointer-events: none;
    z-index: 500;
    white-space: nowrap;
  }
  .prompt kbd {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    padding: 0.1rem 0.35rem;
    font-family: inherit;
    font-weight: bold;
  }
</style>
