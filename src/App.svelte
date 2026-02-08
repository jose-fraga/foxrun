<script>
  import { Canvas } from "@threlte/core";
  import * as THREE from "three";
  import Scene from "./lib/components/Scene.svelte";
  import CharacterSelect from "./lib/components/CharacterSelect.svelte";
  import TouchControls from "./lib/components/TouchControls.svelte";
  import FarmerChat from "./lib/components/FarmerChat.svelte";
  import { connect } from "./lib/network.js";

  let connected = $state(false);
  let roomId = $state(
    new URLSearchParams(window.location.search).get("room") || "default",
  );

  function joinRoom() {
    connect(roomId);
    connected = true;
  }

  function handleKeydown(e) {
    if (e.code === "Enter" && !connected) joinRoom();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if !connected}
  <div class="lobby">
    <h1>Fox run</h1>
    <input bind:value={roomId} placeholder="Room name" />
    <button onclick={joinRoom}>Join</button>
  </div>
{:else}
  <Canvas toneMapping={THREE.ACESFilmicToneMapping} toneMappingExposure={0.7} dpr={Math.min(window.devicePixelRatio, 2)}>
    <Scene />
  </Canvas>
  <CharacterSelect />
  <TouchControls />
  <FarmerChat />
{/if}

<style>
  .lobby {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 1.2rem;
    font-family: "permanent-marker", sans-serif;
    background: linear-gradient(180deg, #87ceeb 0%, #c8dff5 60%, #4a8c3f 100%);
  }
  .lobby h1 {
    font-size: 3.5rem;
    color: #2d5a1e;
    text-shadow: 2px 3px 0 rgba(0, 0, 0, 0.15);
    letter-spacing: 2px;
  }
  .lobby input {
    padding: 0.6rem 1.2rem;
    font-size: 1.1rem;
    font-family: "permanent-marker", sans-serif;
    border: 3px solid #2d5a1e;
    border-radius: 4px;
    outline: none;
    text-align: center;
    background: rgba(255, 255, 255, 0.85);
  }
  .lobby input:focus {
    border-color: #1a3a10;
  }
  .lobby button {
    padding: 0.7rem 2.5rem;
    font-size: 1.3rem;
    font-family: "permanent-marker", sans-serif;
    background: #2d5a1e;
    color: white;
    border: 3px solid #1a3a10;
    border-radius: 4px;
    cursor: pointer;
    letter-spacing: 1px;
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.3);
  }
  .lobby button:hover {
    background: #3a7a2f;
  }
</style>
