import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const cache = new Map()

export function loadModel(path) {
  if (!cache.has(path)) {
    cache.set(path, new Promise((resolve, reject) => {
      loader.load(path, resolve, undefined, reject)
    }))
  }
  return cache.get(path)
}
