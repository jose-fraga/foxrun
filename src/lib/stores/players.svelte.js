import { setCallbacks } from '../network.js'
import { addMessage, setLoading } from '../stores/farmerChat.svelte.js'

const ANIM_SHORT = { I: 'Idle', W: 'Walk', R: 'Gallop', O: 'Gallop_Jump' }
const ANIM_TO_SHORT = { Idle: 'I', Walk: 'W', Gallop: 'R', Gallop_Jump: 'O' }

export function animToShort(name) { return ANIM_TO_SHORT[name] || 'I' }
export function shortToAnim(code) { return ANIM_SHORT[code] || 'Idle' }

class RemotePlayerState {
  prev = { x: 0, y: 0, z: 0, ry: 0, anim: 'Idle', grounded: true, char: 'husky', time: 0 }
  curr = { x: 0, y: 0, z: 0, ry: 0, anim: 'Idle', grounded: true, char: 'husky', time: 0 }

  update(data) {
    this.prev = { ...this.curr }
    this.curr = {
      x: data.x,
      y: data.y,
      z: data.z,
      ry: data.ry,
      anim: shortToAnim(data.anim),
      grounded: data.grounded,
      char: data.char || 'husky',
      time: performance.now(),
    }
  }
}

let remotePlayers = $state(new Map())

export function getRemotePlayers() { return remotePlayers }

setCallbacks({
  init(id, existingPlayers) {
    const map = new Map()
    for (const [pid, pstate] of Object.entries(existingPlayers)) {
      const rp = new RemotePlayerState()
      rp.update(pstate)
      map.set(pid, rp)
    }
    remotePlayers = map
  },
  join(id) {
    const map = new Map(remotePlayers)
    map.set(id, new RemotePlayerState())
    remotePlayers = map
  },
  leave(id) {
    const map = new Map(remotePlayers)
    map.delete(id)
    remotePlayers = map
  },
  state(id, data) {
    let rp = remotePlayers.get(id)
    if (!rp) {
      rp = new RemotePlayerState()
      const map = new Map(remotePlayers)
      map.set(id, rp)
      remotePlayers = map
    }
    rp.update(data)
  },
  chatResponse(text) {
    setLoading(false)
    addMessage('farmer', text)
  },
})
