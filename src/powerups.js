import * as THREE from 'three';
import { getScene } from './scene.js';
import { getPlayerPosition } from './player.js';
import { gameState } from './game-state.js';
import { createCelMaterial } from './celshade.js';

const POWERUP_TYPES = ['instaKill', 'doublePoints', 'nuke'];
const POWERUP_COLORS = {
  instaKill:    0xffdd00,
  doublePoints: 0x00ddff,
  nuke:         0x44ff44,
};
const POWERUP_LABELS = {
  instaKill:    'INSTA-KILL',
  doublePoints: 'DOUBLE POINTS',
  nuke:         'NUKE',
};
const DROP_CHANCE = 0.04;
const PICKUP_RADIUS = 1.8;
const FLOAT_HEIGHT = 0.6;
const PICKUP_DURATION = 26;

const activePowerups = [];
let time = 0;

function buildPickupMesh(type) {
  const color = POWERUP_COLORS[type];
  const geo = new THREE.OctahedronGeometry(0.35, 0);
  const mat = createCelMaterial(color);
  const mesh = new THREE.Mesh(geo, mat);

  const glowGeo = new THREE.SphereGeometry(0.55, 10, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  mesh.add(new THREE.Mesh(glowGeo, glowMat));

  return mesh;
}

export function tryDropPowerup(position) {
  if (Math.random() > DROP_CHANCE) return;
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  spawnPowerup(type, position.clone());
}

function spawnPowerup(type, position) {
  const scene = getScene();
  const mesh = buildPickupMesh(type);
  mesh.position.set(position.x, FLOAT_HEIGHT, position.z);
  scene.add(mesh);
  activePowerups.push({ mesh, type, timer: PICKUP_DURATION });
}

export function updatePowerups(delta) {
  if (gameState.state !== 'playing') return;
  time += delta;
  const scene = getScene();
  const playerPos = getPlayerPosition();

  for (let i = activePowerups.length - 1; i >= 0; i--) {
    const p = activePowerups[i];
    p.timer -= delta;

    p.mesh.position.y = FLOAT_HEIGHT + Math.sin(time * 3 + i) * 0.15;
    p.mesh.rotation.y += delta * 2;

    const dx = playerPos.x - p.mesh.position.x;
    const dz = playerPos.z - p.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const expired = p.timer <= 0;
    const pickedUp = dist < PICKUP_RADIUS;

    if (pickedUp) {
      applyPowerup(p.type);
    }

    if (pickedUp || expired) {
      scene.remove(p.mesh);
      activePowerups.splice(i, 1);
    }
  }
}

function applyPowerup(type) {
  if (type === 'instaKill') gameState.activateInstaKill();
  else if (type === 'doublePoints') gameState.activateDoublePoints();
  else if (type === 'nuke') gameState.activateNuke();
}

export function clearAllPowerups() {
  const scene = getScene();
  for (const p of activePowerups) scene.remove(p.mesh);
  activePowerups.length = 0;
}

export function getActivePowerupLabels() {
  const labels = [];
  if (gameState.instaKill) labels.push(`${POWERUP_LABELS.instaKill} ${Math.ceil(gameState.instaKillTimer)}s`);
  if (gameState.doublePoints) labels.push(`${POWERUP_LABELS.doublePoints} ${Math.ceil(gameState.doublePointsTimer)}s`);
  return labels;
}
