import * as THREE from 'three';
import { makeAsphaltTexture, makeSkyTexture, makeGrungeMaterial, makeWoodPlankMaterial, makeVehicleMaterial, makeBarrelMaterial } from './textures.js';

let scene, camera, renderer;
let ground, barriers, lights;
const barrierColliders = [];
const flickerLights = [];
const spawnPoints = []; // Zombie spawn points: house doors + well

// Seeded PRNG (mulberry32) for deterministic barrier placement
let _seed = 42;
function seededRandom() {
  _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0;
  let t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

export function initScene() {
  scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  // Realistic volumetric fog matching the night sky color
  scene.fog = new THREE.FogExp2(0x020308, 0.035);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 1.7, 0);

  // Add Flashlight to Camera
  const flashlight = new THREE.SpotLight(0xffeedd, 2.0); // Warm light
  flashlight.angle = Math.PI / 7;
  flashlight.penumbra = 0.6;
  flashlight.decay = 2.0;
  flashlight.distance = 45;
  flashlight.castShadow = true;
  flashlight.shadow.mapSize.width = 512;
  flashlight.shadow.mapSize.height = 512;
  
  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0, 0, -10);
  camera.add(flashlight);
  camera.add(flashTarget);
  flashlight.target = flashTarget;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  scene.add(camera);

  lights = createLights();
  ground = createGround();
  barriers = createVillage();
  createVehicles();
  createDebris();
  createStreetProps();
  createWell();
  createMountains();

  window.addEventListener('resize', onResize);
}

function createLights() {
  const ambient = new THREE.AmbientLight(0x101522, 0.2); // Darker blueish ambient
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xaaccff, 0.6); // Slightly dimmer moon
  moon.position.set(30, 50, 20);
  moon.castShadow = true;
  moon.shadow.mapSize.width = 1024;
  moon.shadow.mapSize.height = 1024;
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 120;
  moon.shadow.camera.left = -50;
  moon.shadow.camera.right = 50;
  moon.shadow.camera.top = 50;
  moon.shadow.camera.bottom = -50;
  scene.add(moon);

  const center = new THREE.PointLight(0xff6633, 0.4, 15);
  center.position.set(0, 2, 0);
  scene.add(center);
  flickerLights.push({ light: center, base: 0.4, phase: 0 });

  // Cinematic Street Lights scattered around
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r = 18 + Math.random() * 12;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    // Rotate to face roughly inwards
    createStreetLight(x, z, -angle);
  }

  return { ambient, moon };
}

function createStreetLight(x, z, rotation) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;

  const matPole = makeGrungeMaterial(0x222222, 'metal');
  
  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 6, 8);
  const pole = new THREE.Mesh(poleGeo, matPole);
  pole.position.y = 3;
  pole.castShadow = true;
  group.add(pole);

  // Arm
  const armGeo = new THREE.BoxGeometry(2, 0.1, 0.1);
  const arm = new THREE.Mesh(armGeo, matPole);
  arm.position.set(1, 5.9, 0);
  arm.castShadow = true;
  group.add(arm);

  // Housing
  const houseGeo = new THREE.BoxGeometry(0.5, 0.15, 0.3);
  const house = new THREE.Mesh(houseGeo, matPole);
  house.position.set(1.9, 5.9, 0);
  house.castShadow = true;
  group.add(house);

  // Bulb
  const bulbMat = new THREE.MeshStandardMaterial({ 
    color: 0xffffee, 
    emissive: 0xffcc66, 
    emissiveIntensity: 4.0 
  });
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), bulbMat);
  bulb.position.set(1.9, 5.82, 0);
  group.add(bulb);

  // SpotLight
  const light = new THREE.SpotLight(0xffcc66, 3.5);
  light.position.set(1.9, 5.8, 0);
  light.angle = Math.PI / 4;
  light.penumbra = 0.4;
  light.distance = 25;
  light.castShadow = true;
  light.shadow.mapSize.width = 512;
  light.shadow.mapSize.height = 512;
  group.add(light);

  const target = new THREE.Object3D();
  target.position.set(1.9, 0, 0);
  group.add(target);
  light.target = target;

  // Cinematic broken flicker for some lights
  if (Math.random() > 0.4) {
    flickerLights.push({ 
      light: light, 
      bulb: bulbMat, 
      base: 3.5, 
      phase: Math.random() * 100, 
      isStreet: true 
    });
  }

  scene.add(group);
  
  // Add thick collision so zombies/player don't walk through the pole
  barrierColliders.push({ x: x, z: z, halfX: 0.4, halfZ: 0.4, maxY: 10 });
}

