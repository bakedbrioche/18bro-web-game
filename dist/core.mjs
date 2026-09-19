/** 18Bro deterministic, DOM-free runner simulation. World approaches +Z; cat stays at Z=0. */
import { INTRO_DURATION, CAPTURE_DURATION, introPose, capturePose } from './choreography.mjs?v=street-26';
import { ROUTE, BRANCHES, getRouteProfile, branchOffset, getTrafficPhase, CROSS_STREETS, PEDESTRIAN_STOP } from './route.mjs?v=street-26';
export { INTRO_DURATION, CAPTURE_DURATION } from './choreography.mjs?v=street-26';
export const LANES = Object.freeze([-2.5, 0, 2.5]);
export const THEMES = Object.freeze(['HONG KONG']);
export const POWER_DURATIONS = Object.freeze({ magnet: 8, moon: 5, moped: 10 });
export const MOTION = Object.freeze({ laneDuration: .16, jumpDuration: .82, jumpHeight: 2.65, slideDuration: .72, jumpBuffer: .1, coyoteTime: .08 });
export const BARRIERS = Object.freeze({ jump: { height: 1.9, width: 2.35, depth: 1.0 }, blocker: { opening: 1.55, height: 4.55, width: 2.38, depth: 1.65 }, slide: { height: 4.05, width: 2.38, depth: .9 } });
export const VEHICLES = Object.freeze({ traffic: { approach: 2.05, height: 1.89, width: 1.94, depth: 3.56 }, scooter: { approach: 1.9, height: 2.26, width: 1.04, depth: 2.0 } });
const GRAVITY = 8 * MOTION.jumpHeight / MOTION.jumpDuration ** 2;
const JUMP_VELOCITY = GRAVITY * MOTION.jumpDuration / 2;
const HAZARDS = new Set(['blocker', 'jump', 'slide', 'traffic', 'scooter', 'crossTraffic']);
const COLLECTIBLES = new Set(['coin']);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;

