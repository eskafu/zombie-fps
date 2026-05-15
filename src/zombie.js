import * as THREE from 'three';
import { getScene, resolveCollision, getSpawnPoints } from './scene.js';
import { getPlayerPosition } from './player.js';
import { gameState } from './game-state.js';
import { createCelMaterial, applyOutlineToMesh } from './celshade.js';
import { makeGrungeMaterial } from './textures.js';
import { tryDropPowerup } from './powerups.js';
import { playZombieGrowl } from './audio.js';

const zombies = [];
const particles = [];
const skinColors = [0x708060, 0x8a9a7a, 0x6a7a6a, 0x5a6a5a, 0x6b7762];
const shirtColors = [0x553333, 0x334455, 0x444433, 0x554433, 0x3a3a3a];
const pantsColors = [0x222233, 0x2a2a2a, 0x332a22, 0x223322, 0x1f1f2e];

const flashMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 0.8, roughness: 1 });

const DAMAGE_DISTANCE = 1.8;
const MAX_ZOMBIES = 24;
const SPAWN_MIN_DIST = 18;  // Minimum distance from player
const SPAWN_MAX_DIST = 40;  // Fallback random spawn max distance
const ZOMBIE_SEPARATION = 1.0; // Minimum radius between zombies
const DAMAGE_COOLDOWN = 1.5;
const FLASH_DURATION = 0.08;

let spawnAccumulator = 0;
let wasRoundStarting = false;
let growlCooldown = 0;

function findLimbs(model) {
  const limbs = {};
  model.traverse(c => {
    if (c.userData.leftArm) limbs.leftArm = c;
    if (c.userData.rightArm) limbs.rightArm = c;
    if (c.userData.leftLeg) limbs.leftLeg = c;
    if (c.userData.rightLeg) limbs.rightLeg = c;
  });
  return limbs;
}