function createGround() {
  const tex = makeAsphaltTexture();
  const geo = new THREE.PlaneGeometry(300, 300);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function createVillage() {
  const list = [];
  const matWall = [
    makeGrungeMaterial(0xc0b8a0, 'wall'), // dirty white/beige plaster
    makeGrungeMaterial(0x8a7a6a, 'wall'), // brown stone
    makeGrungeMaterial(0x9a8b80, 'wall'), // light brown
  ];
  const matRoof = [
    makeGrungeMaterial(0x5a3a2a, 'roof'), // red/brown roof
    makeGrungeMaterial(0x3a4a5a, 'roof'), // dark slate roof
  ];
  const matWood = makeGrungeMaterial(0x4a3a2a, 'crate'); // doors

  const count = 75; // More houses since the map is much larger
  let placed = 0;
  let attempts = 0;

  // Pre-create window materials outside the loop for performance
  const matWindowDark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 });
  const matWindowDim = new THREE.MeshStandardMaterial({ 
    color: 0xffaa00, 
    emissive: 0xff5500, // deep orange/red faint light
    emissiveIntensity: 4.0 // increased so it's visible without bloom
  });
  const matWindowLit = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, 
    emissive: 0xffdd55, // bright yellow light
    emissiveIntensity: 6.0 
  });
  const winGeo = new THREE.BoxGeometry(0.8, 1.0, 0.1);
  // The frame must be THINNER than the window so the window glass sticks out and is visible!
  const frameGeo = new THREE.BoxGeometry(1.0, 1.2, 0.05);
  const frameMat = makeGrungeMaterial(0x1a1a1a, 'wall'); // Dark frame
  
  // Clear any existing colliders before generating
  barrierColliders.length = 0;

  // Add invisible boundary colliders (circular approximation) at radius 110
  // to prevent the player walking through the mountains
  const boundaryRadius = 110;
  const numSegments = 24;
  for (let i = 0; i < numSegments; i++) {
    const angle = (i / numSegments) * Math.PI * 2;
    const x = Math.cos(angle) * boundaryRadius;
    const z = Math.sin(angle) * boundaryRadius;
    // Bounding box thickness 4, width approx circumference / segments
    const width = (Math.PI * 2 * boundaryRadius) / numSegments;
    const c = Math.cos(-angle), s = Math.sin(-angle);
    // Rough AABB for a segment
    barrierColliders.push({ x, z, halfX: Math.abs(c)*4 + Math.abs(s)*(width/2), halfZ: Math.abs(s)*4 + Math.abs(c)*(width/2), maxY: 100 });
  }
  
  while (placed < count && attempts < 600) {
    attempts++;
    // Spread across a massive 200x200 area
    const x = (seededRandom() - 0.5) * 200;
    const z = (seededRandom() - 0.5) * 200;
    
    // Check if it's outside the circular mountain bounds (radius 105)
    if (Math.sqrt(x*x + z*z) > 105) continue;
    
    if (Math.sqrt(x*x + z*z) < 15) continue; // Plaza in the center

    // House dimensions
    const width = 4 + seededRandom() * 4;
    const depth = 3 + seededRandom() * 3;
    const height = 3 + seededRandom() * 2;
    
    // Plan extensions before overlap check
    const hasExt = Math.random() > 0.7;
    const extW = hasExt ? 2 + seededRandom() * 2 : 0;
    const extD = hasExt ? depth * (0.6 + seededRandom() * 0.4) : 0;
    const extH = hasExt ? height * (0.6 + seededRandom() * 0.3) : 0;

    // Check overlap with existing colliders
    let overlap = false;
    for (const b of barrierColliders) {
      // Inflate check width to roughly account for possible extension
      if (Math.abs(x - b.x) < ((width + extW)/2 + b.halfX + 1.5) && Math.abs(z - b.z) < (depth/2 + b.halfZ + 1.5)) {
        overlap = true; break;
      }
    }
    if (overlap) continue;

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    
    // Snapped rotations for street alignment, or random
    const rotation = Math.floor(seededRandom() * 4) * (Math.PI / 2);
    group.rotation.y = rotation;

    const wMat = matWall[Math.floor(seededRandom() * matWall.length)];
    const rMat = matRoof[Math.floor(seededRandom() * matRoof.length)];

    // Main Body
    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    const body = new THREE.Mesh(bodyGeo, wMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Roof Trim (Gutters/Border)
    const trimGeo = new THREE.BoxGeometry(width + 0.3, 0.2, depth + 0.3);
    const trimMat = makeGrungeMaterial(0x2b2b2b, 'wall'); // dark grey trim
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = height;
    trim.castShadow = true;
    trim.receiveShadow = true;
    group.add(trim);

    // Roof (Properly scaled to match the rectangular base)
    const roofH = 1.5 + seededRandom() * 1.5;
    const roofGeo = new THREE.ConeGeometry(1, roofH, 4);
    const roof = new THREE.Mesh(roofGeo, rMat);
    
    // A ConeGeometry with radius 1 and 4 segments rotated by PI/4 has a square base of width sqrt(2).
    // We scale it so the base perfectly matches the house dimensions + overhang.
    const roofScaleX = (width + 0.4) / Math.SQRT2;
    const roofScaleZ = (depth + 0.4) / Math.SQRT2;
    roof.scale.set(roofScaleX, 1, roofScaleZ);
    
    roof.position.y = height + roofH / 2;
    roof.rotation.y = Math.PI / 4; 
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);

    // Chimney
    if (Math.random() > 0.6) {
      const cW = 0.5 + seededRandom() * 0.4;
      const cD = 0.5 + seededRandom() * 0.4;
      const cH = 1.5 + seededRandom() * 2;
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cD), wMat); // same material as wall
      chimney.position.set((seededRandom()-0.5)*(width-1.5), height + roofH/2 + 0.5, (seededRandom()-0.5)*(depth-1.5));
      chimney.castShadow = true;
      group.add(chimney);
    }

    // Side Extension (Garage/Shed)
    const extX = width/2 + extW/2; // Attached to the right side
    if (hasExt) {
      const extBody = new THREE.Mesh(new THREE.BoxGeometry(extW, extH, extD), wMat);
      extBody.position.set(extX, extH/2, 0);
      extBody.castShadow = true;
      extBody.receiveShadow = true;
      group.add(extBody);

      const eRoofH = 1.0;
      const extRoof = new THREE.Mesh(new THREE.ConeGeometry(1, eRoofH, 4), rMat);
      extRoof.scale.set((extW + 0.4)/Math.SQRT2, 1, (extD + 0.4)/Math.SQRT2);
      extRoof.position.set(extX, extH + eRoofH/2, 0);
      extRoof.rotation.y = Math.PI / 4;
      extRoof.castShadow = true;
      group.add(extRoof);
    }

    // Front Door
    const doorW = 1.2;
    const doorH = 2.0;
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.1), matWood);
    door.position.set(-width/4, doorH/2, depth/2 + 0.05); // Offset door slightly
    door.castShadow = true;
    group.add(door);

    // Register door as a spawn point (in world space, just outside the door)
    {
      const c = Math.cos(rotation), s = Math.sin(rotation);
      const localDoorX = -width/4;
      const localDoorZ = depth/2 + 1.5; // 1.5m in front of door
      const worldX = x + localDoorX * c - localDoorZ * s;
      const worldZ = z + localDoorX * s + localDoorZ * c;
      if (Math.sqrt(worldX*worldX + worldZ*worldZ) < 100) {
        spawnPoints.push(new THREE.Vector3(worldX, 0, worldZ));
      }
    }

    // Awning over door
    if (Math.random() > 0.5) {
      const awning = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.8, 0.15, 1.2), rMat);
      awning.position.set(-width/4, doorH + 0.3, depth/2 + 0.5);
      awning.rotation.x = -0.2;
      awning.castShadow = true;
      group.add(awning);
    }

    // Damaged/boarded-up variant (20% of houses)
    const isDamaged = Math.random() < 0.2;
    if (isDamaged) {
      // Boarded-up windows: X planks over the window area
      const boardMat = makeGrungeMaterial(0x3a2a1a, 'crate');
      const boardGeo = new THREE.BoxGeometry(0.9, 0.12, 0.12);
      // A cross of planks on the front face
      const bx = width/4;
      const by = doorH/2 + 0.2;
      const bz = depth/2 + 0.08;
      const b1 = new THREE.Mesh(boardGeo, boardMat);
      b1.position.set(bx, by, bz);
      b1.rotation.z = Math.PI / 4;
      group.add(b1);
      const b2 = new THREE.Mesh(boardGeo, boardMat);
      b2.position.set(bx, by, bz);
      b2.rotation.z = -Math.PI / 4;
      group.add(b2);
      // Wall damage: dark rubble patch on one side
      const rubbleMat = makeGrungeMaterial(0x1a1a1a, 'wall');
      const rubbleGeo = new THREE.BoxGeometry(1.5 + Math.random(), 1.2 + Math.random() * 0.8, 0.12);
      const rubble = new THREE.Mesh(rubbleGeo, rubbleMat);
      rubble.position.set((Math.random()-0.5)*width*0.5, 0.6, depth/2 + 0.06);
      group.add(rubble);
    }

    // Determine the lighting state for the ENTIRE house
    const lightRoll = Math.random();
    let houseLightState = 'dark';
    if (lightRoll > 0.80) houseLightState = 'faint';     // 20%: Faint orange light
    // Remaining 80%: Dark

    function addWindow(wx, wy, wz, rotationY) {
      let activeMat = matWindowDark;
      if (houseLightState === 'faint') activeMat = matWindowDim;
      
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(wx, wy, wz);
      frame.rotation.y = rotationY;
      group.add(frame);

      const win = new THREE.Mesh(winGeo, activeMat);
      win.position.set(wx, wy, wz);
      win.rotation.y = rotationY;
      group.add(win);
    }

    const winY = doorH/2 + 0.2;

    // Front face (Z = depth/2)
    // Place windows every ~2 units, avoiding the door at x = -width/4
    for (let xOffset = -width/2 + 1; xOffset < width/2; xOffset += 1.8) {
      if (Math.abs(xOffset - (-width/4)) > 1.2) { // Far enough from door
         if (Math.random() > 0.1) addWindow(xOffset, winY, depth/2 + 0.05, 0);
      }
    }

    // Back face (Z = -depth/2)
    for (let xOffset = -width/2 + 1; xOffset < width/2; xOffset += 1.8) {
      if (Math.random() > 0.1) addWindow(xOffset, winY, -depth/2 - 0.05, Math.PI);
    }

    // Right Side face (X = width/2)
    for (let zOffset = -depth/2 + 1; zOffset < depth/2; zOffset += 1.8) {
      if (Math.random() > 0.1) addWindow(width/2 + 0.05, winY, zOffset, Math.PI / 2);
    }

    // Left Side face (X = -width/2)
    for (let zOffset = -depth/2 + 1; zOffset < depth/2; zOffset += 1.8) {
      if (Math.random() > 0.1) addWindow(-width/2 - 0.05, winY, zOffset, -Math.PI / 2);
    }

    scene.add(group);
    list.push(group);

    // Calculate rotated bounds for collision
    const c = Math.cos(rotation), s = Math.sin(rotation);
    
    // Main Body Collider
    const halfX = Math.abs(c) * width / 2 + Math.abs(s) * depth / 2;
    const halfZ = Math.abs(s) * width / 2 + Math.abs(c) * depth / 2;
    barrierColliders.push({ x, z, halfX, halfZ, maxY: height });

    // Extension Collider
    if (hasExt) {
      const dx = extX * c; 
      const dz = -extX * s;
      const eHalfX = Math.abs(c) * extW / 2 + Math.abs(s) * extD / 2;
      const eHalfZ = Math.abs(s) * extW / 2 + Math.abs(c) * extD / 2;
      barrierColliders.push({ x: x + dx, z: z + dz, halfX: eHalfX, halfZ: eHalfZ, maxY: extH });
    }
    
    placed++;
  }
  return list;
}

