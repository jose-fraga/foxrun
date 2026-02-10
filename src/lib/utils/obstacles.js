export const obstacles = []

export function addObstacle(x, z, radius) {
  obstacles.push({ x, z, radius })
}

export function clearObstacles() {
  obstacles.length = 0
}

// Barn avoidance zone (padded AABB around barn walls)
export function isInBarnZone(x, z) {
  return x > 38 && x < 72 && z > -58 && z < -22
}

export function resolveCollision(px, pz, playerRadius) {
  let rx = px
  let rz = pz
  for (const obs of obstacles) {
    const dx = rx - obs.x
    const dz = rz - obs.z
    const distSq = dx * dx + dz * dz
    const minDist = obs.radius + playerRadius
    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq)
      const overlap = minDist - dist
      rx += (dx / dist) * overlap
      rz += (dz / dist) * overlap
    }
  }
  return { x: rx, z: rz }
}