function createZombieMesh(isElite = false) {
  const mesh = new THREE.Group();
  const model = new THREE.Group(); // Inner group for sway animation
  mesh.add(model);
  mesh.userData.model = model;

  const skinColor = isElite ? 0xcc4422 : skinColors[Math.floor(Math.random() * skinColors.length)];
  const shirtColor = isElite ? 0xaa2211 : shirtColors[Math.floor(Math.random() * shirtColors.length)];
  const pantsColor = isElite ? 0x221111 : pantsColors[Math.floor(Math.random() * pantsColors.length)];

  const skinMat = makeGrungeMaterial(skinColor, 'skin');
  const shirtMat = makeGrungeMaterial(shirtColor, 'clothes');
  const pantsMat = makeGrungeMaterial(pantsColor, 'clothes');

  // Store base materials on the mesh to easily reset from flash damage
  mesh.userData.baseMaterials = { skinMat, shirtMat, pantsMat };

  function createPart(geo, mat, x, y, z, tag) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (tag) m.userData[tag] = true;
    m.userData.baseMat = mat;
    return m;
  }

  // Torso
  const torsoGeo = new THREE.BoxGeometry(0.4, 0.6, 0.22);
  const torso = createPart(torsoGeo, shirtMat, 0, 1.3, 0, 'isTorso');
  model.add(torso);

  // Head Group (pivot at neck)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.6, 0);
  const headGeo = new THREE.BoxGeometry(0.26, 0.26, 0.28);
  const head = createPart(headGeo, skinMat, 0, 0.13, 0, 'isHead');
  headGroup.add(head);

  // Jaw
  const jawGeo = new THREE.BoxGeometry(0.24, 0.08, 0.22);
  const jaw = createPart(jawGeo, skinMat, 0, -0.04, 0.05, 'isHead');
  jaw.rotation.x = 0.25; // slightly open
  headGroup.add(jaw);

  // Glowing Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ 
    color: 0xffff00, 
    emissive: 0xffaa00, 
    emissiveIntensity: 6.0, 
    roughness: 0.4 
  });
  const eyeGeo = new THREE.BoxGeometry(0.04, 0.03, 0.02);
  const leftEye = createPart(eyeGeo, eyeMat, -0.06, 0.17, 0.141, 'isHead');
  const rightEye = createPart(eyeGeo, eyeMat, 0.06, 0.17, 0.141, 'isHead');
  headGroup.add(leftEye, rightEye);

  model.add(headGroup);
  headGroup.userData.headGroup = true;
  model.userData.headGroup = headGroup;

  // Arms
  const upperArmGeo = new THREE.BoxGeometry(0.14, 0.35, 0.14);
  const lowerArmGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12);

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.27, 1.55, 0);
  leftArm.add(createPart(upperArmGeo, shirtMat, 0, -0.175, 0));
  const leftLowerArm = new THREE.Group();
  leftLowerArm.position.set(0, -0.35, 0);
  leftLowerArm.add(createPart(lowerArmGeo, skinMat, 0, -0.175, 0));
  leftArm.add(leftLowerArm);
  leftArm.userData.leftArm = true;
  leftArm.userData.leftLowerArm = leftLowerArm;
  model.add(leftArm);

  // Right Arm
  const rightArm = new THREE.Group();
  rightArm.position.set(0.27, 1.55, 0);
  rightArm.add(createPart(upperArmGeo, shirtMat, 0, -0.175, 0));
  const rightLowerArm = new THREE.Group();
  rightLowerArm.position.set(0, -0.35, 0);
  rightLowerArm.add(createPart(lowerArmGeo, skinMat, 0, -0.175, 0));
  rightArm.add(rightLowerArm);
  rightArm.userData.rightArm = true;
  rightArm.userData.rightLowerArm = rightLowerArm;
  model.add(rightArm);

  // Legs
  const upperLegGeo = new THREE.BoxGeometry(0.16, 0.45, 0.16);
  const lowerLegGeo = new THREE.BoxGeometry(0.14, 0.45, 0.14);

  // Left Leg
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.12, 1.0, 0);
  leftLeg.add(createPart(upperLegGeo, pantsMat, 0, -0.225, 0));
  const leftLowerLeg = new THREE.Group();
  leftLowerLeg.position.set(0, -0.45, 0);
  leftLowerLeg.add(createPart(lowerLegGeo, pantsMat, 0, -0.225, 0));
  leftLeg.add(leftLowerLeg);
  leftLeg.userData.leftLeg = true;
  leftLeg.userData.leftLowerLeg = leftLowerLeg;
  model.add(leftLeg);

  // Right Leg
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.12, 1.0, 0);
  rightLeg.add(createPart(upperLegGeo, pantsMat, 0, -0.225, 0));
  const rightLowerLeg = new THREE.Group();
  rightLowerLeg.position.set(0, -0.45, 0);
  rightLowerLeg.add(createPart(lowerLegGeo, pantsMat, 0, -0.225, 0));
  rightLeg.add(rightLowerLeg);
  rightLeg.userData.rightLeg = true;
  rightLeg.userData.rightLowerLeg = rightLowerLeg;
  model.add(rightLeg);

  // Elite zombies get a larger scale and a reddish tint instead of a cartoon outline
  if (isElite) {
    mesh.traverse(child => {
      if (child.isMesh) {
        // We could tint the material, but they already generate with reddish colors.
        // The scale alone makes them menacing.
      }
    });
  }

  const scale = isElite ? 1.08 + Math.random() * 0.08 : 0.95 + Math.random() * 0.15;
  mesh.scale.setScalar(scale);

  // Initial random offsets for variety
  leftArm.rotation.z = -0.05 - Math.random() * 0.1;
  rightArm.rotation.z = 0.05 + Math.random() * 0.1;

  return { mesh, mat: skinMat };
}

