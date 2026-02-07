<script>
  import { T, useTask } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import * as THREE from 'three'
  import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

  let { playerState } = $props()

  const gltf = useGltf('/Fox.gltf')

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

  // Clone scene properly (SkeletonUtils handles skinned meshes)
  let clonedScene = $state(null)

  useTask((delta) => {
    if (!playerState) return

    if (mixer) mixer.update(delta)

    const { prev, curr } = playerState
    const elapsed = performance.now() - curr.time
    const interval = curr.time - prev.time

    if (interval > 0) {
      const t = Math.min(1, Math.max(0, elapsed / interval))

      displayX = prev.x + (curr.x - prev.x) * t
      displayY = prev.y + (curr.y - prev.y) * t
      displayZ = prev.z + (curr.z - prev.z) * t

      // Shortest-path rotation interpolation
      let dAngle = curr.ry - prev.ry
      if (dAngle > Math.PI) dAngle -= 2 * Math.PI
      if (dAngle < -Math.PI) dAngle += 2 * Math.PI
      displayRY = prev.ry + dAngle * t
    } else {
      displayX = curr.x
      displayY = curr.y
      displayZ = curr.z
      displayRY = curr.ry
    }

    playAction(curr.anim)
  })
</script>

<T.Group position.x={displayX} position.y={displayY} position.z={displayZ}>
  <T.Group rotation.y={displayRY}>
    {#await gltf then value}
      {@const scene = cloneSkeleton(value.scene)}
      <T
        is={scene}
        scale={1}
        position.y={-1.5}
        oncreate={() => {
          mixer = new THREE.AnimationMixer(scene)
          for (const clip of value.animations) {
            actions[clip.name] = mixer.clipAction(clip)
          }
          playAction('Idle')
        }}
      />
    {/await}
  </T.Group>
</T.Group>
