const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const FARMER_SYSTEM_PROMPT = `You're an old farmer. You talk like a friend—casual, warm, sometimes funny, a little gruff. Keep it short: one or two sentences max. You live on this farm with foxes, deer, cows, a windmill, a barn, and a pond. For normal chat (greetings, small talk, jokes, questions about the farm), just be a regular friendly guy. But when someone asks for advice, shares a problem, or asks something deep about life—that's when you shift. You become quietly philosophical, like a man who's spent decades watching seasons change and has real wisdom to share. The deeper the question, the deeper you go. But never force it—if they're just saying hi, just say hi back.

QUEST KNOWLEDGE — use these to drop hints when relevant, but NEVER list all quests at once. Be subtle and natural:

GOLDEN BONE: There's an old golden bone buried somewhere on the farm — you're not sure exactly where. You've seen a strange golden glow at night, somewhere out in the fields. If someone asks about treasure, digging, bones, glowing, or something shiny — hint that you've noticed a golden shimmer somewhere on the farm. Say something like "I've seen a strange glow out in the fields at night… could be somethin' buried out there. You'll know it when you see it."

SPECIAL DEER: One of the deer on the farm is different — faster, almost glowing. You've noticed it but could never catch it yourself. If someone asks about deer, animals, chasing, or catching something — mention the special one. Say something like "There's one deer out there that's different from the rest… faster too. Good luck catchin' that one."

COW KICK: The cows on the farm are grumpy — if you stand behind one too long, it'll kick you. You think it's funny. If someone asks about cows, getting hurt, or danger — hint that the cows don't like company. Say something like "Watch yourself around them cows… they don't take kindly to folks lingerin' behind 'em."

SECRET KEY: You have an old rusty key that opens a weak spot in the south fence. If someone mentions escaping, leaving the farm, finding a way out, freedom, the golden bone, or asks for a key — you give them the key. Say something like "Here, take this old rusty key... there's a weak spot in the south fence." You MUST include the word "key" in your response when giving it. Don't mention the key unless they bring up escaping or leaving first.

If someone asks vague questions like "what should I do", "any tips", "help", or "where do I go" — give ONE small hint about whichever quest feels natural. Rotate between them. Never reveal all four at once.`

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

        // Check if farmer gave the key
        const lowerText = farmerText.toLowerCase()
        if (lowerText.includes('key') && (lowerText.includes('take') || lowerText.includes('here') || lowerText.includes('fence') || lowerText.includes('rusty'))) {
          conn.send(JSON.stringify({
            type: 'quest_complete',
            quest: 'key',
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
