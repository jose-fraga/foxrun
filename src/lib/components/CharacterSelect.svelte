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
  <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Brush-painted border -->
    <path d="M8 6 Q20 3 36 5 Q52 3 64 6 Q67 20 65 36 Q67 52 64 66 Q52 69 36 67 Q20 69 8 66 Q5 52 7 36 Q5 20 8 6Z"
      stroke="white" stroke-width="2.5" fill="rgba(0,0,0,0.35)" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/>
    <path d="M10 8 Q22 5 36 7 Q50 5 62 8"
      stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.3"/>
    <path d="M62 64 Q50 67 36 65 Q22 67 10 64"
      stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.3"/>
    <!-- Wolf icon -->
    <path d="M16 14 L13 30 L18 33 L15 48 L23 42 L28 52 L36 44 L44 52 L49 42 L57 48 L54 33 L59 30 L56 14 L46 24 L36 19 L26 24 Z"
      stroke="white" stroke-width="2" fill="rgba(255,255,255,0.08)" stroke-linejoin="round"/>
    <circle cx="28" cy="33" r="2.5" fill="white"/>
    <circle cx="44" cy="33" r="2.5" fill="white"/>
    <path d="M32 40 Q36 44 40 40" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
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
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    z-index: 101;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(2px 3px 4px rgba(0, 0, 0, 0.5));
    transition: transform 0.12s, filter 0.12s;
  }

  .toggle-btn:hover, .toggle-btn.open {
    transform: scale(1.1);
    filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.6));
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
