<script>
  import { Canvas } from "@threlte/core";
  import * as THREE from "three";
  import Scene from "./lib/components/Scene.svelte";
  import MenuScene from "./lib/components/MenuScene.svelte";
  import CharacterSelect from "./lib/components/CharacterSelect.svelte";
  import TouchControls from "./lib/components/TouchControls.svelte";
  import FarmerChat from "./lib/components/FarmerChat.svelte";
  import { connect } from "./lib/network.js";

  let connected = $state(false);
  let fading = $state(false);
  let showLobby = $state(true);
  let roomId = $state(
    new URLSearchParams(window.location.search).get("room") || "default",
  );

  function joinRoom() {
    // Show loading screen
    const loadEl = document.getElementById('loading-screen');
    if (loadEl) {
      loadEl.style.display = '';
      loadEl.classList.remove('fade-out');
    }
    connect(roomId);
    connected = true;
    fading = true;
    setTimeout(() => {
      showLobby = false;
    }, 1200);
  }

  function onGameReady() {
    const bar = document.getElementById('progress-fill');
    if (bar) bar.classList.add('complete');
    setTimeout(() => {
      const el = document.getElementById('loading-screen');
      if (el) {
        el.classList.add('fade-out');
        setTimeout(() => el.remove(), 700);
      }
    }, 1000);
  }

  function handleKeydown(e) {
    if (e.code === "Enter" && !connected) joinRoom();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if showLobby}
  <!-- 3D menu background -->
  <div class="menu-canvas" class:fading>
    <Canvas toneMapping={THREE.ACESFilmicToneMapping} toneMappingExposure={0.8} dpr={Math.min(window.devicePixelRatio, 2)}>
      <MenuScene />
    </Canvas>
  </div>

  <!-- UI overlay -->
  <div class="lobby" class:fading>
    <div class="title-layer">
      <h1>Fox Run</h1>
    </div>
    <div class="controls-layer">
      <div class="controls">
        <input bind:value={roomId} placeholder="Room: default" />
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
{/if}

<style>
  .menu-canvas {
    position: fixed;
    inset: 0;
    z-index: 199;
    transition: opacity 1s ease-out;
  }

  .menu-canvas.fading {
    opacity: 0;
    pointer-events: none;
  }

  .lobby {
    position: fixed;
    inset: 0;
    z-index: 200;
    font-family: "permanent-marker", sans-serif;
    pointer-events: none;
    transition: opacity 1s ease-out;
  }
  .lobby.fading {
    opacity: 0;
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
    font-size: 5rem;
    color: white;
    text-shadow:
      3px 4px 0 rgba(0, 0, 0, 0.4),
      0 0 60px rgba(255, 200, 50, 0.25),
      0 0 120px rgba(255, 150, 50, 0.1);
    letter-spacing: 6px;
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

  .controls input {
    padding: 0.6rem 1.2rem;
    font-size: 1.1rem;
    font-family: "permanent-marker", sans-serif;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 8px;
    outline: none;
    text-align: center;
    background: rgba(0, 0, 0, 0.3);
    color: white;
    backdrop-filter: blur(8px);
    width: 220px;
  }
  .controls input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  .controls input:focus {
    border-color: rgba(255, 255, 255, 0.7);
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

  @media (max-width: 768px) {
    .title-layer h1 {
      font-size: 3rem;
      letter-spacing: 3px;
    }
    .title-layer {
      top: 15%;
    }
    .controls-layer {
      top: 32%;
    }
  }
</style>
