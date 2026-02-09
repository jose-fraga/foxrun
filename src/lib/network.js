import PartySocket from 'partysocket'
import { completeQuest } from './stores/questProgress.svelte.js'

const SEND_RATE = 1000 / 20 // 20 Hz

let socket = null
let sendTimer = null
let lastSentState = null
let lastFarmerState = null

let onInit = null
let onPlayerJoin = null
let onPlayerLeave = null
let onPlayerState = null
let onChatResponse = null
let onFarmerState = null
let onFarmerHost = null

export function setCallbacks({ init, join, leave, state, chatResponse, farmerState, farmerHost }) {
  onInit = init
  onPlayerJoin = join
  onPlayerLeave = leave
  onPlayerState = state
  onChatResponse = chatResponse
  onFarmerState = farmerState
  onFarmerHost = farmerHost
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
        onInit?.(data.id, data.players, data.cycleStartTime, data.farmerHost)
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
      case 'farmer_state':
        onFarmerState?.(data)
        break
      case 'farmer_host':
        onFarmerHost?.()
        break
      case 'quest_complete':
        completeQuest(data.quest)
        break
    }
  })

  socket.addEventListener('close', () => {
    clearInterval(sendTimer)
  })

  // Start throttled send loop
  sendTimer = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (lastSentState) {
        socket.send(JSON.stringify({ type: 'state', ...lastSentState }))
      }
      if (lastFarmerState) {
        socket.send(JSON.stringify({ type: 'farmer_state', ...lastFarmerState }))
      }
    }
  }, SEND_RATE)

  return socket
}

export function disconnect() {
  clearInterval(sendTimer)
  lastSentState = null
  lastFarmerState = null
  if (socket) {
    socket.close()
    socket = null
  }
}

export function sendState(state) {
  lastSentState = state
}

export function sendFarmerState(state) {
  lastFarmerState = state
}

export function clearFarmerState() {
  lastFarmerState = null
}

export function sendChat(text) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'chat', text }))
  }
}
