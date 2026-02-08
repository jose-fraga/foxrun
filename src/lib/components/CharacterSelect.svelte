<script>
  import { characters, getSelectedCharacter, setSelectedCharacter } from '../stores/character.svelte.js'

  const selected = $derived(getSelectedCharacter())
  let isOpen = $state(false)
  let selectedIndex = $state(0)

  function cycleCharacter(dir, e) {
    e.stopPropagation()
    selectedIndex = (selectedIndex + dir + characters.length) % characters.length
    setSelectedCharacter(characters[selectedIndex])
  }

  function toggleOpen(e) {
    e.stopPropagation()
    isOpen = !isOpen
  }

  function closeSelector() {
    isOpen = false
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onpointerdown={closeSelector}></div>
{/if}

<!-- Wolf icon button -->
<button class="toggle-btn" class:open={isOpen} onpointerdown={toggleOpen}>
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 8 L8 28 L14 32 L10 52 L20 44 L26 56 L32 46 L38 56 L44 44 L54 52 L50 32 L56 28 L52 8 L40 20 L32 14 L24 20 Z"
      stroke="white" stroke-width="2.5" fill="rgba(255,255,255,0.1)" stroke-linejoin="round"/>
    <circle cx="24" cy="30" r="2.5" fill="white"/>
    <circle cx="40" cy="30" r="2.5" fill="white"/>
    <path d="M28 38 Q32 42 36 38" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>
</button>

{#if isOpen}
  <div class="selector">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <button class="arrow-btn left" onpointerdown={(e) => cycleCharacter(-1, e)}>
      <svg viewBox="0 0 64 64" fill="none">
        <!-- Brush-painted left arrow -->
        <path d="M44 6 Q40 8 18 30 Q14 34 18 38 Q22 42 44 58"
          stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"
          opacity="0.9"/>
        <path d="M18 32 L6 30 Q4 32 8 35 L18 36"
          stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"
          opacity="0.85"/>
      </svg>
    </button>

    <div class="char-name">{selected.name}</div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <button class="arrow-btn right" onpointerdown={(e) => cycleCharacter(1, e)}>
      <svg viewBox="0 0 64 64" fill="none">
        <!-- Brush-painted right arrow -->
        <path d="M20 6 Q24 8 46 30 Q50 34 46 38 Q42 42 20 58"
          stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"
          opacity="0.9"/>
        <path d="M46 32 L58 30 Q60 32 56 35 L46 36"
          stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"
          opacity="0.85"/>
      </svg>
    </button>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .toggle-btn {
    position: fixed;
    bottom: 1.2rem;
    left: 1.2rem;
    width: 56px;
    height: 56px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.4);
    border: 2.5px solid rgba(255, 255, 255, 0.45);
    border-radius: 6px;
    cursor: pointer;
    z-index: 101;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.2),
      2px 3px 8px rgba(0, 0, 0, 0.4);
  }

  .toggle-btn:hover, .toggle-btn.open {
    background: rgba(0, 0, 0, 0.6);
    border-color: white;
  }

  .toggle-btn svg {
    width: 100%;
    height: 100%;
  }

  .selector {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 100;
  }

  .arrow-btn {
    pointer-events: auto;
    position: fixed;
    top: 65%;
    transform: translateY(-50%);
    background: none;
    border: none;
    width: 64px;
    height: 64px;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(2px 3px 2px rgba(0, 0, 0, 0.5));
    transition: transform 0.12s, filter 0.12s;
  }

  .arrow-btn:hover {
    transform: translateY(-50%) scale(1.15);
    filter: drop-shadow(2px 4px 4px rgba(0, 0, 0, 0.6));
  }

  .arrow-btn svg {
    width: 100%;
    height: 100%;
  }

  .arrow-btn.left {
    left: 28%;
  }

  .arrow-btn.right {
    right: 28%;
  }

  .char-name {
    pointer-events: none;
    position: fixed;
    bottom: 14%;
    left: 50%;
    transform: translateX(-50%);
    font-family: "permanent-marker", sans-serif;
    font-size: 2rem;
    color: white;
    text-shadow: 2px 3px 0 rgba(0, 0, 0, 0.5);
    letter-spacing: 2px;
    user-select: none;
  }

  @media (max-width: 768px) {
    .arrow-btn.left {
      left: 5%;
    }
    .arrow-btn.right {
      right: 5%;
    }
    .char-name {
      font-size: 1.4rem;
      bottom: 22%;
    }
    .toggle-btn {
      bottom: 0.8rem;
      left: 0.8rem;
      width: 48px;
      height: 48px;
    }
  }
</style>
