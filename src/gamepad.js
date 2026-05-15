// ═══════════════════════════════════════════════════════════════
// GAMEPAD SUPPORT (PlayStation / CoD Style)
// ═══════════════════════════════════════════════════════════════

export class GamepadControls {
  constructor() {
    this.gamepadIndex = -1;
    this.deadzone = 0.15;
    this.lookSensitivity = 1.5;
    
    this.buttons = {
      fire: false,
      jump: false,
      reload: false,
      interact: false,
      switch: false,
      sprint: false,
      grapple: false
    };

    this.prevButtons = { ...this.buttons };

    window.addEventListener('gamepadconnected', (e) => {
      console.log('Gamepad connected:', e.gamepad.id);
      this.gamepadIndex = e.gamepad.index;
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = -1;
      }
    });
  }

  update() {
    const gamepad = this._getGamepad();
    if (!gamepad) return;

    this.prevButtons = { ...this.buttons };

    // Mapping (Standard Gamepad)
    // 0: Cross, 1: Circle, 2: Square, 3: Triangle, 4: L1, 5: R1, 6: L2, 7: R2, 10: L3, 11: R3
    this.buttons.jump = gamepad.buttons[0].pressed;       // Cross
    this.buttons.fire = gamepad.buttons[7].pressed || gamepad.buttons[5].pressed; // R2 or R1
    this.buttons.reload = gamepad.buttons[2].pressed;     // Square
    this.buttons.interact = gamepad.buttons[2].pressed;   // Square
    this.buttons.switch = gamepad.buttons[3].pressed;     // Triangle
    this.buttons.sprint = gamepad.buttons[10].pressed;    // L3
    this.buttons.grapple = gamepad.buttons[4].pressed;    // L1 (Grapple Hook)
  }

  _getGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    // If we have an index, try that first
    if (this.gamepadIndex !== -1 && gamepads[this.gamepadIndex]) {
      return gamepads[this.gamepadIndex];
    }
    
    // Fallback: Find the first connected gamepad
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        if (this.gamepadIndex === -1) console.log('Gamepad detected at index', i, ':', gamepads[i].id);
        this.gamepadIndex = i;
        return gamepads[i];
      }
    }
    return null;
  }

  getMovement() {
    const gamepad = this._getGamepad();
    if (!gamepad) return { x: 0, z: 0 };

    let x = gamepad.axes[0];
    let z = gamepad.axes[1];

    if (Math.abs(x) < this.deadzone) x = 0;
    if (Math.abs(z) < this.deadzone) z = 0;

    return { x, z };
  }

  getLookDelta(delta) {
    const gamepad = this._getGamepad();
    if (!gamepad) return { x: 0, y: 0 };

    let x = gamepad.axes[2];
    let y = gamepad.axes[3];

    if (Math.abs(x) < this.deadzone) x = 0;
    if (Math.abs(y) < this.deadzone) y = 0;

    // Apply response curve (power of 2) for better precision in small movements
    x = Math.sign(x) * Math.pow(Math.abs(x), 2);
    y = Math.sign(y) * Math.pow(Math.abs(y), 2);

    // Apply sensitivity (tuned for 60fps base)
    const sens = gameState.gamepadSensitivity;
    return {
      x: x * sens * delta * 60,
      y: y * sens * delta * 60
    };
  }

  updateSettings() {
    this.lookSensitivity = gameState.gamepadSensitivity;
  }

  isFiring() { return this.buttons.fire; }
  
  consumeJump() {
    const v = this.buttons.jump && !this.prevButtons.jump;
    return v;
  }

  consumeReload() {
    const v = this.buttons.reload && !this.prevButtons.reload;
    return v;
  }

  consumeInteract() {
    const v = this.buttons.interact && !this.prevButtons.interact;
    return v;
  }

  consumeSwitch() {
    const v = this.buttons.switch && !this.prevButtons.switch;
    return v;
  }

  consumeGrapple() {
    const v = this.buttons.grapple && !this.prevButtons.grapple;
    return v;
  }

  consumeSprint() {
    const v = this.buttons.sprint && !this.prevButtons.sprint;
    return v;
  }

  isSprinting() { return this.buttons.sprint; }
}
