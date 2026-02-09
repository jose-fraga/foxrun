<script>
  import { getFarmerChat, openChat, closeChat, addMessage, setLoading } from '../stores/farmerChat.svelte.js'
  import { sendChat } from '../network.js'
  import { setInteractionPrompt, getInteractionPrompt } from '../stores/interactionPrompt.svelte.js'
  import { getQuests } from '../stores/questProgress.svelte.js'

  const chat = $derived(getFarmerChat())

  let inputText = $state('')

  // Sync "talk" prompt with shared interaction prompt store
  $effect(() => {
    if (chat.nearFarmer && !chat.open) {
      setInteractionPrompt('talk')
    } else if (getInteractionPrompt() === 'talk') {
      setInteractionPrompt('')
    }
  })

  function handleKeydown(e) {
    if (e.code === 'KeyE' && chat.nearFarmer) {
      e.preventDefault()
      if (chat.open) {
        closeChat()
      } else {
        openChat()
      }
    }
    if (e.code === 'Escape' && chat.open) {
      e.preventDefault()
      closeChat()
    }
  }

  function sendMessage() {
    const text = inputText.trim()
    if (!text || chat.loading) return
    addMessage('user', text)
    setLoading(true)
    const q = getQuests()
    sendChat(text, { softspot: q.softspot })
    inputText = ''
  }

  function handleInputKeydown(e) {
    if (e.code === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      sendMessage()
      return
    }
    if (e.code === 'Escape') {
      e.preventDefault()
      closeChat()
      return
    }
    e.stopPropagation()
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if chat.open}
  <div class="input-bar">
    <div class="brush-input-wrap">
      <svg class="brush-border" viewBox="0 0 400 44" preserveAspectRatio="none">
        <path d="M6 8 Q20 3 100 6 Q200 2 300 6 Q380 3 394 8 Q398 16 396 22 Q398 30 394 36 Q380 41 300 38 Q200 42 100 38 Q20 41 6 36 Q2 30 4 22 Q2 16 6 8Z"
          stroke="rgba(180,140,80,0.5)" stroke-width="1.5" fill="rgba(20,15,10,0.85)" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <input
        type="text"
        bind:value={inputText}
        onkeydown={handleInputKeydown}
        placeholder="Say something..."
        disabled={chat.loading}
        autofocus
      />
    </div>
    <div class="brush-btn-wrap">
      <svg class="brush-border" viewBox="0 0 80 44" preserveAspectRatio="none">
        <path d="M6 8 Q16 3 40 6 Q64 3 74 8 Q78 16 76 22 Q78 30 74 36 Q64 41 40 38 Q16 41 6 36 Q2 30 4 22 Q2 16 6 8Z"
          stroke="rgba(180,140,80,0.5)" stroke-width="1.5" fill="rgba(180,140,80,0.35)" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <button onclick={sendMessage} disabled={chat.loading}>
        {chat.loading ? '...' : 'Send'}
      </button>
    </div>
  </div>
{/if}

<style>
  .input-bar {
    position: fixed;
    bottom: 3%;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.5rem;
    z-index: 100;
    width: min(400px, 85vw);
    align-items: center;
  }

  .brush-input-wrap,
  .brush-btn-wrap {
    position: relative;
  }
  .brush-input-wrap {
    flex: 1;
  }

  .brush-border {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .input-bar input {
    width: 100%;
    padding: 0.6rem 1rem;
    border: none;
    background: none;
    color: #e8d4a0;
    font-size: 0.9rem;
    font-family: "permanent-marker", sans-serif;
    outline: none;
    position: relative;
    z-index: 1;
  }
  .input-bar input::placeholder {
    color: rgba(232, 212, 160, 0.4);
  }
  .input-bar input:disabled {
    opacity: 0.6;
  }

  .input-bar button {
    padding: 0.6rem 1.2rem;
    background: none;
    color: #e8d4a0;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: bold;
    font-family: "permanent-marker", sans-serif;
    position: relative;
    z-index: 1;
    white-space: nowrap;
  }
  .brush-btn-wrap:hover .brush-border path {
    fill: rgba(180, 140, 80, 0.5);
  }
  .input-bar button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
