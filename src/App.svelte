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
  import { clearMessages } from "./lib/stores/farmerChat.svelte.js";
  import { getInteractionPrompt } from "./lib/stores/interactionPrompt.svelte.js";
  import { isMuted, toggleMute } from "./lib/stores/sound.svelte.js";
  import { playClick } from "./lib/utils/uiSound.js";

  const prompt = $derived(getInteractionPrompt());
  const muted = $derived(isMuted());
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  function triggerInteract() {
    playClick();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  }

  let connected = $state(false);
  let showLobby = $state(true);
  let showIntro = $state(false);
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

  // Soundtrack — plays, waits 5s gap, then repeats
  const soundtrack = new Audio('/sounds/soundtrack.wav');
  soundtrack.volume = 0;
  const SOUNDTRACK_VOL = 0.15;

  soundtrack.addEventListener('ended', () => {
    setTimeout(() => {
      if (isMuted()) return;
      soundtrack.currentTime = 0;
      soundtrack.volume = SOUNDTRACK_VOL;
      soundtrack.play().catch(() => {});
    }, 5000);
  });

  function fadeInSoundtrack() {
    if (isMuted()) return;
    soundtrack.play().catch(() => {});
    let vol = 0;
    const fade = setInterval(() => {
      if (isMuted()) { clearInterval(fade); return; }
      vol += 0.01;
      if (vol >= SOUNDTRACK_VOL) { vol = SOUNDTRACK_VOL; clearInterval(fade); }
      soundtrack.volume = vol;
    }, 100);
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

      // Start soundtrack and show intro message after loading screen fades
      setTimeout(() => {
        fadeInSoundtrack();
        showIntro = true;
        setTimeout(() => { showIntro = false; }, 6000);
      }, 900);
    }, 1000);
  }

  function handlePlayAgain() {
    showLoadingScreen();
    disconnect();
    resetQuests();
    clearMessages();
    connected = false;
    showLobby = false;
    // Let the DOM unmount the game scene, then reconnect
    setTimeout(() => {
      connect(roomId);
      connected = true;
    }, 100);
  }

  function handleSoundToggle() {
    playClick();
    const nowMuted = toggleMute();
    if (nowMuted) {
      soundtrack.pause();
    } else if (connected) {
      soundtrack.play().catch(() => {});
    }
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
  <button class="sound-btn" onclick={handleSoundToggle}>
    <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Brush-painted border -->
      <path d="M8 6 Q20 3 36 5 Q52 3 64 6 Q67 20 65 36 Q67 52 64 66 Q52 69 36 67 Q20 69 8 66 Q5 52 7 36 Q5 20 8 6Z"
        stroke="white" stroke-width="2.5" fill="rgba(0,0,0,0.35)" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/>
      <path d="M10 8 Q22 5 36 7 Q50 5 62 8"
        stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.3"/>
      <path d="M62 64 Q50 67 36 65 Q22 67 10 64"
        stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.3"/>
      <!-- Brush-painted speaker -->
      <path d="M18 26 L17 30 L18 38 L19 44 L20 46 L26 46 L29 47 L33 50 L37 54 L39 53 L40 50 L39 22 L38 19 L36 20 L32 23 L28 26 L24 27 Z"
        stroke="white" stroke-width="2" fill="rgba(255,255,255,0.08)" stroke-linejoin="round" stroke-linecap="round"/>
      {#if !muted}
        <!-- Brush sound waves -->
        <path d="M45 28 L46 31 Q48 36 46 41 L45 44"
          stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M51 22 L53 27 Q56 36 53 45 L51 50"
          stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      {:else}
        <!-- Brush mute X -->
        <path d="M43 26 L46 31 L49 36 L52 41 L55 46"
          stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M55 26 L52 31 L49 36 L46 41 L43 46"
          stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      {/if}
    </svg>
  </button>
  <TouchControls />
  <FarmerChat />
  {#if prompt}
    <button class="interaction-prompt" onclick={triggerInteract}>
      {isMobile ? `Tap to ${prompt}` : `Press E to ${prompt}`}
    </button>
  {/if}
  <QuestHUD />
  <VictoryScreen onplayagain={handlePlayAgain} />
  {#if showIntro}
    <div class="intro-message">
      I've been trapped in this farm for too long...
    </div>
  {/if}
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
    border: none;
    font-family: "permanent-marker", sans-serif;
    font-size: 0.9rem;
    cursor: pointer;
    z-index: 500;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .interaction-prompt:active {
    background: rgba(255, 255, 255, 0.25);
  }

  .intro-message {
    position: fixed;
    top: 40%;
    left: 50%;
    transform: translateX(-50%);
    font-family: "permanent-marker", sans-serif;
    font-size: 1.6rem;
    color: white;
    text-align: center;
    z-index: 400;
    pointer-events: none;
    animation: intro-fade 6s ease-in-out forwards;
  }

  @keyframes intro-fade {
    0% { opacity: 0; transform: translateX(-50%) translateY(8px); }
    12% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  }

  .sound-btn {
    position: fixed;
    bottom: 1.2rem;
    left: calc(1.2rem + 56px + 0.5rem);
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
    -webkit-tap-highlight-color: transparent;
  }
  .sound-btn:hover {
    transform: scale(1.1);
    filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.6));
  }
  .sound-btn svg {
    width: 100%;
    height: 100%;
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
    .intro-message {
      font-size: 1.1rem;
    }
    .sound-btn {
      bottom: 0.8rem;
      left: calc(0.8rem + 48px + 0.4rem);
      width: 48px;
      height: 48px;
    }
  }
</style>
