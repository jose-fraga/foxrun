<script>
  import { getQuests, getElapsedTime } from '../stores/questProgress.svelte.js'

  let { onplayagain } = $props()

  const quotes = [
    "The fence was never the thing holding you back.",
    "Every locked gate has a key — you just have to ask.",
    "The bravest thing a fox can do is keep running.",
    "Freedom isn't a place. It's a decision.",
    "Some bones are worth digging for.",
    "The farmer always said: the way out is through.",
    "You didn't escape the farm. You outgrew it.",
    "Not all who wander are lost — some are just chasing deer.",
    "Courage is just fear that went for a walk.",
    "The south fence was always there. You just weren't ready.",
  ]

  const quote = quotes[Math.floor(Math.random() * quotes.length)]
  const quests = $derived(getQuests())
  const time = $derived(getElapsedTime())
  let visible = $state(false)

  $effect(() => {
    if (quests.cinematicDone && !visible) {
      // Small delay so the fade-in feels intentional
      setTimeout(() => { visible = true }, 300)
    }
    if (!quests.cinematicDone) {
      visible = false
    }
  })

  function playAgain() {
    visible = false
    onplayagain?.()
  }
</script>

{#if visible}
  <div class="overlay">
    <div class="card">
      <svg class="brush-border" viewBox="0 0 340 260" preserveAspectRatio="none">
        <path d="M10 14 Q28 5 80 9 Q170 3 260 9 Q312 5 330 14 Q338 28 336 60 Q338 120 336 180 Q338 220 330 246 Q312 255 260 251 Q170 257 80 251 Q28 255 10 246 Q2 220 4 180 Q2 120 4 60 Q2 28 10 14Z"
          stroke="rgba(180,140,80,0.5)" stroke-width="1.5" fill="rgba(20,15,10,0.75)" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <div class="content">
        <h1>You Escaped!</h1>
        <p class="quote">{quote}</p>
        <p class="time">{time}</p>
        <button onclick={playAgain}>Play Again</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 8%;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.5) 0%,
      rgba(0, 0, 0, 0.15) 50%,
      rgba(0, 0, 0, 0.05) 100%
    );
    animation: fadeIn 1s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .card {
    position: relative;
    width: 300px;
    padding: 0;
  }

  .brush-border {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .content {
    position: relative;
    z-index: 1;
    padding: 2.5rem 2rem;
    text-align: center;
  }

  h1 {
    font-family: "permanent-marker", sans-serif;
    font-size: 2.8rem;
    color: rgba(232, 212, 160, 0.9);
    margin: 0 0 0.6rem;
    text-shadow: 2px 3px 0 rgba(0, 0, 0, 0.4);
    letter-spacing: 3px;
  }

  .quote {
    font-family: "permanent-marker", sans-serif;
    font-size: 0.85rem;
    color: rgba(232, 212, 160, 0.45);
    margin: 0 0 1.2rem;
    font-style: italic;
    letter-spacing: 0.5px;
    line-height: 1.4;
  }

  .time {
    font-family: "permanent-marker", sans-serif;
    font-size: 1.4rem;
    color: rgba(232, 212, 160, 0.6);
    margin: 0 0 2rem;
    letter-spacing: 2px;
  }

  button {
    font-family: "permanent-marker", sans-serif;
    font-size: 1.2rem;
    color: rgba(232, 212, 160, 0.7);
    background: none;
    border: none;
    cursor: pointer;
    letter-spacing: 2px;
    text-shadow: 2px 3px 0 rgba(0, 0, 0, 0.4);
    transition: transform 0.15s, color 0.15s;
    padding: 0.5rem 2rem;
  }

  button:hover {
    transform: scale(1.1);
  }
</style>
