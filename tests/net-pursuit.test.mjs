import test from 'node:test';
import assert from 'node:assert/strict';
import { NET_PURSUIT, NetPursuitController, netPursuitDifficulty, netPursuitReward } from '../dist/net-pursuit.mjs';
import { LANES, NET_PURSUIT_SCHEDULE, RunnerGame } from '../dist/core.mjs';

function advanceTo(controller, predicate, context = {}, limit = 20) {
  for (let elapsed = 0; elapsed < limit; elapsed += 1 / 120) {
    const snapshot = controller.update(1 / 120, context);
    if (predicate(snapshot)) return snapshot;
  }
  assert.fail('controller did not reach the expected state');
}

function completeByDodging(controller) {
  let lane = 1;
  for (let elapsed = 0; elapsed < 90; elapsed += 1 / 120) {
    const before = controller.snapshot();
    if (before.phase === 'telegraph' && before.telegraphProgress >= .68) {
      const candidates = before.safety.candidateEscapeLanes;
      lane = candidates[0] ?? lane;
    }
    if (before.phase === 'recovery' || before.phase === 'approach') lane = 1;
    const snapshot = controller.update(1 / 120, { playerLane: lane, distance: elapsed * 14 });
    if (!snapshot.active) return snapshot;
  }
  assert.fail('pursuit did not complete');
}

test('seeded guards get independent 2-4 attempt counts and alternate deterministically', () => {
  const sequenceFor = seed => {
    const events = [];
    const controller = new NetPursuitController({ seed, onEvent: event => events.push(event) });
    const started = controller.start({ playerLane: 1 });
    const completed = completeByDodging(controller);
    assert.equal(completed.outcome, 'dodged');
    assert.equal(completed.attempts.resolved, started.attempts.totals[0] + started.attempts.totals[1]);
    assert.ok(started.attempts.totals.every(value => value >= 2 && value <= 4));
    return {
      totals: started.attempts.totals,
      guards: events.filter(event => event.type === 'netstrike').map(event => event.guardIndex),
    };
  };

  const first = sequenceFor(1818);
  assert.deepEqual(sequenceFor(1818), first);
  for (let index = 1; index < Math.min(first.totals[0], first.totals[1]) * 2; index++) {
    assert.notEqual(first.guards[index], first.guards[index - 1]);
  }
  const generated = Array.from({ length: 40 }, (_, seed) => sequenceFor(seed + 1).totals);
  assert.ok(generated.some(([left, right]) => left !== right), 'guard counts should be independently randomized');
});

test('telegraph follows slowly, accelerates its blink and publishes a fair hazard contract', () => {
  const controller = new NetPursuitController({ seed: 4 });
  controller.start({ playerLane: 0, distance: 1200 });
  let snapshot = advanceTo(controller, value => value.phase === 'telegraph', { playerLane: 0, distance: 1200 });
  const initialFrequency = snapshot.blinkFrequency;
  assert.ok(snapshot.safety.strikeIn>=3&&snapshot.safety.strikeIn<=5);
  snapshot = controller.update(.2, { playerLane: 2, distance: 1203 });
  assert.ok(snapshot.targetX > NET_PURSUIT.lanes[0]);
  assert.ok(snapshot.targetX < NET_PURSUIT.lanes[2], 'marker must trail a sudden lane change');
  snapshot = controller.update(snapshot.safety.strikeIn * .45, { playerLane: 2, distance: 1210 });
  assert.ok(snapshot.blinkFrequency > initialFrequency);
  assert.equal(snapshot.safety.hazardsAllowed, true);
  assert.equal(snapshot.safety.forbidFullLaneBlock, true);
  assert.equal(snapshot.safety.minimumOpenEscapeLanes, 1);
  assert.ok(snapshot.safety.candidateEscapeLanes.length >= 1);
  assert.ok(snapshot.safety.keepClearLanes.every(lane => snapshot.safety.candidateEscapeLanes.includes(lane)));
  assert.ok(snapshot.safety.protectForSeconds >= snapshot.safety.strikeIn);
});

test('a locked net strike separates netted, lift and carry capture timing', () => {
  const events = [];
  const controller = new NetPursuitController({ seed: 8, onEvent: event => events.push(event) });
  controller.start({ playerLane: 1 });
  let snapshot = advanceTo(controller, value => value.phase === 'netted', { playerLane: 1 });
  assert.equal(snapshot.caught, true);
  assert.equal(snapshot.capture.phase, 'netted');
  const progress = [snapshot.captureProgress];
  snapshot = advanceTo(controller, value => value.phase === 'lift', { playerLane: 1 });
  progress.push(snapshot.captureProgress);
  snapshot = advanceTo(controller, value => value.phase === 'carry', { playerLane: 1 });
  progress.push(snapshot.captureProgress);
  snapshot = advanceTo(controller, value => value.outcome === 'caught', { playerLane: 1 });
  progress.push(snapshot.captureProgress);
  assert.deepEqual([...progress].sort((a, b) => a - b), progress);
  assert.equal(snapshot.active, false);
  assert.equal(snapshot.captureProgress, 1);
  assert.deepEqual(events.filter(event => event.type === 'netcaught').map(event => event.guardIndex), [controller.guardIndex]);
  assert.equal(events.at(-1).type, 'netcapturecomplete');
});

