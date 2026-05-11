import * as THREE from 'three';
import { makeAsphaltTexture, makeSkyTexture } from './textures.js';
import { createCelMaterial, applyOutlineToMesh, applyToonToGroup } from './celshade.js';

let scene, camera, renderer;
let ground, barriers, lights;
const barrierColliders = [];
const flickerLights = [];

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
  scene.fog = new THREE.Fog(0x0a0510, 22, 75);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 1.7, 0);

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
  barriers = createBarriers();

  window.addEventListener('resize', onResize);
}

function createLights() {
  const ambient = new THREE.AmbientLight(0x1a1a2e, 0.35);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xccddff, 0.75);
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

  const center = new THREE.PointLight(0xff6633, 0.6, 22);
  center.position.set(0, 3, 0);
  scene.add(center);
  flickerLights.push({ light: center, base: 0.6, phase: 0 });

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const r = 25 + Math.random() * 15;
    const fire = new THREE.PointLight(0xff8844, 0.5, 16);
    fire.position.set(Math.cos(angle) * r, 1.5, Math.sin(angle) * r);
    scene.add(fire);
    flickerLights.push({ light: fire, base: 0.5, phase: Math.random() * Math.PI * 2 });
  }

  return { ambient, moon };
}

function createGround() {
  const tex = makeAsphaltTexture();
  const geo = new THREE.PlaneGeometry(120, 120);
  const mat = createCelMaterial(0x888888);
  mat.uniforms.uColor.value.set(0x888888);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function createBarriers() {
  const list = [];
  const matCrate = createCelMaterial(0x6a5a3a);
  const matMetal = createCelMaterial(0x5a5a5a);
  const matWall = createCelMaterial(0x7a6a5a);

  const count = 18;
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < 200) {
    attempts++;
    const x = (seededRandom() - 0.5) * 80;
    const z = (seededRandom() - 0.5) * 80;
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

    const type = seededRandom();
    let mesh, halfX, halfZ;
    if (type < 0.4) {
      const w = 1.5 + seededRandom() * 1.2;
      const d = 1.5 + seededRandom() * 1.2;
      const h = 1.6 + seededRandom() * 0.8;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matCrate);
      mesh.position.set(x, h / 2, z);
      mesh.rotation.y = seededRandom() * Math.PI;
      const c = Math.cos(mesh.rotation.y), s = Math.sin(mesh.rotation.y);
      halfX = Math.abs(c) * w / 2 + Math.abs(s) * d / 2;
      halfZ = Math.abs(s) * w / 2 + Math.abs(c) * d / 2;
    } else if (type < 0.7) {
      const r = 0.6 + seededRandom() * 0.3;
      const h = 1.2 + seededRandom() * 0.6;
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), matMetal);
      mesh.position.set(x, h / 2, z);
      halfX = halfZ = r;
    } else {
      const w = 3 + seededRandom() * 2;
      const d = 0.5 + seededRandom() * 0.4;
      const h = 1.8 + seededRandom() * 0.6;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matWall);
      mesh.position.set(x, h / 2, z);
      mesh.rotation.y = seededRandom() * Math.PI;
      const c = Math.cos(mesh.rotation.y), s = Math.sin(mesh.rotation.y);
      halfX = Math.abs(c) * w / 2 + Math.abs(s) * d / 2;
      halfZ = Math.abs(s) * w / 2 + Math.abs(c) * d / 2;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    applyOutlineToMesh(mesh);
    scene.add(mesh);
    list.push(mesh);
    barrierColliders.push({ x, z, halfX, halfZ });
    placed++;
  }
  return list;
}

export function updateAtmosphere(time) {
  for (const f of flickerLights) {
    const flicker = 0.7 + 0.3 * Math.sin(time * 8 + f.phase) + (Math.random() - 0.5) * 0.15;
    f.light.intensity = f.base * flicker;
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

export function resolveCollision(pos, radius) {
  for (const b of barrierColliders) {
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
