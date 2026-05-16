let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playShot(weaponType) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  if (weaponType === 'katana') {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(450, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (weaponType === 'shotgun') {
    // Shotgun: deeper, louder, longer
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    noise.connect(noiseGain);
    gain.connect(ctx.destination);
    noiseGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    noise.start(now);
    noise.stop(now + 0.15);
  } else {
    // Pistol sound (original)
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    noise.connect(noiseGain);
    gain.connect(ctx.destination);
    noiseGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
    noise.start(now);
    noise.stop(now + 0.1);
  }
}

export function playZombieGrowl(distance) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const volume = Math.max(0.03, Math.min(0.15, 0.15 - distance / 50));

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const freq = 40 + Math.random() * 30;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.linearRampToValueAtTime(freq * 0.7, now + 0.4);
  osc.frequency.linearRampToValueAtTime(freq * 1.2, now + 0.7);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, now);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.8);
}

export function playBatScreech(distance) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const volume = Math.max(0.01, Math.min(0.08, 0.08 - distance / 50));

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  const freq = 1500 + Math.random() * 500;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.2);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

export function playDogBark(distance) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const volume = Math.max(0.02, Math.min(0.12, 0.12 - distance / 50));

  // Growl - low rough sound
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(120, now + 0.1);
  osc.frequency.linearRampToValueAtTime(60, now + 0.3);

  // Modulation for the "rough" texture
  const mod = ctx.createOscillator();
  mod.type = 'sawtooth';
  mod.frequency.value = 35; // Rapid modulation
  const modGain = ctx.createGain();
  modGain.gain.value = 40;
  
  mod.connect(modGain);
  modGain.connect(osc.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, now);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  mod.start(now);
  osc.start(now);
  mod.stop(now + 0.4);
  osc.stop(now + 0.4);
}

export function playPickupSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

export function playReloadSound(isShotgun) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Click sound
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);

  if (isShotgun) {
    // Shell insert sound
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(300, now + 0.3);
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.06, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.3);
    osc2.stop(now + 0.45);
  }
}
