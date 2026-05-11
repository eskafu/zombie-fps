import * as THREE from 'three';

export function makeAsphaltTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 35;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${60 + Math.random() * 40},${55 + Math.random() * 30},${50 + Math.random() * 25},0.5)`;
    const r = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(100,100,100,0.4)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const x1 = Math.random() * size;
    const y1 = Math.random() * size;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + (Math.random() - 0.5) * 40, y1 + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(25, 25);
  tex.anisotropy = 4;
  return tex;
}

export function makeSkyTexture() {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#020205');
  grad.addColorStop(0.4, '#030508');
  grad.addColorStop(1, '#0a0510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 600; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.7;
    const a = 0.2 + Math.random() * 0.6;
    const sz = 0.4 + Math.random() * 0.3;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, sz, sz);
  }

  const moonX = w * 0.25;
  const moonY = h * 0.25;
  const moonR = 60;
  const moonGrad = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, moonR);
  moonGrad.addColorStop(0, '#fffef0');
  moonGrad.addColorStop(0.7, '#ffffdd');
  moonGrad.addColorStop(1, 'rgba(255,255,220,0)');
  ctx.fillStyle = moonGrad;
  ctx.fillRect(moonX - moonR, moonY - moonR, moonR * 2, moonR * 2);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
