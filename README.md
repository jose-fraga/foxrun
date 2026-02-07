# Foxrun

A multiplayer 3D game where players control foxes running through a procedurally generated rural environment. Built with Svelte, Three.js, and PartyKit.

## Tech Stack

- **Svelte 5** + **Vite** — UI framework and build tool
- **Three.js** via **Threlte** — 3D rendering
- **Rapier 3D** — Physics engine (WASM)
- **PartyKit** — Real-time multiplayer (edge-deployed WebSockets)

## Getting Started

```bash
npm install
```

### Development (single player)

```bash
npm run dev
```

### Development (with multiplayer)

```bash
npm run dev:party
```

This starts both the Vite dev server and a local PartyKit server on port 1999.

## Controls

| Key | Action |
|-----|--------|
| W / Arrow Up | Move forward |
| S / Arrow Down | Move backward |
| A / Arrow Left | Turn left |
| D / Arrow Right | Turn right |
| Shift | Sprint |
| Space | Jump |

## Deployment

### 1. Deploy the multiplayer server

```bash
npx partykit login
npm run deploy:party
```

### 2. Set the PartyKit host

```bash
echo "VITE_PARTYKIT_HOST=https://foxrun.<username>.partykit.dev" > .env.production
```

### 3. Build and deploy the frontend

```bash
npm run build
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

## Project Structure

```
src/
├── App.svelte                  # Lobby UI + game entry
├── main.js                     # Svelte mount point
├── app.css                     # Global styles
└── lib/
    ├── components/
    │   ├── Scene.svelte        # 3D scene container
    │   ├── LocalPlayer.svelte  # Player movement, physics, camera
    │   ├── RemotePlayer.svelte # Networked player with interpolation
    │   ├── Terrain.svelte      # Procedural terrain mesh + physics
    │   ├── Grass.svelte        # 650k instanced grass blades
    │   ├── Water.svelte        # Pond with animated normals
    │   ├── Fence.svelte        # Perimeter fence
    │   ├── Barn.svelte         # Barn model
    │   ├── Windmill.svelte     # Animated windmill
    │   ├── Birds.svelte        # Procedural bird flocks
    │   ├── Forest.svelte       # Scattered trees
    │   └── CloudRing.svelte    # Cloud ring decoration
    ├── stores/
    │   └── players.svelte.js   # Remote player state management
    ├── network.js              # PartyKit WebSocket client
    └── utils/
        ├── terrain.js          # Noise-based terrain height
        ├── obstacles.js        # Collision resolution
        ├── pond.js             # Pond position/size config
        └── playerPosition.js   # Shared local player position
party/
└── server.js                   # PartyKit multiplayer server
```
