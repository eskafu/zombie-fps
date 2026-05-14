// ═══════════════════════════════════════════════════════════════
// MOBILE CONTROLS — Virtual Joysticks + Buttons
// ═══════════════════════════════════════════════════════════════

const JOYSTICK_SIZE = 140;     // move joystick diameter
const THUMB_SIZE = 60;         // thumb diameter
const FIRE_SIZE = 85;          // fire button diameter

// ── Mobile detection ──
// Detect touch devices including modern iPads (which report as Mac).
export function isMobile() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  // iPadOS 13+ Safari pretends to be Mac. Multi-touch on a "Mac" = iPad.
  const isIpadPretendingMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const uaMobile = /iPhone|iPad|iPod|Android|Mobile|Tablet/i.test(ua);
  return uaMobile || isIpadPretendingMac || (hasTouch && window.innerWidth <= 1024);
}

// ── Haptic helper ──
export function haptic(ms = 15) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
  }
}

// ── Orientation lock helper (best effort; many browsers reject) ──
let _portraitWatcher = null;

export function lockLandscape() {
  // Try native API first (Android Chrome — only works in fullscreen)
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) { /* ignore */ }

  // Fallback: CSS portrait blocker via matchMedia (works everywhere)
  if (!_portraitWatcher) {
    const mq = window.matchMedia('(orientation: portrait)');
    const update = () => {
      document.body.classList.toggle('portrait', mq.matches);
    };
    mq.addEventListener('change', update);
    update(); // check immediately
    _portraitWatcher = mq;
  }
}

