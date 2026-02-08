<script>
  import { T } from '@threlte/core'
  import { Sky } from '@threlte/extras'
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
  import Deer from './Deer.svelte'
  import { getRemotePlayers } from '../stores/players.svelte.js'

  const remotePlayers = $derived(getRemotePlayers())
</script>

<World>
  <!-- Local player (character + third-person camera) -->
  <LocalPlayer />

  <!-- Remote players -->
  {#each [...remotePlayers] as [id, playerState] (id)}
    <RemotePlayer {playerState} />
  {/each}

  <!-- Sunset sunlight -->
  <T.DirectionalLight
    position={[0, 6, -200]}
    color="#ffe0a0"
    intensity={2.0}
    castShadow
    shadow.mapSize.width={2048}
    shadow.mapSize.height={2048}
    shadow.camera.left={-60}
    shadow.camera.right={60}
    shadow.camera.top={60}
    shadow.camera.bottom={-60}
    shadow.camera.near={1}
    shadow.camera.far={400}
    shadow.bias={-0.0005}
  />

  <T.HemisphereLight args={[0xffd4a8, 0x3a4a30, 0.4]} />
  <T.AmbientLight intensity={0.2} color="#ffe0c0" />

  <!-- Sky -->
  <Sky
    elevation={1}
    turbidity={12}
    rayleigh={3}
    mieCoefficient={0.005}
    mieDirectionalG={0.8}
    azimuth={180}
  />

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

  <!-- Pond -->
  <Water />

  <!-- Fence ring -->
  <Fence />

  <!-- Cloud ring -->
  <CloudRing />

  <!-- Cows -->
  <Cows />

  <!-- Deer -->
  <Deer />

  <!-- Birds -->
  <Birds />

  <!-- Fog -->
  <T.FogExp2 args={['#c8dff5', 0.004]} attach="fog" />
</World>
