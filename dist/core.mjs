/** 18Bro deterministic, DOM-free runner simulation. World approaches +Z; cat stays at Z=0. */
export const LANES = Object.freeze([-2.5, 0, 2.5]);
export const THEMES = Object.freeze(['HONG KONG']);
export const POWER_DURATIONS = Object.freeze({ magnet: 8, moon: 5 });
export const MOTION = Object.freeze({ laneDuration: .16, jumpDuration: .7, jumpHeight: 2.3, slideDuration: .72, jumpBuffer: .1, coyoteTime: .08 });
const GRAVITY = 8 * MOTION.jumpHeight / MOTION.jumpDuration ** 2;
const JUMP_VELOCITY = GRAVITY * MOTION.jumpDuration / 2;
const HAZARDS = new Set(['blocker', 'jump', 'slide', 'traffic']);
const COLLECTIBLES = new Set(['coin']);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;

/** Templates always reserve at least one untouched lane, including a moving hazard's sweep. */
export const PATTERNS = Object.freeze([
  { minTier: 1, slots: ['traffic', null, null] },
  { minTier: 1, slots: [null, 'traffic', null] },
  { minTier: 1, slots: [null, null, 'traffic'] },
  { minTier: 1, slots: [null, 'jump', null] },
  { minTier: 1, slots: ['slide', null, null] },
  { minTier: 1, slots: ['traffic', null, 'jump'] },
  { minTier: 2, slots: [null, 'traffic', 'traffic'] },
  { minTier: 2, slots: ['slide', 'traffic', null] },
  { minTier: 2, slots: ['jump', null, 'blocker'] },
  { minTier: 3, slots: ['traffic', 'traffic', null] },
  { minTier: 3, slots: ['blocker', null, 'slide'] },
]);

export function validatePattern(pattern) {
  if (!Array.isArray(pattern.slots) || pattern.slots.length !== 3) return false;
  const occupied = pattern.slots.map(Boolean);
  if (pattern.movingTo != null) {
    if (!Number.isInteger(pattern.movingTo) || pattern.movingTo < 0 || pattern.movingTo > 2) return false;
    occupied[pattern.movingTo] = true;
  }
  return occupied.some(v => !v);
}

export function obstacleSpacing(speed, tier = 1) {
  // At top speed both full two-lane travel (.32s) and jump/slide recovery fit between rows.
  const reaction = [1.14, 1.04, .97, .92][clamp(tier, 1, 4) - 1];
  return Math.max(13.5, speed * reaction + 2.8);
}

const POWER_DEFINITIONS = {
  magnet: { activate() {}, update() {}, end() {} },
  moon: { activate() {}, update() {}, end() {} },
};

/** Active powers are a Map<string, {type, duration, remaining, elapsed}>. */
export class PowerUpManager {
  constructor(game) { this.game = game; this.active = new Map(); }
  has(type) { return this.active.has(type); }
  activate(type) {
    const definition = POWER_DEFINITIONS[type];
    if (!definition) return false;
    const wasActive = this.has(type);
    const duration = POWER_DURATIONS[type];
    this.active.set(type, { type, duration, remaining: duration, elapsed: 0 });
    if (!wasActive || definition.refreshActivation) definition.activate(this.game);
    this.game.emit('power', { kind: type, duration, refresh: wasActive });
    return true;
  }
  remove(type, reason = 'expired') {
    if (!this.active.delete(type)) return false;
    POWER_DEFINITIONS[type].end(this.game);
    this.game.emit('powerend', { kind: type, reason });
    return true;
  }
  clear() { this.active.clear(); }
  update(dt) {
    for (const [type, power] of this.active) {
      const activeDt = Math.min(dt, power.remaining);
      POWER_DEFINITIONS[type].update(this.game, activeDt);
      power.elapsed += activeDt;
      power.remaining -= dt;
      if (power.remaining <= 1e-8) this.remove(type);
    }
  }
  get speedMultiplier() { return this.has('moon') ? 1.5 : 1; }
  get scoreMultiplier() { return this.has('moon') ? 5 : 1; }
  get magnetRadius() { return this.has('magnet') ? 10 : 0; }
  get invulnerable() { return this.has('moon'); }
}

