<script>
  import { World, RigidBody } from '@threlte/rapier'
  import LocalPlayer from './LocalPlayer.svelte'
  import RemotePlayer from './RemotePlayer.svelte'
  import Birds from './Birds.svelte'
  import Terrain from './Terrain.svelte'
  import Grass from './Grass.svelte'
  import CloudRing from './CloudRing.svelte'
  import Windmill from './Windmill.svelte'
  import Fence from './Fence.svelte'
  import Barn from './Barn.svelte'
  import Water from './Water.svelte'
  import Cows from './Cows.svelte'
  import Horses from './Horses.svelte'
  import Farmer from './Farmer.svelte'
  import Flowers from './Flowers.svelte'
  import DayNightCycle from './DayNightCycle.svelte'
  import Fireflies from './Fireflies.svelte'
  import EscapeHole from './EscapeHole.svelte'
  import SoftSpot from './SoftSpot.svelte'
  import Shovel from './Shovel.svelte'
  import Crops from './Crops.svelte'
  import Tractor from './Tractor.svelte'
  import AmbientSounds from './AmbientSounds.svelte'
  import Butterflies from './Butterflies.svelte'
  import HayBales from './HayBales.svelte'
  import ChickenCoop from './ChickenCoop.svelte'
  import Chickens from './Chickens.svelte'

  import { getRemotePlayers } from '../stores/players.svelte.js'

  let { onready } = $props()

  const remotePlayers = $derived(getRemotePlayers())

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
  const shadowMapSize = isMobile ? 1024 : 2048
</script>

<World>
  <!-- Local player (character + third-person camera) -->
  <LocalPlayer {onready} />

  <!-- Remote players -->
  {#each [...remotePlayers] as [id, playerState] (id)}
    <RemotePlayer {playerState} />
  {/each}

  <!-- Day/night cycle (sky, lights, stars, fog) -->
  <DayNightCycle {isMobile} {shadowMapSize} />

  <!-- Terrain -->
  <RigidBody type="fixed">
    <Terrain />
  </RigidBody>

  <!-- Grass -->
  <Grass />

  <!-- Windmill -->
  <Windmill />

  <!-- Barn -->
  <Barn />

  <!-- Hay bales inside barn -->
  <HayBales />

  <!-- Tractor -->
  <Tractor />

  <!-- Pond -->
  <Water />

  <!-- Fence ring -->
  <Fence />

  <!-- Cloud ring -->
  <CloudRing />

  <!-- Cows -->
  <Cows />

  <!-- Horses -->
  <Horses />

  <!-- Farmer NPC -->
  <Farmer />

  <!-- Flower clusters -->
  <Flowers />

  <!-- Fireflies (night only) -->
  <Fireflies />

  <!-- Birds -->
  <Birds />

  <!-- Butterflies (daytime) -->
  <Butterflies />

  <!-- Ambient sounds (wind, water, crickets) -->
  <AmbientSounds />

  <!-- Quest: Soft spot on fence -->
  <SoftSpot />

  <!-- Quest: Shovel behind barn -->
  <Shovel />

  <!-- Quest: Escape hole in fence -->
  <EscapeHole />

  <!-- Chicken coop + hens -->
  <ChickenCoop />
  <Chickens />

  <!-- Crop field -->
  <Crops />
</World>
