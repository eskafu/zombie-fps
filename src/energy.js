import * as THREE from 'three';
import { getScene } from './scene.js';
import { getPlayerPosition } from './player.js';
import { gameState } from './game-state.js';
import { createCelMaterial } from './celshade.js';

const SWITCH_POSITIONS = [
  new THREE.Vector3(-15, 0, 18),
  new THREE.Vector3(25, 0, -22),
  new THREE.Vector3(0, 0, 45)
];
const INTERACT_RADIUS = 3.0;

const switches = [];

export function initEnergySwitches() {
  const scene = getScene();
  
  SWITCH_POSITIONS.forEach((pos, i) => {
    const group = new THREE.Group();
    group.position.copy(pos);
    
    // Box (Standing on ground)
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.4, 0.2),
      createCelMaterial(0x333333)
    );
    box.position.y = 0.7;
    group.add(box);

    // Lever base
    const leverBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.4, 0.1),
      createCelMaterial(0x111111)
    );
    leverBase.position.set(0, 0.4, 0.12);
    box.add(leverBase);

    // Light Mesh
    const lightGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red initially
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.set(0, 0.6, 0.12);
    box.add(lightMesh);

    // Real Point Light for visibility
    const pLight = new THREE.PointLight(0xff0000, 1.5, 12);
    pLight.position.set(0, 0.6, 0.2);
    box.add(pLight);

    scene.add(group);
    
    switches.push({
      group,
      lightMesh,
      pLight,
      active: false,
      pos: pos.clone()
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') tryInteractSwitch();
  });
}

export function tryInteractSwitch() {
  const playerPos = getPlayerPosition();
  for (let s of switches) {
    if (s.active) continue;
    const dx = playerPos.x - s.pos.x;
    const dz = playerPos.z - s.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < INTERACT_RADIUS) {
      s.active = true;
      s.lightMesh.material.color.setHex(0x00ff00); // Green
      s.pLight.color.setHex(0x00ff00);
      gameState.activateSwitch();
      return true;
    }
  }
  return false;
}

export function getNearestSwitchLabel() {
  const playerPos = getPlayerPosition();
  for (let s of switches) {
    if (s.active) continue;
    const dx = playerPos.x - s.pos.x;
    const dz = playerPos.z - s.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < INTERACT_RADIUS) return 'LIGAR ENERGIA';
  }
  return '';
}
