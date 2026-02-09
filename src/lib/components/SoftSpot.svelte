<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { localPlayerPos } from '../utils/playerPosition.js'
  import { getQuests, completeQuest, allQuestsComplete } from '../stores/questProgress.svelte.js'
  import { getFarmerChat } from '../stores/farmerChat.svelte.js'
  import { setInteractionPrompt } from '../stores/interactionPrompt.svelte.js'

  const INTERACT_DIST = 4
  const quests = $derived(getQuests())
  const spotX = $derived(quests.holeX)
  const spotZ = $derived(quests.holeZ)
  const spotY = $derived(getTerrainHeight(spotX, spotZ) + 0.1)

  let nearSpot = $state(false)
  let burstActive = $state(false)
  let burstTimer = 0

  // Shows when: tomatoes picked, soft spot not yet marked
  const showGlow = $derived(quests.tomatoes && !quests.softspot)
  // Shows red X when: soft spot marked, until player escapes
  const showMark = $derived(quests.softspot && !quests.escaped)

  // Pulsing ground glow (amber/brown tone)
  const circleGeo = new THREE.CircleGeometry(1.8, 32)
  circleGeo.rotateX(-Math.PI / 2)
  const circleMat = new THREE.MeshBasicMaterial({
    color: 0xcc8833,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  // Floating particles (earthy tones)
  const PARTICLE_COUNT = 20
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3)
  const particleSpeeds = new Float32Array(PARTICLE_COUNT)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.4 + Math.random() * 1.4
    particlePositions[i * 3] = Math.cos(angle) * radius
    particlePositions[i * 3 + 1] = Math.random() * 2.5
    particlePositions[i * 3 + 2] = Math.sin(angle) * radius
    particleSpeeds[i] = 0.2 + Math.random() * 0.5
  }
  const particleGeo = new THREE.BufferGeometry()
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
  const particleMat = new THREE.PointsMaterial({
    color: 0xddaa44,
    size: 0.25,
    sizeAttenuation: true,
    transparent: false,
    depthWrite: true,
  })
  const particles = new THREE.Points(particleGeo, particleMat)

  // Burst particles on marking
  const BURST_COUNT = 30
  const burstPositions = new Float32Array(BURST_COUNT * 3)
  const burstVelocities = []
  for (let i = 0; i < BURST_COUNT; i++) {
    burstPositions[i * 3] = 0
    burstPositions[i * 3 + 1] = 0
    burstPositions[i * 3 + 2] = 0
    const angle = Math.random() * Math.PI * 2
    const upSpeed = 1.5 + Math.random() * 3
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
    color: 0xcc2222,
    size: 0.3,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  })
  const burstPoints = new THREE.Points(burstGeo, burstMat)

  // Brush-painted red X mark (two crossed strokes)
  function makeStrokeShape(length, width) {
    const SEGS = 24
    const shape = new THREE.Shape()
    const halfL = length / 2
    const halfW = width / 2
    // Elongated ellipse-ish with wobble
    for (let i = 0; i <= SEGS; i++) {
      const angle = (i / SEGS) * Math.PI * 2
      const wobble = 1 + 0.1 * Math.sin(angle * 5 + 0.8) + 0.07 * Math.cos(angle * 7 + 2.1)
      const px = Math.cos(angle) * halfL * wobble
      const py = Math.sin(angle) * halfW * wobble
      if (i === 0) shape.moveTo(px, py)
      else shape.lineTo(px, py)
    }
    return shape
  }

  const stroke1Geo = new THREE.ShapeGeometry(makeStrokeShape(3.5, 0.4))
  stroke1Geo.rotateX(-Math.PI / 2)
  stroke1Geo.rotateY(Math.PI / 4) // 45 degrees

  const stroke2Geo = new THREE.ShapeGeometry(makeStrokeShape(3.5, 0.4))
  stroke2Geo.rotateX(-Math.PI / 2)
  stroke2Geo.rotateY(-Math.PI / 4) // -45 degrees

  const xMat = new THREE.MeshBasicMaterial({
    color: 0xcc2222,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  let pulseTime = 0

  function handleKeydown(e) {
    if (e.code === 'KeyE' && nearSpot && showGlow && !burstActive) {
      if (getFarmerChat().open) return
      burstActive = true
      burstTimer = 0
      setInteractionPrompt('')
      completeQuest('softspot')
    }
  }

  useTask((delta) => {
    if (!showGlow && !burstActive && !showMark) return

    // Proximity check
    const dx = localPlayerPos.x - spotX
    const dz = localPlayerPos.z - spotZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    const wasNear = nearSpot
    nearSpot = dist < INTERACT_DIST

    if (showGlow) {
      if (nearSpot && !wasNear) setInteractionPrompt('mark')
      if (!nearSpot && wasNear) setInteractionPrompt('')

      // Pulse glow
      pulseTime += delta
      circleMat.opacity = 0.25 + Math.sin(pulseTime * 2) * 0.15

      // Animate floating particles
      const pos = particleGeo.attributes.position.array
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos[i * 3 + 1] += particleSpeeds[i] * delta
        if (pos[i * 3 + 1] > 2.5) pos[i * 3 + 1] = 0
      }
      particleGeo.attributes.position.needsUpdate = true
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
</script>

<svelte:window onkeydown={handleKeydown} />

{#if showGlow}
  <T.Group position={[spotX, spotY, spotZ]}>
    <T.Mesh geometry={circleGeo} material={circleMat} />
    <T is={particles} />
    <T.PointLight color="#cc8833" intensity={2} distance={10} position.y={1} />
  </T.Group>
{/if}

{#if showMark}
  <T.Group position={[spotX, spotY + 0.05, spotZ]}>
    <T.Mesh geometry={stroke1Geo} material={xMat} />
    <T.Mesh geometry={stroke2Geo} material={xMat} />
  </T.Group>
{/if}

{#if burstActive}
  <T.Group position={[spotX, spotY, spotZ]}>
    <T is={burstPoints} />
  </T.Group>
{/if}
