# AGENTS.md

## Project
Static-client Zombie FPS built with Three.js. Single-player browser game set in an apocalyptic 1960s village.

## Setup
- No build tools, no package manager. Just serve the root directory with any static file server.
- `game.js` is the main module (imported by `index.html` as `type="module"`).

## Dependencies
- Three.js `0.160.0` loaded from CDN via `<script type="importmap">` — no `npm install` needed.
- Imports use `three` and `three/addons/` bare specifiers.

## Entrypoint
- `index.html` → `game.js`

## Core Systems
- **Vertical Movement**: Functional Grappling Hook weapon (`fireGrappleHook`) and gravity-based jumping.
- **3D Physics**: Collision system supports walking and jumping on obstacles (cars, buses, roofs) via `maxY` property in `barrierColliders`.
- **Mystery Box**: Random weapon generator (1200 points). Includes Grappling Hook, Raygun, Alien Gun, etc.
- **Weapons**: Hand-drawn 2D spritesheets with first-person perspective and animations.

## Key Files
- `index.html` — HTML shell, menus, importmap
- `src/game.js` — Main game loop and orchestration
- `src/player.js` — Player movement, jumping, and grappling logic
- `src/scene.js` — World generation, 1960s props, and 3D collision data
- `src/weapon.js` — Weapon definitions, ammo states, and viewmodel rendering
- `src/mysterybox.js` — Mystery Box logic and weapon roll system
- `assets/armas/` — 2D weapon spritesheets

## Icon Libraries (npm)
- `lucide`, `phosphor-icons`, `remixicon`, `@hugeicons/core-free-icons`