// ─── Wrecked Vehicles ───────────────────────────────────────────────
function createWreckedCar(scene, x, z, rotY, tiltZ = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  group.rotation.z = tiltZ;

  const carColors = [0x8b2020, 0x1a3a6a, 0x2a5a2a, 0x4a3a1a, 0x5a5a5a];
  const bodyMat = makeVehicleMaterial(carColors[Math.floor(Math.random() * carColors.length)]);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.2 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.2, metalness: 0.9 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
  const headLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffddaa, emissiveIntensity: 2.0 });
  const tailLightMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.0 });

  // Hood (front) - slightly sloped
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 1.9), bodyMat);
  hood.position.set(-1.3, 0.85, 0);
  hood.rotation.z = 0.05;
  hood.castShadow = true; group.add(hood);

  // Cabin - curved 60s style (approximated with slightly angled pieces)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 1.7), bodyMat);
  cabin.position.set(0.3, 1.25, 0);
  cabin.castShadow = true; group.add(cabin);

  // Roof (slightly rounded/thinner)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.6), bodyMat);
  roof.position.set(0.3, 1.65, 0);
  group.add(roof);

  // Trunk (rear)
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.9), bodyMat);
  trunk.position.set(1.8, 0.85, 0);
  trunk.castShadow = true; group.add(trunk);

  // Tailfins (classic 60s)
  const finGeo = new THREE.BoxGeometry(1.0, 0.3, 0.15);
  const leftFin = new THREE.Mesh(finGeo, bodyMat);
  leftFin.position.set(2.0, 1.1, 0.85);
  leftFin.rotation.z = -0.15;
  group.add(leftFin);
  
  const rightFin = new THREE.Mesh(finGeo, bodyMat);
  rightFin.position.set(2.0, 1.1, -0.85);
  rightFin.rotation.z = -0.15;
  group.add(rightFin);

  // Main body sides/floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.25, 1.95), bodyMat);
  floor.position.set(0.1, 0.6, 0);
  floor.castShadow = true; group.add(floor);

  // Windshield (cracked dark glass)
  const wshield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.65, 1.5), darkMat);
  wshield.position.set(-0.7, 1.35, 0);
  wshield.rotation.z = 0.3; // Slanted
  group.add(wshield);

  // Rear window
  const rwindow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 1.4), darkMat);
  rwindow.position.set(1.3, 1.3, 0);
  rwindow.rotation.z = -0.4; // Slanted
  group.add(rwindow);

  // Side windows
  const swindow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.71), darkMat);
  swindow.position.set(0.3, 1.25, 0);
  group.add(swindow);

  // Front grille (chrome)
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 1.6), chromeMat);
  grille.position.set(-2.3, 0.85, 0);
  group.add(grille);

  // Headlights
  const hLightL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8), headLightMat);
  hLightL.rotation.z = Math.PI / 2;
  hLightL.position.set(-2.35, 0.9, 0.6);
  group.add(hLightL);
  
  const hLightR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8), headLightMat);
  hLightR.rotation.z = Math.PI / 2;
  hLightR.position.set(-2.35, 0.9, -0.6);
  group.add(hLightR);

  // Taillights
  const tLightL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.3), tailLightMat);
  tLightL.position.set(2.6, 0.9, 0.8);
  group.add(tLightL);
  
  const tLightR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.3), tailLightMat);
  tLightR.position.set(2.6, 0.9, -0.8);
  group.add(tLightR);

  // Front bumper
  const fbumper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 2.1), chromeMat);
  fbumper.position.set(-2.4, 0.55, 0);
  group.add(fbumper);

  // Rear bumper
  const rbumper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 2.1), chromeMat);
  rbumper.position.set(2.6, 0.55, 0);
  group.add(rbumper);

  // 4 Wheels (cylinder on side)
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);
  const wheelPositions = [[-1.4, 0.38, 1.0], [-1.4, 0.38, -1.0], [1.4, 0.38, 1.0], [1.4, 0.38, -1.0]];
  wheelPositions.forEach((p, idx) => {
    if (Math.random() < 0.85 || idx > 1) { // some wheels missing
      const wheel = new THREE.Mesh(wheelGeo, rubberMat);
      wheel.position.set(...p);
      wheel.rotation.x = Math.PI / 2; // Fixed rotation axis
      wheel.castShadow = true;
      group.add(wheel);
      
      // Hubcaps
      const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8), chromeMat);
      hubcap.position.set(...p);
      hubcap.rotation.x = Math.PI / 2;
      group.add(hubcap);
    }
  });

  // Adjust Y so car sits on ground (accounting for tilt)
  group.position.y = tiltZ !== 0 ? 0.95 : 0;
  scene.add(group);

  // Collision boxes - separate hood and cabin so player can jump on
  const c = Math.cos(rotY), s = Math.sin(rotY);
  // Hood collider (lower, jumpable onto) - front half of car
  const hoodOffX = -1.3 * c;
  const hoodOffZ = 1.3 * s;
  barrierColliders.push({ x: x + hoodOffX, z: z + hoodOffZ, halfX: Math.abs(c)*1.2 + Math.abs(s)*1.0, halfZ: Math.abs(s)*1.2 + Math.abs(c)*1.0, maxY: 1.1 });
  // Cabin/roof collider (higher but still jumpable from hood)
  const cabOffX = 0.3 * c;
  const cabOffZ = -0.3 * s;
  barrierColliders.push({ x: x + cabOffX, z: z + cabOffZ, halfX: Math.abs(c)*1.2 + Math.abs(s)*0.9, halfZ: Math.abs(s)*1.2 + Math.abs(c)*0.9, maxY: 1.75 });
  // Trunk collider (same height as hood)
  const trunkOffX = 1.8 * c;
  const trunkOffZ = -1.8 * s;
  barrierColliders.push({ x: x + trunkOffX, z: z + trunkOffZ, halfX: Math.abs(c)*0.9 + Math.abs(s)*1.0, halfZ: Math.abs(s)*0.9 + Math.abs(c)*1.0, maxY: 1.1 });
}

