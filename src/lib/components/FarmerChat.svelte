<script>
  import { getFarmerChat, openChat, closeChat, addMessage, setLoading } from '../stores/farmerChat.svelte.js'
  import { sendChat } from '../network.js'

  const chat = $derived(getFarmerChat())

  let inputText = $state('')

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
    sendChat(text)
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

{#if chat.nearFarmer && !chat.open}
  <div class="prompt">
    Press <kbd>E</kbd> to talk
  </div>
{/if}

{#if chat.open}
  <div class="input-bar">
    <input
      type="text"
      bind:value={inputText}
      onkeydown={handleInputKeydown}
      placeholder="Say something..."
      disabled={chat.loading}
      autofocus
    />
    <button onclick={sendMessage} disabled={chat.loading}>
      {chat.loading ? '...' : 'Send'}
    </button>
  </div>
{/if}

<style>
  .prompt {
    position: fixed;
    bottom: 18%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    font-family: sans-serif;
    font-size: 0.9rem;
    pointer-events: none;
    z-index: 50;
    white-space: nowrap;
  }
  .prompt kbd {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    padding: 0.1rem 0.35rem;
    font-family: inherit;
    font-weight: bold;
  }

  .input-bar {
    position: fixed;
    bottom: 3%;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.4rem;
    z-index: 100;
    width: min(400px, 85vw);
  }
  .input-bar input {
    flex: 1;
    padding: 0.6rem 1rem;
    border: 1px solid rgba(180, 140, 80, 0.5);
    border-radius: 20px;
    background: rgba(20, 15, 10, 0.85);
    color: #e8d4a0;
    font-size: 0.9rem;
    font-family: sans-serif;
    outline: none;
    backdrop-filter: blur(6px);
  }
  .input-bar input::placeholder {
    color: rgba(232, 212, 160, 0.4);
  }
  .input-bar input:focus {
    border-color: rgba(180, 140, 80, 0.8);
  }
  .input-bar input:disabled {
    opacity: 0.6;
  }
  .input-bar button {
    padding: 0.6rem 1.2rem;
    background: rgba(180, 140, 80, 0.4);
    color: #e8d4a0;
    border: 1px solid rgba(180, 140, 80, 0.5);
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: bold;
    font-family: sans-serif;
    backdrop-filter: blur(6px);
  }
  .input-bar button:hover {
    background: rgba(180, 140, 80, 0.6);
  }
  .input-bar button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
