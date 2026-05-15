import * as THREE from 'three';
import { getCamera, getScene } from './scene.js';
import { checkShot, checkShotAll, damageZombie, getZombies, applySplashDamage } from './zombie.js';
import { playShot, playReloadSound } from './audio.js';
import { gameState } from './game-state.js';
import { showHitMarker } from './hud.js';
import { fireGrappleHook, isGrappleActive } from './player.js';

// ═══════════════════════════════════════════════════════════════
// SPRITESHEET CONFIG — grelha 3 linhas × 2 colunas (6 frames)
// │ 0(idle) │ 1(fire1) │
// │ 2(fire2)│ 3(reload1)│
// │ 4(reload2)│ 5(reload3)│
// ═══════════════════════════════════════════════════════════════
const SPRITESHEET_CONFIG = {
  pistol: {
    path: 'assets/armas/pistola.png',
    gridCols: 2, gridRows: 3,
    animFrames: {
      idle:   { start: 0, end: 0, fps: 1 },
      fire:   { start: 1, end: 2, fps: 12 },
      reload: { start: 3, end: 5, fps: 8 },
    },
    muzzleOffset: { x: 0, y: 0.10, z: -0.18 },
    planeSize: { w: 0.55, h: 0.55 },
  },
  shotgun: {
    path: 'assets/armas/shootgun.png',
    gridCols: 2, gridRows: 3,
    animFrames: {
      idle:   { start: 0, end: 0, fps: 1 },
      fire:   { start: 1, end: 2, fps: 8 },
      reload: { start: 3, end: 5, fps: 6 },
    },
    muzzleOffset: { x: 0, y: 0.08, z: -0.22 },
    planeSize: { w: 0.55, h: 0.55 },
  },
  smg: {
    path: 'assets/armas/smg.png',
    gridCols: 2, gridRows: 3,
    animFrames: {
      idle:   { start: 0, end: 0, fps: 1 },
      fire:   { start: 1, end: 2, fps: 14 },
      reload: { start: 3, end: 5, fps: 8 },
    },
    muzzleOffset: { x: 0, y: 0.08, z: -0.16 },
    planeSize: { w: 0.55, h: 0.55 },
  },
  aliengun: {
    path: 'assets/armas/aliengun.png',
    gridCols: 2, gridRows: 3,
    animFrames: {
      idle:   { start: 0, end: 0, fps: 1 },
      fire:   { start: 1, end: 2, fps: 8 },
      reload: { start: 3, end: 5, fps: 6 },
    },
    muzzleOffset: { x: 0, y: 0.12, z: -0.20 },
    planeSize: { w: 0.55, h: 0.55 },
  },
  raygun: {
    path: 'assets/armas/raygun.png',
    gridCols: 2, gridRows: 3,
    animFrames: {
      idle:   { start: 0, end: 0, fps: 1 },
      fire:   { start: 1, end: 2, fps: 6 },
      reload: { start: 3, end: 5, fps: 5 },
    },
    muzzleOffset: { x: 0, y: 0.14, z: -0.22 },
    planeSize: { w: 0.55, h: 0.55 },
  },
  katana: {
    path: 'assets/armas/katana.png',
    gridCols: 2, gridRows: 3,
    animFrames: {
      idle:   { start: 0, end: 0, fps: 1 },
      fire:   { start: 1, end: 2, fps: 14 },
      reload: { start: 3, end: 5, fps: 8 },
    },
    muzzleOffset: { x: 0, y: 0, z: 0 },
    planeSize: { w: 0.72, h: 0.72 },
  },
  grapplegun: {
    path: 'assets/armas/grapplegun.png',
    gridCols: 2, gridRows: 3,
    animFrames: {
      idle:   { start: 0, end: 0, fps: 1 },
      fire:   { start: 1, end: 2, fps: 12 },
      reload: { start: 3, end: 5, fps: 8 },
    },
    muzzleOffset: { x: 0, y: 0.1, z: -0.2 },
    planeSize: { w: 0.55, h: 0.55 },
  },
};

