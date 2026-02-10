let muted = $state(false)

export function isMuted() {
  return muted
}

export function toggleMute() {
  muted = !muted
  return muted
}
