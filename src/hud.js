import { gameState } from './game-state.js';
import { getActivePowerupLabels } from './powerups.js';
import { getAmmoState, getCurrentWeapon, getOwnedWeapons } from './weapon.js';
import { isNearStation, getStationCost, getStationMessage } from './ammostation.js';
import { isNearMysteryBox, getBoxCost, getBoxMessage } from './mysterybox.js';
import { getLeaderboard, submitScore } from './ranking.js';
import { haptic } from './mobile.js';
import { getNearestSwitchLabel } from './energy.js';
import { getNearestPerkLabel } from './perks.js';

const elements = {};
let bloodTimer = 0;
const BLOOD_DURATION = 0.5;
let hitMarkerTimer = 0;
const HIT_MARKER_DURATION = 0.12;
let roundBannerShown = -1;

// Crosshair spread
let crosshairSpread = 0;
const CROSSHAIR_BASE_SIZE = 20;
const CROSSHAIR_MAX_SPREAD = 40;
const CROSSHAIR_RECOVER = 6;

export function initHUD() {
  elements.lives     = document.getElementById('lives');
  elements.kills     = document.getElementById('kills');
  elements.points    = document.getElementById('points');
  elements.round     = document.getElementById('round');
  elements.zombiesLeft = document.getElementById('zombies-left');
  elements.menu      = document.getElementById('menu');
  elements.hud       = document.getElementById('hud');
  elements.gameOver  = document.getElementById('game-over');
  elements.gameOverTitle = document.getElementById('game-over-title');
  elements.finalScore = document.getElementById('final-score');
  elements.finalRound = document.getElementById('final-round');
  elements.startButton  = document.getElementById('start-button');
  elements.restartButton = document.getElementById('restart-button');
  elements.lastScore = document.getElementById('last-score');
  elements.crosshair    = document.getElementById('crosshair');
  elements.hitMarker    = document.getElementById('hit-marker');
  elements.roundBanner  = document.getElementById('round-banner');
  elements.powerupList  = document.getElementById('powerup-list');
  elements.intermission = document.getElementById('intermission');
  elements.ammoDisplay  = document.getElementById('ammo-display');
  elements.reloadBar    = document.getElementById('reload-bar');
  elements.buyPrompt    = document.getElementById('buy-prompt');
  elements.perksList    = document.getElementById('perks-list');

  if (!elements.perksList) {
    elements.perksList = document.createElement('div');
    elements.perksList.id = 'perks-list';
    elements.perksList.style.cssText = `
      position: fixed; bottom: 20px; left: 20px;
      display: flex; gap: 10px; z-index: 10; pointer-events: none;
    `;
    document.body.appendChild(elements.perksList);
  }

  // Blood overlay
  let blood = document.getElementById('blood-overlay');
  if (!blood) {
    blood = document.createElement('div');
    blood.id = 'blood-overlay';
    blood.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(ellipse at center, rgba(255,0,0,0.5) 0%, rgba(200,0,0,0.3) 40%, transparent 70%);
      pointer-events: none; z-index: 6; opacity: 0; transition: opacity 0.1s;
    `;
    document.body.appendChild(blood);
  }
  elements.blood = blood;

  // Health vignette (persistent low hp warning)
  let vignette = document.getElementById('health-vignette');
  if (!vignette) {
    vignette = document.createElement('div');
    vignette.id = 'health-vignette';
    vignette.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 5; opacity: 0; transition: opacity 0.3s;
      box-shadow: inset 0 0 120px 40px rgba(255,0,0,0.5);
      border-radius: 50%;
    `;
    document.body.appendChild(vignette);
  }
  elements.vignette = vignette;

  // Weapon slots indicator
  let weaponSlots = document.getElementById('weapon-slots');
  if (!weaponSlots) {
    weaponSlots = document.createElement('div');
    weaponSlots.id = 'weapon-slots';
    weaponSlots.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 12px; pointer-events: none; z-index: 6;
      font-family: Arial, sans-serif; font-size: 0.9rem;
    `;
    document.body.appendChild(weaponSlots);
  }
  elements.weaponSlots = weaponSlots;
}

export function updateHUD(delta) {
  if (!elements.lives) return;

  elements.lives.textContent = '❤️'.repeat(Math.max(0, gameState.lives));
  elements.kills.textContent = gameState.kills;
  elements.points.textContent = gameState.points.toLocaleString();
  elements.round.textContent = gameState.round;
  elements.zombiesLeft.textContent = gameState.getZombiesLeft();

  // Energy status
  if (!gameState.isPowerOn && gameState.energySwitchesActive > 0) {
    elements.zombiesLeft.innerHTML += `<div style="font-size:0.8rem; color:#00ffaa">ENERGIA: ${gameState.energySwitchesActive}/3</div>`;
  }

  // Health vignette
  if (elements.vignette) {
    if (gameState.lives === 1) {
      elements.vignette.style.opacity = '0.7';
      elements.vignette.style.animation = 'heartbeat 1s infinite';
    } else if (gameState.lives === 2) {
      elements.vignette.style.opacity = '0.25';
      elements.vignette.style.animation = 'none';
    } else {
      elements.vignette.style.opacity = '0';
      elements.vignette.style.animation = 'none';
    }
  }

  // Dynamic crosshair
  if (elements.crosshair) {
    // Recover spread
    crosshairSpread = Math.max(0, crosshairSpread - CROSSHAIR_RECOVER * delta);
    const size = CROSSHAIR_BASE_SIZE + crosshairSpread;
    elements.crosshair.style.width = size + 'px';
    elements.crosshair.style.height = size + 'px';
  }

  // Round banner
  if (gameState.roundBannerTimer > 0 && gameState.round !== roundBannerShown) {
    roundBannerShown = gameState.round;
    if (elements.roundBanner) {
      elements.roundBanner.textContent = `ROUND ${gameState.round}`;
      elements.roundBanner.style.opacity = '1';
    }
  }
  if (gameState.roundBannerTimer <= 0 && elements.roundBanner) {
    elements.roundBanner.style.opacity = '0';
  }

  // Intermission between rounds
  if (elements.intermission) {
    if (gameState.roundStarting) {
      elements.intermission.style.display = 'block';
      elements.intermission.textContent = `ROUND ${gameState.round + 1} EM ${Math.ceil(gameState.roundStartTimer)}s`;
    } else {
      elements.intermission.style.display = 'none';
    }
  }

  // Ammo
  if (elements.ammoDisplay) {
    const ammo = getAmmoState();
    if (ammo.melee) {
      elements.ammoDisplay.innerHTML = `<span class="ammo-weapon">${ammo.weaponName}</span>`;
    } else if (ammo.reloading) {
      const pct = Math.round(Math.min(99, Math.max(0, (1 - ammo.reloadTimer / ammo.reloadTime) * 100)));
      elements.ammoDisplay.innerHTML = `<span class="ammo-reload">RECARREGAR ${pct}%</span>`;
    } else {
      const low = ammo.current <= (ammo.weapon === 'shotgun' ? 0 : 2);
      elements.ammoDisplay.innerHTML =
        `<span class="ammo-weapon">${ammo.weaponName}</span> ` +
        `<span class="${low ? 'ammo-low' : 'ammo-cur'}">${ammo.current}</span>` +
        `<span class="ammo-sep"> / </span>` +
        `<span class="ammo-res">${ammo.reserve}</span>`;
    }
  }

  // Weapon slots
  if (elements.weaponSlots) {
    const owned = getOwnedWeapons();
    const curr = getCurrentWeapon();
    const slotDefs = [
      { key: 'pistol', num: '1', label: 'PISTOL' },
      { key: 'shotgun', num: '2', label: 'SHOTGUN' },
      { key: 'smg', num: '3', label: 'SMG' },
      { key: 'aliengun', num: '4', label: 'ALIEN' },
      { key: 'raygun', num: '5', label: 'RAYGUN' },
      { key: 'katana', num: '6', label: 'KATANA' },
      { key: 'grapplegun', num: '0', label: 'GANCHO' },
    ];
    const items = [];
    for (const s of slotDefs) {
      if (owned[s.key]) {
        items.push(`<span class="weapon-slot ${curr === s.key ? 'weapon-active' : 'weapon-inactive'}">${s.num} ${s.label}</span>`);
      }
    }
    elements.weaponSlots.innerHTML = items.join('');
  }

  // Perks List
  if (elements.perksList) {
    const active = [];
    if (gameState.perks.juggernog)   active.push('<div class="perk-icon" style="background:#aa2211; border: 2px solid white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white; text-shadow: 1px 1px 2px black;">❤️</div>');
    if (gameState.perks.speedCola)   active.push('<div class="perk-icon" style="background:#228833; border: 2px solid white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white; text-shadow: 1px 1px 2px black;">⚡</div>');
    if (gameState.perks.quickRevive) active.push('<div class="perk-icon" style="background:#2244aa; border: 2px solid white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white; text-shadow: 1px 1px 2px black;">➕</div>');
    elements.perksList.innerHTML = active.join('');
  }

  // Buy prompts
  if (elements.buyPrompt) {
    const stationMessage = getStationMessage();
    const boxMessage = getBoxMessage();
    const switchLabel = getNearestSwitchLabel();
    const perkLabel = getNearestPerkLabel();

    if (stationMessage) {
      elements.buyPrompt.style.display = 'block';
      elements.buyPrompt.style.color = '#44ff88';
      elements.buyPrompt.textContent = stationMessage;
    } else if (boxMessage) {
      elements.buyPrompt.style.display = 'block';
      elements.buyPrompt.style.color = '#ffdd00';
      elements.buyPrompt.textContent = boxMessage;
    } else if (switchLabel) {
      elements.buyPrompt.style.display = 'block';
      elements.buyPrompt.style.color = '#00ffaa';
      elements.buyPrompt.textContent = `[E] ${switchLabel}`;
    } else if (perkLabel) {
      elements.buyPrompt.style.display = 'block';
      elements.buyPrompt.style.color = perkLabel.includes('COMPRAR') ? '#ffffff' : '#ff4444';
      elements.buyPrompt.textContent = `[E] ${perkLabel}`;
    } else if (isNearStation()) {
      const ammo = getAmmoState();
      if (ammo.melee) {
        elements.buyPrompt.style.display = 'block';
        elements.buyPrompt.style.color = '#888888';
        elements.buyPrompt.textContent = 'Munição — Não aplicável a esta arma';
      } else {
        const cost = getStationCost();
        const canAfford = gameState.points >= cost;
        elements.buyPrompt.style.display = 'block';
        elements.buyPrompt.style.color = canAfford ? '#44ff88' : '#ff4444';
        elements.buyPrompt.textContent = canAfford
          ? `[E] Comprar munição — ${cost} pts`
          : `Munição — ${cost} pts (pontos insuficientes)`;
      }
    } else if (isNearMysteryBox()) {
      // Mystery box prompt
      const cost = getBoxCost();
      const owned = getOwnedWeapons();
      const allOwned = owned.shotgun && owned.smg && owned.aliengun && owned.raygun && owned.katana;
      if (allOwned) {
        elements.buyPrompt.style.display = 'block';
        elements.buyPrompt.style.color = '#888888';
        elements.buyPrompt.textContent = 'Mystery Box — Esgotada';
      } else {
        const canAfford = gameState.points >= cost;
        elements.buyPrompt.style.display = 'block';
        elements.buyPrompt.style.color = canAfford ? '#ffdd00' : '#ff4444';
        elements.buyPrompt.textContent = canAfford
          ? `[E] Mystery Box — ${cost} pts (arma aleatória)`
          : `Mystery Box — ${cost} pts (pontos insuficientes)`;
      }
    } else {
      elements.buyPrompt.style.display = 'none';
    }
  }

  // Active power-ups
  if (elements.powerupList) {
    const labels = getActivePowerupLabels();
    elements.powerupList.innerHTML = labels.map(l => `<div class="powerup-active">${l}</div>`).join('');
  }
}

export function showHitMarker(killed, isHead) {
  if (!elements.hitMarker) return;
  hitMarkerTimer = HIT_MARKER_DURATION;
  if (isHead) {
    elements.hitMarker.style.color = '#ff4444';
    elements.hitMarker.style.fontSize = '2.4rem';
  } else {
    elements.hitMarker.style.color = killed ? '#ffd700' : '#ffffff';
    elements.hitMarker.style.fontSize = '2rem';
  }
  elements.hitMarker.style.opacity = '1';

  // Expand crosshair on shot
  crosshairSpread = Math.min(CROSSHAIR_MAX_SPREAD, crosshairSpread + 8);

  // Haptics: stronger pulse for kill, head > body for confirmation feel.
  if (killed)      haptic(40);
  else if (isHead) haptic(20);
  else             haptic(10);
}

export function showMenu(lastScore) {
  if (elements.menu) elements.menu.style.display = 'flex';
  if (elements.hud) elements.hud.style.display = 'none';
  if (elements.gameOver) elements.gameOver.style.display = 'none';
  document.body.classList.remove('game-active');
  if (elements.crosshair) elements.crosshair.style.display = 'none';
  if (elements.weaponSlots) elements.weaponSlots.style.display = 'none';
  if (elements.vignette) elements.vignette.style.opacity = '0';
  if (lastScore !== undefined && elements.lastScore) {
    elements.lastScore.textContent = Number(lastScore).toLocaleString();
  }
  loadLeaderboard('menu-leaderboard-list', 'menu-leaderboard-loading');
  document.exitPointerLock();
}

export function hideMenu() {
  if (elements.menu) elements.menu.style.display = 'none';
  if (elements.hud) elements.hud.style.display = 'block';
  if (elements.gameOver) elements.gameOver.style.display = 'none';
  document.body.classList.add('game-active');
  if (elements.crosshair) {
    elements.crosshair.style.display = 'block';
    elements.crosshair.style.width = CROSSHAIR_BASE_SIZE + 'px';
    elements.crosshair.style.height = CROSSHAIR_BASE_SIZE + 'px';
  }
  crosshairSpread = 0;
  if (elements.ammoDisplay) elements.ammoDisplay.style.display = '';
  if (elements.weaponSlots) elements.weaponSlots.style.display = 'flex';
  roundBannerShown = -1;
}

export function showGameOver(won) {
  if (elements.menu) elements.menu.style.display = 'none';
  if (elements.hud) elements.hud.style.display = 'none';
  if (elements.gameOver) elements.gameOver.style.display = 'flex';
  document.body.classList.remove('game-active');
  if (elements.crosshair) elements.crosshair.style.display = 'none';
  if (elements.weaponSlots) elements.weaponSlots.style.display = 'none';
  if (elements.vignette) elements.vignette.style.opacity = '0';
  if (elements.gameOverTitle) {
    elements.gameOverTitle.textContent = 'GAME OVER';
    elements.gameOverTitle.style.color = '#ff4444';
  }
  // Show stats
  const finalKillsEl = document.getElementById('final-kills');
  const finalScoreEl = document.getElementById('final-score-display');
  const finalRoundEl = document.getElementById('final-round');
  const totalScore = gameState.getTotalScore();
  if (finalKillsEl) finalKillsEl.textContent = gameState.kills;
  if (finalScoreEl) finalScoreEl.textContent = totalScore.toLocaleString();
  if (finalRoundEl) finalRoundEl.textContent = gameState.round;

  // Show submit form
  const submitDiv = document.getElementById('submit-score');
  if (submitDiv) submitDiv.style.display = 'block';
  const statusEl = document.getElementById('submit-status');
  if (statusEl) statusEl.textContent = '';

  // Wire submit button
  const submitBtn = document.getElementById('submit-score-btn');
  const nameInput = document.getElementById('player-name');
  if (submitBtn && nameInput) {
    const handler = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        if (statusEl) statusEl.textContent = 'Escreve o teu nome!';
        return;
      }
      if (statusEl) statusEl.textContent = 'A submeter...';
      const result = await submitScore(name, totalScore, gameState.round, gameState.kills);
      if (statusEl) {
        if (result.success && result.kept === false) {
          statusEl.textContent = 'Já tens um score maior!';
        } else {
          statusEl.textContent = result.success ? 'Score submetido!' : 'Erro ao submeter';
        }
      }
      if (submitDiv) submitDiv.style.display = 'none';
    };
    submitBtn.onclick = handler;
    nameInput.onkeydown = (e) => { if (e.key === 'Enter') handler(); };
  }

  loadLeaderboard('leaderboard-list', 'leaderboard-loading');
  document.exitPointerLock();
}

// ═══════════════════════════════════════════════════════
// Leaderboard
// ═══════════════════════════════════════════════════════
async function loadLeaderboard(listId, loadingId) {
  const list = document.getElementById(listId);
  const loading = document.getElementById(loadingId);
  if (!list) return;

  list.innerHTML = '';
  if (loading) loading.style.display = 'block';

  try {
    const scores = await getLeaderboard();
    if (loading) loading.style.display = 'none';

    if (!scores || scores.length === 0) {
      list.innerHTML = '<li class="lb-empty">Sem scores ainda. Sê o primeiro!</li>';
      return;
    }

    list.innerHTML = scores.map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `<li class="lb-entry">
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${escapeHtml(s.name)}</span>
        <span class="lb-score">${Number(s.score).toLocaleString()} pts</span>
        <span class="lb-round">R${s.round}</span>
      </li>`;
    }).join('');
  } catch (err) {
    if (loading) loading.style.display = 'none';
    list.innerHTML = '<li class="lb-empty">Leaderboard indisponível</li>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function showBlood() {
  bloodTimer = BLOOD_DURATION;
  if (elements.blood) elements.blood.style.opacity = '1';
  haptic([30, 20, 30]);
}

export function updateBlood(delta) {
  if (bloodTimer > 0) {
    bloodTimer -= delta;
    if (bloodTimer <= 0 && elements.blood) { elements.blood.style.opacity = '0'; bloodTimer = 0; }
  }
  if (hitMarkerTimer > 0) {
    hitMarkerTimer -= delta;
    if (hitMarkerTimer <= 0 && elements.hitMarker) {
      elements.hitMarker.style.opacity = '0';
      hitMarkerTimer = 0;
    }
  }
}