// ═══════════════════════════════════════════════════════════════
// WEAPON STATS
// ═══════════════════════════════════════════════════════════════
const WEAPON_DEFS = {
  pistol: {
    name: 'PISTOL',
    magSize: 10, // 8 -> 10
    maxReserve: 70, // 56 -> 70
    cooldown: 0.4,
    reloadTime: 1.8,
    damage: 75,
    headDamage: 150,
    pellets: 1,
    spread: 0,
    spritesheet: SPRITESHEET_CONFIG.pistol,
  },
  shotgun: {
    name: 'SHOTGUN',
    magSize: 5, // 4 -> 5
    maxReserve: 25, // 20 -> 25
    cooldown: 0.8,
    reloadTime: 2.2,
    damage: 50,
    headDamage: 100,
    pellets: 6,
    spread: 0.07,
    spritesheet: SPRITESHEET_CONFIG.shotgun,
    unlockRound: 3,
    unlockCost: 1500,
  },
  smg: {
    name: 'SMG',
    magSize: 38, // 30 -> 38
    maxReserve: 150, // 120 -> 150
    cooldown: 0.12,
    reloadTime: 2.0,
    damage: 35,
    headDamage: 70,
    pellets: 1,
    spread: 0.04,
    automatic: true,
    penetration: true, // New property
    spritesheet: SPRITESHEET_CONFIG.smg,
    unlockRound: 5,
    unlockCost: 2000,
  },
  aliengun: {
    name: 'ALIEN GUN',
    magSize: 12, // 10 -> 12
    maxReserve: 38, // 30 -> 38
    cooldown: 0.5,
    reloadTime: 2.5,
    damage: 120,
    headDamage: 240,
    pellets: 1,
    spread: 0.02,
    spritesheet: SPRITESHEET_CONFIG.aliengun,
  },
  raygun: {
    name: 'RAYGUN',
    magSize: 8, // 6 -> 8
    maxReserve: 22, // 18 -> 22
    cooldown: 0.6,
    reloadTime: 2.5,
    damage: 220, // Impact 220
    headDamage: 220,
    pellets: 1,
    spread: 0.01,
    splash: 300, // New property
    spritesheet: SPRITESHEET_CONFIG.raygun,
  },
  katana: {
    name: 'KATANA',
    magSize: 1,
    maxReserve: 0,
    cooldown: 0.55,
    reloadTime: 0,
    damage: 260,
    headDamage: 420,
    pellets: 1,
    spread: 0,
    range: 3.4,
    melee: true,
    spritesheet: SPRITESHEET_CONFIG.katana,
  },
  grapplegun: {
    name: 'PISTOLA GANCHO',
    magSize: 3,
    maxReserve: 0,
    cooldown: 1.0,
    reloadTime: 0,
    damage: 0,
    headDamage: 0,
    pellets: 0,
    spread: 0,
    range: 80,
    special: 'grapple',
    spritesheet: SPRITESHEET_CONFIG.grapplegun,
  },
};

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
const VIEWMODEL_REST = new THREE.Vector3(0.28, -0.28, -0.55);

// Aim assist (touch input only). Snaps fire direction toward nearest zombie
// inside a small cone around forward. Disabled by default for desktop.
let aimAssistEnabled = false;
const AIM_ASSIST_CONE = Math.cos(THREE.MathUtils.degToRad(7));  // ~7° half-angle
const AIM_ASSIST_RANGE = 35;
const AIM_ASSIST_BLEND = 0.55;  // 0 = no help, 1 = full snap

export function setAimAssist(enabled) { aimAssistEnabled = !!enabled; }

let currentWeapon = 'pistol';
let ownedWeapons = { pistol: true, shotgun: false, smg: false, aliengun: false, raygun: false, katana: true, grapplegun: false };

let ammoState = {
  pistol:   { current: 8,  reserve: 56 },
  shotgun:  { current: 4,  reserve: 20 },
  smg:      { current: 30, reserve: 120 },
  aliengun: { current: 10, reserve: 30 },
  raygun:   { current: 6,  reserve: 18 },
  katana:   { current: 1,  reserve: 0 },
  grapplegun: { current: 3, reserve: 0 },
};

