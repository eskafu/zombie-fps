import * as THREE from 'three';
import { toonVertexShader, toonFragmentShader, outlineVertexShader, outlineFragmentShader } from './shaders.js';

export function createCelMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }
    },
    vertexShader: toonVertexShader,
    fragmentShader: toonFragmentShader,
    side: THREE.FrontSide
  });
}

export function createOutlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOutlineWidth: { value: 0.004 }
    },
    vertexShader: outlineVertexShader,
    fragmentShader: outlineFragmentShader,
    side: THREE.BackSide
  });
}

export function applyOutlineToMesh(mesh) {
  const outline = new THREE.Mesh(mesh.geometry, createOutlineMaterial());
  outline.userData.isOutline = true;
  outline.scale.setScalar(1.05);
  mesh.add(outline);
}

export function applyToonToGroup(group, color) {
  group.traverse(child => {
    if (child.isMesh && !child.userData.isOutline) {
      child.material = createCelMaterial(color);
      applyOutlineToMesh(child);
    }
  });
}
