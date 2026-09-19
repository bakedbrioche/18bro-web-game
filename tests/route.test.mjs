import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerGame,INTRO_DURATION} from '../dist/core.mjs';
import {ROUTE,BRANCHES,getRouteProfile,routeCenter,branchOffset,getTrafficPhase} from '../dist/route.mjs';

function tick(game,seconds,dt=1/120){for(let time=0;time<seconds-1e-9;time+=dt)game.update(Math.min(dt,seconds-time));}
function empty(game){for(const e of game.entities)e.active=false;game._spawnCursor=1e9;}

test('the completed opening stays flat and enters the same uninterrupted running state',()=>{
 const events=[],g=new RunnerGame({onEvent:e=>events.push(e),random:()=>.2});
 g.start();assert.equal(g.state,'STARTING');tick(g,INTRO_DURATION+.05);
 assert.equal(g.state,'RUNNING');assert.ok(g.distance<ROUTE.start);
 for(let s=0;s<=ROUTE.start;s+=10){assert.equal(Math.abs(routeCenter(s)),0);assert.equal(getRouteProfile(s).night,0);}
 assert.deepEqual(events.filter(e=>e.type==='state').map(e=>e.state),['STARTING','RUNNING']);
});

test('district boundaries preserve continuous street width, fog, light and road curvature',()=>{
 for(const distance of [240,400,2920,3000,3080,3220,3300,3360,4140,5440,5480,5560]){
  const before=getRouteProfile(distance-.001),after=getRouteProfile(distance+.001);
  for(const key of ['night','roadHalfWidth','buildingEdge','fogNear','fogFar','curve','offsetX'])
   assert.ok(Math.abs(before[key]-after[key])<.002,`${distance}: ${key} abruptly changes`);
 }
 assert.ok(getRouteProfile(3150).roadHalfWidth>getRouteProfile(2600).roadHalfWidth*3);
 assert.ok(getRouteProfile(4400).roadHalfWidth<getRouteProfile(3150).roadHalfWidth);
 assert.ok(getRouteProfile(4400).night>getRouteProfile(3400).night);
});

test('every alternate route has smooth entry and exit and returns to the street',()=>{
 for(const b of BRANCHES){
  assert.deepEqual(branchOffset(b,b.start-1),{x:0,y:0});
  assert.deepEqual(branchOffset(b,b.start),{x:0,y:0});
  assert.deepEqual(branchOffset(b,b.end),{x:0,y:0});
  assert.deepEqual(branchOffset(b,b.end+1),{x:0,y:0});
  let last=branchOffset(b,b.start);
  for(let s=b.start+.1;s<b.end;s+=.1){const p=branchOffset(b,s);assert.ok(Math.abs(p.x-last.x)<Math.abs(b.offset)*.151/Math.min(b.entryLength,b.exitLength),b.id);assert.ok(Math.abs(p.y-last.y)<.03,b.id);last=p;}
  assert.ok(Math.abs(branchOffset(b,(b.start+b.end)/2).x)>3,b.id);
 }
 const stairs=BRANCHES.find(b=>b.kind==='stairs');
 assert.ok(branchOffset(stairs,(stairs.start+stairs.end)/2).y>2.5);
});

test('traffic signals never release conflicting roads or pedestrians together',()=>{
 let pedestrianSeconds=0;
 for(let t=0;t<56;t+=.025){
  const p=getTrafficPhase(t);
  assert.ok(p.remaining>0);assert.notEqual(p.road==='green'&&p.cross==='green',true);
  if(p.pedestrian==='green'){pedestrianSeconds+=.025;assert.equal(p.road,'red');assert.equal(p.cross,'red');}
 }
 assert.ok(pedestrianSeconds>=11.9);
 assert.equal(getTrafficPhase(56).id,getTrafficPhase(0).id);
});

test('outside lane chooses a real passage and merges back without resetting distance',()=>{
 for(const b of BRANCHES.filter(b=>b.kind!=='crossing')){
  const g=new RunnerGame();g.seekArea(b.start-3);empty(g);g.debug.invincible=true;
  g.input(b.side<0?'left':'right');tick(g,.3);
  assert.equal(g.route.branch,b.id,b.id);
  const entry=g.distance;tick(g,(b.end-g.distance)/15+1);
  assert.equal(g.route.branch,null,b.id);assert.ok(g.distance>entry);assert.equal(g.state,'RUNNING');
 }
});

test('pedestrian route waits at red, freezes on pause, then clears both traffic streams',()=>{
 const g=new RunnerGame();g.seekArea(2997);empty(g);g.input('left');tick(g,.3);
 assert.equal(g.route.branch,'crossing');g.time=56;tick(g,9);
 assert.equal(g.distance,3128);assert.equal(g.route.waiting,true);assert.equal(g.speed,0);
 g.pause();const before=g.snapshot();tick(g,2);assert.deepEqual(g.snapshot(),before);g.resume();
 tick(g,20);assert.ok(g.distance>3180);assert.equal(g.state,'RUNNING');assert.equal(g.route.waiting,false);
});

test('lateral traffic is a real collision and leaves the intersection after passing',()=>{
 const g=new RunnerGame();g.seekArea(3138);empty(g);
 const car=g.spawnEntity('crossTraffic',1,0,{x:0,anchor:3138,crossSpeed:10,width:3.55,depth:1.96,height:1.9});
 tick(g,.02);assert.equal(g.state,'CAUGHT');assert.equal(car.stopped,true);
 const h=new RunnerGame();h.seekArea(3138);empty(h);h.debug.invincible=true;
 const past=h.spawnEntity('crossTraffic',1,0,{x:43,anchor:3138,crossSpeed:10});tick(h,.02);assert.equal(past.active,false);
});

test('pooled street entities cannot inherit branch, finale or crossing transforms',()=>{
 const g=new RunnerGame();g.start({skipIntro:true});empty(g);
 const e=g.spawnEntity('crossTraffic',1,-10,{routeBranch:'karaoke',finale:true,anchor:3162,yaw:1.57,crossSpeed:10,vehicleKind:'bus'});
 e.active=false;g._poolCursor=e.id;const chip=g.spawnEntity('coin',1,-20);
 assert.equal(chip,e);assert.equal(chip.routeBranch,null);assert.equal(chip.finale,false);assert.equal(chip.yaw,null);assert.equal(chip.anchor,null);assert.equal(chip.crossSpeed,0);assert.equal(chip.vehicleKind,null);
});

test('arcade arrival stops at its threshold once, with no new level or leftover motion',()=>{
 const events=[],g=new RunnerGame({onEvent:e=>events.push(e)});g.seekArea(5545);empty(g);tick(g,2);
 assert.equal(g.distance,ROUTE.end);assert.equal(g.state,'ARCADE');assert.equal(g.speed,0);assert.equal(g.route.offsetX,10);
 const state=g.snapshot();tick(g,20);assert.deepEqual(g.snapshot(),state);assert.equal(events.filter(e=>e.type==='routecomplete').length,1);
 g.start();assert.equal(g.distance,0);assert.equal(g.state,'STARTING');assert.equal(g._routeWaiting,false);
});
