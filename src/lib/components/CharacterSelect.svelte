<script>
  import { characters, getSelectedCharacter, setSelectedCharacter } from '../stores/character.svelte.js'

  const selected = $derived(getSelectedCharacter())
</script>

<div class="char-select" onpointerdown={(e) => e.stopPropagation()}>
  {#each characters as char}
    <button
      class:active={selected.id === char.id}
      onclick={() => setSelectedCharacter(char)}
    >
      {char.name}
    </button>
  {/each}
</div>

<style>
  .char-select {
    position: fixed;
    bottom: 1rem;
    left: 1rem;
    display: flex;
    gap: 0.3rem;
    background: rgba(0, 0, 0, 0.5);
    padding: 0.4rem;
    border-radius: 8px;
    z-index: 100;
    user-select: none;
  }
  button {
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-family: sans-serif;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }
  button:hover {
    background: rgba(255, 255, 255, 0.25);
  }
  button.active {
    background: rgba(255, 255, 255, 0.4);
    border-color: white;
  }
</style>
