export default class GameServer {
  constructor(room) {
    this.room = room
    this.players = new Map()
  }

  onConnect(conn) {
    conn.send(JSON.stringify({
      type: 'init',
      id: conn.id,
      players: Object.fromEntries(this.players),
    }))

    this.room.broadcast(JSON.stringify({
      type: 'player_join',
      id: conn.id,
    }), [conn.id])
  }

  onMessage(message, conn) {
    const data = JSON.parse(message)

    if (data.type === 'state') {
      const state = {
        x: data.x,
        y: data.y,
        z: data.z,
        ry: data.ry,
        anim: data.anim,
        grounded: data.grounded,
      }
      this.players.set(conn.id, state)

      this.room.broadcast(JSON.stringify({
        type: 'state',
        id: conn.id,
        ...state,
      }), [conn.id])
    }
  }

  onClose(conn) {
    this.players.delete(conn.id)
    this.room.broadcast(JSON.stringify({
      type: 'player_leave',
      id: conn.id,
    }))
  }
}