function createWreckedBus(scene, x, z, rotY, onSide = false) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  if (onSide) group.rotation.z = Math.PI / 2;

  const busMat = makeVehicleMaterial(0xd4a020); // faded school bus yellow
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.2 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3, metalness: 0.8 });
  const headLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffddaa, emissiveIntensity: 1.5 });
  const tailLightMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.0 });

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(9.0, 2.8, 2.6), busMat);
  body.position.set(0, 1.4, 0);
  body.castShadow = true; group.add(body);
  
  // Roof (slightly curved)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.2, 2.4), busMat);
  roof.position.set(0, 2.9, 0);
  group.add(roof);

  // Front face (flatter nose for 60s look)
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 2.5), busMat);
  front.position.set(-4.6, 1.2, 0);
  front.castShadow = true; group.add(front);
  
  // Front grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.8), chromeMat);
  grille.position.set(-4.8, 1.0, 0);
  group.add(grille);
  
  // Front Bumper
  const fbumper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 2.7), chromeMat);
  fbumper.position.set(-4.8, 0.4, 0);
  group.add(fbumper);
  
  // Rear Bumper
  const rbumper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 2.7), chromeMat);
  rbumper.position.set(4.6, 0.4, 0);
  group.add(rbumper);

  // Headlights
  const hLightL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8), headLightMat);
  hLightL.rotation.z = Math.PI / 2;
  hLightL.position.set(-4.85, 1.2, 1.0);
  group.add(hLightL);
  
  const hLightR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8), headLightMat);
  hLightR.rotation.z = Math.PI / 2;
  hLightR.position.set(-4.85, 1.2, -1.0);
  group.add(hLightR);
  
  // Taillights
  const tLightL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), tailLightMat);
  tLightL.position.set(4.55, 1.0, 1.1);
  group.add(tLightL);
  
  const tLightR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), tailLightMat);
  tLightR.position.set(4.55, 1.0, -1.1);
  group.add(tLightR);

  // Destination sign box on top front
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x220000, emissiveIntensity: 0.3 }));
  sign.position.set(-4.5, 2.8, 0);
  group.add(sign);
  
  // Front Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 2.4), darkMat);
  windshield.position.set(-4.75, 2.0, 0);
  windshield.rotation.z = 0.1;
  group.add(windshield);
  
  // Double doors
  const doors = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.1), darkMat);
  doors.position.set(-3.5, 1.2, 1.35);
  group.add(doors);

  // Side windows evenly spaced
  for (let i = -2; i <= 3; i++) {
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.1), darkMat);
    // Left side
    winFrame.position.set(i * 1.2, 1.9, 1.35);
    group.add(winFrame.clone());
    // Right side (some missing/smashed)
    if (Math.random() > 0.3) {
      const rw = winFrame.clone();
      rw.position.set(i * 1.2, 1.9, -1.35);
      group.add(rw);
    }
  }

  // Wheels (6 total, 2 front, 4 rear dual)
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12);
  const wPositions = [[-3.5, 0.5, 1.4], [-3.5, 0.5, -1.4], [3.0, 0.5, 1.55], [3.0, 0.5, 1.1], [3.0, 0.5, -1.55], [3.0, 0.5, -1.1]];
  wPositions.forEach(p => {
    const w = new THREE.Mesh(wheelGeo, blackMat);
    w.position.set(...p);
    w.rotation.x = Math.PI / 2; // Fixed rotation axis
    w.castShadow = true;
    group.add(w);
    
    // Hubcaps for bus
    if (Math.random() > 0.1) {
        const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8), chromeMat);
        hubcap.position.set(...p);
        hubcap.rotation.x = Math.PI / 2;
        group.add(hubcap);
    }
  });

  // Adjust Y for on-side
  group.position.y = onSide ? 1.3 : 0;
  scene.add(group);

  // Collision
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const hw = 4.8, hd = 1.4;
  barrierColliders.push({ x, z, halfX: Math.abs(c)*hw + Math.abs(s)*hd, halfZ: Math.abs(s)*hw + Math.abs(c)*hd, maxY: onSide ? 2.6 : 3.5 });
}