let lastShotTime = 0;
let muzzleFlash = null;       // bright plane at barrel
let muzzleTimer = 0;
let viewmodels = {};          // weaponType → THREE.Mesh (plane)
let recoilTimer = 0;
let isReloading = false;
let reloadTimer = 0;

// Animation state
let animState = 'idle';       // 'idle' | 'fire' | 'reload'
let animFrame = 0;            // current frame index
let animTimer = 0;            // accumulator for frame timing
let animLoopDone = false;     // true when fire/reload anim completed
let isMouseDown = false;
let gamepadInput = null;

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════
export function getAmmoState() {
  const def = WEAPON_DEFS[currentWeapon];
  const ammo = ammoState[currentWeapon];
  return {
    current: ammo.current,
    reserve: ammo.reserve,
    reloading: isReloading,
    reloadTimer,
    reloadTime: def.reloadTime,
    weapon: currentWeapon,
    weaponName: def.name,
    melee: !!def.melee,
  };
}

export function getCurrentWeapon() { return currentWeapon; }
export function getOwnedWeapons() { return { ...ownedWeapons }; }
export function getWeaponDefs() { return WEAPON_DEFS; }

export function setGamepadInput(gi) {
  gamepadInput = gi;
}

export function canBuyWeapon(type) {
  const def = WEAPON_DEFS[type];
  if (!def || !def.unlockRound) return false;
  return !ownedWeapons[type] && gameState.round >= def.unlockRound && gameState.points >= def.unlockCost;
}

export function buyWeapon(type) {
  if (!canBuyWeapon(type)) return false;
  const def = WEAPON_DEFS[type];
  gameState.points -= def.unlockCost;
  unlockWeapon(type);
  return true;
}

function unlockWeapon(type) {
  ownedWeapons[type] = true;
  ammoState[type].current = WEAPON_DEFS[type].magSize;
  ammoState[type].reserve = WEAPON_DEFS[type].maxReserve;
  switchWeapon(type);
}

// Export for mystery box (bypasses round/cost checks)
export function unlockWeaponForBox(type) {
  if (ownedWeapons[type]) return;
  unlockWeapon(type);
}

function switchWeapon(type) {
  if (type === currentWeapon) return;
  if (!ownedWeapons[type]) return;
  if (isReloading) return;
  currentWeapon = type;
  isReloading = false;
  reloadTimer = 0;
  animState = 'idle';
  animFrame = 0;
  animTimer = 0;
  isMouseDown = false;
  updateViewmodelVisibility();
}

function updateViewmodelVisibility() {
  for (const [type, vm] of Object.entries(viewmodels)) {
    vm.visible = type === currentWeapon;
  }
}

function startReload() {
  if (isReloading) return;
  const ammo = ammoState[currentWeapon];
  const def = WEAPON_DEFS[currentWeapon];
  if (ammo.reserve <= 0) return;
  if (ammo.current >= def.magSize) return;
  isReloading = true;
  const reloadSpeedMult = gameState.perks.speedCola ? 0.5 : 1.0;
  reloadTimer = Math.max(0.2, def.reloadTime * reloadSpeedMult);
  // Start reload animation (only if weapon has reload frames)
  playReloadSound(currentWeapon === 'shotgun');
  const cfg = def.spritesheet;
  const rf = cfg.animFrames.reload;
  if (rf) {
    animState = 'reload';
    animFrame = rf.start;
    animTimer = 0;
    animLoopDone = false;
  }
}

// ── Weapon lowering (for ammo buy, mystery box, etc.) ──
let lowerWeaponTimer = 0;
const LOWER_WEAPON_DURATION = 0.7;

export function lowerWeaponBriefly() {
  lowerWeaponTimer = LOWER_WEAPON_DURATION;
}

export function refillAmmoSilent() {
  const def = WEAPON_DEFS[currentWeapon];
  if (def.melee) return;
  const ammo = ammoState[currentWeapon];
  ammo.reserve = def.maxReserve;
  if (ammo.current < def.magSize) {
    // Fill mag silently without reload animation
    const needed = def.magSize - ammo.current;
    const take = Math.min(needed, ammo.reserve);
    ammo.current += take;
    ammo.reserve -= take;
  }
}

