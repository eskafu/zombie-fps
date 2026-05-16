import * as THREE from 'three';
import { getScene } from './scene.js';
import { getPlayerPosition } from './player.js';
import { gameState } from './game-state.js';
import { createCelMaterial, applyOutlineToMesh } from './celshade.js';

const PERK_DEFS = {
  juggernog: {
    name: 'Juggernog',
    cost: 2500,
    color: 0xaa2211,
    pos: new THREE.Vector3(30, 0, 25),
    needsPower: true
  },
  speedCola: {
    name: 'Speed Cola',
    cost: 3000,
    color: 0x228833,
    pos: new THREE.Vector3(-30, 0, -25),
    needsPower: true
  },
  quickRevive: {
    name: 'Quick Revive',
    cost: 1500,
    color: 0x2244aa,
    pos: new THREE.Vector3(-10, 0, 10),
    needsPower: true
  }
};

const INTERACT_RADIUS = 3.5;
const machines = {};

export function initPerks() {
  const scene = getScene();

  for (const [id, def] of Object.entries(PERK_DEFS)) {
    const group = new THREE.Group();
    group.position.copy(def.pos);

    // Machine body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.0, 0.8),
      createCelMaterial(def.color)
    );
    body.position.y = 1.0;
    applyOutlineToMesh(body);
    group.add(body);

    // Top logo/sign
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.4, 0.4),
      createCelMaterial(0xeeeeee)
    );
    sign.position.y = 1.1;
    sign.position.z = 0.25;
    body.add(sign);

    // Bright light on top
    const light = new THREE.PointLight(def.color, 4.0, 30);
    light.position.y = 2.5;
    group.add(light);

    scene.add(group);
    machines[id] = { group, light, body, def };
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') tryBuyPerk();
  });
}

export function updatePerks(delta) {
  const isPowerOn = gameState.isPowerOn;

  for (const [id, m] of Object.entries(machines)) {
    // Machine is visible only if Quick Revive hasn't disappeared
    if (id === 'quickRevive' && gameState.quickReviveUses >= 2 && !gameState.perks.quickRevive) {
        m.group.visible = false;
        continue;
    }

    if (isPowerOn) {
      // Full bright color
      m.body.material.uniforms.uColor.value.setHex(m.def.color);
      m.light.intensity = 4.0;
    } else {
      // Very dark version (10% of brightness)
      const darkColor = new THREE.Color(m.def.color).multiplyScalar(0.1);
      m.body.material.uniforms.uColor.value.copy(darkColor);
      m.light.intensity = 0;
    }
  }
}

export function tryBuyPerk() {
  const playerPos = getPlayerPosition();
  for (const [id, m] of Object.entries(machines)) {
    const dx = playerPos.x - m.def.pos.x;
    const dz = playerPos.z - m.def.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < INTERACT_RADIUS) {
      // Quick Revive disappearance rule
      if (id === 'quickRevive' && gameState.quickReviveUses >= 2) return false;
      
      // Power rule
      if (m.def.needsPower && !gameState.isPowerOn) return false;

      const success = gameState.buyPerk(id, m.def.cost);
      if (success) {
        // Power Tripwire: Each purchase resets power
        gameState.resetPower();
        import('./energy.js').then(m => m.resetSwitches());
        
        if (id === 'quickRevive' && gameState.quickReviveUses >= 2) {
          m.group.visible = false;
          m.light.visible = false;
        }
      }
      return success;
    }
  }
  return false;
}

export function getNearestPerkLabel() {
  const playerPos = getPlayerPosition();
  for (const [id, m] of Object.entries(machines)) {
    const dx = playerPos.x - m.def.pos.x;
    const dz = playerPos.z - m.def.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < INTERACT_RADIUS) {
      if (id === 'quickRevive' && gameState.quickReviveUses >= 2) return '';
      if (m.def.needsPower && !gameState.isPowerOn) return 'SEM ENERGIA';
      if (gameState.perks[id]) return `${id.toUpperCase()} ADQUIRIDO`;
      return `COMPRAR ${m.def.name.toUpperCase()} (${m.def.cost})`;
    }
  }
  return '';
}