function randomSpawnPosition(playerPos) {
  // Try to use a registered spawn point (house door or well)
  const points = getSpawnPoints();
  if (points.length > 0) {
    // Shuffle candidates and pick the first one far enough from player
    const candidates = points.slice().sort(() => Math.random() - 0.5);
    for (const pt of candidates) {
      const dx = pt.x - playerPos.x;
      const dz = pt.z - playerPos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist >= SPAWN_MIN_DIST) {
        const p = pt.clone();
        // Add small random offset so they never spawn exactly on top of each other
        p.x += (Math.random() - 0.5) * 1.5;
        p.z += (Math.random() - 0.5) * 1.5;
        return p;
      }
    }
  }
  // Fallback: random position within the village (never in mountains)
  const angle = Math.random() * Math.PI * 2;
  const dist = SPAWN_MIN_DIST + Math.random() * (SPAWN_MAX_DIST - SPAWN_MIN_DIST);
  const x = playerPos.x + Math.cos(angle) * dist;
  const z = playerPos.z + Math.sin(angle) * dist;
  const clampedX = Math.max(-90, Math.min(90, x));
  const clampedZ = Math.max(-90, Math.min(90, z));
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
    baseMaterial: mat, // legacy, no longer used for flashing all parts easily, but kept for compatibility
    limbs: findLimbs(mesh.userData.model),
    model: mesh.userData.model,
    walkPhase: Math.random() * Math.PI * 2,
    alive: true,
    damageCooldown: 0,
    deathTimer: 0,
    hp: gameState.getZombieHP(),
    flashTimer: 0,
    isElite,
    wanderAngle: Math.random() * Math.PI * 2,
    stuckTimer: 0,
    evadeTimer: 0,
    evadeAngle: 0
  };
  zombies.push(zombie);
  gameState.onZombieSpawned();
  return zombie;
}

function setZombieMaterial(zombie, material) {
  zombie.mesh.traverse(child => {
    if (child.isMesh) {
      if (material) {
        child.material = material;
      } else {
        // reset to base
        child.material = child.userData.baseMat;
      }
    }
  });
}

