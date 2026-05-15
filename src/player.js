import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { getCamera, resolveCollision, getGroundHeight, getScene } from './scene.js';
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
const BOUNDARY = 108;
const PLAYER_HEIGHT = 1.7;

// Jump physics
let jumpVelocity = 0;
let canJump = true;
const GRAVITY = 20;
const JUMP_FORCE = 7;

// Grappling hook
let grappleState = 'idle'; // 'idle', 'shooting', 'pulling'
const grappleTarget = new THREE.Vector3();
let grappleStartTime = 0;
let lastGrappleDist = 0;
const GRAPPLE_TIMEOUT = 2500; // ms

export function isGrappleActive() {
  return grappleState !== 'idle';
}
const raycaster = new THREE.Raycaster();
let hookMesh = null;
let ropeMesh = null;

function createHookMeshes() {
  if (hookMesh) return;
  const scene = getScene();
  
  const hookGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4);
  const hookMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  hookMesh = new THREE.Mesh(hookGeo, hookMat);
  hookMesh.visible = false;
  scene.add(hookMesh);
  
  const ropeGeo = new THREE.BufferGeometry();
  ropeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const ropeMat = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 3 });
  ropeMesh = new THREE.Line(ropeGeo, ropeMat);
  ropeMesh.visible = false;
  scene.add(ropeMesh);
}

function updateRope() {
  if (!ropeMesh || !ropeMesh.visible) return;
  const positions = ropeMesh.geometry.attributes.position.array;
  
  const start = getCamera().position.clone();
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(getCamera().quaternion);
  start.addScaledVector(forward, 0.4);
  start.y -= 0.3;
  
  positions[0] = start.x;
  positions[1] = start.y;
  positions[2] = start.z;
  
  positions[3] = hookMesh.position.x;
  positions[4] = hookMesh.position.y;
  positions[5] = hookMesh.position.z;
  
  ropeMesh.geometry.attributes.position.needsUpdate = true;
}

// Manual camera rotation for mobile.
// Look joystick returns accumulated pixel-delta per frame. Convert to radians
// with per-pixel sensitivity. Pitch is intentionally slower than yaw — most
// players want fast horizontal scanning but find a 1:1 vertical too jumpy.
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const MOBILE_YAW_SENSITIVITY   = 0.0040;  // radians per pixel (tuned for less twitchy aim)
const MOBILE_PITCH_SENSITIVITY = 0.0028;
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
    case 'Space': 
      if (canJump) {
        jumpVelocity = JUMP_FORCE;
        canJump = false;
      }
      break;
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

export function fireGrappleHook() {
  if (grappleState !== 'idle' || gameState.state !== 'playing') return false;
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), getCamera());
  const intersects = raycaster.intersectObjects(getScene().children, true);
  // Ignore objects that are too close (like the camera's weapon viewmodels)
  const valid = intersects.find(i => i.distance > 1.0 && i.distance < 80);
  
  if (valid) {
    grappleTarget.copy(valid.point);
    
    // Check surface normal - only add Y offset if hitting a top surface (roof/floor)
    const normal = valid.face ? valid.face.normal.clone().applyQuaternion(valid.object.quaternion) : new THREE.Vector3(0,1,0);
    if (normal.y > 0.5) {
      grappleTarget.y += 0.8; // Small offset to land ON the surface
    }
    
    grappleStartTime = performance.now();
    lastGrappleDist = 9999;
    
    createHookMeshes();
    hookMesh.position.copy(getCamera().position);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(getCamera().quaternion);
    hookMesh.position.addScaledVector(forward, 0.5);
    hookMesh.position.y -= 0.2;
    hookMesh.lookAt(grappleTarget);
    hookMesh.rotateX(Math.PI / 2);
    
    hookMesh.visible = true;
    ropeMesh.visible = true;
    
    grappleState = 'shooting';
    return true; // Successfully fired
  }
  return false;
}

export function updatePlayer(delta) {
  // On desktop, require pointer lock. On mobile, always active while playing.
  if (!_mobile && (!controls || !controls.isLocked)) return;
  if (gameState.state !== 'playing') return;

  if (grappleState === 'shooting') {
    const hookSpeed = 200 * delta;
    const dir = new THREE.Vector3().subVectors(grappleTarget, hookMesh.position);
    const dist = dir.length();
    
    // Safety timeout
    if (performance.now() - grappleStartTime > GRAPPLE_TIMEOUT) {
      grappleState = 'idle';
      if (hookMesh) hookMesh.visible = false;
      if (ropeMesh) ropeMesh.visible = false;
      return;
    }

    if (dist < hookSpeed) {
      hookMesh.position.copy(grappleTarget);
      grappleState = 'pulling';
      jumpVelocity = 0;
    } else {
      hookMesh.position.addScaledVector(dir.normalize(), hookSpeed);
    }
    updateRope();
  } else if (grappleState === 'pulling') {
    const pos = getPlayerPosition();
    const dir = new THREE.Vector3().subVectors(grappleTarget, pos);
    const dist = dir.length();
    
    // Stuck detection: if we aren't moving closer to target (blocked by wall)
    const stuck = dist > lastGrappleDist - 0.01;
    lastGrappleDist = dist;

    // Safety timeout or reached target or stuck
    if (dist < 2.0 || stuck || (performance.now() - grappleStartTime > GRAPPLE_TIMEOUT)) {
       grappleState = 'idle';
       jumpVelocity = 3;
       if (hookMesh) hookMesh.visible = false;
       if (ropeMesh) ropeMesh.visible = false;
    } else {
       dir.normalize();
       const GRAPPLE_SPEED = 70;
       
       // Move and resolve collisions so we don't clip through walls
       pos.addScaledVector(dir, GRAPPLE_SPEED * delta);
       resolveCollision(pos, 0.6);
       
       updateRope();
       return; 
    }
  }

  velocity.set(0, 0, 0);
  direction.set(0, 0, 0);

  let sprinting = false;

  if (_mobile && mobileInput) {
    // ── Mobile input ──
    const move = mobileInput.getMovement();
    direction.x = move.x;
    direction.z = move.z;
    sprinting = mobileInput.isSprinting();

    // Manual camera rotation from look joystick — apply pixel delta directly.
    const look = mobileInput.getLookDelta();
    if (look.x !== 0 || look.y !== 0) {
      euler.setFromQuaternion(getCamera().quaternion, 'YXZ');
      euler.y -= look.x * MOBILE_YAW_SENSITIVITY;
      euler.x -= look.y * MOBILE_PITCH_SENSITIVITY;
      euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
      getCamera().quaternion.setFromEuler(euler);
    }

    if (mobileInput.consumeJump() && canJump) {
      jumpVelocity = JUMP_FORCE;
      canJump = false;
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

  // Handle jumping and gravity every frame
  const pos = getPlayerPosition();
  jumpVelocity -= GRAVITY * delta;
  pos.y += jumpVelocity * delta;

  // 3D Floor collision
  const floorY = getGroundHeight(pos.x, pos.z, 0.2);
  let targetFloorY = PLAYER_HEIGHT; // Default ground (1.7)
  
  // If we are falling onto an obstacle or standing on it
  if (pos.y - 1.7 >= floorY - 0.6) {
    targetFloorY = floorY + PLAYER_HEIGHT;
  }

  if (pos.y <= targetFloorY) {
    pos.y = targetFloorY;
    jumpVelocity = 0;
    canJump = true;
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
