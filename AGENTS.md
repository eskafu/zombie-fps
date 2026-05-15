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
- **Vertical Movement**: Functional Grappling Hook weapon (`fireGrappleHook`). Fixed raycaster and viewmodel clipping bugs. Mapped to `0` key and mouse wheel.
- **3D Physics**: Advanced collision system. Buildings have `maxY` set to roof height with additional cone blockers to prevent clipping. 
- **Mystery Box**: Random weapon generator (1200 points). Includes Grappling Hook (3 charges, auto-discard), Raygun, etc.
- **Zombie AI**: 
  *   **Spawning**: Smart spawning from house doors and a central stone well landmark.
  *   **Navigation**: Anti-stuck system with 45° rotational evasion.
  *   **Crowd Control**: Separation forces prevent zombies from stacking/overlapping.
  *   **Combat**: Height-aware damage system prevents zombies hitting players through roofs.
- **Controls**: Weapon switching via slots 1-6, `0` for grapple, and mouse wheel scroll.

## Key Files
- `index.html` — HTML shell, menus, importmap
- `src/game.js` — Main game loop and orchestration
- `src/player.js` — Player movement, jumping, and grappling logic
- `src/scene.js` — World generation, stone well landmark, and collision data
- `src/weapon.js` — Weapon definitions, mouse wheel switching, and viewmodel logic
- `src/zombie.js` — Zombie AI, smart spawning, and separation logic
- `src/mysterybox.js` — Mystery Box logic and weapon roll system

## Icon Libraries (npm)
- `lucide`, `phosphor-icons`, `remixicon`, `@hugeicons/core-free-icons`
