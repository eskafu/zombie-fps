import { gameState } from './src/game-state.js';
import { initScene, render, updateAtmosphere } from './src/scene.js';
import { initPlayer, updatePlayer, lock } from './src/player.js';
import { initWeapon, updateWeapon, resetWeapon } from './src/weapon.js';
import { spawnInitialZombies, updateZombies, clearAllZombies } from './src/zombie.js';
import { initHUD, updateHUD, showMenu, hideMenu, showGameOver, showBlood, updateBlood } from './src/hud.js';
import { updatePowerups, clearAllPowerups } from './src/powerups.js';
import { initAmmoStation, updateAmmoStation } from './src/ammostation.js';
import { initMysteryBox, updateMysteryBox } from './src/mysterybox.js';

let lastTime = performance.now();
let lastScore = 0;

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

function startGame() {
  clearAllZombies();
  clearAllPowerups();
  resetWeapon();
  gameState.startGame();
  hideMenu();
  spawnInitialZombies();
  lastTime = performance.now();
  lock();
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

initScene();
initPlayer();
initWeapon();
initAmmoStation();
initMysteryBox();
initHUD();
onStartButton();
onRestartButton();

// Show best round and kills in menu
const bestRoundEl = document.getElementById('best-round');
if (bestRoundEl) bestRoundEl.textContent = gameState.maxRound;
const bestKillsEl = document.getElementById('best-kills');
if (bestKillsEl) bestKillsEl.textContent = gameState.maxKills;

showMenu(0);
gameLoop();