/** Templates always reserve at least one untouched lane, including a moving hazard's sweep. */
export const PATTERNS = Object.freeze([
  { minTier: 1, slots: ['traffic', null, null] },
  { minTier: 1, slots: [null, 'traffic', null] },
  { minTier: 1, slots: [null, null, 'traffic'] },
  { minTier: 1, slots: ['scooter', null, null] },
  { minTier: 1, slots: [null, 'scooter', 'jump'] },
  { minTier: 1, slots: [null, 'jump', null] },
  { minTier: 1, slots: ['slide', null, null] },
  { minTier: 1, slots: ['traffic', null, 'jump'] },
  { minTier: 2, slots: [null, 'traffic', 'traffic'] },
  { minTier: 2, slots: ['slide', 'traffic', null] },
  { minTier: 2, slots: ['scooter', null, 'traffic'] },
  { minTier: 2, slots: ['jump', null, 'blocker'] },
  { minTier: 3, slots: ['traffic', 'traffic', null] },
  { minTier: 3, slots: ['blocker', null, 'slide'] },
  { minTier: 2, slots: ['traffic', 'scooter', null] },
  { minTier: 2, slots: [null, 'traffic', 'jump'] },
  { minTier: 3, slots: ['blocker', 'traffic', null] },
  { minTier: 4, slots: [null, 'scooter', 'traffic'] },
  { minTier: 4, slots: ['traffic', null, 'blocker'] },
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
  const reaction = [1.24, 1.12, 1.01, .94][clamp(tier, 1, 4) - 1];
  return Math.max(13.5, speed * reaction + 2.8);
}

const POWER_DEFINITIONS = {
  magnet: { activate() {}, update() {}, end() {} },
  moon: { activate() {}, update() {}, end() {} },
  moped: { activate(game) { game.policeDistance=18;game._hitAge=100; }, update(game) { game.policeDistance=18; }, end() {} },
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
  get speedMultiplier() { return this.has('moped') ? 1.5 : this.has('moon') ? 1.5 : 1; }
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
    this.distance = 0; this.time = 0; this.speed = 10.4; this.score = 0; this.chips = 0; this.coins = 0;
    this.chipMeter = 0; this.policeDistance = 1.5; this.themeIndex = 0; this.theme = THEMES[0];
    this.tier = 1; this.tiers = 1; this.dodgeStreak = 0; this.perfectDodges = 0;
    this.introRemaining = INTRO_DURATION; this.introProgress = 0; this._hitAge = 100; this._slowRemaining = 0;
    this.mistakes = 0; this.shieldGrace = 0; this.captureRemaining = 0; this.captureDuration = CAPTURE_DURATION; this.captureProgress = 0; this.crash = null;
    this._spawnCursor = 30; this._rowId = 0; this._poolCursor = 0; this._lastSafeLane = 1;
    this.patternHistory = []; this.powers.clear();
    this.route=getRouteProfile(0);this.routeTraffic=getTrafficPhase(0);this._branch=null;this._branchEntries=new Set();this._crossWave=-1;this._crossReleased=false;this._routeComplete=false;this._routeWaiting=false;
    for (const entity of this.entities) entity.active = false;
    for (let i = 0; i < this.chunks.length; i++) Object.assign(this.chunks[i], { z: -i * 32, index: i, theme: THEMES[0] });
  }
  start({ skipIntro = false } = {}) {
    this._reset();
    this._fillAhead();
    if (skipIntro) { this.introRemaining = 0; this.introProgress = 1; this.player.anim = 'run'; }
    this.setState(skipIntro ? 'RUNNING' : 'STARTING');
  }
  pause() { if (['RUNNING', 'STARTING', 'CAUGHT'].includes(this.state)) { this._beforePause = this.state; this.setState('PAUSED'); } }
  resume() { if (this.state === 'PAUSED') this.setState(this._beforePause || 'RUNNING'); }
  menu() { this._reset(); this.setState('MAIN_MENU'); }
  seekArea(distance) {
    this.start({skipIntro:true});this.distance=clamp(Number(distance)||ROUTE.start,0,ROUTE.end-1);
    this.time=this.distance/15;this._spawnCursor=this.distance+30;
    for(const e of this.entities)e.active=false;
    this._branch=null;this._branchEntries=new Set(BRANCHES.filter(b=>b.start<this.distance).map(b=>b.id));
    this._refreshRoute();this._fillAhead();return this.route;
  }
  _refreshRoute() {
    const s=this.distance;
    if(this._branch&&s>=this._branch.end){this._branch=null;this._crossReleased=false;}
    const pose=this._branch?branchOffset(this._branch,s):null;
    this.route={...getRouteProfile(s),...(pose?{offsetX:pose.x,offsetY:pose.y}:{}),
      branch:this._branch?.id||null,branchProgress:this._branch?clamp((s-this._branch.start)/(this._branch.end-this._branch.start),0,1):0,
      waiting:!!this._routeWaiting};
    this.routeTraffic=getTrafficPhase(this.time);
  }
  _enterRoutes(before,after) {
    for(const branch of BRANCHES){
      if(this._branchEntries.has(branch.id)||branch.start<before||branch.start>after)continue;
      this._branchEntries.add(branch.id);
      if(this._branch||this.player.lane!==(branch.side<0?0:2))continue;
      this._branch=branch;this._crossReleased=false;
      this.player.laneFrom=this.player.x;this.player.lane=1;this.player.laneElapsed=0;
      // Route selection is physical. Remove only unreached procedural encounters
      // in the passage; traffic on the main road continues past its doorway.
      for(const e of this.entities)if(e.active&&e.routeBranch===branch.id)e.active=false;
      for(let s=branch.start+32;s<branch.end-24;s+=12){
        this.spawnEntity('coin',1,this.distance-s,{routeBranch:branch.id,y:.95});
        if(branch.kind!=='crossing'&&branch.kind!=='cover'&&Math.round(s)%48===0)this.spawnEntity('slide',0,this.distance-s-6,{routeBranch:branch.id});
      }
      this.emit('branch',{id:branch.id});
    }
  }
  _updateCrossTraffic(dt) {
    if(this.distance<ROUTE.intersectionStart-95||this.distance>ROUTE.intersectionEnd+25)return;
    const phase=getTrafficPhase(this.time),wave=Math.floor(this.time/1.55);
    if(phase.cross==='green'&&wave!==this._crossWave){
      this._crossWave=wave;
      for(const [index,street]of CROSS_STREETS.entries()){
        const kind=(phase.cycle+wave+index)%5,vehicleKind=kind===0?'bus':kind===1?'van':kind===2?'scooter':kind===3?'police':'taxi';
        const length=vehicleKind==='bus'?6.8:vehicleKind==='van'?4.7:vehicleKind==='scooter'?2:3.55;
        const e=this.spawnEntity('crossTraffic',1,this.distance-street.distance,{x:-street.direction*33,z:this.distance-street.distance,
          anchor:street.distance,crossSpeed:street.direction*10,vehicleKind,width:length,depth:vehicleKind==='scooter'?1.05:1.96,height:vehicleKind==='bus'?2.9:vehicleKind==='van'?2.25:1.9,yaw:street.direction*Math.PI/2,approachFactor:1});
        if(e)e.previousZ=e.z;
      }
    }
    for(const e of this.entities)if(e.active&&e.type==='crossTraffic'&&Math.abs(e.x)>42)e.active=false;
  }
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
    const vehicle = VEHICLES[type], dimensions = vehicle || BARRIERS[type];
    const approachFactor = vehicle?.approach || 1;
    z *= approachFactor;
    Object.assign(entity, { active: true, type, lane, x: LANES[lane], y: isHazard ? 0 : 1.0, z,
      previousZ: z, approachFactor, width: dimensions?.width || .75,
      depth: dimensions?.depth || .72, height: dimensions?.height || 1.02, stopped: false, blocked: false, actualApproach: approachFactor,
      variant: 0, hit: false, passed: false, magnetic: false, age: 0, rowId: -1,
      routeBranch:null,finale:false,anchor:null,yaw:null,crossSpeed:0,vehicleKind:null,
      safeLane: -1, fromLane: lane, toLane: lane, spawnDistance: this.distance - z, ...extra });
    return entity;
  }
  debugSpawn(type, lane = this.player.lane) {
    return this.spawnEntity(type, lane, -Math.max(18, this.speed * 2.2));
  }
  _makePattern() {
    const dense = this._random() < [0, .35, .55, .7][this.tier - 1];
    const candidates = PATTERNS.filter(p => p.minTier <= this.tier && (!dense || p.slots.filter(Boolean).length === 2));
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
    if(spawnDistance>=ROUTE.end)return 60;
    const doorway=BRANCHES.find(b=>Math.abs(spawnDistance-b.start)<12||Math.abs(spawnDistance-b.end)<10);
    if(doorway){for(let i=0;i<3;i++)this.spawnEntity('coin',doorway.side<0?0:2,this.distance-spawnDistance-i*2.5);return 18;}
    // A broad junction uses its real lateral traffic and signal cycle, not a
    // second layer of invisible procedural roadblocks.
    if(spawnDistance>2950&&spawnDistance<3320||spawnDistance>ROUTE.roadblock){
      if(spawnDistance<ROUTE.roadblock||spawnDistance>5520)for(let i=0;i<3;i++)this.spawnEntity('coin',1,this.distance-spawnDistance-i*2.5,{y:1,finale:spawnDistance>ROUTE.roadblock});
      return 24;
    }
    const pattern = this._makePattern();
    const rowId = this._rowId++;
    const z = this.distance - spawnDistance;
    for (let lane = 0; lane < 3; lane++) {
      const type = pattern.slots[lane];
      if (!type) continue;
      // Three dodge positions share two traffic lanes in the new narrow streets.
      if(spawnDistance>=ROUTE.start&&lane===1&&VEHICLES[type]){pattern.slots[lane]=null;continue;}
      const dimensions=VEHICLES[type]||BARRIERS[type],approach=VEHICLES[type]?.approach||1;
      let actualZ=z*approach;
      const laneHazards=this.entities.filter(e=>e.active&&HAZARDS.has(e.type)&&e.lane===lane);
      // A new barrier never blocks an already approaching vehicle. Delayed traffic
      // starts far enough back to arrive only after existing barriers leave the road.
      if(BARRIERS[type]&&laneHazards.some(e=>VEHICLES[e.type]&&e.z<actualZ+dimensions.depth)){
        pattern.slots[lane]=null;continue;
      }
      if(VEHICLES[type]){
        for(const e of laneHazards)if(BARRIERS[e.type])actualZ=Math.min(actualZ,-30-approach*Math.max(0,9-e.z));
        for(const e of laneHazards)if(VEHICLES[e.type])actualZ=Math.min(actualZ,e.z-(e.depth+dimensions.depth)/2-8);
      }
      if(laneHazards.some(e=>Math.abs(e.z-actualZ)<(e.depth+dimensions.depth)/2+.8)){
        pattern.slots[lane]=null;continue;
      }
      this.spawnEntity(type,lane,z,{z:actualZ,previousZ:actualZ,delayedForBarrier:actualZ<z*approach-1e-6,
        rowId,safeLane:pattern.safeLane,variant:Math.floor(this._random()*3),fromLane:lane,toLane:lane});
    }
    // Coins lead through the guaranteed clear lane, aligned to scheduled encounters.
    for (let i = 0; i < 4; i++) this.spawnEntity('coin', pattern.safeLane, z + 3.375 - i * 2.25, { rowId, y: 1.0 });
    const jumpLane = pattern.slots.indexOf('jump');
    if (jumpLane >= 0) {
      // Samples of the actual jump parabola: the center coin sits above the barrier at the apex.
      for (let i = -2; i <= 2; i++) {
        const offset = i * .12;
        this.spawnEntity('coin', jumpLane, z + this.speed * offset, { rowId, y: .7 + MOTION.jumpHeight * (1 - (2 * offset / MOTION.jumpDuration) ** 2), jumpArc: true });
      }
    }
    if (rowId > 0 && rowId % 8 === 3) {
      const kind = ['moped', 'magnet', 'moped', 'moon'][Math.floor(rowId / 8) % 4];
      this.spawnEntity(kind, pattern.safeLane, z + 8, { rowId, y: 1.2 });
    }
    const spacing = obstacleSpacing(this.speed, this.tier)*(spawnDistance>ROUTE.start?1.5-getRouteProfile(spawnDistance).trafficIntensity*.55:1);
    this.patternHistory.push({ id: rowId, distance: spawnDistance, spacing, speed: this.speed, tier: this.tier, ...pattern });
    if (this.patternHistory.length > 32) this.patternHistory.shift();
    return spacing;
  }
  _fillAhead() {
    const ahead = Math.max(160, this.speed * 6);
    while (this._spawnCursor < this.distance + ahead) this._spawnCursor += this._spawnPattern(this._spawnCursor);
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.state === 'ARCADE' || this.state === 'PAUSED' || this.state === 'MAIN_MENU' || (this.state === 'GAME_OVER' && !this.captureRemaining)) return;
    let remaining = Math.min(dt, 1); // A suspended tab cannot advance seconds of unseen hazards.
    if (this.state === 'CAUGHT') {
      this.captureRemaining = Math.max(0, this.captureRemaining - remaining);
      this.captureProgress = 1 - this.captureRemaining / this.captureDuration;
      if (!this.captureRemaining) { this.setState('GAME_OVER'); this.emit('gameover', this.snapshot()); }
      return;
    }
    if (this.state === 'STARTING') {
      const introDt = Math.min(remaining, this.introRemaining);
      this.introRemaining -= introDt; this.introProgress = 1 - this.introRemaining / INTRO_DURATION; remaining -= introDt;
      if (this.introRemaining <= 1e-8) { this.introRemaining = 0; this.distance=introPose(INTRO_DURATION).distance; this.player.anim = 'run'; this.setState('RUNNING'); }
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
    this.tier = this.tiers = clamp(Math.round(this.debug.tierOverride || (this.time < 20 ? 1 : this.time < 55 ? 2 : this.time < 110 ? 3 : 4)), 1, 4);
    this._hitAge += dt; this._slowRemaining = Math.max(0, this._slowRemaining - dt);
    this.shieldGrace = Math.max(0, this.shieldGrace - dt);
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
        if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; p.coyote = MOTION.coyoteTime; this.emit('land', {x:p.x}); }
      } else p.coyote = MOTION.coyoteTime;
      if (p.grounded && p.jumpBuffer > 0 && p.slide <= MOTION.slideDuration / 2) this._jump();
    }
    p.anim = p.hit > .65 ? 'hit' : p.slide > 0 ? 'slide' : p.y > .01 ? p.vy >= 0 ? 'jump' : 'fall' : 'run';
    const baseSpeed = this.debug.speedOverride != null ? clamp(Number(this.debug.speedOverride) || 10.4, 2, 120) : Math.min(26, 10.4 + this.time * .12);
    this.speed = baseSpeed * this.powers.speedMultiplier * (this._slowRemaining > 0 ? .7 : 1);
    if(this.distance>=ROUTE.start&&this.debug.speedOverride==null)this.speed=Math.min(this.speed,getRouteProfile(this.distance).speedLimit*this.powers.speedMultiplier);
    const phase=getTrafficPhase(this.time),beforeDistance=this.distance;
    this._routeWaiting=false;
    if(this._branch?.id==='crossing'&&!this._crossReleased&&this.distance+this.speed*dt>=PEDESTRIAN_STOP){
      if(phase.pedestrian==='green'&&phase.remaining>=4.3)this._crossReleased=true;
      else {this.speed=Math.min(this.speed,Math.max(0,PEDESTRIAN_STOP-this.distance)/dt);this._routeWaiting=true;}
    }
    const movement=Math.min(this.speed*dt,Math.max(0,ROUTE.end-this.distance));
    this.distance+=movement;this._enterRoutes(beforeDistance,this.distance);this._refreshRoute();this._updateCrossTraffic(dt);
    if(this._routeWaiting)p.anim='idle';
    this.score += movement * this.powers.scoreMultiplier;
    if(this.time>2.5&&this._hitAge>9){const chaseGap=10-(this.route.night||0)*6;
      if(this.policeDistance<chaseGap)this.policeDistance=Math.min(chaseGap,this.policeDistance+dt*1.65);
      else if(this.route.night>0&&!this.powers.has('moped'))this.policeDistance=Math.max(chaseGap,this.policeDistance-dt*.3*this.route.night);
    }
    this.themeIndex = 0; this.theme = THEMES[0];
    for (const chunk of this.chunks) {
      chunk.z += movement;
      if (chunk.z > 32) { chunk.z -= this.chunks.length * 32; chunk.index += this.chunks.length; chunk.theme = this.theme; }
    }
    // Plan front-to-back from one snapshot. Traffic brakes behind barriers and queued
    // vehicles; it still scrolls with the street when its own forward speed is zero.
    const roadHazards=this.entities.filter(e=>e.active&&HAZARDS.has(e.type)&&e.type!=='crossTraffic').sort((a,b)=>b.z-a.z);
    for(const e of roadHazards){
      e.nextZ=e.stopped?e.z:e.z+movement*e.approachFactor;e.blocked=false;
      if(VEHICLES[e.type]&&!e.stopped){
        const ahead=roadHazards.filter(other=>other!==e&&other.lane===e.lane&&other.routeBranch===e.routeBranch&&other.z>e.z).at(-1);
        if(ahead){
          const limit=ahead.nextZ-(ahead.depth+e.depth)/2-.75;
          e.nextZ=Math.min(e.nextZ,Math.max(e.z+movement,limit));
          e.blocked=e.nextZ<e.z+movement*e.approachFactor-1e-8;
        }
      }
      e.actualApproach=movement?(e.nextZ-e.z)/movement:0;
    }
    for (const e of this.entities) {
      if (!e.active) continue;
      e.age += dt;
      e.previousZ = e.z;
      const oldX = e.x;
      if(!e.stopped){if(e.type==='crossTraffic'){e.z=this.distance-e.anchor;e.x+=e.crossSpeed*dt;}else e.z=HAZARDS.has(e.type)?e.nextZ:e.z+movement*e.approachFactor;}
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
        const branchMagnitude=this._branch?Math.min(1,Math.abs(this.route.offsetX)/Math.abs(this._branch.offset)):(this.route.arcade||0);
        const lateralScale=1-branchMagnitude*.68;
        const playerX = mix(previousX, p.x, crossing)*lateralScale+this.route.offsetX;
        const playerY = mix(previousY, p.y, crossing);
        const ep=e.routeBranch?branchOffset(e.routeBranch,this.distance-e.z):{x:e.finale?getRouteProfile(this.distance-e.z).offsetX:0};
        const entityX = mix(oldX, e.x, crossing)*(e.routeBranch===this.route.branch&&e.routeBranch?lateralScale:1)+(ep.x||0);
        const sameFloor=(!e.routeBranch||e.routeBranch===this.route.branch)&&!(e.type==='crossTraffic'&&this.route.branch==='corner-shop');
        const xOverlap = sameFloor&&Math.abs(playerX - entityX) < (hazard ? e.width / 2*(e.routeBranch?lateralScale:1) + .3 : .72);
        if (xOverlap) {
          if (hazard) {
            const collides = (e.type === 'slide'||e.type === 'blocker') ? playerY < e.height && (p.slide <= 0 || playerY > .2) : playerY < e.height;
            if (collides) {
              const sideImpact = !!VEHICLES[e.type] && (Math.abs(playerX - entityX) > e.width * .39 || (e.previousZ > -halfDepth + .12 && Math.abs(p.x - previousX) > .001));
              const edgeNick = !!VEHICLES[e.type] && e.height <= MOTION.jumpHeight && !p.grounded && p.vy > 0 && playerY >= e.height-.32;
              this._hit(e, edgeNick ? 'edge' : sideImpact ? 'side' : 'front');
            }
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
    if(this.state==='RUNNING'&&this.distance>=ROUTE.end){this.speed=0;p.anim='idle';this._routeComplete=true;this.setState('ARCADE');this.emit('routecomplete',this.snapshot());}
    if (this.state === 'RUNNING') this._fillAhead();
  }
  _pickup(entity) {
    entity.active = false; entity.hit = true;
    const kind = entity.type;
    if (kind === 'coin') { this.coins++; this.score += 10 * this.powers.scoreMultiplier; }
    else this.powers.activate(kind);
    this.emit('pickup', { kind, id: entity.id, x: entity.x, y: entity.y, chips: this.chips, coins: this.coins });
  }
  _hit(entity, impact = 'front') {
    entity.hit = true;
    if (this.debug.invincible || this.powers.invulnerable) {
      entity.active = false;
      this.score += 20 * this.powers.scoreMultiplier;
      this.emit('smash', { kind: entity.type, x: entity.x }); return;
    }
    if (this.shieldGrace > 0) { entity.active = false; return; }
    if (this.powers.has('moped')) {
      this.powers.remove('moped', 'collision'); entity.active = false;
      this.shieldGrace = 1.1; this.player.hit = 0;
      this.emit('shieldbreak', { kind: entity.type }); return;
    }
    // Barriers and direct vehicle impacts are fatal. A side clip or late jump-edge nick stumbles.
    if (impact === 'front' || BARRIERS[entity.type]) { this._capture(entity); return; }
    if (this.player.hit > 0) return;
    this.mistakes++;
    if (this.mistakes >= 2) { this._capture(entity); return; }
    this.policeDistance = 1.5;
    this.player.hit = 1.15; this._slowRemaining = .8; this._hitAge = 0; this.dodgeStreak = 0;
    this.emit('hit', { kind: entity.type, impact, x: this.player.x, policeDistance: this.policeDistance });
  }
  _capture(entity) {
    entity.stopped = true;
    this.captureDuration=CAPTURE_DURATION;
    this.crash = { kind: entity.type, entityId: entity.id, x: this.player.x, y: this.player.y, z: entity.z };
    this.policeDistance = 0; this.speed = 0; this.player.hit = 0;
    this.player.anim = 'caught'; this.player.vy = 0; this.player.slide = 0;
    this.captureRemaining = this.captureDuration; this.captureProgress = 0;
    this.setState('CAUGHT'); this.emit('crash', { kind: entity.type, x: this.player.x });
  }
  snapshot() {
    return { state: this.state, distance: Math.floor(this.distance), time: this.time, speed: this.speed,
      score: Math.floor(this.score), coins: this.coins,
      policeDistance: this.policeDistance, mistakes: this.mistakes, mopedShield: this.powers.has('moped'), captureProgress: this.captureProgress, crash: this.crash, theme: this.theme, themeIndex: this.themeIndex, tier: this.tier,
      perfectDodges: this.perfectDodges, lane: this.player.lane, activeEntities: this.entities.filter(e => e.active).length,
      route:{...this.route},routeTraffic:{...this.routeTraffic},
      powers: [...this.powers.active.values()].map(p => ({ ...p })) };
  }
}
