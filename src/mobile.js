// ═══════════════════════════════════════════════════════════════
// MOBILE CONTROLS — Virtual Joysticks + Buttons
// ═══════════════════════════════════════════════════════════════

const JOYSTICK_SIZE = 140;     // base diameter in px
const THUMB_SIZE = 70;         // thumb diameter in px
const FIRE_SIZE = 80;          // fire button diameter in px

// ── Mobile detection ──
export function isMobile() {
  return ('ontouchstart' in window && navigator.maxTouchPoints > 0)
      || (window.innerWidth <= 1024 && 'ontouchstart' in window);
}

// ═══════════════════════════════════════════════════════════════
// VirtualJoystick — single thumbstick
// ═══════════════════════════════════════════════════════════════
class VirtualJoystick {
  constructor(containerId, opts = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.relative = opts.relative || false;  // relative = trackpad-style for look
    this.value = { x: 0, y: 0 };
    this.active = false;
    this.touchId = null;
    this.baseX = 0;
    this.baseY = 0;
    this.lastX = 0;
    this.lastY = 0;

    // Build DOM
    this.container.style.cssText = `
      position: fixed;
      width: ${JOYSTICK_SIZE}px; height: ${JOYSTICK_SIZE}px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      border: 2px solid rgba(255,255,255,0.2);
      touch-action: none;
      pointer-events: auto;
      z-index: 20;
    `;

    this.thumb = document.createElement('div');
    this.thumb.style.cssText = `
      position: absolute;
      width: ${THUMB_SIZE}px; height: ${THUMB_SIZE}px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      border: 2px solid rgba(255,255,255,0.4);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    `;
    this.container.appendChild(this.thumb);

    // Events
    this.container.addEventListener('touchstart', (e) => this._onStart(e), { passive: false });
    this.container.addEventListener('touchmove',  (e) => this._onMove(e),  { passive: false });
    this.container.addEventListener('touchend',   (e) => this._onEnd(e),   { passive: false });
    this.container.addEventListener('touchcancel',(e) => this._onEnd(e),   { passive: false });
  }

  _onStart(e) {
    e.preventDefault();
    if (this.active) return;
    const t = e.changedTouches[0];
    this.touchId = t.identifier;
    this.active = true;

    const rect = this.container.getBoundingClientRect();
    this.baseX = rect.left + rect.width / 2;
    this.baseY = rect.top + rect.height / 2;
    this.lastX = this.baseX;
    this.lastY = this.baseY;

    this._updateThumb(t.clientX, t.clientY);
  }

