export const localPlayerPos = { x: 0, y: 0, z: 0, grounded: true, stunTimer: 0 }

export function stunPlayer(duration) {
  localPlayerPos.stunTimer = duration
}