export class RunnerGame {
  constructor({ onEvent = () => {}, random = Math.random } = {}) {
    this.onEvent = onEvent;
    this.random = random;
    this.entities = Array.from({ length: 256 }, (_, id) => ({ id, active: false }));
    this.chunks = Array.from({ length: 7 }, (_, id) => ({ id, z: -id * 32, index: id, theme: THEMES[0] }));
    this.debug = { invincible: false, speedOverride: null, tierOverride: null, themeOverride: null, showColliders: false };
    this.powers = new PowerUpManager(this);
    this.state = 'MAIN_MENU';
    this._reset();
  }
  emit(type, data = {}) { this.onEvent({ type, ...data }); }
  setState(state) { if (this.state !== state) { this.state = state; this.emit('state', { state }); } }
  _random() { return clamp(Number(this.random()) || 0, 0, .999999999); }
  _reset() {
    this.player = { x: 0, lane: 1, y: 0, vy: 0, slide: 0, hit: 0, grounded: true, anim: 'idle', laneFrom: 0, laneElapsed: MOTION.laneDuration, jumpBuffer: 0, coyote: MOTION.coyoteTime };
    this.distance = 0; this.time = 0; this.speed = 9.4; this.score = 0; this.chips = 0; this.coins = 0;
    this.chipMeter = 0; this.policeDistance = 10; this.themeIndex = 0; this.theme = THEMES[0];
    this.tier = 1; this.tiers = 1; this.dodgeStreak = 0; this.perfectDodges = 0;
    this.introRemaining = 3.8; this.introProgress = 0; this._hitAge = 100; this._slowRemaining = 0;
    this._spawnCursor = 30; this._rowId = 0; this._poolCursor = 0; this._lastSafeLane = 1;
    this.patternHistory = []; this.powers.clear();
    for (const entity of this.entities) entity.active = false;
    for (let i = 0; i < this.chunks.length; i++) Object.assign(this.chunks[i], { z: -i * 32, index: i, theme: THEMES[0] });
  }
  start({ skipIntro = false } = {}) {
    this._reset();
    this._fillAhead();
    if (skipIntro) { this.introRemaining = 0; this.introProgress = 1; this.player.anim = 'run'; }
    this.setState(skipIntro ? 'RUNNING' : 'STARTING');
  }
  pause() { if (this.state === 'RUNNING' || this.state === 'STARTING') { this._beforePause = this.state; this.setState('PAUSED'); } }
  resume() { if (this.state === 'PAUSED') this.setState(this._beforePause || 'RUNNING'); }
  menu() { this._reset(); this.setState('MAIN_MENU'); }
  input(action) {
    if (this.state !== 'RUNNING') return false;
    const p = this.player;
    if (action === 'left' || action === 'right') {
      const target = clamp(p.lane + (action === 'left' ? -1 : 1), 0, 2);
      if (target === p.lane) return false;
      p.laneFrom = p.x; p.lane = target; p.laneElapsed = 0;
      this.emit('lane', { lane: target });
      return true;
    }
    if (action === 'jump') {
      // Early slide deliberately rejects jump; held/repeated input cannot bypass that gate.
      if (p.slide > MOTION.slideDuration / 2) return false;
      p.jumpBuffer = MOTION.jumpBuffer;
      if ((p.grounded || p.coyote > 0) && p.vy <= 0) this._jump();
      return true;
    }
    if (action === 'slide') {
      if (p.slide > 0) return false;
      p.slide = MOTION.slideDuration; p.jumpBuffer = 0;
      if (!p.grounded) p.vy = Math.min(p.vy, -15);
      p.anim = 'slide'; this.emit('slide'); return true;
    }
    return false;
  }
  _jump() {
    const p = this.player;
    p.vy = JUMP_VELOCITY; p.grounded = false; p.coyote = 0; p.slide = 0; p.jumpBuffer = 0;
    p.anim = 'jump'; this.emit('jump');
  }
  activatePower(type) { return this.powers.activate(type); }
  spawnEntity(type, lane, z, extra = {}) {
    lane = clamp(Math.round(lane), 0, 2);
    let entity;
    for (let i = 0; i < this.entities.length; i++) {
      const candidate = this.entities[(this._poolCursor + i) % this.entities.length];
      if (!candidate.active) { entity = candidate; this._poolCursor = (candidate.id + 1) % this.entities.length; break; }
    }
    if (!entity) return null; // Exhaustion loses optional spawns, never allocates or evicts a visible hazard.
    if (!HAZARDS.has(type) && !COLLECTIBLES.has(type) && !POWER_DEFINITIONS[type]) return null;
    const isHazard = HAZARDS.has(type);
    const approachFactor = type === 'traffic' ? 1.55 : 1;
    z *= approachFactor;
    Object.assign(entity, { active: true, type, lane, x: LANES[lane], y: isHazard ? 0 : 1.1, z,
      previousZ: z, approachFactor, width: type === 'traffic' || type === 'blocker' ? 1.7 : 1.8,
      depth: type === 'blocker' || type === 'traffic' ? 2.7 : .72,
      variant: 0, hit: false, passed: false, magnetic: false, age: 0, rowId: -1,
      safeLane: -1, fromLane: lane, toLane: lane, spawnDistance: this.distance - z, ...extra });
    return entity;
  }
  debugSpawn(type, lane = this.player.lane) {
    return this.spawnEntity(type, lane, -Math.max(18, this.speed * 2.2));
  }
  _makePattern() {
    const candidates = PATTERNS.filter(p => p.minTier <= this.tier);
    let source = candidates[Math.floor(this._random() * candidates.length)];
    // Moving obstacles remain sparse, even after they become eligible.
    if (source.movingTo != null && this._random() > .22) source = candidates[0];
    const reflect = this._random() > .5;
    const slots = reflect ? [...source.slots].reverse() : [...source.slots];
    const movingTo = source.movingTo == null ? undefined : reflect ? 2 - source.movingTo : source.movingTo;
    const available = slots.map((v, lane) => !v && lane !== movingTo ? lane : -1).filter(lane => lane >= 0);
    let safeLane = available.includes(this._lastSafeLane) && this._random() < .45 ? this._lastSafeLane : available[Math.floor(this._random() * available.length)];
    const result = { slots, movingTo, safeLane };
    if (!validatePattern(result)) throw new Error('Unsafe obstacle pattern');
    this._lastSafeLane = safeLane;
    return result;
  }
  _spawnPattern(spawnDistance) {
    const pattern = this._makePattern();
    const rowId = this._rowId++;
    const z = this.distance - spawnDistance;
    for (let lane = 0; lane < 3; lane++) {
      const type = pattern.slots[lane];
      if (!type) continue;
      this.spawnEntity(type, lane, z, { rowId, safeLane: pattern.safeLane, variant: Math.floor(this._random() * 3),
        fromLane: lane, toLane: type === 'moving' ? pattern.movingTo : lane });
    }
    // Coins lead through the guaranteed clear lane, aligned to scheduled encounters.
    for (let i = 0; i < 4; i++) this.spawnEntity('coin', pattern.safeLane, z + 5.5 - i * 2.4, { rowId, y: 1.1 });
    const jumpLane = pattern.slots.indexOf('jump');
    if (jumpLane >= 0 && rowId % 3 === 1) {
      for (let i = 0; i < 3; i++) this.spawnEntity('coin', jumpLane, z + 2.5 - i * 2.5, { rowId, y: i === 1 ? 2.5 : 1.8 });
    }
    if (rowId > 0 && rowId % 12 === 6) {
      const kind = Math.floor(rowId / 12) % 3 === 2 ? 'moon' : 'magnet';
      this.spawnEntity(kind, pattern.safeLane, z + 8, { rowId, y: 1.2 });
    }
    const spacing = obstacleSpacing(this.speed, this.tier);
    this.patternHistory.push({ id: rowId, distance: spawnDistance, spacing, speed: this.speed, tier: this.tier, ...pattern });
    if (this.patternHistory.length > 32) this.patternHistory.shift();
    return spacing;
  }
  _fillAhead() {
    const ahead = Math.max(160, this.speed * 6);
    while (this._spawnCursor < this.distance + ahead) this._spawnCursor += this._spawnPattern(this._spawnCursor);
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.state === 'PAUSED' || this.state === 'MAIN_MENU' || this.state === 'GAME_OVER') return;
    let remaining = Math.min(dt, 1); // A suspended tab cannot advance seconds of unseen hazards.
    if (this.state === 'STARTING') {
      const introDt = Math.min(remaining, this.introRemaining);
      this.introRemaining -= introDt; this.introProgress = 1 - this.introRemaining / 3.8; remaining -= introDt;
      if (this.introRemaining <= 1e-8) { this.introRemaining = 0; this.player.anim = 'run'; this.setState('RUNNING'); }
    }
    while (remaining > 1e-8 && this.state === 'RUNNING') {
      const step = Math.min(remaining, 1 / 120);
      this._step(step); remaining -= step;
    }
  }
  _step(dt) {
    const p = this.player;
    const previousX = p.x, previousY = p.y;
    this.time += dt;
    this.tier = this.tiers = clamp(Math.round(this.debug.tierOverride || (this.time < 30 ? 1 : this.time < 90 ? 2 : this.time < 180 ? 3 : 4)), 1, 4);
    this._hitAge += dt; this._slowRemaining = Math.max(0, this._slowRemaining - dt);
    p.hit = Math.max(0, p.hit - dt);
    p.laneElapsed = Math.min(MOTION.laneDuration, p.laneElapsed + dt);
    const ease = 1 - (1 - p.laneElapsed / MOTION.laneDuration) ** 3;
    p.x = mix(p.laneFrom, LANES[p.lane], ease);
    p.slide = Math.max(0, p.slide - dt);
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    this.powers.update(dt);
    {
      if (!p.grounded || p.y > 0) {
        p.y += p.vy * dt - GRAVITY * dt * dt / 2;
        p.vy -= GRAVITY * dt;
        p.coyote = Math.max(0, p.coyote - dt);
        if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; p.coyote = MOTION.coyoteTime; }
      } else p.coyote = MOTION.coyoteTime;
      if (p.grounded && p.jumpBuffer > 0 && p.slide <= MOTION.slideDuration / 2) this._jump();
    }
    p.anim = p.hit > .65 ? 'hit' : p.slide > 0 ? 'slide' : p.y > .01 ? p.vy >= 0 ? 'jump' : 'fall' : 'run';
    const baseSpeed = this.debug.speedOverride != null ? clamp(Number(this.debug.speedOverride) || 9.4, 2, 120) : Math.min(26, 9.4 + this.time * .12);
    this.speed = baseSpeed * this.powers.speedMultiplier * (this._slowRemaining > 0 ? .7 : 1);
    const movement = this.speed * dt;
    this.distance += movement;
    this.score += movement * this.powers.scoreMultiplier;
    if (this._hitAge > 7) this.policeDistance = Math.min(10, this.policeDistance + dt * .45);
    this.themeIndex = 0; this.theme = THEMES[0];
    for (const chunk of this.chunks) {
      chunk.z += movement;
      if (chunk.z > 32) { chunk.z -= this.chunks.length * 32; chunk.index += this.chunks.length; chunk.theme = this.theme; }
    }
    for (const e of this.entities) {
      if (!e.active) continue;
      e.age += dt;
      e.previousZ = e.z;
      const oldX = e.x;
      e.z += movement * e.approachFactor;
      if (COLLECTIBLES.has(e.type) && this.powers.magnetRadius > 0 && e.z > -this.powers.magnetRadius && e.z < 1) {
        e.magnetic = true;
        e.x += (p.x - e.x) * Math.min(1, dt * 13);
        e.y += (p.y + .8 - e.y) * Math.min(1, dt * 13);
        e.z += (1 - e.z) * Math.min(1, dt * 7);
      }
      const hazard = HAZARDS.has(e.type);
      const halfDepth = hazard ? e.depth / 2 + .25 : .65;
      const zMin = Math.min(e.previousZ, e.z), zMax = Math.max(e.previousZ, e.z);
      if (!e.hit && zMax >= -halfDepth && zMin <= halfDepth) {
        // Evaluate the player at entry time to the swept Z slab rather than at the end of a large step.
        const crossing = e.z === e.previousZ ? 1 : clamp((-halfDepth - e.previousZ) / (e.z - e.previousZ), 0, 1);
        const playerX = mix(previousX, p.x, crossing);
        const playerY = mix(previousY, p.y, crossing);
        const entityX = mix(oldX, e.x, crossing);
        const xOverlap = Math.abs(playerX - entityX) < (hazard ? e.width / 2 + .3 : .72);
        if (xOverlap) {
          if (hazard) {
            const collides = e.type === 'jump' ? playerY < 1.02 : e.type === 'slide' ? playerY < 3 && (p.slide <= 0 || playerY > .2) : playerY < 2.85;
            if (collides) this._hit(e);
          } else if (Math.abs(playerY + .85 - e.y) < .95 || e.magnetic) this._pickup(e);
        }
      }
      if (this.state !== 'RUNNING') break;
      if (hazard && !e.passed && e.z > halfDepth) {
        e.passed = true;
        if (!e.hit && Math.abs(p.x - e.x) < 2.1) {
          this.dodgeStreak++; this.perfectDodges++;
          const bonus = this.dodgeStreak % 5 === 0 ? 100 : 15;
          this.score += bonus * this.powers.scoreMultiplier;
          this.emit('dodge', { streak: this.dodgeStreak, bonus });
        }
      }
      if (e.z > 9) e.active = false;
    }
    if (this.state === 'RUNNING') this._fillAhead();
  }
  _pickup(entity) {
    entity.active = false; entity.hit = true;
    const kind = entity.type;
    if (kind === 'coin') { this.coins++; this.score += 10 * this.powers.scoreMultiplier; }
    else this.powers.activate(kind);
    this.emit('pickup', { kind, id: entity.id, x: entity.x, y: entity.y, chips: this.chips, coins: this.coins });
  }
  _hit(entity) {
    entity.hit = true;
    if (this.debug.invincible || this.powers.invulnerable) {
      entity.active = false;
      this.score += 20 * this.powers.scoreMultiplier;
      this.emit('smash', { kind: entity.type, x: entity.x }); return;
    }
    if (this.player.hit > 0) return;
    this.policeDistance = Math.max(0, this.policeDistance - 4);
    this.player.hit = 1.2; this._slowRemaining = .65; this._hitAge = 0; this.dodgeStreak = 0;
    this.emit('hit', { kind: entity.type, policeDistance: this.policeDistance });
    if (this.policeDistance <= 0) {
      this.player.anim = 'caught';
      this.setState('GAME_OVER'); this.emit('gameover', this.snapshot());
    }
  }
  snapshot() {
    return { state: this.state, distance: Math.floor(this.distance), time: this.time, speed: this.speed,
      score: Math.floor(this.score), coins: this.coins,
      policeDistance: this.policeDistance, theme: this.theme, themeIndex: this.themeIndex, tier: this.tier,
      perfectDodges: this.perfectDodges, lane: this.player.lane, activeEntities: this.entities.filter(e => e.active).length,
      powers: [...this.powers.active.values()].map(p => ({ ...p })) };
  }
}