test('pursuit reward scales with chase length, attempts and difficulty and rotates its tag', () => {
  const short = netPursuitReward({ elapsedSeconds: 12, attemptsResolved: 4, difficulty: 0 });
  const long = netPursuitReward({ elapsedSeconds: 35, attemptsResolved: 8, difficulty: 0 });
  const hard = netPursuitReward({ elapsedSeconds: 12, attemptsResolved: 4, difficulty: 1 });
  assert.ok(short >= NET_PURSUIT.bonus);
  assert.ok(long >= short + 10000, 'long chase should materially outscore short chase: ' + short + ' -> ' + long);
  assert.ok(hard > short, 'late-run difficulty should increase an otherwise identical reward');

  const events = [];
  const controller = new NetPursuitController({ seed: 27, onEvent: event => events.push(event) });
  controller.start({ playerLane: 1 });
  const first = completeByDodging(controller);
  const firstEvent = events.find(event => event.type === 'netpursuitsuccess');
  assert.equal(first.outcome, 'dodged');
  assert.equal(first.bonus, firstEvent.bonus);
  assert.equal(first.reward.tagIndex, firstEvent.tagIndex);
  assert.equal(first.reward.elapsedSeconds, firstEvent.elapsedSeconds);
  assert.ok(firstEvent.chaseDistance > 0);
  assert.equal(firstEvent.attemptsResolved, first.attempts.resolved);
  assert.equal(events.filter(event => event.type === 'netpursuitretreat').length, 1);
  assert.ok(firstEvent.tagIndex >= 0 && firstEvent.tagIndex < NET_PURSUIT.reward.tagCount);

  controller.start({ playerLane: 1 });
  const second = completeByDodging(controller);
  const successEvents = events.filter(event => event.type === 'netpursuitsuccess');
  assert.equal(successEvents.length, 2);
  assert.notEqual(second.reward.tagIndex, first.reward.tagIndex, 'success copy must not repeat consecutively');
});

test('difficulty escalates with distance, caps, and never removes the dodge window', () => {
  assert.equal(netPursuitDifficulty(-10), 0);
  assert.equal(netPursuitDifficulty(3000), .5);
  assert.equal(netPursuitDifficulty(6000), 1);
  assert.equal(netPursuitDifficulty(60000), 1);
  const easy = new NetPursuitController({ seed: 3 });
  const hard = new NetPursuitController({ seed: 3 });
  easy.start({ distance: 0 });
  hard.start({ distance: 6000 });
  const easyTelegraph = advanceTo(easy, value => value.phase === 'telegraph');
  const hardTelegraph = advanceTo(hard, value => value.phase === 'telegraph', { distance: 6000 });
  assert.ok(hardTelegraph.safety.strikeIn < easyTelegraph.safety.strikeIn);
  assert.ok(hardTelegraph.safety.strikeIn >= NET_PURSUIT.minimumDodgeSeconds);
  assert.equal(easyTelegraph.safety.strikeIn,5);
  assert.equal(hardTelegraph.safety.strikeIn,3);
  const escalated = easy.update(.1, { distance: 60000 });
  assert.equal(escalated.difficulty, 1);
});

test('presentation snapshots match the scene contract, serialize and reject mutation', () => {
  const controller = new NetPursuitController({ seed: 19 });
  const snapshot = controller.start({ playerLane: 2 });
  for (const key of ['active', 'guardIndex', 'phase', 'targetX', 'telegraphProgress', 'blink', 'caught', 'captureProgress']) {
    assert.ok(Object.hasOwn(snapshot, key), `missing scene field ${key}`);
  }
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(snapshot)));
  assert.equal(JSON.stringify(controller), JSON.stringify(snapshot));
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.attempts), true);
  assert.equal(Object.isFrozen(snapshot.attempts.totals), true);
  assert.equal(Object.isFrozen(snapshot.safety), true);
  assert.equal(Object.isFrozen(snapshot.reward), true);
  assert.throws(() => { snapshot.targetX = 99; }, TypeError);
  assert.throws(() => { snapshot.safety.keepClearLanes.push(2); }, TypeError);
});


function emptyRunner(events = []) {
  const game = new RunnerGame({ random: () => .37, onEvent: event => events.push(event) });
  game.start({ skipIntro: true });
  game.entities.forEach(entity => { entity.active = false; });
  game._spawnCursor = Infinity;
  game._coinSectionCursor = Infinity;
  game._nextNetPursuitDistance = Infinity;
  game.debug.speedOverride = 10;
  return game;
}