// ═══════════════════════════════════════════════════════════════
// SPRITESHEET VIEWMODEL
// ═══════════════════════════════════════════════════════════════
function buildSpritesheetViewmodel(cfg, weaponType) {
  const texture = new THREE.TextureLoader().load(cfg.path);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  // Set repeat for the grid
  texture.repeat.set(1 / cfg.gridCols, 1 / cfg.gridRows);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const { w, h } = cfg.planeSize;
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.userData.weaponType = weaponType;
  plane.userData.spritesheetCfg = cfg;

  // Set initial frame (idle)
  const idleFrames = cfg.animFrames.idle;
  setSpritesheetFrame(texture, cfg.gridCols, cfg.gridRows, idleFrames.start);

  return plane;
}

function setSpritesheetFrame(texture, cols, rows, frameIndex) {
  const col = frameIndex % cols;
  const row = Math.floor(frameIndex / cols);
  texture.offset.set(col / cols, 1 - (row + 1) / rows);
}

// ═══════════════════════════════════════════════════════════════
// MUZZLE FLASH
// ═══════════════════════════════════════════════════════════════
function createMuzzleFlash() {
  const geo = new THREE.PlaneGeometry(0.12, 0.12);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffcc44,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flash = new THREE.Mesh(geo, mat);
  flash.renderOrder = 999;
  return flash;
}

// ═══════════════════════════════════════════════════════════════
// INIT / RESET
// ═══════════════════════════════════════════════════════════════
export function initWeapon() {
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) isMouseDown = false; });
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('wheel', onWheel, { passive: false });

  const camera = getCamera();

  // Build spritesheet viewmodels for all weapons
  for (const [type, def] of Object.entries(WEAPON_DEFS)) {
    const vm = buildSpritesheetViewmodel(def.spritesheet, type);
    vm.position.copy(VIEWMODEL_REST);
    vm.visible = type === currentWeapon;
    camera.add(vm);
    viewmodels[type] = vm;
  }

  // Muzzle flash (attached to camera so it's always visible)
  muzzleFlash = createMuzzleFlash();
  muzzleFlash.position.copy(VIEWMODEL_REST);
  camera.add(muzzleFlash);

  // Init ammo
  for (const [type, def] of Object.entries(WEAPON_DEFS)) {
    ammoState[type].current = def.magSize;
    ammoState[type].reserve = def.maxReserve;
  }
  isReloading = false;
}

export function resetWeapon() {
  currentWeapon = 'pistol';
  ownedWeapons = { pistol: true, shotgun: false, smg: false, aliengun: false, raygun: false, katana: true, grapplegun: false };
  for (const [type, def] of Object.entries(WEAPON_DEFS)) {
    ammoState[type].current = def.magSize;
    ammoState[type].reserve = def.maxReserve;
  }
  isReloading = false;
  reloadTimer = 0;
  animState = 'idle';
  animFrame = 0;
  animTimer = 0;
  updateViewmodelVisibility();
}

// ═══════════════════════════════════════════════════════════════
// KEY HANDLING
// ═══════════════════════════════════════════════════════════════
function onKeyDown(e) {
  if (gameState.state !== 'playing' || !document.pointerLockElement) return;

  if (e.code === 'KeyR') {
    startReload();
    return;
  }

  // Weapon slots 1-6 + 0 for Grapple Gun
  const slotMap = {
    'Digit1': 'pistol',
    'Digit2': 'shotgun',
    'Digit3': 'smg',
    'Digit4': 'aliengun',
    'Digit5': 'raygun',
    'Digit6': 'katana',
    'Digit0': 'grapplegun',
  };
  const type = slotMap[e.code];
  if (type && ownedWeapons[type]) {
    switchWeapon(type);
  }
}

function onWheel(e) {
  if (gameState.state !== 'playing' || !document.pointerLockElement) return;

  const order = ['pistol', 'shotgun', 'smg', 'aliengun', 'raygun', 'katana', 'grapplegun'];
  const owned = order.filter(w => ownedWeapons[w]);
  if (owned.length <= 1) return;

  let currentIndex = owned.indexOf(currentWeapon);
  if (currentIndex === -1) currentIndex = 0;

  if (e.deltaY > 0) {
    // Scroll down -> Next weapon
    currentIndex = (currentIndex + 1) % owned.length;
  } else if (e.deltaY < 0) {
    // Scroll up -> Previous weapon
    currentIndex = (currentIndex - 1 + owned.length) % owned.length;
  }

  switchWeapon(owned[currentIndex]);
}

