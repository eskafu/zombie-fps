import { gameState } from './src/game-state.js';
import { initScene, render, updateAtmosphere } from './src/scene.js';
import { initPlayer, updatePlayer, lock, isOnMobile, setMobileInput, setGamepadInput as setPlayerGamepadInput } from './src/player.js';
import { initWeapon, updateWeapon, resetWeapon, fireOnce, startReloadMobile, switchWeaponMobile, getOwnedWeapons, getCurrentWeapon, setAimAssist, setGamepadInput as setWeaponGamepadInput } from './src/weapon.js';
import { spawnInitialZombies, updateZombies, clearAllZombies } from './src/zombie.js';
import { initHUD, updateHUD, showMenu, hideMenu, showGameOver, showBlood, updateBlood } from './src/hud.js';
import { updatePowerups, clearAllPowerups } from './src/powerups.js';
import { initAmmoStation, updateAmmoStation, tryBuyAmmo, isNearStation, getStationCost } from './src/ammostation.js';
import { initMysteryBox, updateMysteryBox, tryActivateBox, isNearMysteryBox, getBoxCost } from './src/mysterybox.js';
import { MobileControls, isMobile, lockLandscape } from './src/mobile.js';
import { GamepadControls } from './src/gamepad.js';
import { initEnergySwitches, tryInteractSwitch, getNearestSwitchLabel } from './src/energy.js';
import { initPerks, tryBuyPerk, getNearestPerkLabel } from './src/perks.js';

let lastTime = performance.now();
let lastScore = 0;
let mobileControls = null;
let gamepadControls = null;

function onStartButton() {
  const btn = document.getElementById('start-button');
  const handler = (e) => {
    e.stopPropagation();
    e.preventDefault();
    startGame();
  };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', handler, { passive: false });
}

function onRestartButton() {
  const btn = document.getElementById('restart-button');
  const handler = (e) => {
    e.stopPropagation();
    e.preventDefault();
    gameState.reset();
    showMenu(lastScore);
  };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', handler, { passive: false });
}

function initMobile() {
  if (!isMobile()) return;

  document.body.classList.add('mobile');
  mobileControls = new MobileControls();
  setMobileInput(mobileControls);
  setAimAssist(true);

  mobileControls.setWeaponSwitchCallback((type) => {
    switchWeaponMobile(type);
  });

  mobileControls.setReloadCallback(() => {
    startReloadMobile();
  });

  mobileControls.setInteractCallback(() => {
    if (tryBuyAmmo()) return;
    if (tryActivateBox()) return;
    if (tryInteractSwitch()) return;
    if (tryBuyPerk()) return;
  });
}

function initGamepad() {
  gamepadControls = new GamepadControls();
  setPlayerGamepadInput(gamepadControls);
  setWeaponGamepadInput(gamepadControls);
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
    // Mobile: enter fullscreen + try to lock orientation to landscape.
    requestFullscreen();
    lockLandscape();
  }

  // Update weapon slots on mobile
  if (mobileControls) {
    mobileControls.updateWeaponSlots(getOwnedWeapons(), getCurrentWeapon());
  }
}

function requestFullscreen() {
  const el = document.documentElement;
  // Try standard API with navigationUI: 'hide' (hides browser chrome on mobile)
  if (el.requestFullscreen) {
    el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
      // Fallback without options
      el.requestFullscreen().catch(() => {});
    });
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  } else if (el.msRequestFullscreen) {
    el.msRequestFullscreen();
  }
}

function updateMobileInput() {
  if (!mobileControls || !mobileControls.enabled) return;

  if (mobileControls.isFiring()) {
    fireOnce();
  }

  if (mobileControls.consumeReload()) {
    startReloadMobile();
  }

  if (mobileControls.consumeInteract()) {
    if (!tryBuyAmmo()) {
      if (!tryActivateBox()) {
        if (!tryInteractSwitch()) {
          tryBuyPerk();
        }
      }
    }
  }

  // Slots rebuild is dirty-checked internally — cheap to call each frame.
  mobileControls.updateWeaponSlots(getOwnedWeapons(), getCurrentWeapon());

  // Contextual label for "E" button so the player knows what it does.
  let label = '';
  if (isNearStation()) {
    label = `AMMO ${getStationCost()}`;
  } else if (isNearMysteryBox()) {
    label = `BOX ${getBoxCost()}`;
  } else {
    const sl = getNearestSwitchLabel();
    if (sl) label = sl;
    else label = getNearestPerkLabel();
  }
  mobileControls.setInteractLabel(label);
}

function updateGamepadInput() {
  if (!gamepadControls) return;

  gamepadControls.update();

  if (gamepadControls.isFiring()) {
    fireOnce();
  }

  if (gamepadControls.consumeInteract()) {
    if (!tryBuyAmmo()) {
      if (!tryActivateBox()) {
        if (!tryInteractSwitch()) {
          tryBuyPerk();
        }
      }
    }
  }

  if (gamepadControls.consumeGrapple()) {
    // If they have grapplegun, switch to it and fire. 
    // Or just call the function if it's currently held.
    if (getCurrentWeapon() === 'grapplegun') {
      fireOnce();
    } else {
      const owned = getOwnedWeapons();
      if (owned.grapplegun) {
        switchWeaponMobile('grapplegun');
      }
    }
  }
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
    updateGamepadInput();
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
initEnergySwitches();
initPerks();
initHUD();
initMobile();
initGamepad();
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
      <p>🔫 Botão vermelho - Atirar &nbsp;|&nbsp; ⬆ - Saltar</p>
      <p>↻ - Recarregar &nbsp;|&nbsp; E - Interagir</p>
      <p>⚔️ Botões em baixo - Trocar arma</p>
    `;
  }
}

showMenu(0);
gameLoop();
