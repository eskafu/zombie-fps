import { gameState } from './src/game-state.js';
import { initScene, render, updateAtmosphere } from './src/scene.js';
import { initPlayer, updatePlayer, lock, isOnMobile, setMobileInput } from './src/player.js';
import { initWeapon, updateWeapon, resetWeapon, fireOnce, startReloadMobile, switchWeaponMobile, getOwnedWeapons, getCurrentWeapon } from './src/weapon.js';
import { spawnInitialZombies, updateZombies, clearAllZombies } from './src/zombie.js';
import { initHUD, updateHUD, showMenu, hideMenu, showGameOver, showBlood, updateBlood } from './src/hud.js';
import { updatePowerups, clearAllPowerups } from './src/powerups.js';
import { initAmmoStation, updateAmmoStation, tryBuyAmmo } from './src/ammostation.js';
import { initMysteryBox, updateMysteryBox, tryActivateBox } from './src/mysterybox.js';
import { MobileControls, isMobile } from './src/mobile.js';

let lastTime = performance.now();
let lastScore = 0;
let mobileControls = null;

function onStartButton() {
  document.getElementById('start-button').addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
  });
}

function onRestartButton() {
  document.getElementById('restart-button').addEventListener('click', (e) => {
    e.stopPropagation();
    gameState.reset();
    showMenu(lastScore);
  });
}

function initMobile() {
  if (!isMobile()) return;

  document.body.classList.add('mobile');
  mobileControls = new MobileControls();
  setMobileInput(mobileControls);

  // Wire weapon switch
  mobileControls.setWeaponSwitchCallback((type) => {
    switchWeaponMobile(type);
  });

  // Wire reload
  mobileControls.setReloadCallback(() => {
    startReloadMobile();
  });

  // Wire interact (E button)
  mobileControls.setInteractCallback(() => {
    if (!tryBuyAmmo()) {
      tryActivateBox();
    }
  });
}

function startGame() {
  clearAllZombies();
  clearAllPowerups();
  resetWeapon();
  gameState.startGame();
  hideMenu();
  spawnInitialZombies();
  lastTime = performance.now();

  if (!isOnMobile()) {
    lock();
  } else {
    // Request fullscreen on mobile to prevent browser chrome scroll/gestures
    requestFullscreen();
  }

  // Update weapon slots on mobile
  if (mobileControls) {
    mobileControls.updateWeaponSlots(getOwnedWeapons(), getCurrentWeapon());
  }
}

function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  }
}

function updateMobileInput() {
  if (!mobileControls || !mobileControls.enabled) return;

  // Fire button (held = continuous fire for auto/semi-auto)
  if (mobileControls.isFiring()) {
    fireOnce();
  }

  // Reload button (one-shot)
  if (mobileControls.consumeReload()) {
    startReloadMobile();
  }

  // Interact button (one-shot)
  if (mobileControls.consumeInteract()) {
    if (!tryBuyAmmo()) {
      tryActivateBox();
    }
  }

  // Update weapon slots (refresh on weapon change)
  mobileControls.updateWeaponSlots(getOwnedWeapons(), getCurrentWeapon());
}

function gameLoop() {
  requestAnimationFrame(gameLoop);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const time = now / 1000;

  updateAtmosphere(time);

  if (gameState.state === 'playing') {
    gameState.tick(delta);
    updatePlayer(delta);
    updateMobileInput();
    updateZombies(delta, () => showBlood());
    updatePowerups(delta);
    updateAmmoStation(delta);
    updateMysteryBox(delta);
    updateWeapon(delta);
    updateHUD(delta);
    updateBlood(delta);

    if (gameState.state === 'game-over') {
      lastScore = gameState.getTotalScore();
      showGameOver(false);
    }
  }

  render();
}

// ── Init ──
initScene();
initPlayer();
initWeapon();
initAmmoStation();
initMysteryBox();
initHUD();
initMobile();
onStartButton();
onRestartButton();

// Show best round and kills in menu
const bestRoundEl = document.getElementById('best-round');
if (bestRoundEl) bestRoundEl.textContent = gameState.maxRound;
const bestKillsEl = document.getElementById('best-kills');
if (bestKillsEl) bestKillsEl.textContent = gameState.maxKills;

// Update instructions for mobile
if (isMobile()) {
  const instructions = document.querySelector('.instructions');
  if (instructions) {
    instructions.innerHTML = `
      <p>🎮 Joystick esquerdo - Mover</p>
      <p>👆 Joystick direito - Olhar</p>
      <p>🔫 Botão vermelho - Atirar</p>
      <p>↻ - Recarregar &nbsp;|&nbsp; E - Interagir</p>
      <p>⚔️ Botões em baixo - Trocar arma</p>
    `;
  }
}

showMenu(0);
gameLoop();
