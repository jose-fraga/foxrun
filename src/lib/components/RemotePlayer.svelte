<script>
  import { T, useTask } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import * as THREE from 'three'
  import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
  import { characters } from '../stores/character.svelte.js'

  let { playerState } = $props()

  // Preload all character models
  const allModels = {}
  for (const char of characters) {
    allModels[char.id] = useGltf(char.model)
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
    {#key playerState.curr.char}
      {#await allModels[playerState.curr.char || 'husky'] then value}
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
