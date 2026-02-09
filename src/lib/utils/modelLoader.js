import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const cache = new Map()

// --- Brush-painted style: 3-band gradient map for toon shading ---
const gradData = new Uint8Array([128, 128, 128, 255, 176, 176, 176, 255, 255, 255, 255, 255])
export const gradientMap = new THREE.DataTexture(gradData, 3, 1, THREE.RGBAFormat)
gradientMap.minFilter = THREE.NearestFilter
gradientMap.magFilter = THREE.NearestFilter
gradientMap.needsUpdate = true

export function applyBrushPaintStyle(gltf) {
  const scene = gltf.scene

  scene.traverse((child) => {
    if (!child.isMesh) return

    // Replace materials with toon versions (skip if already toon)
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    const toonMats = mats.map((mat) => {
      if (mat.isMeshToonMaterial) return mat
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
