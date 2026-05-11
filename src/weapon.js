import * as THREE from 'three';
import { getCamera, getScene } from './scene.js';
import { checkShot, damageZombie } from './zombie.js';
import { playShot, playReloadSound } from './audio.js';
import { gameState } from './game-state.js';
import { showHitMarker } from './hud.js';

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
};

// ═══════════════════════════════════════════════════════════════
// WEAPON STATS
// ═══════════════════════════════════════════════════════════════
const WEAPON_DEFS = {
  pistol: {
    name: 'PISTOL',
    magSize: 8,
    maxReserve: 56,
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
    magSize: 2,
    maxReserve: 20,
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
    magSize: 30,
    maxReserve: 120,
    cooldown: 0.12,
    reloadTime: 2.0,
    damage: 35,
    headDamage: 70,
    pellets: 1,
    spread: 0.04,
    spritesheet: SPRITESHEET_CONFIG.smg,
    unlockRound: 5,
    unlockCost: 2000,
  },
  aliengun: {
    name: 'ALIEN GUN',
    magSize: 10,
    maxReserve: 30,
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
    magSize: 6,
    maxReserve: 18,
    cooldown: 0.6,
    reloadTime: 2.5,
    damage: 200,
    headDamage: 400,
    pellets: 1,
    spread: 0.01,
    spritesheet: SPRITESHEET_CONFIG.raygun,
  },
};

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
const VIEWMODEL_REST = new THREE.Vector3(0.28, -0.28, -0.55);

let currentWeapon = 'pistol';
let ownedWeapons = { pistol: true, shotgun: false, smg: false, aliengun: false, raygun: false };

let ammoState = {
  pistol:   { current: 8,  reserve: 56 },
  shotgun:  { current: 2,  reserve: 20 },
  smg:      { current: 30, reserve: 120 },
  aliengun: { current: 10, reserve: 30 },
  raygun:   { current: 6,  reserve: 18 },
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
  };
}

export function getCurrentWeapon() { return currentWeapon; }
export function getOwnedWeapons() { return ownedWeapons; }

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
  reloadTimer = def.reloadTime;
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
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeyDown);

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
  ownedWeapons = { pistol: true, shotgun: false, smg: false, aliengun: false, raygun: false };
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

  // Weapon slots 1-4
  const slotMap = {
    'Digit1': 'pistol',
    'Digit2': 'shotgun',
    'Digit3': 'smg',
    'Digit4': 'aliengun',
    'Digit5': 'raygun',
  };
  const type = slotMap[e.code];
  if (type && ownedWeapons[type]) {
    switchWeapon(type);
  }
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

  const frameDuration = 1 / anim.fps;
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
function onClick() {
  if (gameState.state !== 'playing') return;
  if (!document.pointerLockElement) return;
  if (isReloading) return;

  const def = WEAPON_DEFS[currentWeapon];
  const ammo = ammoState[currentWeapon];

  if (ammo.current <= 0) {
    startReload();
    return;
  }

  const now = performance.now() / 1000;
  if (now - lastShotTime < def.cooldown) return;
  lastShotTime = now;
  shoot();
}

function shoot() {
  const def = WEAPON_DEFS[currentWeapon];
  const ammo = ammoState[currentWeapon];
  ammo.current--;

  const camera = getCamera();
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

  playShot(currentWeapon);

  // Muzzle flash
  muzzleFlash.material.opacity = 1;
  muzzleTimer = currentWeapon === 'shotgun' ? 0.10 : 0.06;

  // Recoil
  recoilTimer = currentWeapon === 'shotgun' ? 0.18 : 0.12;

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
    raycaster.set(camera.position, spreadVec);

    const hit = checkShot(raycaster);
    if (hit) {
      anyHit = true;
      if (hit.isHead) anyHead = true;
      gameState.addPoints(10);
      const damage = hit.isHead ? def.headDamage : def.damage;
      const killed = damageZombie(hit.zombie, damage);
      if (killed) {
        anyKill = true;
        gameState.addPoints(hit.isHead ? 130 : 60);
      }
    }
  }

  if (anyHit) showHitMarker(anyKill, anyHead);

  if (ammo.current === 0 && ammo.reserve > 0) startReload();
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
