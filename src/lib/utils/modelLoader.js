import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const cache = new Map()

// --- Brush-painted style: 3-band gradient map for toon shading ---
const gradientCanvas = document.createElement('canvas')
gradientCanvas.width = 3
gradientCanvas.height = 1
const gCtx = gradientCanvas.getContext('2d')
gCtx.fillStyle = '#808080'
gCtx.fillRect(0, 0, 1, 1)
gCtx.fillStyle = '#b0b0b0'
gCtx.fillRect(1, 0, 1, 1)
gCtx.fillStyle = '#ffffff'
gCtx.fillRect(2, 0, 1, 1)
export const gradientMap = new THREE.CanvasTexture(gradientCanvas)
gradientMap.minFilter = THREE.NearestFilter
gradientMap.magFilter = THREE.NearestFilter

export function applyBrushPaintStyle(gltf) {
  const scene = gltf.scene
  if (scene.userData._brushPainted) return
  scene.userData._brushPainted = true

  scene.traverse((child) => {
    if (!child.isMesh) return

    // Replace materials with toon versions
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    const toonMats = mats.map((mat) => {
      const toon = new THREE.MeshToonMaterial({
        map: mat.map || null,
        color: mat.color || new THREE.Color(0xffffff),
        gradientMap,
        side: mat.side,
        emissive: mat.color || new THREE.Color(0xffffff),
        emissiveMap: mat.map || null,
        emissiveIntensity: 0.2,
      })
      if (mat.transparent) toon.transparent = true
      if (mat.alphaTest) toon.alphaTest = mat.alphaTest
      return toon
    })
    child.material = toonMats.length === 1 ? toonMats[0] : toonMats
  })
}

export function loadModel(path) {
  if (!cache.has(path)) {
    cache.set(path, new Promise((resolve, reject) => {
      loader.load(path, (gltf) => {
        applyBrushPaintStyle(gltf)
        resolve(gltf)
      }, undefined, reject)
    }))
  }
  return cache.get(path)
}
