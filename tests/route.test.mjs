import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerGame,INTRO_DURATION} from '../dist/core.mjs';
import {ROUTE,BRANCHES,getRouteProfile,routeCenter,routeSection,crossStreetsAt,getTrafficPhase} from '../dist/route.mjs';

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
 const boundaries=[240];for(let s=240;s<30000;s=routeSection(s).end)boundaries.push(routeSection(s).end);
 for(const distance of boundaries){
  const before=getRouteProfile(distance-.001),after=getRouteProfile(distance+.001);
  for(const key of ['night','roadHalfWidth','buildingEdge','fogNear','fogFar','curve','offsetX'])
   assert.ok(Math.abs(before[key]-after[key])<.002,`${distance}: ${key} abruptly changes`);
 }
 assert.ok(getRouteProfile(780).roadHalfWidth>getRouteProfile(500).roadHalfWidth*3);
 assert.ok(getRouteProfile(1100).roadHalfWidth<getRouteProfile(780).roadHalfWidth);
 assert.ok(getRouteProfile(1100).night>getRouteProfile(500).night);
});

test('compact districts repeat in varied seeded orders with no missing sections',()=>{
 const sequence=seed=>{const ids=[];for(let s=240;s<240+1080*20;){const section=routeSection(s,seed);assert.equal(section.start,s);assert.ok(section.end-section.start<=420);ids.push(section.id);s=section.end;}return ids;};
 const a=sequence(123),b=sequence(456);assert.deepEqual(a.slice(0,3),['commercial','intersection','neon']);assert.notDeepEqual(a,b);assert.deepEqual(sequence(123),a);
 const orders=new Set();for(let i=0;i<a.length;i+=3){assert.deepEqual([...a.slice(i,i+3)].sort(),['commercial','intersection','neon']);orders.add(a.slice(i,i+3).join(','));}
 assert.ok(orders.size>=4);assert.equal(BRANCHES.length,0);
});

test('former hallway entrances keep the runner outside and never spawn indoor encounters',()=>{
 for(const [start,end,side] of [[860,1010,-1],[1740,1890,1],[2980,3270,1],[3720,3890,-1],[4250,4480,1],[4780,4930,-1]]){
  const g=new RunnerGame();g.seekArea(start-3);empty(g);g.debug.invincible=true;
  g.input(side<0?'left':'right');
  while(g.distance<end+1){
   tick(g,.1);
   assert.equal(g.route.branch,null,`entered hallway at ${g.distance}`);
   assert.equal(g.route.offsetY,0);
   assert.ok(g.entities.every(e=>!e.active||!e.routeBranch||['crossing','van-cover'].includes(e.routeBranch)));
  }
  assert.equal(g.state,'RUNNING');
 }
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

test('every later intersection generates crossing traffic at its own physical location',()=>{
 const g=new RunnerGame({random:()=>.31});g.start({skipIntro:true});let seen=0;
 for(let s=240;s<12000;s=routeSection(s,g.routeSeed).end){const section=routeSection(s,g.routeSeed);if(section.id!=='intersection')continue;
  g.distance=(section.start+section.end)/2;empty(g);g.time=12+seen*28;g._updateCrossTraffic(.01);
  const streets=crossStreetsAt(g.distance,g.routeSeed),cars=g.entities.filter(e=>e.active&&e.type==='crossTraffic');
  assert.equal(cars.length,2);assert.deepEqual(cars.map(e=>e.anchor),streets.map(e=>e.distance));seen++;
 }
 assert.ok(seen>8);
});

test('lateral traffic is a real collision and leaves the intersection after passing',()=>{
 const g=new RunnerGame();g.seekArea(768);empty(g);
 const car=g.spawnEntity('crossTraffic',1,0,{x:0,anchor:768,crossSpeed:10,width:3.55,depth:1.96,height:1.9});
 tick(g,.02);assert.equal(g.state,'CAUGHT');assert.equal(car.stopped,true);
 const h=new RunnerGame();h.seekArea(768);empty(h);h.debug.invincible=true;
 const past=h.spawnEntity('crossTraffic',1,0,{x:43,anchor:768,crossSpeed:10});tick(h,.02);assert.equal(past.active,false);
});

test('pooled street entities cannot inherit branch, finale or crossing transforms',()=>{
 const g=new RunnerGame();g.start({skipIntro:true});empty(g);
 const e=g.spawnEntity('crossTraffic',1,-10,{routeBranch:'karaoke',finale:true,anchor:3162,yaw:1.57,crossSpeed:10,vehicleKind:'bus'});
 e.active=false;g._poolCursor=e.id;const chip=g.spawnEntity('coin',1,-20);
 assert.equal(chip,e);assert.equal(chip.routeBranch,null);assert.equal(chip.finale,false);assert.equal(chip.yaw,null);assert.equal(chip.anchor,null);assert.equal(chip.crossSpeed,0);assert.equal(chip.vehicleKind,null);
});

test('the old endpoint remains an ordinary part of the endless street',()=>{
 const events=[],g=new RunnerGame({onEvent:e=>events.push(e)});g.seekArea(5545);empty(g);g.debug.invincible=true;tick(g,20);
 assert.ok(g.distance>5800);assert.equal(g.state,'RUNNING');assert.ok(g.speed>0);assert.equal(g.route.offsetX,0);
 assert.equal(events.filter(e=>e.type==='routecomplete').length,0);
 g.start();assert.equal(g.distance,0);assert.equal(g.state,'STARTING');assert.equal(g._routeWaiting,false);
});