function createVehicles() {
  const s = getScene();
  // 4 wrecked cars at strategic positions around the village
  createWreckedCar(s,  18,  12, 0.6,  0);
  createWreckedCar(s, -20,  -8, 2.1,  0);
  createWreckedCar(s,  -8,  22, 1.2,  Math.PI * 0.45); // tilted
  createWreckedCar(s,  28, -18, 3.8,  0);
  // 2 wrecked buses
  createWreckedBus(s,   5,  -5, 0.3,  false);  // blocking village centre
  createWreckedBus(s, -35,  15, 1.8,  true);   // on its side on outskirts
}

// ─── Debris & Props ──────────────────────────────────────────────────
function createDebris() {
  const s = getScene();
  const rubbleMat = makeGrungeMaterial(0x3a3530, 'wall');
  const crateMat  = makeGrungeMaterial(0x4a3a2a, 'crate');
  const sandbagMat = makeGrungeMaterial(0x8a7a50, 'wall');
  const barrelMats = [
    makeBarrelMaterial(0x7a1515), // rusted red
    makeBarrelMaterial(0x2a4a25), // military green
    makeBarrelMaterial(0xaaaa00), // hazard yellow
  ];

  // ── Barrels in clusters ──
  const barrelPositions = [
    { x:  12, z:  -6 }, { x: -15, z:  10 }, { x:  30, z:   5 },
    { x:  -5, z: -28 }, { x:  22, z:  30 }, { x: -30, z: -15 },
  ];
  barrelPositions.forEach(({ x, z }) => {
    const count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const bx = x + (Math.random() - 0.5) * 4;
      const bz = z + (Math.random() - 0.5) * 4;
      const mat = barrelMats[Math.floor(Math.random() * barrelMats.length)];
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.0, 10), mat);
      const isKnocked = Math.random() < 0.35;
      if (isKnocked) {
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(bx, 0.4, bz);
      } else {
        barrel.position.set(bx, 0.5, bz);
      }
      barrel.castShadow = true;
      s.add(barrel);
      barrierColliders.push({ x: bx, z: bz, halfX: 0.5, halfZ: 0.5, maxY: isKnocked ? 0.8 : 1.0 });
    }
  });

  // ── Wooden crates ──
  const cratePositions = [
    [10, -12], [-12, 20], [25, 8], [-30, -8], [18, -30],
    [-22, -5], [38, 15], [-15, -35], [5, 25], [32, -22],
    [-28, 18], [15, 38], [-38, 5], [22, -18], [-5, -40],
    [40, -30], [-10, 12], [28, -8], [-20, 35], [8, -22]
  ];
  cratePositions.forEach(([cx, cz]) => {
    const stack = 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < stack; i++) {
      const size = 0.8 + Math.random() * 0.4;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
      crate.position.set(
        cx + (Math.random() - 0.5) * 1.5,
        size / 2 + i * size,
        cz + (Math.random() - 0.5) * 1.5
      );
      crate.rotation.y = Math.random() * Math.PI;
      crate.castShadow = true;
      s.add(crate);
    }
    barrierColliders.push({ x: cx, z: cz, halfX: 0.7, halfZ: 0.7, maxY: stack * 1.2 });
  });

  // ── Sandbag barricades ──
  const sandbagPositions = [
    { x:  2, z: -18, rot: 0 },
    { x: -18, z:  2, rot: Math.PI / 2 },
    { x:  20, z:  20, rot: Math.PI / 4 },
    { x: -20, z: -22, rot: 0.8 },
  ];
  sandbagPositions.forEach(({ x, z, rot }) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    // Two stacked rows of bags
    for (let row = 0; row < 2; row++) {
      for (let bag = -2; bag <= 2; bag++) {
        const bagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), sandbagMat);
        bagMesh.position.set(bag * 0.72, row * 0.42 + 0.21, 0);
        bagMesh.rotation.y = (Math.random() - 0.5) * 0.2;
        bagMesh.castShadow = true;
        group.add(bagMesh);
      }
    }
    s.add(group);
    barrierColliders.push({ x, z, halfX: 2.0, halfZ: 0.5, maxY: 0.8 });
  });
}

