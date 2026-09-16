import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerGame, INTRO_DURATION, CAPTURE_DURATION, MOTION, BARRIERS, VEHICLES} from '../dist/core.mjs';
import {introPose, capturePose, STORE} from '../dist/choreography.mjs';
const tick=(g,t)=>{for(let left=t;left>1e-8;left-=1/120)g.update(Math.min(left,1/120));};
function emptyGame(){const g=new RunnerGame();g.start({skipIntro:true});g.entities.forEach(e=>e.active=false);g._spawnCursor=1e9;g.debug.speedOverride=10;return g;}

test('every normal retry resets into the store before starting the street chase',()=>{
  const g=emptyGame();g.spawnEntity('traffic',1,-.1);tick(g,.1);tick(g,CAPTURE_DURATION);
  assert.equal(g.state,'GAME_OVER');g.start();assert.equal(g.state,'STARTING');
  assert.equal(g.introProgress,0);assert.equal(g.distance,0);assert.equal(g.crash,null);
  assert.equal(g.mistakes,0);assert.equal(g.policeDistance,1.5);
  tick(g,INTRO_DURATION-.01);assert.equal(g.state,'STARTING');assert.equal(g.distance,0);
  tick(g,.02);assert.equal(g.state,'RUNNING');assert.ok(g.distance<1);
});
test('the police join from the street, remain close briefly, then fall behind continuously',()=>{
  for(let t=0;t<=INTRO_DURATION;t+=.01)for(const cop of introPose(t).officers)assert.ok(cop.x>STORE.x+.6);
  const g=emptyGame();tick(g,2.4);assert.equal(g.policeDistance,1.5);
  tick(g,1);assert.ok(g.policeDistance>1.5&&g.policeDistance<4);
  tick(g,5);assert.equal(g.policeDistance,10);assert.equal(g.mistakes,0);
});
test('clipping a vehicle edge stumbles; a following head-on hit immediately captures',()=>{
  const g=emptyGame();g.player.x=.94;g.player.laneFrom=.94;
  g.spawnEntity('traffic',1,-.1);tick(g,.1);
  assert.equal(g.state,'RUNNING');assert.equal(g.mistakes,1);assert.equal(g.policeDistance,1.5);
  tick(g,1.3);g.player.x=0;g.player.laneFrom=0;g.spawnEntity('traffic',1,-.1);tick(g,.1);
  assert.equal(g.state,'CAUGHT');
});
test('lane-changing into the side of a passing vehicle is recoverable',()=>{
  const g=emptyGame();g.player.x=-2.5;g.player.laneFrom=-2.5;g.player.lane=0;
  const car=g.spawnEntity('traffic',1,-.05);g.input('right');tick(g,.1);
  assert.equal(g.state,'RUNNING');assert.equal(g.mistakes,1);assert.equal(car.stopped,false);
});
test('coin arcs fit the real jump and all five can be collected while clearing a low barrier',()=>{
  const g=emptyGame();g._makePattern=()=>({slots:[null,'jump',null],safeLane:0});g._spawnPattern(4.1);
  const arc=g.entities.filter(e=>e.active&&e.jumpArc);assert.equal(arc.length,5);
  assert.equal(Math.max(...arc.map(e=>e.y)),MOTION.jumpHeight+.85);
  g.input('jump');tick(g,.85);assert.equal(g.mistakes,0);assert.equal(g.coins,5);
  assert.ok(BARRIERS.jump.height>1.5&&BARRIERS.jump.height<MOTION.jumpHeight);
});
test('late tiers have more barriers and shorter reaction gaps while preserving an escape lane',()=>{
  let seed=8;const g=new RunnerGame({random:()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296)});
  const count=tier=>{g.tier=tier;let barriers=0,obstacles=0;for(let i=0;i<3000;i++){const p=g._makePattern();assert.equal(p.slots[p.safeLane],null);barriers+=p.slots.filter(x=>BARRIERS[x]).length;obstacles+=p.slots.filter(Boolean).length;}return {barriers,obstacles};};
  const first=count(1),late=count(4);assert.ok(late.barriers>first.barriers*1.7);assert.ok(late.obstacles>first.obstacles*1.35);
});
test('store motion is continuous, packets attach before the dance and doors burst before exit',()=>{
  assert.equal(introPose(.94).packetHeld,false);assert.equal(introPose(.95).packetHeld,true);
  assert.ok(Math.abs(introPose(1.55).dance)>.5);
  for(let t=0;t<INTRO_DURATION;t+=.001){const a=introPose(t),b=introPose(t+.001);assert.ok(Math.abs(a.x-b.x)<.015);assert.ok(Math.abs(a.yaw-b.yaw)<.015);if(Math.abs(a.x-(STORE.x+.49))<.08)assert.ok(Math.abs(a.z-STORE.z)<.5);if(a.x>STORE.x+.49)assert.equal(a.doors,1);}
  const end=introPose(INTRO_DURATION);assert.equal(end.x,0);assert.equal(end.chase,1);
});
test('capture separates fall, pickup and carry with the final position outside the camera',()=>{
  assert.equal(capturePose(.2).lift,0);assert.equal(capturePose(.5).carry,0);
  assert.equal(capturePose(.57).lift,1);assert.equal(capturePose(1).carry,1);
});
