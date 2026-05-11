# AGENTS.md

## Project
Static-client Zombie FPS built with Three.js. Single-player browser game.

## Setup
- No build tools, no package manager. Just serve the root directory with any static file server.
- `game.js` is the main module (imported by `index.html` as `type="module"`).

## Dependencies
- Three.js `0.160.0` loaded from CDN via `<script type="importmap">` — no `npm install` needed.
- Imports use `three` and `three/addons/` bare specifiers (e.g. `three/addons/controls/PointerLockControls.js`).

## Entrypoint
- `index.html` → `game.js`

## Files
- `index.html` — HTML shell, menus, importmap
- `style.css` — all styling
- `game.js` — all game logic (referenced but not yet created)
- `Novo Documento de Texto.txt` — empty, irrelevant
- `package.json` — npm dependencies (icon libraries)

## Local Skills (`.opencode/skills/`)
- `product-builder` — manage requirements and features
- `ui-prompt-designer` — prepare structured design prompts
- `ui-ux-design-intelligence` — analyze and suggest UI/UX improvements
- `full-stack-developer` — orchestrate frontend/backend code

## Icon Libraries (npm)
- `lucide` — vanilla JS icon library (web component `<i-lucide>`)
- `phosphor-icons` — vanilla JS icon set (`phosphor-icons` CSS)
- `remixicon` — icon font collection (CDN or npm)
- `@hugeicons/core-free-icons` — free Hugeicons SVG icons
