import * as THREE from 'three';
import { getScene } from './scene.js';
import { getPlayerPosition } from './player.js';
import { gameState } from './game-state.js';
import { canBuyWeapon, buyWeapon } from './weapon.js';
import { createCelMaterial, applyOutlineToMesh } from './celshade.js';

const STATION_POS = new THREE.Vector3(-18, 0, -24);
const INTERACT_RADIUS = 3.5;

// Weapons available at this station (in order of availability)
const WEAPONS_FOR_SALE = ['shotgun', 'smg', 'aliengun'];

let stationMesh = null;
let nearStation = false;
let pulseTime = 0;
let stationLight = null;
let currentWeaponForSale = null;  // which weapon is currently buyable

export function initShotgunStation() {
  const scene = getScene();

  const group = new THREE.Group();
  group.position.copy(STATION_POS);
  group.position.y = 1.5;

  // Back panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.0, 0.15),
    createCelMaterial(0x443322)
  );
  applyOutlineToMesh(panel);
  group.add(panel);

  // Generic weapon silhouette
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8),
    createCelMaterial(0x3a3a3a)
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.25, 0.05, 0.12);
  group.add(barrel);

  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.12, 0.4),
    createCelMaterial(0x6a5040)
  );
  stock.position.set(-0.3, 0.05, 0.12);
  group.add(stock);

  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, 0.5),
    createCelMaterial(0x5a4a3a)
  );
  receiver.position.set(0, 0.05, 0.12);
  group.add(receiver);

  // Glowing border (color changes per weapon type)
  const borderGeo = new THREE.BoxGeometry(1.6, 1.2, 0.05);
  const borderMat = new THREE.MeshBasicMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.z = -0.1;
  border.userData.isBorder = true;
  group.add(border);

  scene.add(group);
  stationMesh = group;

  stationLight = new THREE.PointLight(0x44aaff, 0, 10);
  stationLight.position.copy(STATION_POS);
  stationLight.position.y = 2.5;
  scene.add(stationLight);

  document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
  if (e.code !== 'KeyE') return;
  if (gameState.state !== 'playing') return;
  if (!document.pointerLockElement) return;
  if (!nearStation) return;
  if (!currentWeaponForSale) return;

  buyWeapon(currentWeaponForSale);
}

const WEAPON_COLORS = {
  shotgun:  0x44aaff,  // blue
  smg:       0xff8844,  // orange
  aliengun:  0xaa44ff,  // purple
};

export function updateShotgunStation(delta) {
  if (!stationMesh || !stationLight) return;

  pulseTime += delta;

  // Determine which weapon is for sale
  currentWeaponForSale = null;
  for (const type of WEAPONS_FOR_SALE) {
    if (canBuyWeapon(type)) {
      currentWeaponForSale = type;
      break;
    }
  }

  const visible = currentWeaponForSale !== null;
  stationMesh.visible = visible;
  stationLight.visible = visible;

  if (!visible) return;

  // Update border color based on weapon type
  const borderColor = WEAPON_COLORS[currentWeaponForSale] || 0x44aaff;
  stationMesh.traverse(child => {
    if (child.userData.isBorder) {
      child.material.color.set(borderColor);
    }
  });
  stationLight.color.set(borderColor);

  const playerPos = getPlayerPosition();
  const dx = playerPos.x - STATION_POS.x;
  const dz = playerPos.z - STATION_POS.z;
  nearStation = Math.sqrt(dx * dx + dz * dz) < INTERACT_RADIUS;

  if (nearStation) {
    stationLight.intensity = 0.8 + 0.4 * Math.sin(pulseTime * 4);
  } else {
    stationLight.intensity = 0.3 + 0.2 * Math.sin(pulseTime * 1.5);
  }
}

export function isNearShotgunStation() { return nearStation; }
export function getShotgunStationPos() { return STATION_POS; }
export function getCurrentWeaponForSale() { return currentWeaponForSale; }
