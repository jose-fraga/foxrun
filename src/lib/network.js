import PartySocket from 'partysocket'

const SEND_RATE = 1000 / 20 // 20 Hz

let socket = null
let sendTimer = null
let lastSentState = null

let onInit = null
let onPlayerJoin = null
let onPlayerLeave = null
let onPlayerState = null
let onChatResponse = null

export function setCallbacks({ init, join, leave, state, chatResponse }) {
  onInit = init
  onPlayerJoin = join
  onPlayerLeave = leave
  onPlayerState = state
  onChatResponse = chatResponse
}

export function connect(roomId) {
  socket = new PartySocket({
    host: import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999',
    room: roomId,
  })

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data)
    switch (data.type) {
      case 'init':
        onInit?.(data.id, data.players)
        break
      case 'player_join':
        onPlayerJoin?.(data.id)
        break
      case 'player_leave':
        onPlayerLeave?.(data.id)
        break
      case 'state':
        onPlayerState?.(data.id, data)
        break
      case 'chat_response':
        onChatResponse?.(data.text)
        break
    }
  })

  socket.addEventListener('close', () => {
    clearInterval(sendTimer)
  })

  // Start throttled send loop
  sendTimer = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN && lastSentState) {
      socket.send(JSON.stringify({ type: 'state', ...lastSentState }))
    }
  }, SEND_RATE)

  return socket
}

export function disconnect() {
  clearInterval(sendTimer)
  if (socket) {
    socket.close()
    socket = null
  }
}

export function sendState(state) {
  lastSentState = state
}

export function sendChat(text) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'chat', text }))
  }
}
