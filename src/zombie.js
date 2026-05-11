import * as THREE from 'three';
import { getScene, resolveCollision } from './scene.js';
import { getPlayerPosition } from './player.js';
import { gameState } from './game-state.js';
import { createCelMaterial, applyToonToGroup, createOutlineMaterial } from './celshade.js';
import { tryDropPowerup } from './powerups.js';
import { playZombieGrowl } from './audio.js';

const zombies = [];
const particles = [];
const zombieGeometry = createZombieGeometry();
const zombieColors = [0x4a5a2a, 0x6a4a2a, 0x5a3a4a, 0x6a5a1a, 0x5a4a3a];
const flashCelMaterial = createCelMaterial(0xff8844);
const eliteOutlineMaterial = (() => {
  const m = createOutlineMaterial();
  m.uniforms.uColor = { value: new THREE.Color(0xffaa00) };
  m.fragmentShader = `
    uniform vec3 uColor;
    void main() {
      gl_FragColor = vec4(uColor, 1.0);
    }
  `;
  return m;
})();

const DAMAGE_DISTANCE = 1.8;
const MAX_ZOMBIES = 24;
const SPAWN_MIN_DIST = 20;
const SPAWN_MAX_DIST = 40;
const DAMAGE_COOLDOWN = 1.5;
const FLASH_DURATION = 0.08;

let spawnAccumulator = 0;
let wasRoundStarting = false;
let growlCooldown = 0;

function makeLimb(geo, x, y, z, tag) {
  const m = new THREE.Mesh(geo);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (tag) m.userData[tag] = true;
  return m;
}

function createZombieGeometry() {
  const group = new THREE.Group();

  const torsoGeo = new THREE.CapsuleGeometry(0.32, 0.7, 4, 10);
  const torso = makeLimb(torsoGeo, 0, 1.35, 0);
  group.add(torso);

  const headGeo = new THREE.SphereGeometry(0.27, 14, 12);
  const head = makeLimb(headGeo, 0, 2.0, 0, 'isHead');
  group.add(head);

  const jawGeo = new THREE.BoxGeometry(0.32, 0.12, 0.28);
  const jaw = new THREE.Mesh(jawGeo);
  jaw.position.set(0, 1.88, 0.05);
  jaw.castShadow = true;
  jaw.userData.isHead = true;
  group.add(jaw);

  const armGeo = new THREE.CapsuleGeometry(0.1, 0.55, 4, 8);
  const leftArm = makeLimb(armGeo, -0.42, 1.55, 0.15, 'leftArm');
  leftArm.rotation.x = -0.5;
  group.add(leftArm);

  const rightArm = makeLimb(armGeo, 0.42, 1.55, 0.15, 'rightArm');
  rightArm.rotation.x = -0.4;
  group.add(rightArm);

  const legGeo = new THREE.CapsuleGeometry(0.13, 0.6, 4, 8);
  const leftLeg = makeLimb(legGeo, -0.18, 0.5, 0, 'leftLeg');
  group.add(leftLeg);

  const rightLeg = makeLimb(legGeo, 0.18, 0.5, 0, 'rightLeg');
  group.add(rightLeg);

  return group;
}

function findLimbs(mesh) {
  const limbs = {};
  mesh.traverse(c => {
    if (c.userData.leftArm) limbs.leftArm = c;
    if (c.userData.rightArm) limbs.rightArm = c;
    if (c.userData.leftLeg) limbs.leftLeg = c;
    if (c.userData.rightLeg) limbs.rightLeg = c;
  });
  return limbs;
}

function createZombieMesh(isElite = false) {
  const mesh = zombieGeometry.clone();
  const color = isElite ? 0xcc2200 : zombieColors[Math.floor(Math.random() * zombieColors.length)];
  const mat = createCelMaterial(color);
  applyToonToGroup(mesh, color);
  // Elite: golden outline + glow
  if (isElite) {
    mesh.traverse(child => {
      if (child.isMesh && child.userData.isOutline) {
        child.material = eliteOutlineMaterial.clone();
        child.scale.setScalar(1.12);
      }
    });
  }
  const scale = isElite ? 1.08 + Math.random() * 0.08 : 0.92 + Math.random() * 0.18;
  mesh.scale.setScalar(scale);
  return { mesh, mat };
}

