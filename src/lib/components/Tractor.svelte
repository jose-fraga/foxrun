<script>
  import { T } from '@threlte/core'
  import * as THREE from 'three'
  import { addObstacle } from '../utils/obstacles.js'
  import { loadModel } from '../utils/modelLoader.js'

  const TX = 170
  const TZ = -170

  // Elongated collision — front, center, back along the tractor's angled body
  const cos = Math.cos(-0.4)
  const sin = Math.sin(-0.4)
  addObstacle(TX + sin * 4, TZ + cos * 4, 3.5)
  addObstacle(TX, TZ, 3.5)
  addObstacle(TX - sin * 4, TZ - cos * 4, 3.5)
  addObstacle(TX - sin * 8, TZ - cos * 8, 3.5)

  const gltf = loadModel('/Tractor.glb')

  // Sharp 2-band gradient for a punchier toon look
  const toonGrad = new THREE.DataTexture(
    new Uint8Array([100, 100, 100, 255, 255, 255, 255, 255]),
    2, 1, THREE.RGBAFormat
  )
  toonGrad.minFilter = THREE.NearestFilter
  toonGrad.magFilter = THREE.NearestFilter
  toonGrad.needsUpdate = true

  // Downsample texture to tiny resolution — keeps color regions, removes detail
  const DOWNSAMPLE_SIZE = 16
  function downsampleTexture(tex) {
    const img = tex.image
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = DOWNSAMPLE_SIZE
    canvas.height = DOWNSAMPLE_SIZE
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(img, 0, 0, DOWNSAMPLE_SIZE, DOWNSAMPLE_SIZE)
    // Boost saturation on the pixel data
    const imageData = ctx.getImageData(0, 0, DOWNSAMPLE_SIZE, DOWNSAMPLE_SIZE)
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i+1] / 255, b = d[i+2] / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const l = (max + min) / 2
      if (max !== min) {
        const delta = max - min
        let s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
        s = Math.min(1, s * 1.5) // boost saturation
        // Reconstruct from boosted HSL
        let h
        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
        else if (max === g) h = ((b - r) / delta + 2) / 6
        else h = ((r - g) / delta + 4) / 6
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1; if (t > 1) t -= 1
          if (t < 1/6) return p + (q - p) * 6 * t
          if (t < 1/2) return q
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
          return p
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        d[i]   = Math.round(hue2rgb(p, q, h + 1/3) * 255)
        d[i+1] = Math.round(hue2rgb(p, q, h) * 255)
        d[i+2] = Math.round(hue2rgb(p, q, h - 1/3) * 255)
      }
    }
    ctx.putImageData(imageData, 0, 0)
    tex.image = canvas
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.needsUpdate = true
  }

  function setupTractor(scene) {
    scene.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of mats) {
        if (mat.isMeshToonMaterial) {
          mat.gradientMap = toonGrad
          mat.emissiveIntensity = 0.3
          // Downsample diffuse + emissive maps for flat toon color regions
          if (mat.map) downsampleTexture(mat.map)
          if (mat.emissiveMap) downsampleTexture(mat.emissiveMap)
          // Strip detail maps
          if (mat.normalMap) { mat.normalMap.dispose(); mat.normalMap = null }
          if (mat.bumpMap) { mat.bumpMap.dispose(); mat.bumpMap = null }
          if (mat.roughnessMap) { mat.roughnessMap.dispose(); mat.roughnessMap = null }
          mat.needsUpdate = true
        }
      }
    })
  }
</script>

{#await gltf then value}
  <T
    is={value.scene}
    scale={1}
    rotation.y={-0.4}
    position={[TX, 0, TZ]}
    oncreate={() => setupTractor(value.scene)}
  />
{/await}
