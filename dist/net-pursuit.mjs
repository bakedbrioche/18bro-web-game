/**
 * Deterministic police-net pursuit choreography.
 *
 * This controller owns timing and fairness only. The runner keeps ownership of
 * movement, hazards, score and the final game-state transition. Every snapshot
 * is plain, frozen data so the WebGL layer can render it without mutating the
 * simulation.
 */

const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const mix = (from, to, amount) => from + (to - from) * amount;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const NET_PURSUIT = Object.freeze({
  lanes: Object.freeze([-2.5, 0, 2.5]),
  bonus: 10000,
  reward: Object.freeze({
    base: 4000,
    perAttempt: 1100,
    perSecond: 320,
    difficultyScale: .65,
    roundTo: 250,
    tagCount: 4,
  }),
  attemptsMin: 2,
  attemptsMax: 4,
  approachSeconds: 1.05,
  telegraphSeconds: Object.freeze({ easy: 5, hard: 3 }),
  strikeSeconds: .26,
  recoverySeconds: Object.freeze({ easy: .58, hard: .38 }),
  retreatSeconds: 1.3,
  minimumDodgeSeconds: 3,
  catchRadius: .78,
  followSpeed: Object.freeze({ easy: 2.15, hard: 3.35 }),
  captureSeconds: Object.freeze({ netted: .62, lift: .78, carry: 2.4 }),
  difficultyDistance: 6000,
});

const CAPTURE_PHASES = Object.freeze(['netted', 'lift', 'carry']);
const ACTIVE_PHASES = new Set(['approach', 'telegraph', 'strike', 'recovery', 'retreat', ...CAPTURE_PHASES]);