function randomSpawnPosition(playerPos) {
  const angle = Math.random() * Math.PI * 2;
  const dist = SPAWN_MIN_DIST + Math.random() * (SPAWN_MAX_DIST - SPAWN_MIN_DIST);
  const x = playerPos.x + Math.cos(angle) * dist;
  const z = playerPos.z + Math.sin(angle) * dist;
  const clampedX = Math.max(-48, Math.min(48, x));
  const clampedZ = Math.max(-48, Math.min(48, z));
  return new THREE.Vector3(clampedX, 0, clampedZ);
}

export function spawnInitialZombies() {
  spawnAccumulator = 0;
  // Spawn 2-3 zombies immediately so the player isn't waiting
  const count = 2 + Math.floor(Math.random() * 2);
  const scene = getScene();
  const playerPos = getPlayerPosition();
  for (let i = 0; i < count; i++) {
    spawnSingle(scene, playerPos);
  }
}

function spawnSingle(scene, playerPos) {
  if (zombies.length >= MAX_ZOMBIES) return null;
  if (!gameState.canSpawnMore()) return null;

  const isElite = gameState.round >= 5 && Math.random() < 0.20;
  const { mesh, mat } = createZombieMesh(isElite);
  const pos = randomSpawnPosition(playerPos);
  mesh.position.copy(pos);
  scene.add(mesh);

  const zombie = {
    mesh,
    baseMaterial: mat,
    limbs: findLimbs(mesh),
    walkPhase: Math.random() * Math.PI * 2,
    alive: true,
    damageCooldown: 0,
    deathTimer: 0,
    hp: gameState.getZombieHP(),
    flashTimer: 0,
    isElite
  };
  zombies.push(zombie);
  gameState.onZombieSpawned();
  return zombie;
}

function setZombieMaterial(zombie, material) {
  zombie.mesh.traverse(child => {
    if (child.isMesh && !child.userData.isOutline) {
      child.material = material;
    }
  });
}

function animateWalk(z, delta, isMoving) {
  const limbs = z.limbs;
  if (!limbs.leftArm) return;
  const speed = isMoving ? 6 : 0;
  z.walkPhase += delta * speed;
  const s = Math.sin(z.walkPhase);
  const armBase = -0.45;
  limbs.leftArm.rotation.x = armBase + s * 0.3;
  limbs.rightArm.rotation.x = armBase - s * 0.3;
  limbs.leftLeg.rotation.x = -s * 0.5;
  limbs.rightLeg.rotation.x = s * 0.5;
  z.mesh.position.y = isMoving ? Math.abs(s) * 0.05 : 0;
}

