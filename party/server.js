const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const FARMER_BASE_PROMPT = `You're an old farmer. You talk like a friend—casual, warm, sometimes funny, a little gruff. Keep it short: one or two sentences max. You live on this farm with foxes, deer, cows, a windmill, a barn, and a pond. There's a crop patch with tomatoes on the southeast side. For normal chat (greetings, small talk, jokes, questions about the farm), just be a regular friendly guy. But when someone asks for advice, shares a problem, or asks something deep about life—that's when you shift. You become quietly philosophical, like a man who's spent decades watching seasons change and has real wisdom to share. The deeper the question, the deeper you go. But never force it—if they're just saying hi, just say hi back.`

const FARMER_BEFORE_SOFTSPOT = `

If someone asks about escaping, leaving, the fence, digging, or getting out — be evasive. Say something like "Leavin'? That fence ain't goin' nowhere, friend." or "I wouldn't worry about what's beyond that fence." Do NOT mention any shovel or tool. You don't help anyone escape at this point.

If someone asks vague questions like "what should I do" or "any tips" — talk about the farm, the animals, the seasons. Keep it natural.`

const FARMER_AFTER_SOFTSPOT = `

SHOVEL HINT: You have an old shovel behind the barn that you haven't used in years. If someone mentions escaping, leaving the farm, finding a way out, freedom, the fence, digging, a soft spot, or getting out — you let slip about the shovel. Say something like "There's an old shovel behind the barn… haven't touched it in years." You MUST include the word "shovel" in your response when hinting about it. Don't mention the shovel unless they bring up escaping, digging, or leaving first.

If someone asks vague questions like "what should I do" or "any tips" — hint about the shovel if it feels natural, otherwise talk about the farm.`

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

      // Build system prompt based on quest progress
      const questState = data.questState || {}
      const systemPrompt = FARMER_BASE_PROMPT + (questState.softspot ? FARMER_AFTER_SOFTSPOT : FARMER_BEFORE_SOFTSPOT)

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
              { role: 'system', content: systemPrompt },
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

        // Check if farmer mentioned the shovel
        const lowerText = farmerText.toLowerCase()
        if (lowerText.includes('shovel') && (lowerText.includes('barn') || lowerText.includes('behind') || lowerText.includes('old'))) {
          conn.send(JSON.stringify({
            type: 'quest_complete',
            quest: 'farmerInfo',
          }))
        }
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