  _onMove(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.touchId) {
        this._updateThumb(t.clientX, t.clientY);
        return;
      }
    }
  }

  _onEnd(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.active = false;
        this.touchId = null;
        this.value.x = 0;
        this.value.y = 0;
        this.thumb.style.transform = 'translate(-50%, -50%)';
        if (this.relative) {
          this.lastX = this.baseX;
          this.lastY = this.baseY;
        }
        return;
      }
    }
  }

  _updateThumb(clientX, clientY) {
    if (this.relative) {
      // Trackpad-style: delta from last position
      const dx = clientX - this.lastX;
      const dy = clientY - this.lastY;
      this.lastX = clientX;
      this.lastY = clientY;
      // Scale delta to -1..1 range based on sensitivity
      this.value.x = Math.max(-1, Math.min(1, dx / 12));
      this.value.y = Math.max(-1, Math.min(1, dy / 12));
      // Keep thumb centered (it's a trackpad, not a stick)
      this.thumb.style.transform = 'translate(-50%, -50%)';
    } else {
      // Absolute joystick
      const dx = clientX - this.baseX;
      const dy = clientY - this.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = JOYSTICK_SIZE / 2 - THUMB_SIZE / 2;
      const clamped = Math.min(dist, maxDist);

      if (dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const ratio = clamped / maxDist;
        this.value.x = nx * ratio;
        this.value.y = ny * ratio;
        this.thumb.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
      } else {
        this.value.x = 0;
        this.value.y = 0;
        this.thumb.style.transform = 'translate(-50%, -50%)';
      }
    }
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

// ═══════════════════════════════════════════════════════════════
// MobileControls — orchestrates all mobile input
// ═══════════════════════════════════════════════════════════════
export class MobileControls {
  constructor() {
    this.enabled = isMobile();
    if (!this.enabled) return;

    this.moveJoystick = null;
    this.lookJoystick = null;
    this.firePressed = false;
    this.reloadPressed = false;
    this.interactPressed = false;
    this.sprintHeld = false;
    this.weaponSlots = [];
    this._fireInterval = null;
    this._autoReload = true; // auto-reload when empty on mobile

    this._buildUI();
  }

  _buildUI() {
    // Prevent all default touch behaviors globally on mobile
    document.addEventListener('touchstart', (e) => {
      // Allow touches on buttons and inputs
      const tag = e.target.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchend', (e) => {
      e.preventDefault();
    }, { passive: false });

    const root = document.createElement('div');
    root.id = 'mobile-controls';
    root.innerHTML = `
      <!-- Left joystick zone -->
      <div id="move-joystick-zone"></div>

      <!-- Right joystick zone -->
      <div id="look-joystick-zone"></div>

      <!-- Fire button -->
      <button id="btn-fire" class="mobile-btn fire-btn">🔫</button>

      <!-- Reload button -->
      <button id="btn-reload" class="mobile-btn action-btn">↻</button>

      <!-- Interact button -->
      <button id="btn-interact" class="mobile-btn action-btn">E</button>

      <!-- Sprint button -->
      <button id="btn-sprint" class="mobile-btn action-btn">⚡</button>

      <!-- Weapon slots -->
      <div id="mobile-weapons"></div>
    `;
    document.body.appendChild(root);

    // Inject CSS for mobile controls
    const style = document.createElement('style');
    style.textContent = `
      #mobile-controls {
        display: none;
        position: fixed; top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        z-index: 25;
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
      }
      body.mobile #mobile-controls { display: block; }

      #move-joystick-zone {
        position: fixed;
        left: calc(3% + ${JOYSTICK_SIZE/2}px);
        bottom: calc(5% + ${JOYSTICK_SIZE/2}px);
        transform: translate(-50%, 50%);
      }
      #look-joystick-zone {
        position: fixed;
        right: calc(10% + ${JOYSTICK_SIZE/2}px);
        bottom: calc(5% + ${JOYSTICK_SIZE/2}px);
        transform: translate(50%, 50%);
      }

      .mobile-btn {
        position: fixed;
        pointer-events: auto;
        touch-action: manipulation;
        border: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4rem;
        z-index: 20;
        -webkit-tap-highlight-color: transparent;
        cursor: pointer;
      }

      .fire-btn {
        width: ${FIRE_SIZE}px; height: ${FIRE_SIZE}px;
        right: 5%;
        bottom: 22%;
        background: rgba(200,0,0,0.55);
        border: 2px solid rgba(255,60,60,0.7);
        color: #fff;
        font-size: 2rem;
        box-shadow: 0 0 20px rgba(255,0,0,0.3);
      }
      .fire-btn:active, .fire-btn.pressed {
        background: rgba(255,30,30,0.8);
        box-shadow: 0 0 35px rgba(255,0,0,0.6);
        transform: scale(0.92);
      }

      .action-btn {
        width: 50px; height: 50px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.25);
        color: #ccc;
        font-size: 1rem;
      }
      .action-btn:active {
        background: rgba(255,255,255,0.25);
      }

      #btn-reload {
        right: calc(5% + ${FIRE_SIZE}px + 20px);
        bottom: calc(22% + ${FIRE_SIZE/2}px - 25px);
      }
      #btn-interact {
        right: calc(5% + ${FIRE_SIZE}px + 80px);
        bottom: calc(22% + ${FIRE_SIZE/2}px - 25px);
      }
      #btn-sprint {
        right: calc(5% + ${FIRE_SIZE/2}px - 25px);
        bottom: calc(22% + ${FIRE_SIZE}px + 15px);
      }

      #mobile-weapons {
        position: fixed;
        bottom: 5%;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        pointer-events: auto;
        touch-action: manipulation;
        z-index: 20;
      }
      .mobile-weapon-btn {
        padding: 8px 14px;
        background: rgba(0,0,0,0.55);
        border: 1px solid #444;
        color: #888;
        font-size: 0.75rem;
        letter-spacing: 1px;
        border-radius: 6px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        white-space: nowrap;
      }
      .mobile-weapon-btn.active {
        color: #fff;
        border-color: #ffd700;
        background: rgba(255,215,0,0.15);
      }
    `;
    document.head.appendChild(style);

    // Create joysticks
    this.moveJoystick = new VirtualJoystick('move-joystick-zone', { relative: false });
    this.lookJoystick = new VirtualJoystick('look-joystick-zone', { relative: true });

    // Fire button
    const fireBtn = document.getElementById('btn-fire');
    fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.firePressed = true; });
    fireBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.firePressed = false; });
    fireBtn.addEventListener('touchcancel', (e) => { this.firePressed = false; });
    // Also handle mouse for dev testing
    fireBtn.addEventListener('mousedown', () => { this.firePressed = true; });
    fireBtn.addEventListener('mouseup', () => { this.firePressed = false; });
    fireBtn.addEventListener('mouseleave', () => { this.firePressed = false; });

    // Reload button
    const reloadBtn = document.getElementById('btn-reload');
    reloadBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.reloadPressed = true; });
    reloadBtn.addEventListener('touchend', () => { this.reloadPressed = false; });

    // Interact button
    const interactBtn = document.getElementById('btn-interact');
    interactBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.interactPressed = true; });
    interactBtn.addEventListener('touchend', () => { this.interactPressed = false; });

    // Sprint button (hold)
    const sprintBtn = document.getElementById('btn-sprint');
    sprintBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.sprintHeld = true; });
    sprintBtn.addEventListener('touchend', () => { this.sprintHeld = false; });
    sprintBtn.addEventListener('touchcancel', () => { this.sprintHeld = false; });

    // Prevent accidental zoom/scroll on controls
    root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  // ── Public read API ──
  getMovement() {
    if (!this.moveJoystick) return { x: 0, z: 0 };
    const v = this.moveJoystick.value;
    // Joystick Y is inverted (up = negative in screen space)
    return { x: v.x, z: -v.y };
  }

  getLookDelta() {
    if (!this.lookJoystick) return { x: 0, y: 0 };
    return { x: this.lookJoystick.value.x, y: this.lookJoystick.value.y };
  }

  isFiring() { return this.firePressed; }
  isSprinting() { return this.sprintHeld; }
  consumeReload() { const v = this.reloadPressed; this.reloadPressed = false; return v; }
  consumeInteract() { const v = this.interactPressed; this.interactPressed = false; return v; }

  // ── Weapon slots ──
  updateWeaponSlots(owned, current) {
    const container = document.getElementById('mobile-weapons');
    if (!container) return;

    const slotDefs = [
      { key: 'pistol', label: '🔫' },
      { key: 'shotgun', label: '💥' },
      { key: 'smg', label: '🔫🔥' },
      { key: 'aliengun', label: '👽' },
      { key: 'raygun', label: '☢️' },
      { key: 'katana', label: '⚔️' },
    ];

    container.innerHTML = '';
    for (const s of slotDefs) {
      if (owned[s.key]) {
        const btn = document.createElement('button');
        btn.className = 'mobile-weapon-btn' + (s.key === current ? ' active' : '');
        btn.textContent = s.label;
        btn.addEventListener('touchstart', (e) => {
          e.preventDefault();
          if (this._onWeaponSwitch) this._onWeaponSwitch(s.key);
        });
        container.appendChild(btn);
      }
    }
  }

  setWeaponSwitchCallback(fn) { this._onWeaponSwitch = fn; }
  setReloadCallback(fn) { this._onReload = fn; }
  setInteractCallback(fn) { this._onInteract = fn; }

  destroy() {
    const root = document.getElementById('mobile-controls');
    if (root) root.remove();
    document.body.classList.remove('mobile');
  }
}
