<script>
  import { Canvas } from "@threlte/core";
  import * as THREE from "three";
  import Scene from "./lib/components/Scene.svelte";
  import MenuScene from "./lib/components/MenuScene.svelte";
  import CharacterSelect from "./lib/components/CharacterSelect.svelte";
  import TouchControls from "./lib/components/TouchControls.svelte";
  import FarmerChat from "./lib/components/FarmerChat.svelte";
  import QuestHUD from "./lib/components/QuestHUD.svelte";
  import VictoryScreen from "./lib/components/VictoryScreen.svelte";
  import { connect, disconnect } from "./lib/network.js";
  import "./lib/stores/players.svelte.js";
  import { resetQuests } from "./lib/stores/questProgress.svelte.js";
  import { getInteractionPrompt } from "./lib/stores/interactionPrompt.svelte.js";

  const prompt = $derived(getInteractionPrompt());

  let connected = $state(false);
  let showLobby = $state(true);
  let roomId = $state(
    new URLSearchParams(window.location.search).get("room") || "default",
  );

  function showLoadingScreen() {
    const loadEl = document.getElementById('loading-screen');
    if (loadEl) {
      loadEl.style.display = '';
      loadEl.classList.remove('fade-out');
    }
    const bar = document.getElementById('progress-fill');
    if (bar) bar.style.width = '0%';

    THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
      const fill = document.getElementById('progress-fill');
      if (fill) {
        fill.style.width = Math.round((loaded / total) * 100) + '%';
      }
    };
  }

  function joinRoom() {
    showLoadingScreen();
    showLobby = false;
    connect(roomId);
    connected = true;
  }

  function onGameReady() {
    // Ensure bar fills to 100%
    const bar = document.getElementById('progress-fill');
    if (bar) bar.style.width = '100%';

    // Wait 1 second after 100%, then fade out
    setTimeout(() => {
      const el = document.getElementById('loading-screen');
      if (el) {
        el.classList.add('fade-out');
        setTimeout(() => { el.style.display = 'none'; el.classList.remove('fade-out'); }, 900);
      }
      THREE.DefaultLoadingManager.onProgress = undefined;
    }, 1000);
  }

  function handlePlayAgain() {
    showLoadingScreen();
    disconnect();
    resetQuests();
    connected = false;
    showLobby = false;
    // Let the DOM unmount the game scene, then reconnect
    setTimeout(() => {
      connect(roomId);
      connected = true;
    }, 100);
  }

  function handleKeydown(e) {
    if (e.code === "Enter" && !connected) joinRoom();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if showLobby}
  <!-- 3D menu background -->
  <div class="menu-canvas">
    <Canvas toneMapping={THREE.ACESFilmicToneMapping} toneMappingExposure={0.8} dpr={Math.min(window.devicePixelRatio, 2)}>
      <MenuScene />
    </Canvas>
  </div>

  <!-- UI overlay -->
  <div class="lobby">
    <div class="title-layer">
      <h1>Beyond the Fence</h1>
    </div>
    <div class="controls-layer">
      <div class="controls">
        <div class="brush-input-wrap">
          <svg class="brush-border" viewBox="0 0 260 48" preserveAspectRatio="none">
            <path d="M6 8 Q20 3 60 6 Q130 2 200 6 Q240 3 254 8 Q258 16 256 24 Q258 32 254 40 Q240 45 200 42 Q130 46 60 42 Q20 45 6 40 Q2 32 4 24 Q2 16 6 8Z"
              stroke="rgba(255,255,255,0.35)" stroke-width="1.8" fill="rgba(0,0,0,0.3)" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          <input bind:value={roomId} placeholder="Room: default" />
        </div>
        <button onclick={joinRoom}>Play</button>
      </div>
    </div>
  </div>
{/if}

{#if connected}
  <Canvas toneMapping={THREE.ACESFilmicToneMapping} toneMappingExposure={0.7} dpr={Math.min(window.devicePixelRatio, 2)}>
    <Scene onready={onGameReady} />
  </Canvas>
  <CharacterSelect />
  <TouchControls />
  <FarmerChat />
  {#if prompt}
    <div class="interaction-prompt">{prompt}</div>
  {/if}
  <QuestHUD />
  <VictoryScreen onplayagain={handlePlayAgain} />
{/if}

<style>
  .menu-canvas {
    position: fixed;
    inset: 0;
    z-index: 199;
  }

  .lobby {
    position: fixed;
    inset: 0;
    z-index: 200;
    font-family: "permanent-marker", sans-serif;
    pointer-events: none;
  }

  /* Vignette overlay */
  .lobby::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center 55%,
      rgba(0, 0, 0, 0) 30%,
      rgba(0, 0, 0, 0.4) 100%
    );
    pointer-events: none;
  }

  .title-layer {
    position: absolute;
    top: 18%;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .title-layer h1 {
    font-size: 4rem;
    color: white;
    text-shadow:
      3px 4px 0 rgba(0, 0, 0, 0.4),
      0 0 60px rgba(255, 200, 50, 0.25),
      0 0 120px rgba(255, 150, 50, 0.1);
    letter-spacing: 4px;
    white-space: nowrap;
    user-select: none;
  }

  .controls-layer {
    position: absolute;
    top: 38%;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: auto;
  }

  .controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
  }

  .brush-input-wrap {
    position: relative;
    width: 220px;
  }
  .brush-border {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .controls input {
    width: 100%;
    padding: 0.6rem 1.2rem;
    font-size: 1.1rem;
    font-family: "permanent-marker", sans-serif;
    border: none;
    outline: none;
    text-align: center;
    background: none;
    color: white;
    position: relative;
    z-index: 1;
  }
  .controls input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .controls button {
    padding: 0.7rem 3rem;
    font-size: 1.4rem;
    font-family: "permanent-marker", sans-serif;
    background: none;
    color: white;
    border: none;
    cursor: pointer;
    letter-spacing: 2px;
    text-shadow: 2px 3px 0 rgba(0, 0, 0, 0.4);
    transition: transform 0.15s;
  }
  .controls button:hover {
    transform: scale(1.1);
  }

  .interaction-prompt {
    position: fixed;
    bottom: 18%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    font-family: "permanent-marker", sans-serif;
    font-size: 0.9rem;
    pointer-events: none;
    z-index: 500;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .title-layer h1 {
      font-size: 2.2rem;
      letter-spacing: 2px;
    }
    .title-layer {
      top: 15%;
    }
    .controls-layer {
      top: 32%;
    }
  }
</style>