// ═══════════════════════════════════════════════════════════════
// VirtualJoystick — single thumbstick
// ═══════════════════════════════════════════════════════════════
class VirtualJoystick {
  constructor(containerId, opts = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.relative = opts.relative || false;
    this.noVisual = opts.noVisual || false;
    this.floating = opts.floating || false;   // base spawns at touch point
    this.deadzone = opts.deadzone ?? 0;       // 0..1 normalized
    this.value = { x: 0, y: 0 };
    this.pendingDx = 0;
    this.pendingDy = 0;
    this.active = false;
    this.touchId = null;
    this.baseX = 0;
    this.baseY = 0;
    this.lastX = 0;
    this.lastY = 0;

    this.container.style.touchAction = 'none';
    this.container.style.pointerEvents = 'auto';

    if (!this.noVisual) {
      // Visual joystick is a child element so we can move it on the container.
      this.base = document.createElement('div');
      this.base.style.cssText = `
        position: absolute;
        width: ${JOYSTICK_SIZE}px; height: ${JOYSTICK_SIZE}px;
        border-radius: 50%;
        background: rgba(255,255,255,0.08);
        border: 2px solid rgba(255,255,255,0.22);
        pointer-events: none;
        ${this.floating ? 'opacity: 0; transition: opacity 0.12s;' : ''}
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
      `;

      this.thumb = document.createElement('div');
      this.thumb.style.cssText = `
        position: absolute;
        width: ${THUMB_SIZE}px; height: ${THUMB_SIZE}px;
        border-radius: 50%;
        background: rgba(255,255,255,0.22);
        border: 2px solid rgba(255,255,255,0.45);
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
      `;
      this.base.appendChild(this.thumb);
      this.container.appendChild(this.base);
    } else {
      this.base = null;
      this.thumb = null;
    }

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

    if (this.floating && this.base) {
      // Spawn base at the touch point (in container-local coords).
      const rect = this.container.getBoundingClientRect();
      this.base.style.left = `${t.clientX - rect.left}px`;
      this.base.style.top  = `${t.clientY - rect.top}px`;
      this.base.style.transform = 'translate(-50%, -50%)';
      this.base.style.opacity = '1';
      this.baseX = t.clientX;
      this.baseY = t.clientY;
    } else if (!this.relative) {
      const rect = this.container.getBoundingClientRect();
      this.baseX = rect.left + rect.width / 2;
      this.baseY = rect.top + rect.height / 2;
    }

    this.lastX = t.clientX;
    this.lastY = t.clientY;

    if (!this.relative) this._updateThumb(t.clientX, t.clientY);
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
        if (this.thumb) this.thumb.style.transform = 'translate(-50%, -50%)';
        if (this.floating && this.base) this.base.style.opacity = '0';
        return;
      }
    }
  }

  _updateThumb(clientX, clientY) {
    if (this.relative) {
      const dx = clientX - this.lastX;
      const dy = clientY - this.lastY;
      this.lastX = clientX;
      this.lastY = clientY;
      this.pendingDx += dx;
      this.pendingDy += dy;
      return;
    }

    const dx = clientX - this.baseX;
    const dy = clientY - this.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = JOYSTICK_SIZE / 2 - THUMB_SIZE / 2;
    const clamped = Math.min(dist, maxDist);

    if (dist === 0) {
      this.value.x = 0;
      this.value.y = 0;
      if (this.thumb) this.thumb.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const ratio = clamped / maxDist;
    // Linear with dead-zone: small jitter doesn't produce input, then linear ramp.
    const adj = ratio < this.deadzone ? 0 : (ratio - this.deadzone) / (1 - this.deadzone);
    this.value.x = nx * adj;
    this.value.y = ny * adj;
    if (this.thumb) {
      this.thumb.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
    }
  }

  consumeDelta() {
    const d = { x: this.pendingDx, y: this.pendingDy };
    this.pendingDx = 0;
    this.pendingDy = 0;
    return d;
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
    this._lastSlotsKey = '';  // dirty-check signature for weapon slots
    this._lastInteractLabel = '';

    this._buildUI();
  }

  _buildUI() {
    // Prevent default touch behaviour outside form controls.
    // Only touchmove — touchstart preventDefault can break multi-touch on some
    // mobile browsers (second finger events get cancelled).
    // CSS touch-action: none on html/body/canvas handles the rest.
    const blockTouch = (e) => {
      const tag = e.target.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
      e.preventDefault();
    };
    document.addEventListener('touchmove',  blockTouch, { passive: false });

    const root = document.createElement('div');
    root.id = 'mobile-controls';
    root.innerHTML = `
      <!-- Look area: full-screen overlay; joystick/buttons sit above and intercept first -->
      <div id="look-area"></div>

      <!-- Move joystick zone (bottom-left) -->
      <div id="move-joystick-zone"></div>

      <!-- Fire button (bottom-right, large) -->
      <button id="btn-fire" class="mobile-btn fire-btn">🔫</button>

      <!-- Reload button (above fire) -->
      <button id="btn-reload" class="mobile-btn action-btn">↻</button>

      <!-- Interact button (hidden unless near station/box) -->
      <button id="btn-interact" class="mobile-btn action-btn" style="display:none">E</button>

      <!-- Weapon slots (top edge) -->
      <div id="mobile-weapons"></div>
    `;
    document.body.appendChild(root);

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

      /* ── LOOK AREA: right 55%, stops above buttons ── */
      #look-area {
        position: fixed;
        top: 0; left: 45%;
        width: 55%; height: 100%;
        pointer-events: auto;
        touch-action: none;
        z-index: 20;
        background: transparent;
      }

      /* ── MOVE JOYSTICK — floating: zone covers bottom-left, base spawns at touch ── */
      #move-joystick-zone {
        position: fixed;
        left: 0;
        bottom: 0;
        width: 45%;
        height: 65%;
        z-index: 21;
      }

      /* ── BUTTONS ── */
      .mobile-btn {
        position: fixed;
        pointer-events: auto;
        touch-action: manipulation;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 22;
        -webkit-tap-highlight-color: transparent;
        cursor: pointer;
      }

      .fire-btn {
        width: ${FIRE_SIZE}px; height: ${FIRE_SIZE}px;
        border-radius: 50%;
        right: 6%;
        bottom: 5%;
        background: rgba(200,0,0,0.5);
        border: 2px solid rgba(255,60,60,0.6);
        color: #fff;
        font-size: 2.2rem;
        box-shadow: 0 0 25px rgba(255,0,0,0.3);
        transition: transform 0.08s;
      }
      .fire-btn:active {
        background: rgba(255,30,30,0.75);
        box-shadow: 0 0 40px rgba(255,0,0,0.5);
        transform: scale(0.9);
      }

      .action-btn {
        min-width: 52px;
        height: 52px;
        padding: 0 10px;
        border-radius: 26px;
        background: rgba(255,255,255,0.12);
        border: 2px solid rgba(255,255,255,0.25);
        color: #ddd;
        font-size: 0.85rem;
        font-weight: bold;
        letter-spacing: 1px;
        white-space: nowrap;
      }
      .action-btn:active {
        background: rgba(255,255,255,0.25);
        transform: scale(0.9);
      }
      .action-btn.contextual {
        background: rgba(40,180,80,0.35);
        border-color: rgba(80,255,140,0.7);
        color: #d8ffe6;
        box-shadow: 0 0 20px rgba(60,255,120,0.25);
      }

      #btn-reload {
        right: calc(6% + ${FIRE_SIZE}px + 14px);
        bottom: calc(5% + ${FIRE_SIZE/2}px - 26px);
      }
      #btn-interact {
        right: calc(6% + ${FIRE_SIZE}px + 74px);
        bottom: calc(5% + ${FIRE_SIZE/2}px - 26px);
      }

      /* ── WEAPON SLOTS (top edge) ── */
      #mobile-weapons {
        position: fixed;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        pointer-events: auto;
        touch-action: manipulation;
        z-index: 22;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 90vw;
      }
      .mobile-weapon-btn {
        padding: 6px 12px;
        background: rgba(0,0,0,0.55);
        border: 1px solid #444;
        color: #888;
        font-size: 0.8rem;
        letter-spacing: 1px;
        border-radius: 6px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        white-space: nowrap;
      }
      .mobile-weapon-btn.active {
        color: #fff;
        border-color: #ffd700;
        background: rgba(255,215,0,0.18);
      }
    `;
    document.head.appendChild(style);

    this.moveJoystick = new VirtualJoystick('move-joystick-zone', {
      relative: false,
      floating: true,   // base appears wherever the player touches in the zone
      deadzone: 0.12,   // small dead-zone so tiny finger jitter doesn't drift
    });
    this.lookJoystick = new VirtualJoystick('look-area', {
      relative: true,
      noVisual: true,
    });

    const fireBtn = document.getElementById('btn-fire');
    fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.firePressed = true; });
    fireBtn.addEventListener('touchend',   (e) => { e.preventDefault(); this.firePressed = false; });
    fireBtn.addEventListener('touchcancel',()  => { this.firePressed = false; });
    fireBtn.addEventListener('mousedown',  () => { this.firePressed = true; });
    fireBtn.addEventListener('mouseup',    () => { this.firePressed = false; });
    fireBtn.addEventListener('mouseleave', () => { this.firePressed = false; });

    const reloadBtn = document.getElementById('btn-reload');
    reloadBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.reloadPressed = true; });
    reloadBtn.addEventListener('touchend',   () => { this.reloadPressed = false; });

    const interactBtn = document.getElementById('btn-interact');
    interactBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.interactPressed = true; });
    interactBtn.addEventListener('touchend',   () => { this.interactPressed = false; });
  }

  // ── Public read API ──
  getMovement() {
    if (!this.moveJoystick) return { x: 0, z: 0 };
    const v = this.moveJoystick.value;
    return { x: v.x, z: v.y };
  }

  // Sprint only when pushing forward (within ~45° cone) at near-max deflection.
  // Prevents accidental sprint when strafing or backpedaling at full stick.
  isSprinting() {
    if (!this.moveJoystick) return false;
    const v = this.moveJoystick.value;
    const mag = Math.sqrt(v.x * v.x + v.y * v.y);
    if (mag < 0.85) return false;
    // Joystick y is screen-down-positive; pushing UP gives v.y < 0 → forward.
    // atan2(x, -y): 0 = forward, ±π = back.
    const angle = Math.atan2(v.x, -v.y);
    return Math.abs(angle) < Math.PI / 4;
  }

  // Returns accumulated pixel delta since last call. Frame-rate independent.
  getLookDelta() {
    if (!this.lookJoystick) return { x: 0, y: 0 };
    return this.lookJoystick.consumeDelta();
  }

  isFiring() { return this.firePressed; }
  consumeReload()  { const v = this.reloadPressed;   this.reloadPressed   = false; return v; }
  consumeInteract(){ const v = this.interactPressed; this.interactPressed = false; return v; }

  // ── Weapon slots (dirty-checked so we don't rebuild DOM every frame) ──
  updateWeaponSlots(owned, current) {
    const container = document.getElementById('mobile-weapons');
    if (!container) return;

    const ownedKeys = Object.keys(owned).filter(k => owned[k]).sort().join(',');
    const key = `${ownedKeys}|${current}`;
    if (key === this._lastSlotsKey) return;
    this._lastSlotsKey = key;

    const slotDefs = [
      { key: 'pistol',   label: '🔫' },
      { key: 'shotgun',  label: '💥' },
      { key: 'smg',      label: '🔫🔥' },
      { key: 'aliengun', label: '👽' },
      { key: 'raygun',   label: '☢️' },
      { key: 'katana',   label: '⚔️' },
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

  // ── Contextual label for the "E" button (e.g. "AMMO 500", "BOX 1200") ──
  setInteractLabel(label) {
    const btn = document.getElementById('btn-interact');
    if (!btn) return;
    const text = label || 'E';
    if (text === this._lastInteractLabel) return;
    this._lastInteractLabel = text;
    btn.textContent = text;
    btn.classList.toggle('contextual', !!label);
    btn.style.display = label ? '' : 'none';
  }

  setWeaponSwitchCallback(fn) { this._onWeaponSwitch = fn; }
  setReloadCallback(fn)       { this._onReload = fn; }
  setInteractCallback(fn)     { this._onInteract = fn; }

  destroy() {
    const root = document.getElementById('mobile-controls');
    if (root) root.remove();
    document.body.classList.remove('mobile');
  }
}
