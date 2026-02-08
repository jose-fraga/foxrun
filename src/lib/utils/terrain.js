function hash(x, z) {
  let n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

export function noise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smoothstep(x - ix)
  const fz = smoothstep(z - iz)

  const a = hash(ix, iz)
  const b = hash(ix + 1, iz)
  const c = hash(ix, iz + 1)
  const d = hash(ix + 1, iz + 1)

  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

function fbm(x, z) {
  let val = 0
  let amp = 1
  let freq = 1
  for (let i = 0; i < 4; i++) {
    val += noise(x * freq, z * freq) * amp
    amp *= 0.5
    freq *= 2
  }
  return val
}

export const noiseScale = 0.02
export const heightScale = 3

// Pond depression constants
const POND_CX = -70
const POND_CZ = -60
const POND_R = 22
const POND_DEPTH = 2

export function getTerrainHeight(x, z) {
  const distFromCenter = Math.sqrt(x * x + z * z)
  const flatRadius = 15
  const flatFactor = Math.min(1, Math.max(0, (distFromCenter - flatRadius) / 20))
  let h = fbm(x * noiseScale, z * noiseScale) * heightScale * flatFactor

  // Pond depression: smooth dip toward center
  const dx = x - POND_CX
  const dz = z - POND_CZ
  const pondDist = Math.sqrt(dx * dx + dz * dz)
  if (pondDist < POND_R) {
    const t = 1 - pondDist / POND_R
    h -= POND_DEPTH * t * t
  }

  return h
}