// ═══════════════════════════════════════════════════════════════

// UPDATE (animation + timers)
// ═══════════════════════════════════════════════════════════════
export function updateWeapon(delta) {
  const def = WEAPON_DEFS[currentWeapon];
  const cfg = def.spritesheet;
  const texture = viewmodels[currentWeapon]?.material.map;

  // ── Reload timer ──
  if (isReloading) {
    reloadTimer -= delta;
    if (reloadTimer <= 0) {
      const ammo = ammoState[currentWeapon];
      const needed = def.magSize - ammo.current;
      const take = Math.min(needed, ammo.reserve);
      ammo.current += take;
      ammo.reserve -= take;
      isReloading = false;
      animState = 'idle';
      animFrame = cfg.animFrames.idle.start;
      animTimer = 0;
      if (texture) setSpritesheetFrame(texture, cfg.gridCols, cfg.gridRows, animFrame);
    }
  }

  // ── Muzzle flash timer ──
  if (muzzleTimer > 0) {
    muzzleTimer -= delta;
    if (muzzleTimer <= 0) {
      muzzleFlash.material.opacity = 0;
    }
  }

  // ── Animation state machine ──
  updateAnimation(delta, cfg, texture);

  // ── Weapon lowering timer ──
  if (lowerWeaponTimer > 0) {
    lowerWeaponTimer -= delta;
  }

  // ── Viewmodel bob + recoil + lowering ──
  const vm = viewmodels[currentWeapon];
  if (vm) {
    // Calculate lowering offset
    let lowerOffset = 0;
    if (lowerWeaponTimer > 0) {
      const t = 1 - (lowerWeaponTimer / LOWER_WEAPON_DURATION);
      // Ease out: goes down and back up
      const ease = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
      lowerOffset = -ease * 0.5; // lowers 0.5 units then returns
    }
    const loweredRest = new THREE.Vector3(VIEWMODEL_REST.x, VIEWMODEL_REST.y + lowerOffset, VIEWMODEL_REST.z);

    if (recoilTimer > 0) {
      recoilTimer -= delta;
      const recoilDur = currentWeapon === 'shotgun' ? 0.18 : 0.12;
      const t = Math.max(0, recoilTimer / recoilDur);
      const kick = Math.sin(t * Math.PI) * (currentWeapon === 'shotgun' ? 0.12 : 0.06);
      vm.position.set(loweredRest.x, loweredRest.y, loweredRest.z + kick);
      vm.rotation.x = -kick * 0.6;
      // Move muzzle flash with weapon
      muzzleFlash.position.set(
        loweredRest.x + cfg.muzzleOffset.x,
        loweredRest.y + cfg.muzzleOffset.y,
        loweredRest.z + kick + cfg.muzzleOffset.z
      );
    } else {
      const t = performance.now() / 1000;
      vm.position.set(
        loweredRest.x + Math.sin(t * 1.6) * 0.004,
        loweredRest.y + Math.cos(t * 2.0) * 0.003,
        loweredRest.z
      );
      vm.rotation.x = 0;
      muzzleFlash.position.set(
        loweredRest.x + cfg.muzzleOffset.x,
        loweredRest.y + cfg.muzzleOffset.y,
        loweredRest.z + cfg.muzzleOffset.z
      );
    }
  }

  // ── Automatic fire ──
  const isGamepadFiring = gamepadInput && gamepadInput.gamepadIndex !== -1 && gamepadInput.isFiring();
  if ((isMouseDown || isGamepadFiring) && def.automatic && !isReloading && gameState.state === 'playing') {
    // Only require pointer lock for mouse on desktop. Gamepad bypasses it.
    if (isGamepadFiring || document.pointerLockElement) {
      fireOnce();
    }
  }

  // ── Gamepad actions ──
  if (gamepadInput && gamepadInput.gamepadIndex !== -1) {
    if (gamepadInput.consumeReload()) startReload();
    if (gamepadInput.consumeSwitch()) {
      const order = ['pistol', 'shotgun', 'smg', 'aliengun', 'raygun', 'katana', 'grapplegun'];
      const owned = order.filter(w => ownedWeapons[w]);
      let idx = owned.indexOf(currentWeapon);
      idx = (idx + 1) % owned.length;
      switchWeapon(owned[idx]);
    }
  }
}

