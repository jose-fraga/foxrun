<script>
  import { T, useTask } from '@threlte/core'
  import * as THREE from 'three'
  import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
  import { getTerrainHeight } from '../utils/terrain.js'
  import { dayNight } from '../stores/dayNight.js'
  import { loadModel } from '../utils/modelLoader.js'

  const gltf = loadModel('/Butterfly.glb')

  const COUNT = 4
  const FLUTTER_HEIGHT = 2.5
  const WANDER_SPEED = 2.5
  const WANDER_RADIUS = 8

  const SPAWN_POINTS = [
    { x: -42, z: -55 },
    { x: 25, z: -15 },
    { x: -20, z: 30 },
    { x: 80, z: 20 },
  ]

  let seed = 77
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  let butterflies = []

  function pickTarget(b) {
    const angle = rand() * Math.PI * 2
    const dist = rand() * WANDER_RADIUS
    b.targetX = b.homeX + Math.cos(angle) * dist
    b.targetZ = b.homeZ + Math.sin(angle) * dist
  }

  for (let i = 0; i < COUNT; i++) {
    const sp = SPAWN_POINTS[i]
    const ox = (rand() - 0.5) * 6
    const oz = (rand() - 0.5) * 6
    const b = {
      homeX: sp.x + ox,
      homeZ: sp.z + oz,
      x: sp.x + ox,
      z: sp.z + oz,
      y: 0,
      rotY: rand() * Math.PI * 2,
      flapSpeed: 6 + rand() * 4,
      flapPhase: rand() * Math.PI * 2,
      bobPhase: rand() * Math.PI * 2,
      bobSpeed: 0.8 + rand() * 0.6,
      targetX: 0,
      targetZ: 0,
      pauseTimer: rand() * 3,
      moving: false,
      group: null,
      wingObjs: [],
      scale: 0.04,
    }
    pickTarget(b)
    butterflies.push(b)
  }

  function splitMeshIntoWings(mesh, leftPivot, rightPivot) {
    const geo = mesh.geometry
    const pos = geo.attributes.position
    const idx = geo.index
    const hasNormals = !!geo.attributes.normal
    const hasUV = !!geo.attributes.uv

    const sides = [[], []]
    const sideNormals = [[], []]
    const sideUVs = [[], []]

    const triCount = idx ? idx.count / 3 : pos.count / 3
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
      const avgX = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3
      const s = avgX >= 0 ? 1 : 0

      for (const ii of [i0, i1, i2]) {
        sides[s].push(pos.getX(ii), pos.getY(ii), pos.getZ(ii))
        if (hasNormals) {
          const n = geo.attributes.normal
          sideNormals[s].push(n.getX(ii), n.getY(ii), n.getZ(ii))
        }
        if (hasUV) {
          const uv = geo.attributes.uv
          sideUVs[s].push(uv.getX(ii), uv.getY(ii))
        }
      }
    }

    mesh.visible = false

    for (let s = 0; s < 2; s++) {
      if (sides[s].length === 0) continue
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(sides[s], 3))
      if (sideNormals[s].length) g.setAttribute('normal', new THREE.Float32BufferAttribute(sideNormals[s], 3))
      if (sideUVs[s].length) g.setAttribute('uv', new THREE.Float32BufferAttribute(sideUVs[s], 2))
      const m = new THREE.Mesh(g, mesh.material)
      ;(s === 0 ? leftPivot : rightPivot).add(m)
    }
  }

  function setupButterfly(b, scene) {
    // Collect all meshes and measure their X-width
    const meshes = []
    scene.traverse((child) => {
      if (!child.isMesh) return
      const box = new THREE.Box3().setFromObject(child)
      const size = new THREE.Vector3()
      box.getSize(size)
      meshes.push({ mesh: child, xWidth: size.x })
    })
    if (meshes.length === 0) return

    // Body is the narrowest mesh on X — everything wider gets split into wings
    const minWidth = Math.min(...meshes.map(m => m.xWidth))
    const wingMeshes = meshes.filter(m => m.xWidth > minWidth * 2)
    if (wingMeshes.length === 0) return

    // Create one pivot group per wing side, shared by all wing meshes
    const parent = wingMeshes[0].mesh.parent
    const leftPivot = new THREE.Group()
    const rightPivot = new THREE.Group()
    parent.add(leftPivot)
    parent.add(rightPivot)

    for (const { mesh } of wingMeshes) {
      splitMeshIntoWings(mesh, leftPivot, rightPivot)
    }

    b.wingObjs.push({ pivot: leftPivot, side: -1 })
    b.wingObjs.push({ pivot: rightPivot, side: 1 })
  }

  useTask((delta) => {
    const isDay = dayNight.sunFactor > 0.4

    for (const b of butterflies) {
      if (!b.group) continue

      b.group.visible = isDay
      if (!isDay) continue

      // Flap each wing half around the body centerline (x=0)
      const flap = Math.sin(performance.now() * 0.001 * b.flapSpeed + b.flapPhase) * 0.7
      for (const wing of b.wingObjs) {
        wing.pivot.rotation.z = flap * wing.side
      }

      // Wandering
      if (b.pauseTimer > 0) {
        b.pauseTimer -= delta
        if (b.pauseTimer <= 0) {
          b.moving = true
          pickTarget(b)
        }
      } else if (b.moving) {
        const dx = b.targetX - b.x
        const dz = b.targetZ - b.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist < 0.5) {
          b.moving = false
          b.pauseTimer = 1.5 + rand() * 4
        } else {
          const targetRot = Math.atan2(dx, dz)
          let dAngle = targetRot - b.rotY
          if (dAngle > Math.PI) dAngle -= 2 * Math.PI
          if (dAngle < -Math.PI) dAngle += 2 * Math.PI
          b.rotY += dAngle * Math.min(1, 3 * delta)

          b.x += (dx / dist) * WANDER_SPEED * delta
          b.z += (dz / dist) * WANDER_SPEED * delta
        }
      }

      // Vertical bob
      const groundY = getTerrainHeight(b.x, b.z)
      const bob = Math.sin(performance.now() * 0.001 * b.bobSpeed + b.bobPhase) * 0.8
      b.y = groundY + FLUTTER_HEIGHT + bob

      b.group.position.set(b.x, b.y, b.z)
      b.group.rotation.y = b.rotY
    }
  })
</script>

{#await gltf then value}
  {#each butterflies as b}
    {@const scene = cloneSkeleton(value.scene)}
    <T
      is={scene}
      scale={b.scale}
      oncreate={(ref) => {
        b.group = ref
        setupButterfly(b, scene)
      }}
    />
  {/each}
{/await}
