<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getQuests, allQuestsComplete, setEscaped } from '../stores/questProgress.svelte.js'
  import { getFarmerChat } from '../stores/farmerChat.svelte.js'

  const INTERACT_DIST = 4
  const holeX = $derived(getQuests().holeX)
  const holeZ = $derived(getQuests().holeZ)
  const holeY = $derived(getTerrainHeight(holeX, holeZ) + 0.1)
  const PARTICLE_COUNT = 50

  const quests = $derived(getQuests())
  const ready = $derived(allQuestsComplete() && !quests.cinematicDone)
  let nearHole = $state(false)

  // Swirling particles
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3)
  const particlePhases = new Float32Array(PARTICLE_COUNT)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePhases[i] = Math.random() * Math.PI * 2
    const angle = particlePhases[i]
    const radius = 1 + Math.random() * 2
    particlePositions[i * 3] = Math.cos(angle) * radius
    particlePositions[i * 3 + 1] = Math.random() * 4
    particlePositions[i * 3 + 2] = Math.sin(angle) * radius
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

  // Dark hole on ground
  const holeGeo = new THREE.PlaneGeometry(4, 4)
  holeGeo.rotateX(-Math.PI / 2)
  const holeMat = new THREE.MeshBasicMaterial({
    color: 0x0a0a0a,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  let elapsed = 0

  function handleKeydown(e) {
    if (e.code === 'KeyE' && nearHole && ready) {
      if (getFarmerChat().open) return
      setEscaped()
    }
  }

  useTask((delta) => {
    if (!ready) return

    elapsed += delta

    // Proximity check
    const dx = localPlayerPos.x - holeX
    const dz = localPlayerPos.z - holeZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    nearHole = dist < INTERACT_DIST

    // Animate swirling particles
    const pos = particleGeo.attributes.position.array
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phase = particlePhases[i]
      const t = elapsed * 1.5 + phase
      const radius = 1 + Math.sin(t * 0.5) * 0.8
      pos[i * 3] = Math.cos(t) * radius
      pos[i * 3 + 1] = (pos[i * 3 + 1] + delta * 1.5) % 4
      pos[i * 3 + 2] = Math.sin(t) * radius
    }
    particleGeo.attributes.position.needsUpdate = true
  })
</script>

<svelte:window onkeydown={handleKeydown} />

{#if ready}
  <T.Group position={[holeX, holeY, holeZ]}>
    <!-- Dark hole -->
    <T.Mesh geometry={holeGeo} material={holeMat} />

    <!-- Swirling golden particles -->
    <T is={particles} />

    <!-- Beacon light -->
    <T.PointLight color="#ffd700" intensity={5} distance={30} position.y={3} />
    <T.PointLight color="#ffd700" intensity={2} distance={60} position.y={10} />
  </T.Group>
{/if}

{#if nearHole && ready}
  <div class="prompt">
    Press <kbd>E</kbd> to Escape
  </div>
{/if}

<style>
  .prompt {
    position: fixed;
    bottom: 18%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.65);
    color: #f4d03f;
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    font-family: "permanent-marker", sans-serif;
    font-size: 1rem;
    pointer-events: none;
    z-index: 500;
    white-space: nowrap;
    text-shadow: 0 0 10px rgba(244, 208, 63, 0.5);
  }
  .prompt kbd {
    background: rgba(244, 208, 63, 0.2);
    border: 1px solid rgba(244, 208, 63, 0.4);
    border-radius: 3px;
    padding: 0.1rem 0.35rem;
    font-family: inherit;
    font-weight: bold;
  }
</style>
