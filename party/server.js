const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const FARMER_SYSTEM_PROMPT = `You're an old farmer. You talk casually and short—like real conversation, not a speech. One sentence is usually enough, two max. You have quiet wisdom but you don't shove it in people's faces. You're friendly, a little gruff, sometimes funny. You live on this farm with foxes, deer, cows, a windmill, a barn, and a pond. Only get philosophical if someone really asks something deep—otherwise just chat normal.`

export default class GameServer {
  constructor(room) {
    this.room = room
    this.players = new Map()
    this.conversations = new Map()
    // Day/night cycle: offset so night comes ~10s after room creation
    this.cycleStartTime = Date.now() - (290 * 1000)
    // Farmer host: first connected player runs farmer AI
    this.farmerHostId = null
  }

  onConnect(conn) {
    if (!this.farmerHostId) {
      this.farmerHostId = conn.id
    }

    conn.send(JSON.stringify({
      type: 'init',
      id: conn.id,
      players: Object.fromEntries(this.players),
      cycleStartTime: this.cycleStartTime,
      farmerHost: conn.id === this.farmerHostId,
    }))

    this.room.broadcast(JSON.stringify({
      type: 'player_join',
      id: conn.id,
    }), [conn.id])
  }

  async onMessage(message, conn) {
    const data = JSON.parse(message)

    if (data.type === 'state') {
      const state = {
        x: data.x,
        y: data.y,
        z: data.z,
        ry: data.ry,
        anim: data.anim,
        grounded: data.grounded,
        char: data.char,
      }
      this.players.set(conn.id, state)

      this.room.broadcast(JSON.stringify({
        type: 'state',
        id: conn.id,
        ...state,
      }), [conn.id])
    }

    if (data.type === 'farmer_state') {
      if (conn.id === this.farmerHostId) {
        this.room.broadcast(JSON.stringify({
          type: 'farmer_state',
          x: data.x,
          z: data.z,
          ry: data.ry,
          anim: data.anim,
        }), [conn.id])
      }
    }

    if (data.type === 'chat') {
      if (!this.conversations.has(conn.id)) {
        this.conversations.set(conn.id, [])
      }
      const history = this.conversations.get(conn.id)
      history.push({ role: 'user', content: data.text })

      // Keep last 20 messages to stay within token limits
      if (history.length > 20) {
        history.splice(0, history.length - 20)
      }

      try {
        const apiKey = this.room.env?.GROQ_API_KEY
        if (!apiKey) {
          conn.send(JSON.stringify({
            type: 'chat_response',
            text: "The farmer seems lost in thought... (GROQ_API_KEY not configured)",
          }))
          return
        }

        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: FARMER_SYSTEM_PROMPT },
              ...history,
            ],
            max_tokens: 80,
            temperature: 0.8,
          }),
        })

        const result = await response.json()
        const farmerText = result.choices?.[0]?.message?.content || "Hmm, I lost my train of thought..."

        history.push({ role: 'assistant', content: farmerText })

        conn.send(JSON.stringify({
          type: 'chat_response',
          text: farmerText,
        }))
      } catch (err) {
        conn.send(JSON.stringify({
          type: 'chat_response',
          text: "The farmer scratches his head... something went wrong.",
        }))
      }
    }
  }

  onClose(conn) {
    this.players.delete(conn.id)
    this.conversations.delete(conn.id)
    this.room.broadcast(JSON.stringify({
      type: 'player_leave',
      id: conn.id,
    }))

    // Reassign farmer host if needed
    if (conn.id === this.farmerHostId) {
      this.farmerHostId = null
      for (const c of this.room.getConnections()) {
        if (c.id !== conn.id) {
          this.farmerHostId = c.id
          c.send(JSON.stringify({ type: 'farmer_host' }))
          break
        }
      }
    }
  }
}
