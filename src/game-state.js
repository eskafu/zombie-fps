const POWERUP_DURATION = 30;
const LIFE_REGEN_DELAY = 5;

export const gameState = {
  state: 'menu', // 'menu', 'playing', 'paused', 'game-over'
  round: 1,
  maxRound: parseInt(localStorage.getItem('zm_maxRound') || '1'),
  maxKills: parseInt(localStorage.getItem('zm_maxKills') || '0'),
  points: 500,
  lives: 3,
  kills: 0,

  // Settings
  mouseSensitivity: parseFloat(localStorage.getItem('zm_mouseSens') || '1.0'),
  gamepadSensitivity: parseFloat(localStorage.getItem('zm_padSens') || '1.5'),

  zombiesInRound: 0,
  zombiesSpawned: 0,
  zombiesKilled: 0,

  roundStarting: false,
  roundStartTimer: 0,
  roundBannerTimer: 0,
  isDogRound: false,

  instaKill: false,
  instaKillTimer: 0,
  doublePoints: false,
  doublePointsTimer: 0,
  nukeQueued: false,

  energySwitchesActive: 0,
  isPowerOn: false,
  perks: {
    juggernog: false,
    speedCola: false,
    quickRevive: false
  },
  quickReviveUses: 0,

  lifeRegenTimer: 0,
  MAX_LIVES: 3,

  startGame() {
    this.state = 'playing';
    this.round = 1;
    this.isDogRound = false;
    this.points = 500;
    this.MAX_LIVES = 3;
    this.lives = this.MAX_LIVES;
    this.kills = 0;
    this.nukeQueued = false;
    this.instaKill = false;
    this.doublePoints = false;
    this.energySwitchesActive = 0;
    this.isPowerOn = false;
    this.perks = { juggernog: false, speedCola: false, quickRevive: false };
    this.quickReviveUses = 0;
    this.lifeRegenTimer = LIFE_REGEN_DELAY;
    this._beginRound();
  },

  reset() {
    this.state = 'menu';
  },

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      return true;
    } else if (this.state === 'paused') {
      this.state = 'playing';
      return true;
    }
    return false;
  },

  updateSettings(mouse, pad) {
    this.mouseSensitivity = mouse;
    this.gamepadSensitivity = pad;
    localStorage.setItem('zm_mouseSens', mouse);
    localStorage.setItem('zm_padSens', pad);
  },

  _beginRound() {
    this.isDogRound = (this.round > 0 && this.round % 4 === 0);
    
    if (this.isDogRound) {
      this.zombiesInRound = 16; // 4 batches of 4 enemies (2 bats + 2 dogs)
    } else {
      this.zombiesInRound = Math.min(6 + this.round * 6, 24 + this.round);
    }
    
    this.zombiesSpawned = 0;
    this.zombiesKilled = 0;
    this.roundStarting = false;
    this.roundBannerTimer = 3;
  },

  onZombieSpawned() {
    this.zombiesSpawned++;
  },

  onZombieKilled() {
    this.zombiesKilled++;
    this.kills++;
    if (this.zombiesKilled >= this.zombiesInRound) {
      this.roundStarting = true;
      this.roundStartTimer = 8;
      if (this.round > this.maxRound) {
        this.maxRound = this.round;
        localStorage.setItem('zm_maxRound', this.maxRound);
      }
    }
  },

  addPoints(base) {
    this.points += this.doublePoints ? base * 2 : base;
  },

  activateSwitch() {
    if (this.isPowerOn) return;
    this.energySwitchesActive++;
    if (this.energySwitchesActive >= 3) {
      this.isPowerOn = true;
    }
  },

  resetPower() {
    this.isPowerOn = false;
    this.energySwitchesActive = 0;
  },

  buyPerk(name, cost) {
    if (this.points < cost) return false;
    if (this.perks[name]) return false;
    
    this.points -= cost;
    this.perks[name] = true;

    if (name === 'juggernog') {
      this.MAX_LIVES = 5;
      this.lives = Math.max(this.lives, 5);
    }
    if (name === 'quickRevive') {
      this.quickReviveUses++;
    }
    return true;
  },

  losePerks() {
    this.perks = { juggernog: false, speedCola: false, quickRevive: false };
    this.MAX_LIVES = 3;
    this.lives = Math.min(this.lives, 3);
  },

  takeDamage() {
    if (this.state !== 'playing') return false;
    this.lives--;
    
    if (this.lives <= 0) {
      // Check Quick Revive
      if (this.perks.quickRevive) {
        this.lives = 1;
        this.losePerks();
        return false; // Not game over yet
      }

      this.state = 'game-over';
      if (this.kills > this.maxKills) {
        this.maxKills = this.kills;
        localStorage.setItem('zm_maxKills', this.maxKills);
      }
      return true;
    }
    return false;
  },

  activateInstaKill() {
    this.instaKill = true;
    this.instaKillTimer = POWERUP_DURATION;
  },

  activateDoublePoints() {
    this.doublePoints = true;
    this.doublePointsTimer = POWERUP_DURATION;
  },

  activateNuke() {
    this.nukeQueued = true;
  },

  tick(delta) {
    if (this.state !== 'playing') return;

    if (this.roundBannerTimer > 0) this.roundBannerTimer -= delta;

    if (this.roundStarting) {
      this.roundStartTimer -= delta;
      if (this.roundStartTimer <= 0) {
        this.round++;
        this._beginRound();
      }
    }

    // Life regen: +1 heart every 5s up to max
    if (this.lives < this.MAX_LIVES) {
      this.lifeRegenTimer -= delta;
      if (this.lifeRegenTimer <= 0) {
        this.lives = Math.min(this.lives + 1, this.MAX_LIVES);
        this.lifeRegenTimer = LIFE_REGEN_DELAY;
      }
    }

    if (this.instaKill) {
      this.instaKillTimer -= delta;
      if (this.instaKillTimer <= 0) { this.instaKill = false; this.instaKillTimer = 0; }
    }
    if (this.doublePoints) {
      this.doublePointsTimer -= delta;
      if (this.doublePointsTimer <= 0) { this.doublePoints = false; this.doublePointsTimer = 0; }
    }
  },

  getZombieHP() {
    // Max 900 HP = 6 headshots (150 dmg each)
    return Math.min(Math.round(150 * Math.pow(1.1, this.round - 1)), 900);
  },

  getZombieSpeed() {
    return Math.min(3 * (1 + (this.round - 1) * 0.08), 6);
  },

  getSpawnInterval() {
    return Math.max(0.5, 1.5 - this.round * 0.04);
  },

  canSpawnMore() {
    return this.zombiesSpawned < this.zombiesInRound && !this.roundStarting;
  },

  getZombiesLeft() {
    return Math.max(0, this.zombiesInRound - this.zombiesKilled);
  },

  getTotalScore() {
    // Round é o fator mais importante, depois kills, depois pontos
    return this.round * 10000 + this.kills * 100 + this.points;
  },
};
