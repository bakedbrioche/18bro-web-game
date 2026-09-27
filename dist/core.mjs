/** 18Bro deterministic, DOM-free runner simulation. World approaches +Z; cat stays at Z=0. */
import { INTRO_DURATION, CAPTURE_DURATION, introPose, capturePose } from './choreography.mjs?v=street-28';
import { ROUTE, BRANCHES, getRouteProfile, branchOffset, getTrafficPhase, crossStreetsAt } from './route.mjs?v=street-28';
import { NET_PURSUIT, NetPursuitController } from './net-pursuit.mjs?v=graphics2-2';
export { INTRO_DURATION, CAPTURE_DURATION } from './choreography.mjs?v=street-28';
export const LANES = Object.freeze([-2.5, 0, 2.5]);
export const THEMES = Object.freeze(['HONG KONG']);
export const POWER_DURATIONS = Object.freeze({ magnet: 8, moon: 10, speedburst: 8, moped: 10, shield:15, doublechips:12, jetpack:10 });
export const NET_PURSUIT_SCHEDULE = Object.freeze({ firstMin: 520, firstRange: 180, repeatMin: 700, repeatRange: 350 });
export const POWER_SPAWN = Object.freeze({
  rowInterval: 8,
  rowOffset: 3,
  weights: Object.freeze({ magnet: 30, moon: 24, speedburst: 16, doublechips: 13, moped: 8, shield: 5, jetpack: 4 }),
});
export const SHIELD_CHARGES = 3;
export const COIN_SEQUENCES = Object.freeze({
  lengthWeights: Object.freeze({ 3: 1, 4: 3, 5: 3, 6: 1 }),
  patterns: Object.freeze(['straight', 'lateral', 'weave']),
});
export const COIN_SECTIONS = Object.freeze({
  gapMin: 28,
  gapMax: 36,
});
export const MOTION = Object.freeze({ laneDuration: .16, jumpDuration: .82, jumpHeight: 2.65, moonJumpDuration: 1.16, moonJumpHeight: 6.1, slideDuration: .72, jumpBuffer: .1, coyoteTime: .08 });
export const JETPACK_PHASES = Object.freeze({ lift: 1.2, descent: 1.3, visibleChips: 8 });
export const INTERSECTION_TRAFFIC = Object.freeze({
  cadenceByTier: Object.freeze([2.8, 2.55, 2.3, 2.1]),
  crossingSpeed: 10,
  maxVehicleWidth: 4.7,
  requiredClearTime: MOTION.jumpDuration + MOTION.laneDuration * 2,
});
export const BARRIERS = Object.freeze({ jump: { height: 1.9, width: 2.35, depth: 1.0 }, blocker: { opening: 1.55, height: 4.55, width: 2.38, depth: 1.65 }, slide: { height: 4.05, width: 2.38, depth: .9 } });
export const VEHICLES = Object.freeze({ traffic: { approach: 2.05, height: 1.89, width: 1.94, depth: 3.56 }, scooter: { approach: 1.9, height: 2.26, width: 1.04, depth: 2.0 } });
const GRAVITY = 8 * MOTION.jumpHeight / MOTION.jumpDuration ** 2;
const JUMP_VELOCITY = GRAVITY * MOTION.jumpDuration / 2;
const MOON_GRAVITY = 8 * MOTION.moonJumpHeight / MOTION.moonJumpDuration ** 2;
const MOON_JUMP_VELOCITY = MOON_GRAVITY * MOTION.moonJumpDuration / 2;
const HAZARDS = new Set(['blocker', 'jump', 'slide', 'traffic', 'scooter', 'crossTraffic']);
const COLLECTIBLES = new Set(['coin']);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const seededUnit = (seed, index, salt = 0) => {
  let n = (Number(seed) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

export function intersectionTrafficWindow(tier = 1) {
  const cadence = INTERSECTION_TRAFFIC.cadenceByTier[clamp(Math.round(tier), 1, 4) - 1];
  const occupiedTime = INTERSECTION_TRAFFIC.maxVehicleWidth / INTERSECTION_TRAFFIC.crossingSpeed;
  return { cadence, occupiedTime, clearTime: cadence - occupiedTime, requiredClearTime: INTERSECTION_TRAFFIC.requiredClearTime };
}

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
  speedburst: { activate() {}, update() {}, end() {} },
  shield: { activate() {}, update() {}, end() {} },
  doublechips: { activate() {}, update() {}, end() {} },
  jetpack: { refreshActivation: true, activate(game) {game.powers.remove('moped');game.player.vy=0;game.player.slide=0;game.player.jumpBuffer=0;game._clearGroundCoinsAhead();game._createFlightTrail();}, update() {}, end(game) {game._finishJetpackLanding();} },
  moped: { activate(game) { game.powers.remove('jetpack');game.policeDistance=18;game._hitAge=100;game.player.mopedMount=.625;game.player.mopedSlideSide=0; }, update(game) { game.policeDistance=18; }, end(game) { game.player.mopedMount=0;game.player.mopedSlideSide=0; } },
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
    this.active.set(type, { type, duration, remaining: duration, elapsed: 0, ...(type === 'shield' ? { charges: SHIELD_CHARGES } : {}) });
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
      power.remaining = Math.max(0, power.remaining - dt);
      // A coin already caught by the magnet remains owed to the player. Keep the
      // visual power alive while it completes its trip, but do not tag new coins.
      const magnetDebt = type === 'magnet' && this.game.entities.some(e => e.active && e.magnetLatched);
      if (power.remaining <= 1e-8 && !magnetDebt) this.remove(type);
    }
  }
  get speedMultiplier() { return Math.max(this.has('moped') ? 1.5 : 1, this.has('speedburst') ? 1.6 : 1); }
  get scoreMultiplier() { return 1; }
  get magnetRadius() { return (this.active.get('magnet')?.remaining || 0) > 0 ? 10 : 0; }
  get shieldCharges() { return this.active.get('shield')?.charges || 0; }
  get invulnerable() { return this.has('jetpack'); }
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
  _routeProfile(s){return getRouteProfile(s,this.routeSeed);}
  _reset() {
    this.routeSeed=Math.floor(this._random()*4294967295);
    this.player = { x: 0, lane: 1, y: 0, vy: 0, jumpApex: MOTION.jumpHeight, jumpGravity: GRAVITY, slide: 0, hit: 0, grounded: true, anim: 'idle', laneFrom: 0, laneElapsed: MOTION.laneDuration, jumpBuffer: 0, coyote: MOTION.coyoteTime,
      mopedMount: 0, mopedSlideSide: 0, roofEntityId: null };
    this.distance = 0; this.time = 0; this.speed = 10.4; this.score = 0; this.chips = 0; this.coins = 0;
    this.chipMeter = 0; this.policeDistance = 1.5; this.themeIndex = 0; this.theme = THEMES[0];
    this.tier = 1; this.tiers = 1; this.dodgeStreak = 0; this.perfectDodges = 0;
    this.introRemaining = INTRO_DURATION; this.introProgress = 0; this._hitAge = 100; this._slowRemaining = 0;
    this.mistakes = 0; this.shieldGrace = 0; this.captureRemaining = 0; this.captureDuration = CAPTURE_DURATION; this.captureProgress = 0; this.crash = null;
    this._spawnCursor = 30; this._rowId = 0; this._poolCursor = 0; this._lastSafeLane = 1;
    this._coinSequenceId = 0; this._lastCoinPattern = null; this._lastCoinLane = null;
    this._coinSectionIndex = 0; this._coinSectionCursor = this._coinSectionGap(0);
    this._lastPowerKind = null;
    this._jetpackTrailId = 0; this._jetpackFinalChip = null; this._flightTrailPlan = []; this._flightTrailCursor = 0; this._flightTrailSpacing = 3;
    this.patternHistory = []; this.powers.clear();
    this._netPursuitCount=0;this._netPursuitController=new NetPursuitController({seed:this.routeSeed^0x18b0cafe,onEvent:event=>this._handleNetPursuitEvent(event)});
    this.netPursuit=this._netPursuitController.snapshot();this._nextNetPursuitDistance=NET_PURSUIT_SCHEDULE.firstMin+seededUnit(this.routeSeed,0,1818)*NET_PURSUIT_SCHEDULE.firstRange;
    this.route=this._routeProfile(0);this.routeTraffic=getTrafficPhase(0);this._branch=null;this._branchEntries=new Set();this._crossWave=-1;this._crossReleased=false;this._routeComplete=false;this._routeWaiting=false;
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
  _scheduleNextNetPursuit() {
    const index=++this._netPursuitCount;
    this._nextNetPursuitDistance=this.distance+NET_PURSUIT_SCHEDULE.repeatMin+seededUnit(this.routeSeed,index,1818)*NET_PURSUIT_SCHEDULE.repeatRange;
  }
  _handleNetPursuitEvent(event) {
    if(event.type==='netpursuitsuccess'){
      this.score+=event.bonus;this._scheduleNextNetPursuit();
    }else if(event.type==='netcaught'){
      this.captureDuration=Object.values(NET_PURSUIT.captureSeconds).reduce((sum,value)=>sum+value,0);
      this.captureRemaining=this.captureDuration;this.captureProgress=0;
      this.crash={kind:'net',x:this.player.x,y:this.player.y,z:0,guardIndex:event.guardIndex};
      this.policeDistance=0;this.speed=0;this.player.hit=0;this.player.anim='caught';this.player.vy=0;this.player.slide=0;
      this.setState('CAUGHT');this.emit('crash',{kind:'net',x:this.player.x,guardIndex:event.guardIndex});
    }
    this.emit(event.type,event);
  }
  _startNetPursuit() {
    if(this.state!=='RUNNING'||this.netPursuit?.active)return false;
    this.netPursuit=this._netPursuitController.start({playerLane:this.player.lane,playerX:this.player.x,distance:this.distance});
    this._protectNetEscapeLane();return true;
  }
  _protectNetEscapeLane() {
    const pursuit=this.netPursuit;if(!pursuit?.active)return;
    const lanes=pursuit.safety?.keepClearLanes||[];if(!lanes.length)return;
    const horizon=Math.max(8,(pursuit.safety.protectForSeconds||0)*Math.max(this.speed,10.4)+5);
    for(const entity of this.entities){
      if(!entity.active||!HAZARDS.has(entity.type)||entity.z>4||entity.z< -horizon)continue;
      const blocks=entity.type==='crossTraffic'
        ?lanes.some(lane=>Math.abs(entity.x-LANES[lane])<entity.width/2+.65)
        :lanes.includes(entity.lane);
      if(blocks)entity.active=false;
    }
  }
  _updateNetPursuit(dt) {
    const eligible=!this.debug.invincible&&!this.netPursuit?.active&&this.distance>=this._nextNetPursuitDistance&&!this.route.branch&&this.route.id!=='intersection'&&!this.powers.has('jetpack')&&!this.powers.has('moped')&&this.player.grounded;
    if(eligible)this._startNetPursuit();
    if(!this.netPursuit?.active)return;
    this.netPursuit=this._netPursuitController.update(dt,{playerLane:this.player.lane,playerX:this.player.x,distance:this.distance});
    const pursuitTarget=this.netPursuit.phase==='retreat'?12:this.netPursuit.active?1.65:this.policeDistance;
    this.policeDistance+=(pursuitTarget-this.policeDistance)*(1-Math.exp(-dt*(this.netPursuit.phase==='retreat'?2.4:4.2)));
    this._protectNetEscapeLane();
  }
  seekArea(distance) {
    this.start({skipIntro:true});this.distance=clamp(Number(distance)||ROUTE.start,0,ROUTE.end-1);
    this.time=this.distance/15;this._spawnCursor=this.distance+30;
    this._coinSectionIndex=Math.floor(this.distance/((COIN_SECTIONS.gapMin+COIN_SECTIONS.gapMax)/2));
    this._coinSectionCursor=this.distance+this._coinSectionGap(this._coinSectionIndex);
    for(const e of this.entities)e.active=false;
    this._branch=null;this._branchEntries=new Set(BRANCHES.filter(b=>b.start<this.distance).map(b=>b.id));
    this._refreshRoute();this._fillAhead();return this.route;
  }
  _refreshRoute() {
    const s=this.distance;
    if(this._branch&&s>=this._branch.end){this._branch=null;this._crossReleased=false;}
    const pose=this._branch?branchOffset(this._branch,s):null;
    this.route={...this._routeProfile(s),...(pose?{offsetX:pose.x,offsetY:pose.y}:{}),
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
    const streets=crossStreetsAt(this.distance,this.routeSeed);if(!streets.length)return;
    const phase=getTrafficPhase(this.time),window=intersectionTrafficWindow(this.tier);
    const slot=phase.cross==='green'?Math.floor(Math.max(0,phase.time-11)/window.cadence):-1;
    const wave=slot<0?null:`${phase.cycle}:${slot}`;
    if(wave!==null&&wave!==this._crossWave){
      this._crossWave=wave;
      for(const [index,street]of streets.entries()){
        // Every crossroad vehicle fits below the normal jump apex. The capped
        // cadence leaves time for a full jump plus a two-lane correction.
        const kind=(phase.cycle+slot+index)%4,vehicleKind=kind===0?'van':kind===1?'scooter':kind===2?'police':'taxi';
        const length=vehicleKind==='van'?4.7:vehicleKind==='scooter'?2:3.55;
        const e=this.spawnEntity('crossTraffic',1,this.distance-street.distance,{x:-street.direction*33,z:this.distance-street.distance,
          anchor:street.distance,crossSpeed:street.direction*INTERSECTION_TRAFFIC.crossingSpeed,vehicleKind,width:length,
          depth:vehicleKind==='scooter'?1.05:1.96,height:vehicleKind==='van'?2.25:1.9,yaw:street.direction*Math.PI/2,
          approachFactor:1,crossSlot:slot,crossCadence:window.cadence,crossClearTime:window.clearTime});
        if(e)e.previousZ=e.z;
      }
    }
    for(const e of this.entities)if(e.active&&e.type==='crossTraffic'&&Math.abs(e.x)>42)e.active=false;
  }
  input(action) {
    if (this.state !== 'RUNNING') return false;
    const p = this.player;
    if(this.powers.has('jetpack')&&['jump','slide'].includes(action))return false;
    if (action === 'left' || action === 'right') {
      const target = clamp(p.lane + (action === 'left' ? -1 : 1), 0, 2);
      if (target === p.lane) return false;
      p.laneFrom = p.x; p.lane = target; p.laneElapsed = 0;
      this.emit('lane', { lane: target });
      return true;
    }
    if (action === 'jump') {
      // A ground roll can turn into a jump immediately. An airborne roll still
      // obeys the normal coyote/buffer rule; it never grants a second jump.
      p.jumpBuffer = MOTION.jumpBuffer;
      if ((p.grounded || p.coyote > 0) && p.vy <= 0) this._jump();
      return true;
    }
    if (action === 'slide') {
      if (p.slide > 0) return false;
      p.slide = MOTION.slideDuration; p.jumpBuffer = 0;
      if (!p.grounded) p.vy = Math.min(p.vy, -15);
      if (this.powers.has('moped')) { p.mopedMount = 0; p.mopedSlideSide = this._random() < .5 ? -1 : 1; }
      p.anim = 'roll'; this.emit('slide'); return true;
    }
    return false;
  }
  _jump() {
    const p = this.player;
    const moon = this.powers.has('moon');
    p.jumpApex = moon ? MOTION.moonJumpHeight : MOTION.jumpHeight;
    p.jumpGravity = moon ? MOON_GRAVITY : GRAVITY;
    p.vy = moon ? MOON_JUMP_VELOCITY : JUMP_VELOCITY;
    p.grounded = false; p.coyote = 0; p.slide = 0; p.jumpBuffer = 0; p.roofEntityId = null;
    if (this.powers.has('moped')) p.mopedMount = 0;
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
      variant: 0, hit: false, passed: false, magnetic: false, magnetLatched: false, flightTrail: false, flightTrailId: 0, trailIndex: -1, trailFinal: false,
      jumpArc: false, ordinaryCoin: false, coinSequenceId: -1, coinPattern: null, coinSequenceLength: 0, sequenceIndex: -1,
      coinSectionId: -1, coinSectionPattern: null, age: 0, rowId: -1,
      routeBranch:null,finale:false,anchor:null,yaw:null,crossSpeed:0,vehicleKind:null,crossSlot:-1,crossCadence:0,crossClearTime:0,intersectionFlow:false,
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
  _coinSectionGap(index) {
    return mix(COIN_SECTIONS.gapMin, COIN_SECTIONS.gapMax, seededUnit(this.routeSeed, index, 17));
  }
  _maybeSpawnCoinSection({ safeLane = null, rowId = -1, z, y = 1, spawnDistance, jumpLane = -1 }) {
    if (this.powers.has('jetpack') || spawnDistance + 1e-8 < this._coinSectionCursor) return [];
    const sectionId = this._coinSectionIndex++;
    let coins;
    if (jumpLane >= 0) {
      coins = [];
      for (let index = -2; index <= 2; index++) {
        const offset = index * .12;
        const coin = this.spawnEntity('coin', jumpLane, z + this.speed * offset, {
          rowId, y: .7 + MOTION.jumpHeight * (1 - (2 * offset / MOTION.jumpDuration) ** 2),
          jumpArc: true, ordinaryCoin: true, coinSectionId: sectionId, coinSectionPattern: 'jump',
          coinSequenceLength: 5, sequenceIndex: index + 2,
        });
        if (coin) coins.push(coin);
      }
    } else {
      coins = this._spawnCoinSequence({ safeLane, rowId, z, y });
      for (const coin of coins) {
        coin.coinSectionId = sectionId;
        coin.coinSectionPattern = coin.coinPattern;
      }
    }
    this._coinSectionCursor = spawnDistance + this._coinSectionGap(this._coinSectionIndex);
    return coins;
  }
  _spawnCoinSequence({ safeLane = null, rowId = -1, z, y = 1 }) {
    const weightedLengths = Object.entries(COIN_SEQUENCES.lengthWeights);
    const totalWeight = weightedLengths.reduce((sum, [, weight]) => sum + weight, 0);
    let lengthRoll = this._random() * totalWeight;
    let length = Number(weightedLengths.at(-1)[0]);
    for (const [candidate, weight] of weightedLengths) {
      lengthRoll -= weight;
      if (lengthRoll < 0) { length = Number(candidate); break; }
    }

    const availablePatterns = COIN_SEQUENCES.patterns.filter(pattern => pattern !== this._lastCoinPattern);
    const pattern = availablePatterns[Math.floor(this._random() * availablePatterns.length)];
    const openCenterLanes = [0, 1, 2].filter(lane => lane !== this._lastCoinLane);
    const centerLane = safeLane == null
      ? openCenterLanes[Math.floor(this._random() * openCenterLanes.length)]
      : clamp(Math.round(safeLane), 0, 2);
    const centerStart = Math.floor((length - 1) / 2);
    const centerEnd = Math.ceil((length - 1) / 2);
    let laneRoutes;
    if (pattern === 'straight') {
      laneRoutes = [Array(length).fill(centerLane)];
    } else {
      const outerLanes = [0, 1, 2].filter(lane => lane !== centerLane);
      if (pattern === 'lateral') {
        laneRoutes = outerLanes.flatMap(outerLane => [
          Array.from({ length }, (_, index) => index < centerStart ? outerLane : centerLane),
          Array.from({ length }, (_, index) => index > centerEnd ? outerLane : centerLane),
        ]);
      } else {
        laneRoutes = outerLanes.flatMap(startLane => outerLanes
          .filter(endLane => endLane !== startLane)
          .map(endLane => Array.from({ length }, (_, index) => index < centerStart ? startLane : index > centerEnd ? endLane : centerLane)));
      }
    }
    const freshLaneRoutes = laneRoutes.filter(route => route[0] !== this._lastCoinLane);
    const candidates = freshLaneRoutes.length ? freshLaneRoutes : laneRoutes;
    const lanes = candidates[Math.floor(this._random() * candidates.length)];
    const gap = Math.max(2.25, this.speed * MOTION.laneDuration + .35);
    const center = (length - 1) / 2;
    const sequenceId = this._coinSequenceId++;
    const coins = [];
    for (let index = 0; index < length; index++) {
      const coin = this.spawnEntity('coin', lanes[index], z + (center - index) * gap, {
        rowId, y, ordinaryCoin: true, coinSequenceId: sequenceId, coinPattern: pattern,
        coinSequenceLength: length, sequenceIndex: index,
      });
      if (coin) coins.push(coin);
    }
    this._lastCoinPattern = pattern;
    this._lastCoinLane = lanes[0];
    return coins;
  }
  _spawnPattern(spawnDistance) {
    const doorway=BRANCHES.find(b=>Math.abs(spawnDistance-b.start)<12||Math.abs(spawnDistance-b.end)<10);
    if(doorway){const rowId=this._rowId++,safeLane=doorway.side<0?0:2;this._maybeSpawnCoinSection({safeLane,rowId,z:this.distance-spawnDistance,y:1,spawnDistance});return 18;}
    // Broad junctions retain sparse forward traffic as well as signal-driven
    // cross traffic. One car every other 24 m row is less than half the normal
    // road density, while the other lanes always remain open.
    if(this._routeProfile(spawnDistance).id==='intersection'){
      const rowId=this._rowId++,z=this.distance-spawnDistance;
      const lane=Math.floor(seededUnit(this.routeSeed,rowId,113)*2)*2;
      const safeLane=lane===0?2:0;
      if(rowId%2===0)this.spawnEntity('traffic',lane,z,{rowId,safeLane,intersectionFlow:true,
        variant:Math.floor(seededUnit(this.routeSeed,rowId,127)*3),fromLane:lane,toLane:lane});
      this._maybeSpawnCoinSection({safeLane,rowId,z,y:1,spawnDistance});
      const spacing=24;
      this.patternHistory.push({id:rowId,distance:spawnDistance,spacing,speed:this.speed,tier:this.tier,
        slots:lane===0?['traffic',null,null]:[null,null,'traffic'],safeLane,intersection:true});
      if(this.patternHistory.length>32)this.patternHistory.shift();
      return spacing;
    }
    const pattern = this._makePattern();
    const pursuitLane=this.netPursuit?.active?this.netPursuit.safety?.keepClearLanes?.[0]:null;
    if(Number.isInteger(pursuitLane)&&pursuitLane>=0&&pursuitLane<3){pattern.slots[pursuitLane]=null;pattern.safeLane=pursuitLane;}
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
    // Jetpack owns the only chip route while airborne. Hazards and power
    // pickups keep streaming, but ordinary ground/jump rows resume after landing.
    // One scheduled trail owns each reward section. A jump row uses the arc as
    // that trail instead of layering another line across it.
    this._maybeSpawnCoinSection({safeLane:pattern.safeLane,rowId,z,y:1,spawnDistance,jumpLane:pattern.slots.indexOf('jump')});
    // Power choices are deliberately sparse. Selection below is weighted so
    // utility powers recur more often than run-changing Jetpack and Shield.
    if (rowId > 0 && rowId % POWER_SPAWN.rowInterval === POWER_SPAWN.rowOffset) {
      const kind = this._nextPowerKind();
      this.spawnEntity(kind, pattern.safeLane, z + 8, { rowId, y: 1.2 });
    }
    const spacing = obstacleSpacing(this.speed, this.tier)*(spawnDistance>ROUTE.start?1.5-this._routeProfile(spawnDistance).trafficIntensity*.55:1);
    this.patternHistory.push({ id: rowId, distance: spawnDistance, spacing, speed: this.speed, tier: this.tier, ...pattern });
    if (this.patternHistory.length > 32) this.patternHistory.shift();
    return spacing;
  }
  _fillAhead() {
    const ahead = Math.max(160, this.speed * 6);
    while (this._spawnCursor < this.distance + ahead) this._spawnCursor += this._spawnPattern(this._spawnCursor);
  }
  _projectSpeed() {
    const base = this.debug.speedOverride != null ? clamp(Number(this.debug.speedOverride) || 10.4, 2, 120) : Math.min(26, 10.4 + this.time * .12);
    const multiplier = this.powers.speedMultiplier;
    let speed = base * multiplier * (this._slowRemaining > 0 ? .7 : 1);
    if (this.distance >= ROUTE.start && this.debug.speedOverride == null) speed = Math.min(speed, this._routeProfile(this.distance).speedLimit * multiplier);
    return speed;
  }
  _nextPowerKind() {
    const choices=Object.entries(POWER_SPAWN.weights).filter(([kind])=>kind!==this._lastPowerKind);
    const total=choices.reduce((sum,[,weight])=>sum+weight,0);
    let roll=this._random()*total,kind=choices.at(-1)[0];
    for(const [candidate,weight] of choices){roll-=weight;if(roll<0){kind=candidate;break;}}
    this._lastPowerKind=kind;return kind;
  }
  _clearGroundCoinsAhead() {
    for (const e of this.entities) if (e.active && e.type === 'coin' && !e.flightTrail && e.z < 3) e.active = false;
  }
  _clearFlightTrail() {
    for (const e of this.entities) if (e.active && e.flightTrail && e.flightTrailId === this._jetpackTrailId) e.active = false;
    this._jetpackFinalChip = null;this._flightTrailPlan=[];this._flightTrailCursor=0;
  }
  _finishJetpackLanding() {
    this._clearFlightTrail();
    const p=this.player;
    p.y=0;p.vy=0;p.grounded=true;p.coyote=MOTION.coyoteTime;p.jumpBuffer=0;p.slide=0;
    p.jumpApex=MOTION.jumpHeight;p.jumpGravity=GRAVITY;p.roofEntityId=null;p.anim='run';
    this.shieldGrace=Math.max(this.shieldGrace,1.4);
    this.emit('jetpackland',{x:p.x});
  }
  _createFlightTrail() {
    this._clearFlightTrail();
    const flight = this.powers.active.get('jetpack');
    if (!flight) return;
    ++this._jetpackTrailId;
    flight.descending=false;
    // Budget only the lift/cruise distance. Descent owns no chips. The route
    // is sized for the maximum legitimate speed multiplier so a Speed Burst
    // picked up mid-flight cannot exhaust it; Double Chips never affects speed.
    const speed=Math.max(this._projectSpeed(),2);
    const cruiseDuration=Math.max(0,flight.duration-JETPACK_PHASES.descent);
    const routeCap=this.distance>=ROUTE.start?this._routeProfile(this.distance).speedLimit*1.6:26*1.6;
    const plannedSpeed=Math.max(speed,routeCap);
    const firstDistance=Math.max(3.5,speed*.3),spacing=3;
    const count=Math.max(2,Math.ceil((plannedSpeed*cruiseDuration-firstDistance)/spacing)+1);
    this._flightTrailSpacing=spacing;
    let lane=this.player.lane,direction=this._random()<.5?-1:1,hold=3+Math.floor(this._random()*3);
    this._flightTrailPlan=[];this._flightTrailCursor=0;
    for(let i=0;i<count;i++){
      const distance=firstDistance+i*spacing;
      const liftBlend=clamp(distance/Math.max(speed*JETPACK_PHASES.lift,1),0,1);
      const eased=liftBlend*liftBlend*(3-2*liftBlend);
      this._flightTrailPlan.push({lane,y:2.2+7.6*eased,index:i,final:i===count-1});
      if(--hold<=0&&i<count-1){if(lane+direction<0||lane+direction>2)direction*=-1;lane+=direction;hold=3+Math.floor(this._random()*3);}
    }
    // The first route window is created after lift-off in _step. This keeps
    // Jetpack-only chips out of the ground phase entirely.
  }
  _spawnFlightTrailWindow(firstDistance=null,trailId=this._jetpackTrailId) {
    const flight=this.powers.active.get('jetpack');
    if(!flight||flight.descending||flight.remaining<=JETPACK_PHASES.descent||!this._flightTrailPlan.length||this.player.y<=.05)return;
    const active=this.entities.filter(e=>e.active&&e.flightTrail&&e.flightTrailId===trailId&&e.z<3).sort((a,b)=>a.z-b.z);
    let farthest=active[0]?.z??-Math.max(3.5,firstDistance||this._flightTrailSpacing);
    while(active.length<JETPACK_PHASES.visibleChips&&this._flightTrailCursor<this._flightTrailPlan.length){
      const step=this._flightTrailPlan[this._flightTrailCursor++],z=active.length?farthest-this._flightTrailSpacing:farthest;
      const coin=this.spawnEntity('coin',step.lane,z,{y:step.y,flightTrail:true,flightTrailId:trailId,trailIndex:step.index,trailFinal:step.final});
      if(!coin){this._flightTrailCursor--;break;}active.push(coin);farthest=z;if(step.final)this._jetpackFinalChip=coin;
    }
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.state === 'ARCADE' || this.state === 'PAUSED' || this.state === 'MAIN_MENU' || (this.state === 'GAME_OVER' && !this.captureRemaining)) return;
    let remaining = Math.min(dt, 1); // A suspended tab cannot advance seconds of unseen hazards.
    if (this.state === 'CAUGHT') {
      if(this.crash?.kind==='net'&&this.netPursuit?.active){
        this.netPursuit=this._netPursuitController.update(remaining,{playerLane:this.player.lane,playerX:this.player.x,distance:this.distance});
        this.captureProgress=this.netPursuit.captureProgress;this.captureRemaining=Math.max(0,this.captureDuration*(1-this.captureProgress));
        if(this.netPursuit.outcome==='caught'){this.captureRemaining=0;this.captureProgress=1;this.setState('GAME_OVER');this.emit('gameover',this.snapshot());}
      }else{
        this.captureRemaining = Math.max(0, this.captureRemaining - remaining);
        this.captureProgress = 1 - this.captureRemaining / this.captureDuration;
        if (!this.captureRemaining) { this.setState('GAME_OVER'); this.emit('gameover', this.snapshot()); }
      }
      return;
    }
    if (this.state === 'STARTING') {
      const introDt = Math.min(remaining, this.introRemaining);
      this.introRemaining -= introDt; this.introProgress = 1 - this.introRemaining / INTRO_DURATION; remaining -= introDt;
      if (this.introRemaining <= 1e-8) { this.introRemaining = 0; this.distance=introPose(INTRO_DURATION).distance; for(const e of this.entities)if(e.active){e.z+=this.distance;e.previousZ=e.z;} this.player.anim = 'run'; this.setState('RUNNING'); }
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
    p.mopedMount = Math.max(0, p.mopedMount - dt);
    p.laneElapsed = Math.min(MOTION.laneDuration, p.laneElapsed + dt);
    const ease = 1 - (1 - p.laneElapsed / MOTION.laneDuration) ** 3;
    p.x = mix(p.laneFrom, LANES[p.lane], ease);
    p.slide = Math.max(0, p.slide - dt);
    if (!p.slide) p.mopedSlideSide = 0;
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    this.powers.update(dt);
    const roof = p.roofEntityId == null ? null : this.entities[p.roofEntityId];
    const roofSupported = !!roof?.active && !this.powers.has('jetpack') &&
      Math.abs(p.x - roof.x) < roof.width / 2 + .3 &&
      roof.z >= -roof.depth / 2 - .25 && roof.z <= roof.depth / 2 + .25;
    if (!roofSupported && p.roofEntityId != null) {
      p.roofEntityId = null; p.grounded = false; p.coyote = MOTION.coyoteTime;
    }
    if(this.powers.has('jetpack')){
      const flight=this.powers.active.get('jetpack'),landingTime=flight.remaining;
      if(landingTime<=JETPACK_PHASES.descent&&!flight.descending){flight.descending=true;this._clearFlightTrail();}
      const blend=Math.min(1,flight.elapsed/JETPACK_PHASES.lift,landingTime/JETPACK_PHASES.descent);
      const target=9*blend*blend*(3-2*blend);
      p.y+=(target-p.y)*(1-Math.exp(-dt*12));p.vy=0;p.grounded=false;
    }else if (roofSupported) {
      p.y = roof.height; p.vy = 0; p.grounded = true; p.coyote = MOTION.coyoteTime;
    }else{
      if (!p.grounded || p.y > 0) {
        if (p.y > 0) p.grounded = false;
        p.y += p.vy * dt - p.jumpGravity * dt * dt / 2;
        p.vy -= p.jumpGravity * dt;
        p.coyote = Math.max(0, p.coyote - dt);
        if (p.y <= 0) { p.y = 0; p.vy = 0; p.jumpApex = MOTION.jumpHeight; p.jumpGravity = GRAVITY; p.grounded = true; p.coyote = MOTION.coyoteTime; this.emit('land', {x:p.x}); }
      } else p.coyote = MOTION.coyoteTime;
      if (p.grounded && p.jumpBuffer > 0) this._jump();
    }
    p.anim = p.hit > .65 ? 'hit' : p.slide > 0 ? 'roll' : p.y > .01 ? p.vy >= 0 ? 'jump' : 'fall' : 'run';
    this.speed = this._projectSpeed();
    const phase=getTrafficPhase(this.time),beforeDistance=this.distance;
    this._routeWaiting=false;
    const movement=this.speed*dt;
    this.distance+=movement;this._enterRoutes(beforeDistance,this.distance);this._refreshRoute();this._updateCrossTraffic(dt);this._updateNetPursuit(dt);
    if(this.state!=='RUNNING')return;
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
      const jetpackActive=this.powers.has('jetpack');
      const flightPull=jetpackActive&&e.flightTrail&&(e.trailFinal||Math.abs(p.x-e.x)<.95)?2.4:0;
      const pullRadius=jetpackActive?(e.flightTrail?flightPull:0):this.powers.magnetRadius;
      const mayAttract=!jetpackActive||e.flightTrail;
      if (COLLECTIBLES.has(e.type) && mayAttract && (e.magnetLatched || (pullRadius > 0 && e.z > -pullRadius && e.z < 1))) {
        if (this.powers.magnetRadius > 0 && e.z > -this.powers.magnetRadius && e.z < 1) e.magnetLatched = true;
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
        const ep=e.routeBranch?branchOffset(e.routeBranch,this.distance-e.z):{x:e.finale?this._routeProfile(this.distance-e.z).offsetX:0};
        const entityX = mix(oldX, e.x, crossing)*(e.routeBranch===this.route.branch&&e.routeBranch?lateralScale:1)+(ep.x||0);
        const sameFloor=(!e.routeBranch||e.routeBranch===this.route.branch)&&!(e.type==='crossTraffic'&&this.route.branch==='corner-shop');
        const xOverlap = (sameFloor || e.magnetLatched) &&
          (e.magnetic || Math.abs(playerX - entityX) < (hazard ? e.width / 2*(e.routeBranch?lateralScale:1) + .3 : .72));
        if (xOverlap) {
          if (hazard) {
            const vehicle = !!VEHICLES[e.type] || e.type === 'crossTraffic';
            const roofReachable = vehicle || !!BARRIERS[e.type];
            const landsOnRoof = roofReachable && !p.grounded && p.vy <= 0 &&
              previousY >= e.height - .05 && playerY <= e.height + .18 &&
              p.roofEntityId == null;
            if (landsOnRoof) {
              p.y = e.height; p.vy = 0; p.grounded = true; p.coyote = MOTION.coyoteTime;
              p.roofEntityId = e.id; e.hit = true;
              this.emit('roofland', { kind: e.type, x: p.x });
              continue;
            }
            const collides = (e.type === 'slide'||e.type === 'blocker') ? playerY < e.height && (p.slide <= 0 || playerY > .2) : playerY < e.height;
            if (collides) {
              const sideImpact = vehicle && (Math.abs(playerX - entityX) > e.width * .39 ||
                (e.previousZ > -halfDepth + .12 && (Math.abs(p.x - previousX) > .001 || Math.abs(e.x - oldX) > .001)));
              const edgeNick = vehicle && e.height <= MOTION.jumpHeight && !p.grounded && p.vy > 0 && playerY >= e.height-.32;
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
      if (e.z > (e.flightTrail?3:9)) e.active = false;
    }
    if(this.powers.has('jetpack'))this._spawnFlightTrailWindow();
    if (this.state === 'RUNNING') this._fillAhead();
  }
  _pickup(entity) {
    entity.active = false; entity.hit = true;
    const kind = entity.type;
    if (kind === 'coin') { const count=this.powers.has('doublechips')?2:1;this.coins+=count; this.score += 10 * count * this.powers.scoreMultiplier; }
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
    if(this.powers.has('shield')){
      const shield=this.powers.active.get('shield');
      shield.charges=Math.max(0,shield.charges-1);entity.active=false;this.shieldGrace=1.1;
      this.emit('shieldhit',{kind:entity.type,remaining:shield.charges});
      this.emit('shieldbreak',{kind:entity.type,remaining:shield.charges});
      if(!shield.charges)this.powers.remove('shield','depleted');
      return;
    }
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
    if(this.netPursuit?.active){this._netPursuitController.reset();this.netPursuit=this._netPursuitController.snapshot();}
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
      route:{...this.route},routeTraffic:{...this.routeTraffic},netPursuit:this.netPursuit,
      powers: [...this.powers.active.values()].map(p => ({ ...p })) };
  }
}
