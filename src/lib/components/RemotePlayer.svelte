<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
  import { characters } from '../stores/character.svelte.js'
  import { loadModel } from '../utils/modelLoader.js'

  let { playerState } = $props()

  // Derive char reactively so {#key} reliably detects character changes
  let remoteChar = $derived(playerState.curr.char)

  function getModelPath(charId) {
    const char = characters.find(c => c.id === charId)
    return char ? char.model : '/Fox.gltf'
  }

  // Animation
  let mixer = null
  let actions = {}
  let currentAction = null

  function playAction(name) {
    if (currentAction === name) return
    const prev = actions[currentAction]
    const next = actions[name]
    if (!next) return
    next.reset().play()
    if (prev) prev.crossFadeTo(next, 0.3, true)
    currentAction = name
  }

  // Interpolated display state ($state needed for runes-mode reactivity)
  let displayX = $state(0)
  let displayY = $state(0)
  let displayZ = $state(0)
  let displayRY = $state(0)

  useTask((delta) => {
    if (!playerState) return

    if (mixer) mixer.update(delta)

    const { curr } = playerState
    const t = 1 - Math.exp(-15 * delta)

    displayX += (curr.x - displayX) * t
    displayY += (curr.y - displayY) * t
    displayZ += (curr.z - displayZ) * t

    // Shortest-path rotation interpolation
    let dAngle = curr.ry - displayRY
    if (dAngle > Math.PI) dAngle -= 2 * Math.PI
    if (dAngle < -Math.PI) dAngle += 2 * Math.PI
    displayRY += dAngle * t

    playAction(curr.anim)
  })
</script>

<T.Group position.x={displayX} position.y={displayY} position.z={displayZ}>
  <T.Group rotation.y={displayRY}>
    {#key remoteChar}
      {#await loadModel(getModelPath(remoteChar)) then value}
        {@const scene = cloneSkeleton(value.scene)}
        <T
          is={scene}
          scale={1}
          position.y={-1.5}
          oncreate={() => {
            mixer = new THREE.AnimationMixer(scene)
            actions = {}
            for (const clip of value.animations) {
              actions[clip.name] = mixer.clipAction(clip)
            }
            currentAction = null
            playAction('Idle')
          }}
        />
      {/await}
    {/key}
  </T.Group>
</T.Group>
