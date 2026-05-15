import * as THREE from 'three';
import { getScene } from './scene.js';
import { getPlayerPosition } from './player.js';
import { gameState } from './game-state.js';
import { getAmmoState, refillAmmoSilent, lowerWeaponBriefly } from './weapon.js';
import { createCelMaterial, applyOutlineToMesh } from './celshade.js';

const STATION_POS = new THREE.Vector3(8, 0, -12);
const INTERACT_RADIUS = 3.5;
const AMMO_COST = 500;

let stationMesh = null;
let nearStation = false;
let pulseTime = 0;
let stationLight = null;
let stationMessage = '';
let stationMessageTimer = 0;

export function initAmmoStation() {
  const scene = getScene();

  // Base box
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.6, 0.4),
    createCelMaterial(0x335533)
  );
  base.position.copy(STATION_POS);
  base.position.y = 0.8;
  applyOutlineToMesh(base);

  // Panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.6, 0.1),
    createCelMaterial(0x55aa55)
  );
  panel.position.set(0, 0.3, 0.26);
  applyOutlineToMesh(panel);
  base.add(panel);

  // Bullet icon (small cylinder)
  const bullet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8),
    createCelMaterial(0xffdd44)
  );
  bullet.position.set(0, 0.3, 0.33);
  base.add(bullet);

  scene.add(base);
  stationMesh = base;

  stationLight = new THREE.PointLight(0x44ff44, 0.6, 8);
  stationLight.position.copy(STATION_POS);
  stationLight.position.y = 2;
  scene.add(stationLight);

  document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
  if (e.code !== 'KeyE') return;
  if (gameState.state !== 'playing') return;
  if (!document.pointerLockElement) return;
  tryBuyAmmo();
}

// Mobile-friendly (no pointerLock/key check)
export function tryBuyAmmo() {
  if (gameState.state !== 'playing') return false;
  if (!nearStation) return false;
  
  const ammo = getAmmoState();
  if (ammo.melee) return false; // Don't buy ammo for melee weapons

  if (gameState.points < AMMO_COST) return false;

  gameState.points -= AMMO_COST;
  
  // Power Tripwire: Ammo purchase resets power
  gameState.resetPower();
  import('./energy.js').then(m => m.resetSwitches());

  refillAmmoSilent();
  lowerWeaponBriefly();
  stationMessage = 'MUNIÇÃO REPOSTA';
  stationMessageTimer = 1.5;
  return true;
}

export function updateAmmoStation(delta) {
  pulseTime += delta;
  stationMessageTimer = Math.max(0, stationMessageTimer - delta);

  if (stationLight) {
    stationLight.intensity = 0.5 + 0.3 * Math.sin(pulseTime * 3);
  }

  const playerPos = getPlayerPosition();
  const dx = playerPos.x - STATION_POS.x;
  const dz = playerPos.z - STATION_POS.z;
  nearStation = Math.sqrt(dx * dx + dz * dz) < INTERACT_RADIUS;
}

export function isNearStation() { return nearStation; }
export function getStationCost() { return AMMO_COST; }
export function getStationMessage() { return stationMessageTimer > 0 ? stationMessage : ''; }