// ─── Street Props ────────────────────────────────────────────────────
function createStreetProps() {
  const s = getScene();
  const poleMat = makeGrungeMaterial(0x2a2520, 'metal');

  const polePositions = [
    [15, -40], [-40, 12], [40, -15], [-15, 40]
  ];
  polePositions.forEach(([px, pz]) => {
    const group = new THREE.Group();
    group.position.set(px, 0, pz);
    group.rotation.y = Math.random() * Math.PI;

    // Slightly leaning pole
    const leanX = (Math.random() - 0.5) * 0.15;
    const leanZ = (Math.random() - 0.5) * 0.15;

    // Main pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 8.0, 8), poleMat);
    pole.position.y = 4.0;
    pole.rotation.x = leanX;
    pole.rotation.z = leanZ;
    pole.castShadow = true;
    group.add(pole);

    // Crossbar
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 0.1), poleMat);
    crossbar.position.set(0, 7.8, 0);
    crossbar.castShadow = true;
    group.add(crossbar);

    // Dangling broken wire (thin flat box)
    const wire = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.5, 0.04), poleMat);
    wire.position.set(0.8, 5.5, 0);
    wire.rotation.z = 0.4;
    group.add(wire);

    s.add(group);
    barrierColliders.push({ x: px, z: pz, halfX: 0.3, halfZ: 0.3, maxY: 10 });
  });
}

