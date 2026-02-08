<script>
  import { Canvas } from "@threlte/core";
  import * as THREE from "three";
  import Scene from "./lib/components/Scene.svelte";
  import CharacterSelect from "./lib/components/CharacterSelect.svelte";
  import TouchControls from "./lib/components/TouchControls.svelte";
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
  <Canvas toneMapping={THREE.ACESFilmicToneMapping} toneMappingExposure={0.7}>
    <Scene />
  </Canvas>
  <CharacterSelect />
  <TouchControls />
{/if}

<style>
  .lobby {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 1rem;
    font-family: sans-serif;
    background: linear-gradient(180deg, #87ceeb 0%, #c8dff5 60%, #4a8c3f 100%);
  }
  .lobby h1 {
    font-size: 2.5rem;
    color: #2d5a1e;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  .lobby input {
    padding: 0.6rem 1.2rem;
    font-size: 1.1rem;
    border: 2px solid #4a8c3f;
    border-radius: 6px;
    outline: none;
    text-align: center;
  }
  .lobby input:focus {
    border-color: #2d5a1e;
  }
  .lobby button {
    padding: 0.6rem 2.5rem;
    font-size: 1.1rem;
    background: #4a8c3f;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
  }
  .lobby button:hover {
    background: #3a7a2f;
  }
</style>