function animateWalk(z, delta, isMoving) {
  const limbs = z.limbs;
  if (!limbs.leftArm) return;
  const speed = isMoving ? 7 : 2; // idle sway
  z.walkPhase += delta * speed;
  const s = Math.sin(z.walkPhase);
  const c = Math.cos(z.walkPhase);

  const model = z.model;

  if (isMoving) {
    // Walking animation
    limbs.leftArm.rotation.x = -1.3 + s * 0.3; // Arms reaching forward
    limbs.rightArm.rotation.x = -1.3 - s * 0.3;
    
    // Lower arms bend towards player
    if (limbs.leftArm.userData.leftLowerArm) limbs.leftArm.userData.leftLowerArm.rotation.x = -0.3 + Math.sin(z.walkPhase * 2) * 0.1;
    if (limbs.rightArm.userData.rightLowerArm) limbs.rightArm.userData.rightLowerArm.rotation.x = -0.3 - Math.cos(z.walkPhase * 2) * 0.1;

    limbs.leftLeg.rotation.x = -s * 0.6;
    limbs.rightLeg.rotation.x = s * 0.6;

    // Bend knees when leg goes back
    if (limbs.leftLeg.userData.leftLowerLeg) limbs.leftLeg.userData.leftLowerLeg.rotation.x = Math.max(0, -s * 0.8);
    if (limbs.rightLeg.userData.rightLowerLeg) limbs.rightLeg.userData.rightLowerLeg.rotation.x = Math.max(0, s * 0.8);

    model.position.y = -0.10 + Math.abs(c) * 0.08;

    // Torso and head sway
    model.rotation.y = s * 0.1;
    model.rotation.z = c * 0.05;
    if (model.userData.headGroup) {
      model.userData.headGroup.rotation.y = -s * 0.15; // head counter-steers
      model.userData.headGroup.rotation.x = 0.1 + Math.sin(z.walkPhase * 1.5) * 0.05; // creepy head bob
    }
  } else {
    // Idle animation
    limbs.leftArm.rotation.x = -1.0 + s * 0.05;
    limbs.rightArm.rotation.x = -1.0 - s * 0.05;
    
    if (limbs.leftArm.userData.leftLowerArm) limbs.leftArm.userData.leftLowerArm.rotation.x = -0.2;
    if (limbs.rightArm.userData.rightLowerArm) limbs.rightArm.userData.rightLowerArm.rotation.x = -0.2;

    limbs.leftLeg.rotation.x = 0;
    limbs.rightLeg.rotation.x = 0;
    if (limbs.leftLeg.userData.leftLowerLeg) limbs.leftLeg.userData.leftLowerLeg.rotation.x = 0;
    if (limbs.rightLeg.userData.rightLowerLeg) limbs.rightLeg.userData.rightLowerLeg.rotation.x = 0;

    model.position.y = -0.10;
    model.rotation.y = s * 0.02;
    model.rotation.z = 0;
    if (model.userData.headGroup) {
      model.userData.headGroup.rotation.y = Math.sin(z.walkPhase * 0.5) * 0.1;
      model.userData.headGroup.rotation.x = 0.1;
    }
  }
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
    while (spawnAccumulator >= interval && zombies.filter(z => z.alive).length < MAX_ZOMBIES) {
      spawnAccumulator -= interval;
      if (!spawnSingle(scene, playerPos)) break;
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
      if (z.flashTimer <= 0) setZombieMaterial(z, null); // reset to base
    }

    const dir = new THREE.Vector3()
      .subVectors(playerPos, z.mesh.position)
      .setY(0);

    const dist = dir.length();
    const isMoving = dist > 0.01 && dist > DAMAGE_DISTANCE * 0.8;

    if (isMoving) {
      dir.normalize();

      if (z.evadeTimer > 0) {
        z.evadeTimer -= delta;
        // Se estiver a tentar desviar, roda o eixo na direção definida
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), z.evadeAngle);
      } else {
        // Wobble normal se não estiver preso
        z.wanderAngle += delta * 1.5;
        const wobble = new THREE.Vector3(Math.cos(z.wanderAngle), 0, Math.sin(z.wanderAngle)).multiplyScalar(0.2);
        dir.add(wobble).normalize();
      }

      const speed = isLastZombie ? baseSpeed * 0.35 : z.isElite ? baseSpeed * 1.8 : baseSpeed;
      const step = speed * delta;
      
      const beforePos = z.mesh.position.clone();
      z.mesh.position.addScaledVector(dir, Math.min(step, dist));
      resolveCollision(z.mesh.position, 0.5);

      // Stuck detection: se não andou, tenta rodar 45 graus
      const movedDist = z.mesh.position.distanceTo(beforePos);
      if (movedDist < step * 0.2) {
        z.stuckTimer += delta;
        if (z.stuckTimer > 0.4) {
          if (z.evadeTimer > 0) {
            // Se já estava a desviar e continuou preso, adiciona mais 45 graus!
            z.evadeAngle += (z.evadeAngle > 0 ? 1 : -1) * (Math.PI / 4);
          } else {
            // Primeiro bloqueio: tenta 45 graus para um dos lados
            z.evadeAngle = (z.wanderAngle % 2 > 1 ? 1 : -1) * (Math.PI / 4);
          }
          z.evadeTimer = 1.0; // Mantém a rotação por 1 segundo
          z.stuckTimer = 0;
        }
      } else {
        z.stuckTimer = 0;
      }
    }

    // Zombie separation — push apart from other zombies so they don't stack
    for (let j = i - 1; j >= 0; j--) {
      const other = zombies[j];
      if (!other.alive) continue;
      const sep = new THREE.Vector3().subVectors(z.mesh.position, other.mesh.position);
      sep.y = 0;
      const sepDist = sep.length();
      if (sepDist < ZOMBIE_SEPARATION && sepDist > 0.001) {
        const push = (ZOMBIE_SEPARATION - sepDist) * 0.5;
        sep.normalize().multiplyScalar(push);
        z.mesh.position.add(sep);
        other.mesh.position.sub(sep);
      }
    }

    animateWalk(z, delta, isMoving);

    z.mesh.lookAt(new THREE.Vector3(playerPos.x, z.mesh.position.y, playerPos.z));

    // Last zombie pulsing
    if (z === lastAliveZombie) {
      const pulse = 1 + Math.sin(performance.now() / 1000 * 5) * 0.06;
      z.mesh.scale.setScalar(pulse);
    }

    const vertDist = Math.abs(playerPos.y - z.mesh.position.y);
    if (dist < DAMAGE_DISTANCE && vertDist < 2.0 && z.damageCooldown <= 0) {
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
  setZombieMaterial(zombie, flashMaterial);
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