function createWell() {
  const group = new THREE.Group();
  const stoneMat = makeGrungeMaterial(0x555555, 'wall');
  const woodMat = makeGrungeMaterial(0x4a3a2a, 'crate');
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1a3a5a, roughness: 0.1, metalness: 0.2 });

  // Stone base ring
  const baseGeo = new THREE.CylinderGeometry(1.1, 1.2, 0.9, 12);
  const base = new THREE.Mesh(baseGeo, stoneMat);
  base.position.y = 0.45;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Inner hole (dark water at bottom)
  const holeGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.85, 12);
  const hole = new THREE.Mesh(holeGeo, new THREE.MeshStandardMaterial({ color: 0x080808 }));
  hole.position.y = 0.425;
  group.add(hole);

  // Water surface
  const waterGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.05, 12);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = 0.1;
  group.add(water);

  // 4 stone pillars
  const pillarGeo = new THREE.BoxGeometry(0.22, 1.4, 0.22);
  const pillarPositions = [[0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75]];
  for (const [px, pz] of pillarPositions) {
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.set(px, 1.55, pz);
    pillar.castShadow = true;
    group.add(pillar);
  }

  // Horizontal wooden beam across the top
  const beamGeo = new THREE.BoxGeometry(0.18, 0.18, 1.8);
  const beam = new THREE.Mesh(beamGeo, woodMat);
  beam.position.set(0, 2.3, 0);
  beam.castShadow = true;
  group.add(beam);

  // Winding axle in the center
  const axleGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8);
  const axle = new THREE.Mesh(axleGeo, woodMat);
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0, 2.3, 0);
  group.add(axle);

  // Rope hanging down
  const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 4);
  const rope = new THREE.Mesh(ropeGeo, ropeMat);
  rope.position.set(0, 1.4, 0);
  group.add(rope);

  group.position.set(0, 0, 0); // Center of the map
  scene.add(group);

  // Collision: ring around the well
  barrierColliders.push({ x: 0, z: 0, halfX: 1.3, halfZ: 1.3, maxY: 2.5 });

  // Register 4 spawn points around the well (rising from the well)
  const wellRadius = 3.5;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    spawnPoints.push(new THREE.Vector3(Math.cos(a) * wellRadius, 0, Math.sin(a) * wellRadius));
  }
}

