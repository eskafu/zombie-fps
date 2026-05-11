import * as THREE from 'three';
import { getScene } from './scene.js';
import { getPlayerPosition } from './player.js';
import { gameState } from './game-state.js';
import { getOwnedWeapons, unlockWeaponForBox, getCurrentWeapon, lowerWeaponBriefly } from './weapon.js';
import { createCelMaterial } from './celshade.js';

const BOX_POS = new THREE.Vector3(-18, 0, -24);
const INTERACT_RADIUS = 3.5;
const BOX_COST = 950;
const BOX_APPEAR_ROUND = 3;

// Weapons the box can give (excludes pistol)
const BOX_WEAPONS = ['shotgun', 'smg', 'aliengun', 'raygun'];

let boxGroup = null;
let nearBox = false;
let boxLight = null;
let pulseTime = 0;
let questionMarks = [];
let boxState = 'closed';  // 'closed' | 'opening' | 'revealing' | 'cooldown'
let boxTimer = 0;
let revealedWeapon = null;
let jinglePlayed = false;

// Particles for reveal
let revealParticles = [];
const REVEAL_DURATION = 1.5;
const COOLDOWN_DURATION = 3.0;

export function initMysteryBox() {
  const scene = getScene();

  boxGroup = new THREE.Group();
  boxGroup.position.copy(BOX_POS);
  boxGroup.visible = false;

  // Wooden crate
  const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const crateMat = createCelMaterial(0x6b4423);
  const crate = new THREE.Mesh(crateGeo, crateMat);
  crate.position.y = 0.7;
  crate.castShadow = true;
  crate.receiveShadow = true;
  boxGroup.add(crate);

  // Metal bands
  const bandMat = createCelMaterial(0x888888);
  const bandV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.45, 1.45), bandMat);
  bandV.position.y = 0.7;
  boxGroup.add(bandV);
  const bandH = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.1, 1.45), bandMat);
  bandH.position.y = 0.7;
  boxGroup.add(bandH);
  const bandZ = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.45, 0.1), bandMat);
  bandZ.position.y = 0.7;
  boxGroup.add(bandZ);

  // Question marks (floating, rotating)
  const qmMat = new THREE.MeshBasicMaterial({
    color: 0xffdd00,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const r = 0.9;
    // Diamond shape to represent "?"
    const qmGeo = new THREE.OctahedronGeometry(0.15, 0);
    const qm = new THREE.Mesh(qmGeo, qmMat);
    qm.position.set(
      Math.cos(angle) * r,
      0.7 + Math.sin(pulseTime * 2 + i) * 0.2,
      Math.sin(angle) * r
    );
    qm.userData.angle = angle;
    qm.userData.radius = r;
    boxGroup.add(qm);
    questionMarks.push(qm);
  }

  scene.add(boxGroup);

  // Light
  boxLight = new THREE.PointLight(0xffdd00, 0, 10);
  boxLight.position.copy(BOX_POS);
  boxLight.position.y = 2.5;
  scene.add(boxLight);

  document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
  if (e.code !== 'KeyE') return;
  if (gameState.state !== 'playing') return;
  if (!document.pointerLockElement) return;
  if (!nearBox) return;
  if (boxState !== 'closed') return;
  if (gameState.points < BOX_COST) return;

  // Check if player already owns all weapons
  const owned = getOwnedWeapons();
  const available = BOX_WEAPONS.filter(w => !owned[w]);
  if (available.length === 0) return; // All weapons owned

  gameState.points -= BOX_COST;
  activateBox(available);
}

function activateBox(available) {
  boxState = 'opening';
  boxTimer = 0;
  jinglePlayed = false;
  revealedWeapon = null;

  // Pick random weapon
  revealedWeapon = available[Math.floor(Math.random() * available.length)];

  // Spawn particles
  spawnRevealParticles();
}