function normalizeSeed(seed) {
  const normalized = finite(seed, 18) >>> 0;
  return normalized || 0x12b0cafe;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function nearestLaneIndex(x, lanes) {
  let result = 0;
  for (let index = 1; index < lanes.length; index++) {
    if (Math.abs(lanes[index] - x) < Math.abs(lanes[result] - x)) result = index;
  }
  return result;
}

/** A distance-derived difficulty value that rises monotonically and caps at one. */
export function netPursuitDifficulty(distance = 0) {
  return clamp(Math.max(0, finite(distance)) / NET_PURSUIT.difficultyDistance);
}

/**
 * Score an escaped pursuit from its actual deterministic choreography.
 * Longer chases, more net attempts and later-run difficulty all contribute;
 * the original 10,000-point award remains the minimum for a completed escape.
 */
export function netPursuitReward({ elapsedSeconds = 0, attemptsResolved = 0, difficulty = 0 } = {}) {
  const rules = NET_PURSUIT.reward;
  const durationValue = Math.max(0, finite(elapsedSeconds)) * rules.perSecond;
  const attemptValue = Math.max(0, Math.floor(finite(attemptsResolved))) * rules.perAttempt;
  const difficultyMultiplier = 1 + clamp(finite(difficulty)) * rules.difficultyScale;
  const raw = (rules.base + durationValue + attemptValue) * difficultyMultiplier;
  const rounded = Math.round(raw / rules.roundTo) * rules.roundTo;
  return Math.max(NET_PURSUIT.bonus, rounded);
}

export class NetPursuitController {
  constructor({ seed = 18, onEvent = () => {}, lanes = NET_PURSUIT.lanes } = {}) {
    if (!Array.isArray(lanes) || lanes.length < 2 || lanes.some(value => !Number.isFinite(value))) {
      throw new TypeError('Net pursuit requires at least two finite lane positions');
    }
    this.lanes = Object.freeze([...lanes]);
    this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
    this.seed = normalizeSeed(seed);
    this._rngState = this.seed;
    this._events = [];
    this._lastRewardTag = -1;
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.phase = 'idle';
    this.phaseElapsed = 0;
    this.phaseDuration = 0;
    this.elapsed = 0;
    this.startDistance = 0;
    this.distance = 0;
    this.difficulty = 0;
    this.guardIndex = null;
    this.nextGuardIndex = 0;
    this.attemptTotals = [0, 0];
    this.attemptsRemaining = [0, 0];
    this.attemptsResolved = 0;
    this.targetX = this.lanes[Math.floor(this.lanes.length / 2)];
    this.lockedTargetX = this.targetX;
    this.playerX = this.targetX;
    this.playerAirborne = false;
    this.openLanes = this.lanes.map((_, lane) => lane);
    this.caught = false;
    this.outcome = null;
    this.bonusAwarded = 0;
    this.rewardTagIndex = -1;
    this.escapeReason = null;
    this.strikeShielded = false;
    this.captureElapsed = 0;
    this._events.length = 0;
    return this.snapshot();
  }

  _random() {
    // Mulberry32 keeps the controller deterministic without consuming the
    // runner's route RNG or depending on browser globals.
    let value = this._rngState += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    this._rngState >>>= 0;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }

  _emit(type, data = {}) {
    const event = Object.freeze({ type, ...data });
    this._events.push(event);
    this.onEvent(event);
  }

  drainEvents() {
    const events = this._events;
    this._events = [];
    return Object.freeze([...events]);
  }

  start({ playerLane = Math.floor(this.lanes.length / 2), playerX, distance = 0 } = {}) {
    this.reset();
    this.state = 'active';
    this.phase = 'approach';
    this.phaseDuration = NET_PURSUIT.approachSeconds;
    this.startDistance = Math.max(0, finite(distance));
    this.distance = this.startDistance;
    this.difficulty = netPursuitDifficulty(this.distance);
    this.playerX = this._resolvePlayerX(playerLane, playerX);
    this.targetX = this.playerX;
    this.lockedTargetX = this.playerX;
    this.attemptTotals = [0, 1].map(() => NET_PURSUIT.attemptsMin + Math.floor(this._random() * (NET_PURSUIT.attemptsMax - NET_PURSUIT.attemptsMin + 1)));
    this.attemptsRemaining = [...this.attemptTotals];
    this.nextGuardIndex = this._random() < .5 ? 0 : 1;
    this.guardIndex = this.nextGuardIndex;
    this._emit('netpursuitstart', {
      guardIndex: this.guardIndex,
      attempts: Object.freeze([...this.attemptTotals]),
      difficulty: this.difficulty,
    });
    return this.snapshot();
  }

  _resolvePlayerX(playerLane, playerX) {
    if (Number.isFinite(playerX)) return Number(playerX);
    const index = clamp(Math.round(finite(playerLane, Math.floor(this.lanes.length / 2))), 0, this.lanes.length - 1);
    return this.lanes[index];
  }

  _telegraphDuration() {
    return Math.max(NET_PURSUIT.minimumDodgeSeconds, mix(NET_PURSUIT.telegraphSeconds.easy, NET_PURSUIT.telegraphSeconds.hard, this.difficulty));
  }

  _recoveryDuration() {
    return mix(NET_PURSUIT.recoverySeconds.easy, NET_PURSUIT.recoverySeconds.hard, this.difficulty);
  }

  _setPhase(phase, duration) {
    this.phase = phase;
    this.phaseElapsed = 0;
    this.phaseDuration = duration;
  }

  _selectGuard() {
    let guard = this.nextGuardIndex;
    if (this.attemptsRemaining[guard] <= 0) guard = 1 - guard;
    return this.attemptsRemaining[guard] > 0 ? guard : null;
  }

  _beginAttempt() {
    const guard = this._selectGuard();
    if (guard === null) {
      this._setPhase('retreat', NET_PURSUIT.retreatSeconds);
      this._emit('netpursuitretreat', { attemptsResolved: this.attemptsResolved });
      return;
    }
    this.guardIndex = guard;
    this.nextGuardIndex = 1 - guard;
    this.targetX = this.playerX;
    this.lockedTargetX = this.targetX;
    this._setPhase('telegraph', this._telegraphDuration());
    this._emit('nettelegraph', {
      guardIndex: guard,
      attempt: this.attemptTotals[guard] - this.attemptsRemaining[guard] + 1,
      attemptsForGuard: this.attemptTotals[guard],
      duration: this.phaseDuration,
    });
  }

  _beginStrike() {
    const playerLane=nearestLaneIndex(this.playerX,this.lanes);
    const reachableEscape=this.openLanes.filter(lane=>lane!==playerLane);
    this.lockedTargetX = reachableEscape.length ? this.targetX : this.lanes[(playerLane+(this.guardIndex===0?1:this.lanes.length-1))%this.lanes.length];
    this._setPhase('strike', NET_PURSUIT.strikeSeconds);
    this._emit('netstrike', { guardIndex: this.guardIndex, targetX: this.lockedTargetX });
  }

  _resolveStrike() {
    this.attemptsRemaining[this.guardIndex]--;
    this.attemptsResolved++;
    if (Math.abs(this.playerX - this.lockedTargetX) <= NET_PURSUIT.catchRadius && this.playerAirborne) {
      this._emit('netdodged', {
        guardIndex: this.guardIndex,
        targetX: this.lockedTargetX,
        reason: 'jump',
        attemptsRemaining: Object.freeze([...this.attemptsRemaining]),
      });
      this._setPhase('recovery', this._recoveryDuration());
      return;
    }
    if (Math.abs(this.playerX - this.lockedTargetX) <= NET_PURSUIT.catchRadius && this.strikeShielded) {
      this._emit('netblocked', {
        guardIndex: this.guardIndex,
        targetX: this.lockedTargetX,
        attemptsRemaining: Object.freeze([...this.attemptsRemaining]),
      });
      this._setPhase('recovery', this._recoveryDuration());
      return;
    }
    if (Math.abs(this.playerX - this.lockedTargetX) <= NET_PURSUIT.catchRadius) {
      this.caught = true;
      this.state = 'capture';
      this.captureElapsed = 0;
      this._setPhase('netted', NET_PURSUIT.captureSeconds.netted);
      this._emit('netcaught', { guardIndex: this.guardIndex, targetX: this.lockedTargetX });
      return;
    }
    this._emit('netdodged', {
      guardIndex: this.guardIndex,
      targetX: this.lockedTargetX,
      attemptsRemaining: Object.freeze([...this.attemptsRemaining]),
    });
    this._setPhase('recovery', this._recoveryDuration());
  }

  _finishSuccess(reason = this.escapeReason) {
    this.state = 'complete';
    this.phase = 'complete';
    this.phaseElapsed = 0;
    this.phaseDuration = 0;
    this.outcome = 'dodged';
    const elapsedSeconds = this.elapsed;
    const chaseDistance = Math.max(0, this.distance - this.startDistance);
    this.bonusAwarded = netPursuitReward({ elapsedSeconds, attemptsResolved: this.attemptsResolved, difficulty: this.difficulty });
    let tagIndex = Math.floor(this._random() * NET_PURSUIT.reward.tagCount);
    if (tagIndex === this._lastRewardTag) tagIndex = (tagIndex + 1) % NET_PURSUIT.reward.tagCount;
    this._lastRewardTag = tagIndex;
    this.rewardTagIndex = tagIndex;
    this._emit('netpursuitsuccess', {
      bonus: this.bonusAwarded,
      attemptsResolved: this.attemptsResolved,
      elapsedSeconds,
      chaseDistance,
      difficulty: this.difficulty,
      tagIndex,
      reason,
    });
  }

  /** Resolve an active chase immediately through a legitimate mobility escape. */
  escape(reason = 'mobility') {
    if (this.state !== 'active' || this.caught) return this.snapshot();
    this.escapeReason = String(reason || 'mobility');
    this._finishSuccess(this.escapeReason);
    return this.snapshot();
  }

  _finishCapture() {
    this.state = 'complete';
    this.phase = 'complete';
    this.phaseElapsed = 0;
    this.phaseDuration = 0;
    this.outcome = 'caught';
    this._emit('netcapturecomplete', { guardIndex: this.guardIndex });
  }

  _finishPhase() {
    if (this.phase === 'approach') this._beginAttempt();
    else if (this.phase === 'telegraph') this._beginStrike();
    else if (this.phase === 'strike') this._resolveStrike();
    else if (this.phase === 'recovery') this._beginAttempt();
    else if (this.phase === 'retreat') this._finishSuccess();
    else if (this.phase === 'netted') this._setPhase('lift', NET_PURSUIT.captureSeconds.lift);
    else if (this.phase === 'lift') this._setPhase('carry', NET_PURSUIT.captureSeconds.carry);
    else if (this.phase === 'carry') this._finishCapture();
  }

  _advance(step) {
    if (this.phase === 'telegraph') {
      const speed = mix(NET_PURSUIT.followSpeed.easy, NET_PURSUIT.followSpeed.hard, this.difficulty);
      const delta = this.playerX - this.targetX;
      this.targetX += clamp(delta, -speed * step, speed * step);
    }
    if (CAPTURE_PHASES.includes(this.phase)) this.captureElapsed += step;
    this.phaseElapsed += step;
    this.elapsed += step;
  }

  update(dt, { playerLane = Math.floor(this.lanes.length / 2), playerX, playerY = 0, playerGrounded = true, airborne = false, openLanes = this.openLanes, distance = this.distance, shielded = false } = {}) {
    let remaining = Math.max(0, finite(dt));
    this.playerX = this._resolvePlayerX(playerLane, playerX);
    this.distance = Math.max(this.distance, Math.max(0, finite(distance, this.distance)));
    this.difficulty = Math.max(this.difficulty, netPursuitDifficulty(this.distance));
    this.playerAirborne = airborne === true || playerGrounded === false || finite(playerY) > .08;
    this.openLanes = Array.isArray(openLanes) ? [...new Set(openLanes.map(value=>Math.round(finite(value,-1))).filter(lane=>lane>=0&&lane<this.lanes.length))] : this.lanes.map((_,lane)=>lane);
    this.strikeShielded = shielded === true;
    if (!ACTIVE_PHASES.has(this.phase) || remaining <= 0) return this.snapshot();

    // Consume boundaries so a long frame cannot skip a strike or capture phase.
    let transitions = 0;
    while (remaining > 1e-9 && ACTIVE_PHASES.has(this.phase) && transitions < 16) {
      const untilBoundary = Math.max(0, this.phaseDuration - this.phaseElapsed);
      const step = Math.min(remaining, untilBoundary);
      if (step > 0) {
        this._advance(step);
        remaining -= step;
      }
      if (this.phaseElapsed + 1e-9 < this.phaseDuration) break;
      this._finishPhase();
      transitions++;
    }
    return this.snapshot();
  }

  _telegraphProgress() {
    if (this.phase === 'telegraph') return clamp(this.phaseElapsed / Math.max(this.phaseDuration, 1e-9));
    return this.phase === 'strike' ? 1 : 0;
  }

  _blinkState(progress) {
    if (this.phase !== 'telegraph') return { blink: this.phase === 'strike', frequency: 0 };
    const startFrequency = .8 + this.difficulty * .25;
    const endFrequency = 5.4 + this.difficulty * 1.6;
    const seconds = this.phaseElapsed;
    const frequency = mix(startFrequency, endFrequency, progress);
    const cycles = startFrequency * seconds + .5 * (endFrequency - startFrequency) * seconds * progress;
    return { blink: Math.sin(cycles * Math.PI * 2) >= 0, frequency };
  }

  _safetySnapshot() {
    const markerX = this.phase === 'strike' ? this.lockedTargetX : this.targetX;
    const dangerLane = nearestLaneIndex(markerX, this.lanes);
    const candidateEscapeLanes = this.lanes
      .map((x, lane) => ({ lane, clearance: Math.abs(x - markerX) }))
      .filter(({ lane, clearance }) => clearance > NET_PURSUIT.catchRadius && this.openLanes.includes(lane))
      .sort((a, b) => b.clearance - a.clearance || (this.guardIndex === 0 ? b.lane - a.lane : a.lane - b.lane))
      .map(({ lane }) => lane);
    const escapeLane = candidateEscapeLanes[0] ?? null;
    const strikeIn = this.phase === 'telegraph'
      ? Math.max(0, this.phaseDuration - this.phaseElapsed)
      : this.phase === 'approach'
        ? Math.max(0, this.phaseDuration - this.phaseElapsed) + this._telegraphDuration()
        : 0;
    const protectForSeconds = this.phase === 'approach' || this.phase === 'telegraph' || this.phase === 'strike'
      ? strikeIn + NET_PURSUIT.strikeSeconds + this._recoveryDuration()
      : this.phase === 'recovery' ? Math.max(0, this.phaseDuration - this.phaseElapsed) : 0;
    return {
      hazardsAllowed: true,
      forbidFullLaneBlock: this.state === 'active' && this.phase !== 'retreat',
      minimumOpenEscapeLanes: this.state === 'active' && this.phase !== 'retreat' ? 1 : 0,
      dangerLane,
      candidateEscapeLanes,
      keepClearLanes: this.state === 'active' && this.phase !== 'retreat' && escapeLane !== null ? [escapeLane] : [],
      strikeIn,
      minimumDodgeSeconds: NET_PURSUIT.minimumDodgeSeconds,
      protectForSeconds,
    };
  }

  _captureSnapshot() {
    const total = CAPTURE_PHASES.reduce((sum, phase) => sum + NET_PURSUIT.captureSeconds[phase], 0);
    const active = this.state === 'capture';
    return {
      active,
      phase: active ? this.phase : null,
      phaseProgress: active ? clamp(this.phaseElapsed / Math.max(this.phaseDuration, 1e-9)) : this.caught ? 1 : 0,
      progress: this.outcome === 'caught' ? 1 : this.caught ? clamp(this.captureElapsed / total) : 0,
      durations: { ...NET_PURSUIT.captureSeconds },
    };
  }

  /**
   * Plain presentation contract used directly as `game.netPursuit`.
   * Consumers may JSON.stringify it, but cannot mutate this or nested values.
   */
  snapshot() {
    const telegraphProgress = this._telegraphProgress();
    const blink = this._blinkState(telegraphProgress);
    const capture = this._captureSnapshot();
    return deepFreeze({
      active: ACTIVE_PHASES.has(this.phase),
      state: this.state,
      phase: this.phase,
      guardIndex: this.guardIndex,
      targetX: this.phase === 'strike' ? this.lockedTargetX : this.targetX,
      telegraphProgress,
      blink: blink.blink,
      blinkFrequency: blink.frequency,
      caught: this.caught,
      captureProgress: capture.progress,
      capture,
      difficulty: this.difficulty,
      attempts: {
        totals: [...this.attemptTotals],
        remaining: [...this.attemptsRemaining],
        resolved: this.attemptsResolved,
      },
      safety: this._safetySnapshot(),
      outcome: this.outcome,
      escapeReason: this.escapeReason,
      bonus: this.bonusAwarded,
      reward: {
        bonus: this.bonusAwarded,
        tagIndex: this.rewardTagIndex,
        elapsedSeconds: this.elapsed,
        chaseDistance: Math.max(0, this.distance - this.startDistance),
        reason: this.escapeReason,
      },
    });
  }

  toJSON() { return this.snapshot(); }
}