function updateAnimation(delta, cfg, texture) {
  if (!cfg || !texture) return;

  let anim;
  if (animState === 'idle') {
    anim = cfg.animFrames.idle;
  } else if (animState === 'fire') {
    anim = cfg.animFrames.fire;
  } else if (animState === 'reload') {
    anim = cfg.animFrames.reload;
  } else {
    return;
  }

  if (!anim) return;

  const isReloadAnim = animState === 'reload';
  const fps = (isReloadAnim && gameState.perks.speedCola) ? anim.fps * 2 : anim.fps;
  const frameDuration = 1 / fps;
  animTimer += delta;

  // Determine target frame
  if (animState === 'idle') {
    // Idle: just hold first frame (or loop if multiple)
    animFrame = anim.start;
    animTimer = 0;
  } else {
    // Fire / Reload: play once then return to idle
    const totalFrames = anim.end - anim.start + 1;
    const newFrame = anim.start + Math.floor(animTimer / frameDuration);

    if (newFrame > anim.end) {
      // Animation finished
      if (animState === 'fire') {
        animState = 'idle';
        animFrame = cfg.animFrames.idle.start;
      }
      // Reload completion is handled by the reload timer
      animTimer = 0;
    } else {
      animFrame = newFrame;
    }
  }

  setSpritesheetFrame(texture, cfg.gridCols, cfg.gridRows, animFrame);
}

// ═══════════════════════════════════════════════════════════════
// SHOOTING
// ═══════════════════════════════════════════════════════════════
function onMouseDown(e) {
  if (e.button !== 0) return;
  const isPlaying = gameState.state === 'playing';
  const hasGamepad = gamepadInput && gamepadInput.gamepadIndex !== -1;
  if (!isPlaying || (!hasGamepad && !document.pointerLockElement)) return;
  isMouseDown = true;
  // If not automatic, fire once on press. If automatic, updateWeapon handles it.
  if (!WEAPON_DEFS[currentWeapon].automatic) {
    fireOnce();
  }
}

function onMouseUp(e) {
  if (e.button !== 0) return;
  isMouseDown = false;
}

// Mobile-friendly fire (no pointerLock check)
export function fireOnce() {
  if (gameState.state !== 'playing') return false;
  if (isReloading) return false;

  const def = WEAPON_DEFS[currentWeapon];
  const ammo = ammoState[currentWeapon];

  if (!def.melee && ammo.current <= 0) {
    startReload();
    return false;
  }

  const now = performance.now() / 1000;
  if (now - lastShotTime < def.cooldown) return false;
  lastShotTime = now;
  shoot();
  return true;
}

export function startReloadMobile() {
  if (gameState.state !== 'playing') return;
  startReload();
}

export function switchWeaponMobile(type) {
  switchWeapon(type);
}

function checkDiscard() {
  const ammo = ammoState[currentWeapon];
  if (ammo && ammo.current <= 0 && ammo.reserve <= 0 && currentWeapon === 'grapplegun') {
    ownedWeapons['grapplegun'] = false;
    switchWeaponMobile('pistol');
  }
}

