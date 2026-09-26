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
  tick(g,.02);assert.equal(g.state,'RUNNING');assert.ok(Math.abs(g.distance-introPose(INTRO_DURATION).distance)<.3);
});
test('the police join from the street, remain close briefly, then fall behind continuously',()=>{
  for(let t=0;t<=INTRO_DURATION;t+=.01)for(const cop of introPose(t).officers)assert.ok(cop.x>STORE.x+.6);
  const g=emptyGame();tick(g,2.4);assert.equal(g.policeDistance,1.5);
  tick(g,1);assert.ok(g.policeDistance>1.5&&g.policeDistance<4);
  tick(g,5);assert.equal(g.policeDistance,10);assert.equal(g.mistakes,0);
});
test('vehicle edge clips stumble; a following head-on hit captures',()=>{
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
  assert.equal(Math.max(...arc.map(e=>e.y)),MOTION.jumpHeight+.7);
  g.input('jump');tick(g,.85);assert.equal(g.mistakes,0);assert.equal(g.coins,5);
  assert.ok(BARRIERS.jump.height>1.5&&BARRIERS.jump.height<MOTION.jumpHeight);
});
test('later tiers grow denser with a majority of vehicles and a reserved escape lane',()=>{
  let seed=8;const g=new RunnerGame({random:()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296)});
  const count=tier=>{g.tier=tier;let barriers=0,obstacles=0;for(let i=0;i<3000;i++){const p=g._makePattern();assert.equal(p.slots[p.safeLane],null);barriers+=p.slots.filter(x=>BARRIERS[x]).length;obstacles+=p.slots.filter(Boolean).length;}return {barriers,obstacles};};
  const first=count(1),late=count(4);assert.ok(late.barriers>first.barriers);assert.ok(late.obstacles>first.obstacles*1.35);assert.ok(late.barriers<late.obstacles*.45);
});
test('store motion is continuous, packets attach before the dance and doors burst before exit',()=>{
  assert.equal(introPose(.94).packetHeld,false);assert.equal(introPose(.95).packetHeld,true);
  assert.ok(Math.abs(introPose(1.55).dance)>.5);
  for(let t=0;t<INTRO_DURATION;t+=.001){const a=introPose(t),b=introPose(t+.001);assert.ok(Math.abs(a.x-b.x)<.015);assert.ok(Math.abs(a.yaw-b.yaw)<.015);if(Math.abs(a.x-(STORE.x+.49))<.08)assert.ok(Math.abs(a.z-a.distance-STORE.z)<.5);if(a.x>STORE.x+.49)assert.equal(a.doors,1);}
  const end=introPose(INTRO_DURATION);assert.equal(end.x,0);assert.equal(end.chase,1);
});
test('capture separates fall, pickup and carry',()=>{
  assert.equal(capturePose(.2).lift,0);assert.equal(capturePose(.5).carry,0);
  assert.equal(capturePose(.57).lift,1);assert.equal(capturePose(1).carry,1);
});
test('arrest duration stays short even when the chasing officers were far behind',()=>{
 for(const distance of [0,1.5,10,18,40]){
  const g=emptyGame();g.policeDistance=distance;g._capture(g.spawnEntity('traffic',1,-.1));
  assert.equal(g.captureDuration,CAPTURE_DURATION);assert.ok(g.captureDuration<=4);
  tick(g,1.4);assert.ok(capturePose(g.captureProgress).gather>.999);
  tick(g,3);assert.equal(g.state,'GAME_OVER');
 }
});
test('escape joins the running street at the same position and forward speed',()=>{
  const end=introPose(INTRO_DURATION),before=introPose(INTRO_DURATION-.001);
  assert.equal(end.x,0);assert.equal(end.z,0);assert.equal(end.yaw,Math.PI);
  assert.ok(Math.abs((end.distance-before.distance)/.001-10.4)<.001);
  assert.equal(end.chase,1);
});
test('moped immediately drops police and preserves the remaining mistake allowance',()=>{
  const g=emptyGame();g.mistakes=1;g.policeDistance=1.5;
  g.activatePower('moped');assert.equal(g.policeDistance,18);tick(g,1);
  assert.equal(g.policeDistance,18);assert.equal(g.mistakes,1);
  g.powers.remove('moped');g._hitAge=100;tick(g,3);assert.equal(g.policeDistance,18);
});
test('clear-lane chip routes stay compact and cross the safe lane at the encounter',()=>{
  const g=emptyGame();g._makePattern=()=>({slots:[null,'blocker',null],safeLane:0});
  g._spawnPattern(30);const chips=g.entities.filter(e=>e.active&&e.type==='coin'&&e.ordinaryCoin).sort((a,b)=>a.sequenceIndex-b.sequenceIndex);
  assert.ok(chips.length>=3&&chips.length<=6);
  const centerStart=Math.floor((chips.length-1)/2),centerEnd=Math.ceil((chips.length-1)/2);
  assert.equal(chips[centerStart].lane,0);assert.equal(chips[centerEnd].lane,0);
  assert.ok(chips[0].z-chips.at(-1).z<=5*Math.max(2.25,g.speed*MOTION.laneDuration+.35)+1e-9);
});
test('police finish turning before carrying the cat toward the camera',()=>{
  assert.equal(capturePose(.35).turn,0);assert.equal(capturePose(.5).turn,0);
  assert.equal(capturePose(.67).turn,1);assert.equal(capturePose(.67).carry,0);
});


test('the grab turn includes stepping and the door burst settles into the run',()=>{
 assert.ok(introPose(.45).turnStep>.9);assert.equal(introPose(.95).turnStep,0);
 assert.ok(introPose(1.2).turnStep>.8);assert.equal(introPose(1.5).turnStep,0);
 assert.ok(introPose(3.05).burst>.95);assert.equal(introPose(3.6).burst,0);
});
