<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getQuests, allQuestsComplete, setEscaped } from '../stores/questProgress.svelte.js'
  import { getFarmerChat } from '../stores/farmerChat.svelte.js'
  import { setInteractionPrompt } from '../stores/interactionPrompt.svelte.js'

  const INTERACT_DIST = 4
  const holeX = $derived(getQuests().holeX)
  const holeZ = $derived(getQuests().holeZ)
  const holeY = $derived(getTerrainHeight(holeX, holeZ) + 0.1)
  const PARTICLE_COUNT = 50

  const quests = $derived(getQuests())
  const ready = $derived(allQuestsComplete() && !quests.cinematicDone)
  const showExit = $derived(quests.escaped)
  const exitZ = $derived(holeZ - 6)
  const exitY = $derived(getTerrainHeight(holeX, holeZ - 6) + 0.1)
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

  // Organic brush-painted hole shape
  const holeShape = new THREE.Shape()
  const HOLE_SEGMENTS = 32
  for (let i = 0; i <= HOLE_SEGMENTS; i++) {
    const angle = (i / HOLE_SEGMENTS) * Math.PI * 2
    const wobble = 1
      + 0.12 * Math.sin(angle * 3 + 0.5)
      + 0.08 * Math.cos(angle * 5 + 1.7)
      + 0.06 * Math.sin(angle * 7 + 3.2)
      + 0.04 * Math.cos(angle * 11 + 0.3)
    const r = 2.0 * wobble
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    if (i === 0) holeShape.moveTo(x, y)
    else holeShape.lineTo(x, y)
  }
  const holeGeo = new THREE.ShapeGeometry(holeShape)
  holeGeo.rotateX(-Math.PI / 2)

  // Dirt rim ring around hole
  const rimShape = new THREE.Shape()
  const rimInner = new THREE.Path()
  for (let i = 0; i <= HOLE_SEGMENTS; i++) {
    const angle = (i / HOLE_SEGMENTS) * Math.PI * 2
    const wobble = 1
      + 0.12 * Math.sin(angle * 3 + 0.5)
      + 0.08 * Math.cos(angle * 5 + 1.7)
      + 0.06 * Math.sin(angle * 7 + 3.2)
      + 0.04 * Math.cos(angle * 11 + 0.3)
    const rOuter = 2.5 * wobble
    const rInner = 2.0 * wobble
    const xO = Math.cos(angle) * rOuter
    const yO = Math.sin(angle) * rOuter
    const xI = Math.cos(angle) * rInner
    const yI = Math.sin(angle) * rInner
    if (i === 0) { rimShape.moveTo(xO, yO); rimInner.moveTo(xI, yI) }
    else { rimShape.lineTo(xO, yO); rimInner.lineTo(xI, yI) }
  }
  rimShape.holes.push(rimInner)
  const rimGeo = new THREE.ShapeGeometry(rimShape)
  rimGeo.rotateX(-Math.PI / 2)
  const rimMat = new THREE.MeshBasicMaterial({
    color: 0x3a2a1a,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  const holeMat = new THREE.MeshBasicMaterial({
    color: 0x0a0a0a,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  let elapsed = 0
  let exitTimer = 0
  let showExitHole = $state(false)

  $effect(() => {
    if (showExit) {
      exitTimer = 0
      showExitHole = false
    }
  })

  function handleKeydown(e) {
    if (e.code === 'KeyE' && nearHole && ready) {
      if (getFarmerChat().open) return
      setInteractionPrompt('')
      setEscaped()
    }
  }

  useTask((delta) => {
    // Stagger exit hole appearance
    if (showExit && !showExitHole) {
      exitTimer += delta
      if (exitTimer >= 1) showExitHole = true
    }

    if (!ready) return

    elapsed += delta

    // Proximity check
    const dx = localPlayerPos.x - holeX
    const dz = localPlayerPos.z - holeZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    const wasNear = nearHole
    nearHole = dist < INTERACT_DIST
    if (nearHole && !wasNear) setInteractionPrompt('dig')
    if (!nearHole && wasNear) setInteractionPrompt('')

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

{#if showExit}
  <!-- Entry hole (inside fence) — appears immediately -->
  <T.Group position={[holeX, holeY, holeZ]}>
    <T.Mesh geometry={rimGeo} material={rimMat} position.y={0.02} />
    <T.Mesh geometry={holeGeo} material={holeMat} />
  </T.Group>
{/if}

{#if showExitHole}
  <!-- Exit hole (outside fence) — appears after 1s delay -->
  <T.Group position={[holeX, exitY, exitZ]}>
    <T.Mesh geometry={rimGeo} material={rimMat} position.y={0.02} />
    <T.Mesh geometry={holeGeo} material={holeMat} />
    <T.PointLight color="#ffd700" intensity={3} distance={15} position.y={1} />
  </T.Group>
{/if}