function shoot() {
  const def = WEAPON_DEFS[currentWeapon];
  const ammo = ammoState[currentWeapon];
  if (!def.melee && def.special !== 'grapple') ammo.current--;

  if (def.special === 'grapple') {
    const success = fireGrappleHook();
    if (success) {
      ammo.current--;
      
      // Intelligent discard: wait for grapple to finish
      const waitAndDiscard = () => {
        if (isGrappleActive()) {
          setTimeout(waitAndDiscard, 100);
        } else {
          checkDiscard();
        }
      };
      setTimeout(waitAndDiscard, 500);
    } else {
      // If grapple failed (e.g., aimed at sky), don't play animation
      return;
    }
  }

  const camera = getCamera();
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  if (aimAssistEnabled && !def.melee) applyAimAssist(camera, forward);

  playShot(currentWeapon);

  // Muzzle flash
  muzzleFlash.material.opacity = (def.melee || def.special === 'grapple') ? 0 : 1;
  muzzleTimer = (def.melee || def.special === 'grapple') ? 0 : currentWeapon === 'shotgun' ? 0.10 : 0.06;

  // Recoil
  recoilTimer = def.melee ? 0.22 : currentWeapon === 'shotgun' ? 0.18 : 0.12;

  // Fire animation
  const cfg = def.spritesheet;
  const fireFrames = cfg.animFrames.fire;
  animState = 'fire';
  animFrame = fireFrames.start;
  animTimer = 0;

  // Shoot pellets
  let anyHit = false;
  let anyHead = false;
  let anyKill = false;

  for (let i = 0; i < def.pellets; i++) {
    const spreadVec = forward.clone();
    if (def.spread > 0) {
      spreadVec.x += (Math.random() - 0.5) * def.spread * 2;
      spreadVec.y += (Math.random() - 0.5) * def.spread * 2;
      spreadVec.z += (Math.random() - 0.5) * def.spread * 2;
    }
    spreadVec.normalize();
    raycaster.set(camera.position, spreadVec);
    raycaster.far = def.range || 150;

    const hits = checkShotAll(raycaster);
    if (hits.length > 0) {
      anyHit = true;
      
      // Penetration: SMG hits max 2 zombies (the first and the one behind)
      const targets = def.penetration ? hits.slice(0, 2) : [hits[0]];

      for (const hit of targets) {
        if (hit.isHead) anyHead = true;
        gameState.addPoints(10); // +10 per hit
        const damage = hit.isHead ? def.headDamage : def.damage;
        const killed = damageZombie(hit.zombie, damage);
        if (killed) {
          anyKill = true;
          const killPoints = (hit.isHead || def.melee) ? 80 : 30;
          gameState.addPoints(killPoints);
        }

        // Raygun Splash logic (only on first hit to avoid multiple explosions)
        if (def.splash && hit === targets[0]) {
          const splash = applySplashDamage(hit.point, 3.5, def.splash);
          if (splash.anyKill) anyKill = true;
          // Award points for splash kills (fixed 30 per splash kill)
          if (splash.killCount > 0) gameState.addPoints(splash.killCount * 30);
        }
      }
    }
  }

  if (anyHit) showHitMarker(anyKill, anyHead);

  if (!def.melee && ammo.current === 0 && ammo.reserve > 0) startReload();
}

// Bias `forward` toward the nearest zombie inside the assist cone.
// Aims at chest height to avoid headshot misses going over the head.
function applyAimAssist(camera, forward) {
  const zombies = getZombies();
  if (!zombies || zombies.length === 0) return;

  const camPos = camera.position;
  const toZ = new THREE.Vector3();
  let best = null;
  let bestDot = AIM_ASSIST_CONE;

  for (const z of zombies) {
    if (!z.alive) continue;
    toZ.copy(z.mesh.position);
    toZ.y += 1.4;  // chest, not feet
    toZ.sub(camPos);
    const dist = toZ.length();
    if (dist > AIM_ASSIST_RANGE || dist < 0.01) continue;
    toZ.multiplyScalar(1 / dist);
    const dot = forward.dot(toZ);
    if (dot > bestDot) {
      bestDot = dot;
      best = { dir: toZ.clone() };
    }
  }

  if (best) {
    forward.lerp(best.dir, AIM_ASSIST_BLEND).normalize();
  }
}

// ═══════════════════════════════════════════════════════════════
// WEAPON STATE (for crosshair spread)
// ═══════════════════════════════════════════════════════════════
export function getWeaponState() {
  const def = WEAPON_DEFS[currentWeapon];
  return {
    isShotgun: currentWeapon === 'shotgun',
    isReloading,
    lastShotTime,
    cooldown: def.cooldown,
    weapon: currentWeapon,
  };
}
