import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { getCamera, resolveCollision } from './scene.js';
import { gameState } from './game-state.js';
import { isMobile } from './mobile.js';

let controls;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isSprinting = false;

// Mobile input state (set externally by game.js)
let mobileInput = null;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const PLAYER_SPEED = 8;
const SPRINT_MULTIPLIER = 1.6;
const BOUNDARY = 48;

// Manual camera rotation for mobile
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const MOBILE_LOOK_SPEED = 0.07;
const PI_2 = Math.PI / 2 - 0.001;

const _mobile = isMobile();

export function initPlayer() {
  const camera = getCamera();

  if (!_mobile) {
    controls = new PointerLockControls(camera, document.body);

    controls.addEventListener('lock', () => {
      if (gameState.state !== 'playing') {
        controls.unlock();
      }
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }

  // Init euler from camera quaternion for mobile
  euler.setFromQuaternion(camera.quaternion, 'YXZ');

  return controls;
}

// ── Set mobile input reference ──
export function setMobileInput(mi) {
  mobileInput = mi;
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
  // On desktop, require pointer lock. On mobile, always active while playing.
  if (!_mobile && (!controls || !controls.isLocked)) return;
  if (gameState.state !== 'playing') return;

  velocity.set(0, 0, 0);
  direction.set(0, 0, 0);

  let sprinting = false;

  if (_mobile && mobileInput) {
    // ── Mobile input ──
    const move = mobileInput.getMovement();
    direction.x = move.x;
    direction.z = move.z;
    sprinting = mobileInput.isSprinting();

    // Manual camera rotation from look joystick
    const look = mobileInput.getLookDelta();
    if (look.x !== 0 || look.y !== 0) {
      euler.setFromQuaternion(getCamera().quaternion, 'YXZ');
      euler.y -= look.x * MOBILE_LOOK_SPEED * 60 * delta; // yaw
      euler.x -= look.y * MOBILE_LOOK_SPEED * 60 * delta; // pitch
      euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
      getCamera().quaternion.setFromEuler(euler);
    }
  } else {
    // ── Desktop (keyboard) ──
    if (moveForward)  direction.z -= 1;
    if (moveBackward) direction.z += 1;
    if (moveLeft)     direction.x -= 1;
    if (moveRight)    direction.x += 1;
    sprinting = isSprinting;
  }

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
    velocity.normalize().multiplyScalar(PLAYER_SPEED * (sprinting ? SPRINT_MULTIPLIER : 1) * delta);

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
  if (_mobile) return gameState.state === 'playing';
  return controls ? controls.isLocked : false;
}

export function lock() {
  if (_mobile) return; // No pointer lock on mobile
  if (controls) controls.lock();
}

export function unlock() {
  if (_mobile) return;
  if (controls) controls.unlock();
}

export function getControls() {
  return controls;
}

export function isOnMobile() {
  return _mobile;
}