export function updateZombies(delta, audioCallback) {
  if (gameState.state !== 'playing') return;

  const playerPos = getPlayerPosition();
  const scene = getScene();

  // Nuke — kill all alive zombies instantly
  if (gameState.nukeQueued) {
    gameState.nukeQueued = false;
    for (const z of zombies) {
      if (z.alive) {
        z.alive = false;
        z.deathTimer = 0;
        // only count kills up to round total to avoid negative counter
        if (gameState.zombiesKilled < gameState.zombiesInRound) {
          gameState.onZombieKilled();
        } else {
          gameState.kills++;
        }
      }
    }
  }

  // Spawn zombies gradually
  const aliveCount = zombies.filter(z => z.alive).length;
  if (!gameState.roundStarting) {
    // Round just started — spawn initial batch immediately
    if (wasRoundStarting) {
      wasRoundStarting = false;
      const initialCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < initialCount; i++) {
        spawnSingle(scene, playerPos);
      }
    }
    spawnAccumulator += delta;
    const interval = gameState.getSpawnInterval();
    while (spawnAccumulator >= interval && aliveCount < MAX_ZOMBIES) {
      spawnAccumulator -= interval;
      spawnSingle(scene, playerPos);
    }
  }

  const baseSpeed = gameState.getZombieSpeed();
  const isLastZombie = zombies.filter(z => z.alive).length === 1;
  // Find the actual last alive zombie for pulsing
  let lastAliveZombie = null;
  if (isLastZombie) {
    lastAliveZombie = zombies.find(z => z.alive);
  }

  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];

    if (!z.alive) {
      z.deathTimer += delta;
      const scale = Math.max(0, 1 - z.deathTimer / 0.3);
      z.mesh.scale.setScalar(scale);
      if (z.deathTimer >= 0.3) {
        scene.remove(z.mesh);
        zombies.splice(i, 1);
      }
      continue;
    }

    z.damageCooldown = Math.max(0, z.damageCooldown - delta);

    if (z.flashTimer > 0) {
      z.flashTimer -= delta;
      if (z.flashTimer <= 0) setZombieMaterial(z, z.baseMaterial);
    }

    const dir = new THREE.Vector3()
      .subVectors(playerPos, z.mesh.position)
      .setY(0);

    const dist = dir.length();
    const isMoving = dist > 0.01 && dist > DAMAGE_DISTANCE * 0.8;

    if (isMoving) {
      dir.normalize();
      const speed = isLastZombie ? baseSpeed * 0.35 : z.isElite ? baseSpeed * 1.8 : baseSpeed;
      const step = speed * delta;
      z.mesh.position.addScaledVector(dir, Math.min(step, dist));
      resolveCollision(z.mesh.position, 0.5);
    }

    animateWalk(z, delta, isMoving);

    z.mesh.lookAt(new THREE.Vector3(playerPos.x, z.mesh.position.y, playerPos.z));

    // Last zombie pulsing
    if (z === lastAliveZombie) {
      const pulse = 1 + Math.sin(performance.now() / 1000 * 5) * 0.06;
      z.mesh.scale.setScalar(pulse);
    }

    if (dist < DAMAGE_DISTANCE && z.damageCooldown <= 0) {
      z.damageCooldown = DAMAGE_COOLDOWN;
      gameState.takeDamage();
      if (audioCallback) audioCallback();
    }
  }

  // Zombie growls — play from nearest zombie periodically
  growlCooldown -= delta;
  if (growlCooldown <= 0) {
    // Find nearest alive zombie
    let nearest = null;
    let nearestDist = Infinity;
    for (const z of zombies) {
      if (!z.alive) continue;
      const d = new THREE.Vector3().subVectors(playerPos, z.mesh.position).length();
      if (d < nearestDist) { nearestDist = d; nearest = z; }
    }
    if (nearest && nearestDist < 25) {
      playZombieGrowl(nearestDist);
      growlCooldown = 2 + Math.random() * 3;
    }
  }

  // Update death particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= delta;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
      continue;
    }
    p.velocity.y -= 8 * delta; // gravity
    p.mesh.position.addScaledVector(p.velocity, delta);
    p.mesh.rotation.x += delta * 8;
    p.mesh.rotation.y += delta * 6;
    p.mesh.material.opacity = Math.max(0, p.life / 1.0);
  }

  wasRoundStarting = gameState.roundStarting;
}

export function checkShot(raycaster) {
  const meshes = zombies.filter(z => z.alive).map(z => {
    z.mesh.updateWorldMatrix(true, false);
    return z.mesh;
  });
  const intersects = raycaster.intersectObjects(meshes, true);
  if (intersects.length === 0) return null;

  const hit = intersects[0];
  const isHead = !!hit.object.userData.isHead;
  let obj = hit.object;
  while (obj) {
    for (const z of zombies) {
      if (z.alive && z.mesh === obj) {
        return { zombie: z, isHead };
      }
    }
    obj = obj.parent;
  }
  return null;
}

function spawnDeathParticles(position) {
  const scene = getScene();
  const count = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const size = 0.04 + Math.random() * 0.08;
    const geo = new THREE.BoxGeometry(size, size, size);
    const shade = 0.3 + Math.random() * 0.3;
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(shade, shade * 0.7, shade * 0.3), transparent: true, opacity: 1 });
    const cube = new THREE.Mesh(geo, mat);
    cube.position.copy(position);
    cube.position.y += 1.0 + Math.random() * 0.8;
    scene.add(cube);
    particles.push({
      mesh: cube,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 3
      ),
      life: 0.6 + Math.random() * 0.5
    });
  }
}

export function damageZombie(zombie, amount) {
  if (!zombie || !zombie.alive) return false;
  const dmg = gameState.instaKill ? zombie.hp : amount;
  zombie.hp -= dmg;
  if (zombie.hp <= 0) {
    zombie.alive = false;
    zombie.deathTimer = 0;
    spawnDeathParticles(zombie.mesh.position.clone());
    gameState.onZombieKilled();
    tryDropPowerup(zombie.mesh.position);
    return true;
  }
  zombie.flashTimer = FLASH_DURATION;
  setZombieMaterial(zombie, flashCelMaterial);
  return false;
}

export function clearAllZombies() {
  const scene = getScene();
  for (const z of zombies) {
    scene.remove(z.mesh);
  }
  zombies.length = 0;
  for (const p of particles) {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  particles.length = 0;
}

export function getZombies() {
  return zombies;
}