function spawnRevealParticles() {
  const scene = getScene();
  for (const p of revealParticles) {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  revealParticles = [];

  const count = 20;
  for (let i = 0; i < count; i++) {
    const size = 0.05 + Math.random() * 0.1;
    const geo = new THREE.SphereGeometry(size, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(Math.random() * 0.15 + 0.1, 1, 0.5 + Math.random() * 0.5),
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const particle = new THREE.Mesh(geo, mat);
    particle.position.copy(BOX_POS);
    particle.position.y += 0.7;
    particle.position.x += (Math.random() - 0.5) * 1;
    particle.position.z += (Math.random() - 0.5) * 1;
    scene.add(particle);
    revealParticles.push({
      mesh: particle,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        2 + Math.random() * 4,
        (Math.random() - 0.5) * 2
      ),
      life: 0.8 + Math.random() * 0.6,
    });
  }
}

export function updateMysteryBox(delta) {
  if (!boxGroup || !boxLight) return;

  pulseTime += delta;

  // Only visible from round 3+
  const visible = gameState.round >= BOX_APPEAR_ROUND;
  boxGroup.visible = visible;
  boxLight.visible = visible;
  if (!visible) return;

  // Update question marks
  for (let i = 0; i < questionMarks.length; i++) {
    const qm = questionMarks[i];
    const angle = qm.userData.angle + pulseTime * 1.5;
    const r = qm.userData.radius;
    qm.position.x = Math.cos(angle) * r;
    qm.position.z = Math.sin(angle) * r;
    qm.position.y = 0.7 + Math.sin(pulseTime * 3 + i) * 0.25;
    qm.rotation.y += delta * 3;
    qm.rotation.x += delta * 2;
  }

  // State machine
  if (boxState === 'opening') {
    boxTimer += delta;
    // Shake the box
    const shake = Math.sin(boxTimer * 20) * 0.05 * (1 - boxTimer / REVEAL_DURATION);
    boxGroup.rotation.z = shake;
    boxGroup.rotation.x = shake * 0.5;

    if (boxTimer >= REVEAL_DURATION * 0.6 && !jinglePlayed) {
      jinglePlayed = true;
      // Visual flash
      boxLight.intensity = 5;
      boxLight.color.set(0xffffff);
    }

    if (boxTimer >= REVEAL_DURATION) {
      // Reveal!
      boxState = 'cooldown';
      boxTimer = 0;
      boxGroup.rotation.z = 0;
      boxGroup.rotation.x = 0;
      boxLight.intensity = 2;
      boxLight.color.set(0xffdd00);

      // Give weapon to player
      if (revealedWeapon) {
        unlockWeaponForBox(revealedWeapon);
        lowerWeaponBriefly();
      }
    }
  } else if (boxState === 'cooldown') {
    boxTimer += delta;
    boxLight.intensity = 0.5 + 0.3 * Math.sin(pulseTime * 4);

    if (boxTimer >= COOLDOWN_DURATION) {
      boxState = 'closed';
      boxTimer = 0;
    }
  } else {
    // Closed — pulsing glow
    const isAvailable = BOX_WEAPONS.some(w => !getOwnedWeapons()[w]);
    if (isAvailable) {
      boxLight.intensity = 0.6 + 0.4 * Math.sin(pulseTime * 3);
    } else {
      boxLight.intensity = 0.15;
    }
  }

  // Proximity detection
  const playerPos = getPlayerPosition();
  const dx = playerPos.x - BOX_POS.x;
  const dz = playerPos.z - BOX_POS.z;
  nearBox = Math.sqrt(dx * dx + dz * dz) < INTERACT_RADIUS;

  if (nearBox && boxState === 'closed') {
    boxLight.intensity = 1.0 + 0.5 * Math.sin(pulseTime * 6);
  }

  // Update particles
  const scene = getScene();
  for (let i = revealParticles.length - 1; i >= 0; i--) {
    const p = revealParticles[i];
    p.life -= delta;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      revealParticles.splice(i, 1);
      continue;
    }
    p.velocity.y -= 6 * delta;
    p.mesh.position.addScaledVector(p.velocity, delta);
    p.mesh.material.opacity = Math.max(0, p.life / 1.0);
    p.mesh.scale.setScalar(Math.max(0.1, p.life / 1.0));
  }
}

export function isNearMysteryBox() { return nearBox && boxState === 'closed'; }
export function getBoxCost() { return BOX_COST; }
export function getBoxState() { return boxState; }
export function getRevealedWeapon() { return revealedWeapon; }