function createMountains() {
  const geo = new THREE.CylinderGeometry(115, 115, 60, 64, 1, true);
  const posAttribute = geo.attributes.position;
  const vertex = new THREE.Vector3();
  
  for(let i = 0; i < posAttribute.count; i++) {
    vertex.fromBufferAttribute(posAttribute, i);
    // Displace top edge
    if (vertex.y > 0) {
      const angle = Math.atan2(vertex.z, vertex.x);
      // Combine multiple sine waves for jagged peaks
      const noise = Math.sin(angle * 7) * 8 
                  + Math.sin(angle * 13) * 4
                  + Math.sin(angle * 29) * 2;
      vertex.y += noise + 8; // Taller and jagged
    }
    posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geo.computeVertexNormals();

  const rockTex = makeGrungeMaterial(0x0a0c11, 'rock').map;

  const mat = new THREE.MeshStandardMaterial({ 
    map: rockTex,
    color: 0x0a0c11, // Very dark base
    roughness: 1.0,
    metalness: 0.1,
    fog: true, 
    side: THREE.BackSide // Render inside out since it surrounds the map
  });
  
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 8; // Lift slightly above ground
  scene.add(mesh);
}

export function updateAtmosphere(time) {
  for (const f of flickerLights) {
    if (f.isStreet) {
      // Broken fluorescent tube flicker
      const noise = Math.sin(time * 15 + f.phase) * Math.cos(time * 35 + f.phase);
      const isOff = noise > 0.8;
      const intensity = isOff ? f.base * 0.05 : f.base;
      f.light.intensity = intensity;
      if (f.bulb) {
        f.bulb.emissiveIntensity = isOff ? 0.2 : 4.0;
      }
    } else {
      // Fire flicker
      const flicker = 0.7 + 0.3 * Math.sin(time * 8 + f.phase) + (Math.random() - 0.5) * 0.15;
      f.light.intensity = f.base * flicker;
    }
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getGround() { return ground; }
export function getBarriers() { return barriers; }
export function getBarrierColliders() { return barrierColliders; }
export function getSpawnPoints() { return spawnPoints; }

export function getGroundHeight(x, z, radius) {
  let highest = 0;
  for (const b of barrierColliders) {
    const dx = x - b.x;
    const dz = z - b.z;
    const overlapX = b.halfX + radius - Math.abs(dx);
    const overlapZ = b.halfZ + radius - Math.abs(dz);
    if (overlapX > 0 && overlapZ > 0) {
      const maxY = b.maxY !== undefined ? b.maxY : 1000;
      if (maxY > highest) highest = maxY;
    }
  }
  return highest;
}

export function resolveCollision(pos, radius) {
  const feetY = pos.y - 1.7;
  for (const b of barrierColliders) {
    const maxY = b.maxY !== undefined ? b.maxY : 1000;
    if (feetY >= maxY - 0.1) continue;
    const dx = pos.x - b.x;
    const dz = pos.z - b.z;
    const overlapX = b.halfX + radius - Math.abs(dx);
    const overlapZ = b.halfZ + radius - Math.abs(dz);
    if (overlapX > 0 && overlapZ > 0) {
      if (overlapX < overlapZ) {
        pos.x += dx >= 0 ? overlapX : -overlapX;
      } else {
        pos.z += dz >= 0 ? overlapZ : -overlapZ;
      }
    }
  }
}

export function render() {
  renderer.render(scene, camera);
}
