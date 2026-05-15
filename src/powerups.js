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
  const group = new THREE.Group();
  const color = POWERUP_COLORS[type];
  const mat = createCelMaterial(color);

  if (type === 'instaKill') {
    // SKULL
    const headGeo = new THREE.SphereGeometry(0.24, 8, 8);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 0.12;
    group.add(head);

    const jawGeo = new THREE.BoxGeometry(0.18, 0.15, 0.18);
    const jaw = new THREE.Mesh(jawGeo, mat);
    jaw.position.y = -0.05;
    group.add(jaw);

    // Eye sockets (darker)
    const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08, 0.15, 0.18);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.08, 0.15, 0.18);
    group.add(eyeL, eyeR);

  } else if (type === 'doublePoints') {
    // 2X
    const barMat = mat;
    const barGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
    
    // The "2" (simplified as two bars and a diagonal or just a stylized S shape)
    const t2 = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.08), barMat);
    top.position.y = 0.18;
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.08), barMat);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.08), barMat);
    bot.position.y = -0.18;
    const side1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), barMat);
    side1.position.set(0.1, 0.09, 0);
    const side2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), barMat);
    side2.position.set(-0.1, -0.09, 0);
    t2.add(top, mid, bot, side1, side2);
    t2.position.x = -0.18;
    group.add(t2);

    // The "X"
    const tx = new THREE.Group();
    const x1 = new THREE.Mesh(barGeo, barMat);
    x1.rotation.z = Math.PI / 4;
    const x2 = new THREE.Mesh(barGeo, barMat);
    x2.rotation.z = -Math.PI / 4;
    tx.add(x1, x2);
    tx.position.x = 0.18;
    group.add(tx);

  } else if (type === 'nuke') {
    // NUCLEAR SYMBOL
    const centerGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8);
    const center = new THREE.Mesh(centerGeo, mat);
    center.rotation.x = Math.PI / 2;
    group.add(center);

    for (let i = 0; i < 3; i++) {
      const bladeGeo = new THREE.BoxGeometry(0.35, 0.15, 0.05);
      const blade = new THREE.Mesh(bladeGeo, mat);
      const pivot = new THREE.Group();
      pivot.rotation.z = (i * Math.PI * 2) / 3;
      blade.position.y = 0.25;
      pivot.add(blade);
      group.add(pivot);
    }
  }

  // Common glow
  const glowGeo = new THREE.SphereGeometry(0.6, 12, 10);
  const glowMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  return group;
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
