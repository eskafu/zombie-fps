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
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(50, 50);
  tex.anisotropy = 4;
  return tex;
}

export function makeGrungeMaterial(hexColor, type = 'clothes') {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // Parse hex
  let r = (hexColor >> 16) & 255;
  let g = (hexColor >> 8) & 255;
  let b = hexColor & 255;

  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;

  // Add noise
  const noiseIntensity = type === 'skin' ? 15 : 35;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * noiseIntensity;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // Add dirt/blood splatters
  const splatterCount = type === 'skin' ? 5 : 15;
  for (let i = 0; i < splatterCount; i++) {
    const isBlood = Math.random() > 0.7;
    ctx.fillStyle = isBlood ? 'rgba(70, 10, 10, 0.5)' : 'rgba(30, 30, 30, 0.4)';
    const rad = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // If wood/metal
  if (type === 'crate') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for(let i=0; i<4; i++){
       ctx.fillRect(0, Math.random()*size, size, 1 + Math.random()*2);
    }
  } else if (type === 'metal') {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for(let i=0; i<8; i++){
       ctx.fillRect(Math.random()*size, 0, 1, size);
    }
  } else if (type === 'wall') {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for(let i=0; i<15; i++) {
      ctx.fillRect(0, Math.random()*size, size, 1);
      ctx.fillRect(Math.random()*size, 0, 1, size);
    }
  } else if (type === 'roof') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for(let i=0; i<10; i++) {
      ctx.fillRect(i * (size/10), 0, 2, size); // vertical lines
      ctx.fillRect(0, i * (size/10), size, 2); // horizontal shingles
    }
  } else if (type === 'rock') {
    for(let i=0; i<40; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.3})`;
      // thick vertical bands
      ctx.fillRect(Math.random()*size, 0, 2 + Math.random()*12, size);
      // horizontal cracks
      ctx.fillStyle = `rgba(0,0,0,${0.2 + Math.random() * 0.4})`;
      ctx.fillRect(0, Math.random()*size, size, 1 + Math.random()*2);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Use nearest filter for a sharper, grittier retro-realistic look
  tex.magFilter = THREE.NearestFilter;

  const roughness = type === 'skin' ? 0.6 : (type === 'metal' ? 0.3 : (type === 'rock' ? 1.0 : 0.95));
  const metalness = type === 'metal' ? 0.6 : 0.0;

  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: roughness,
    metalness: metalness
  });
}

export function makeWoodPlankMaterial(hexColor, horizontal = true) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  let r = (hexColor >> 16) & 255;
  let g = (hexColor >> 8) & 255;
  let b = hexColor & 255;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, size, size);

  // Planks
  const numPlanks = 8;
  const plankThickness = size / numPlanks;
  
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i <= numPlanks; i++) {
    if (horizontal) {
      ctx.fillRect(0, i * plankThickness - 1, size, 2);
    } else {
      ctx.fillRect(i * plankThickness - 1, 0, 2, size);
    }
  }

  // Wood grain & dirt noise
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // Grain lines along the plank
    const x = (i / 4) % size;
    const y = Math.floor((i / 4) / size);
    const grain = horizontal 
      ? Math.sin(x * 0.1 + y * 2) * 15 
      : Math.sin(y * 0.1 + x * 2) * 15;
      
    const n = (Math.random() - 0.5) * 20 + grain;
    
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4); // Tile the texture
  tex.magFilter = THREE.NearestFilter;

  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.9,
    metalness: 0.0
  });
}

export function makeVehicleMaterial(hexColor) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  let r = (hexColor >> 16) & 255;
  let g = (hexColor >> 8) & 255;
  let b = hexColor & 255;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, size, size);

  // Dirt edge gradients
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(30,20,10,0)');
  grad.addColorStop(0.8, 'rgba(30,20,10,0.4)');
  grad.addColorStop(1, 'rgba(30,20,10,0.8)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Rust spots
  for(let i=0; i<30; i++) {
    ctx.fillStyle = 'rgba(70,30,10,0.6)';
    ctx.beginPath();
    ctx.arc(Math.random()*size, Math.random()*size, Math.random()*4, 0, Math.PI*2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;

  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.4,
    metalness: 0.5
  });
}

export function makeBarrelMaterial(hexColor) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  let r = (hexColor >> 16) & 255;
  let g = (hexColor >> 8) & 255;
  let b = hexColor & 255;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, size, size);

  // Horizontal barrel ribs
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 5; i++) {
    const y = (i / 5) * size;
    ctx.fillRect(0, y, size, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, y + 4, size, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
  }

  // Heavy rust/corrosion blotches
  for (let i = 0; i < 40; i++) {
    const rx = Math.random() * size;
    const ry = Math.random() * size;
    const rr = 1 + Math.random() * 6;
    ctx.fillStyle = `rgba(${60 + Math.random()*40}, ${15 + Math.random()*15}, ${5 + Math.random()*10}, ${0.4 + Math.random()*0.5})`;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  // General noise
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 30;
    d[i]   = Math.max(0, Math.min(255, d[i] + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;

  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.4 });
}

export function makeSkyTexture() {
  const w = 2048, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // Deep night sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#010103');
  grad.addColorStop(0.3, '#020308');
  grad.addColorStop(0.7, '#050712');
  grad.addColorStop(1, '#080510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Stars (thousands of them, varying opacity)
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.8;
    const a = Math.random() * Math.random(); // skew towards dim stars
    const sz = 0.2 + Math.random() * 0.6; // smaller stars
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clouds / Nebula noise (faked with overlapping faint radial gradients)
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h * 0.6;
    const cr = 150 + Math.random() * 350;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    cg.addColorStop(0, 'rgba(30, 40, 60, 0.12)');
    cg.addColorStop(1, 'rgba(30, 40, 60, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon
  const moonX = w * 0.25;
  const moonY = h * 0.35;
  const moonR = 40;
  
  // Huge moon glow
  const glowGrad = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 12);
  glowGrad.addColorStop(0, 'rgba(200, 220, 255, 0.3)');
  glowGrad.addColorStop(0.2, 'rgba(100, 150, 255, 0.08)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(moonX - moonR * 12, moonY - moonR * 12, moonR * 24, moonR * 24);

  // Moon base
  ctx.fillStyle = '#fffef0';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  // Moon craters (clipped inside moon)
  ctx.save();
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.clip(); 
  for(let i=0; i<15; i++) {
    const cx = moonX + (Math.random() - 0.5) * moonR * 1.5;
    const cy = moonY + (Math.random() - 0.5) * moonR * 1.5;
    const cr = 2 + Math.random() * 8;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    // highlight edge to give depth
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(cx - 1, cy - 1, cr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
