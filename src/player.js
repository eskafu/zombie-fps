import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { getCamera, resolveCollision } from './scene.js';
import { gameState } from './game-state.js';

let controls;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isSprinting = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const PLAYER_SPEED = 8;
const SPRINT_MULTIPLIER = 1.6;
const BOUNDARY = 48;

export function initPlayer() {
  const camera = getCamera();
  controls = new PointerLockControls(camera, document.body);

  controls.addEventListener('lock', () => {
    if (gameState.state !== 'playing') {
      controls.unlock();
    }
  });

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  return controls;
}

function onKeyDown(e) {
  switch (e.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyD': moveRight = true; break;
    case 'ShiftLeft': case 'ShiftRight': isSprinting = true; break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyD': moveRight = false; break;
    case 'ShiftLeft': case 'ShiftRight': isSprinting = false; break;
  }
}

export function updatePlayer(delta) {
  if (!controls.isLocked) return;

  velocity.set(0, 0, 0);
  direction.set(0, 0, 0);

  if (moveForward) direction.z -= 1;
  if (moveBackward) direction.z += 1;
  if (moveLeft) direction.x -= 1;
  if (moveRight) direction.x += 1;

  if (direction.length() > 0) {
    direction.normalize();
    const camera = getCamera();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    velocity.addScaledVector(forward, -direction.z);
    velocity.addScaledVector(right, direction.x);
    velocity.normalize().multiplyScalar(PLAYER_SPEED * (isSprinting ? SPRINT_MULTIPLIER : 1) * delta);

    const pos = getPlayerPosition();
    pos.add(velocity);
    resolveCollision(pos, 0.5);
    pos.x = Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.x));
    pos.z = Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.z));
  }
}

export function getPlayerPosition() {
  return getCamera().position;
}

export function isLocked() {
  return controls ? controls.isLocked : false;
}

export function lock() {
  if (controls) controls.lock();
}

export function getControls() {
  return controls;
}