function placeRunnerInLane(game, lane) {
  game.player.lane = lane;
  game.player.x = LANES[lane];
  game.player.laneFrom = LANES[lane];
  game.player.laneElapsed = game.player.laneDuration ?? 1;
}

test('RunnerGame schedules pursuits, preserves an escape lane and awards the bonus once', () => {
  const events = [], game = emptyRunner(events);
  assert.equal(game._startNetPursuit(), true);
  const protectedLane = game.netPursuit.safety.keepClearLanes[0];
  const otherLane = [0, 1, 2].find(lane => lane !== protectedLane);
  const protectedHazard = game.spawnEntity('blocker', protectedLane, -5);
  const otherHazard = game.spawnEntity('blocker', otherLane, -5);
  game._protectNetEscapeLane();
  assert.equal(protectedHazard.active, false);
  assert.equal(otherHazard.active, true);
  otherHazard.active = false;

  for (let elapsed = 0; elapsed < 90 && game.netPursuit.active; elapsed += 1 / 120) {
    const pursuit = game.netPursuit;
    if (pursuit.phase === 'telegraph' && pursuit.telegraphProgress >= .62) {
      placeRunnerInLane(game, pursuit.safety.candidateEscapeLanes[0]);
    }
    game.update(1 / 120);
  }
  assert.equal(game.state, 'RUNNING');
  assert.equal(game.netPursuit.outcome, 'dodged');
  assert.equal(events.filter(event => event.type === 'netpursuitsuccess').length, 1);
  assert.ok(game.score >= NET_PURSUIT.bonus);
  assert.ok(game._nextNetPursuitDistance >= game.distance + NET_PURSUIT_SCHEDULE.repeatMin - 1e-6);
});

test('RunnerGame net capture stays visible through netted lift and carry before game over', () => {
  const events = [], game = emptyRunner(events);
  game._startNetPursuit();
  for (let elapsed = 0; elapsed < 8 && game.state === 'RUNNING'; elapsed += 1 / 120) game.update(1 / 120);
  assert.equal(game.state, 'CAUGHT');
  assert.equal(game.crash.kind, 'net');
  assert.equal(game.netPursuit.caught, true);
  assert.ok(game.captureRemaining > 0);
  assert.equal(events.filter(event => event.type === 'crash' && event.kind === 'net').length, 1);
  game.update(.7);
  assert.ok(['lift', 'carry'].includes(game.netPursuit.phase));
  for (let elapsed = 0; elapsed < 5 && game.state !== 'GAME_OVER'; elapsed += 1 / 120) game.update(1 / 120);
  assert.equal(game.state, 'GAME_OVER');
  assert.equal(game.captureProgress, 1);
});


test('moped and jetpack immediately turn an active pursuit into one scored escape', () => {
  for (const power of ['moped', 'jetpack']) {
    const events = [], game = emptyRunner(events);
    game._startNetPursuit();
    for (let elapsed = 0; elapsed < 1.8; elapsed += 1 / 120) game.update(1 / 120);
    const before = game.score;
    game.activatePower(power);
    const success = events.filter(event => event.type === 'netpursuitsuccess');
    assert.equal(success.length, 1, power + ' emits exactly one success');
    assert.equal(success[0].reason, power);
    assert.equal(game.netPursuit.active, false);
    assert.equal(game.netPursuit.outcome, 'dodged');
    assert.equal(game.netPursuit.escapeReason, power);
    assert.equal(game.score - before, success[0].bonus);
    assert.ok(success[0].bonus >= NET_PURSUIT.bonus);
    game.activatePower(power);
    assert.equal(events.filter(event => event.type === 'netpursuitsuccess').length, 1);
  }
});

test('a net strike consumes one shield charge and returns to pursuit recovery', () => {
  const events = [], game = emptyRunner(events);
  game.activatePower('shield');
  game._startNetPursuit();
  for (let elapsed = 0; elapsed < 8 && !events.some(event => event.type === 'netblocked'); elapsed += 1 / 120) {
    game.update(1 / 120);
  }
  assert.equal(events.filter(event => event.type === 'netblocked').length, 1);
  assert.equal(events.filter(event => event.type === 'netcaught').length, 0);
  assert.equal(events.filter(event => event.type === 'shieldhit').at(-1)?.kind, 'net');
  assert.equal(game.powers.shieldCharges, 2);
  assert.equal(game.state, 'RUNNING');
  assert.equal(game.netPursuit.phase, 'recovery');
});

test('automatic pursuit waits for its seeded distance and starts only on an eligible road', () => {
  const game = emptyRunner();
  game._nextNetPursuitDistance = game.distance + .01;
  game.update(.02);
  assert.equal(game.netPursuit.active, true);
  assert.equal(game.netPursuit.phase, 'approach');
});
