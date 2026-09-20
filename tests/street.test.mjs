import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerGame,LANES,MOTION,POWER_DURATIONS,PATTERNS,THEMES,VEHICLES,INTRO_DURATION,CAPTURE_DURATION,validatePattern,obstacleSpacing} from '../dist/core.mjs';
function game(){const g=new RunnerGame({random:()=>.21});g.start({skipIntro:true});return g;}
function tick(g,t,dt=1/120){for(let n=0;n<Math.ceil(t/dt);n++)g.update(Math.min(dt,t-n*dt));}
function empty(g){g.entities.forEach(e=>e.active=false);g._spawnCursor=1e9;}
test('street edition starts faster, keeps one level, and uses only supported powers',()=>{let g=game();assert.equal(g.speed,10.4);assert.deepEqual(THEMES,['HONG KONG']);assert.deepEqual(Object.keys(POWER_DURATIONS),['magnet','moon','moped','shield','doublechips','jetpack']);assert.equal(g.activatePower('frenzy'),false);assert.equal(g.activatePower('rocket'),false);assert.equal(g.activatePower('giant'),false);assert.equal(g.activatePower('skateboard'),false);assert.equal(g.spawnEntity('chip',1,-30),null);});
test('new obstacle groups are meaningfully closer with safe recovery spacing',()=>{for(let speed of [10.4,15,26])for(let tier=1;tier<=4;tier++){const spacing=obstacleSpacing(speed,tier);assert.ok(spacing/speed>MOTION.slideDuration+.2);if(tier===1)assert.ok(spacing<Math.max(17,speed*1.6+4));}});
test('all templates and 10000 generated traffic patterns leave a clear lane',()=>{let seed=4;const g=new RunnerGame({random:()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)});PATTERNS.forEach(p=>assert.ok(validatePattern(p)));for(let i=0;i<10000;i++){g.tier=i%4+1;const p=g._makePattern();assert.ok(validatePattern(p));assert.equal(p.slots[p.safeLane],null);}assert.equal(validatePattern({slots:['traffic','traffic','traffic']}),false);});
test('traffic advances faster than road scenery but preserves encounter timing',()=>{const g=game();empty(g);g.debug.invincible=true;g.debug.speedOverride=10;const car=g.spawnEntity('traffic',0,-40),bar=g.spawnEntity('jump',2,-40);assert.equal(car.z,-82);assert.equal(bar.z,-40);tick(g,2);assert.ok(Math.abs(car.z+41)<1e-6);assert.ok(Math.abs(bar.z+20)<1e-6);tick(g,2);assert.ok(Math.abs(car.z)<1e-6);assert.ok(Math.abs(bar.z)<1e-6);});
test('quick lane switches finish in 160ms and respect bounds',()=>{const g=game();g.input('left');tick(g,.16);assert.equal(g.player.x,LANES[0]);assert.equal(g.input('left'),false);g.input('right');g.input('right');tick(g,.16);assert.equal(g.player.x,LANES[2]);});
test('jump and slide keep generous stable timing with no double jump',()=>{const g=game();g.input('jump');tick(g,.41);assert.ok(g.player.y>2.6);g.input('jump');tick(g,.43);assert.equal(g.player.y,0);g.input('slide');assert.equal(g.input('jump'),false);g.input('left');tick(g,.16);assert.equal(g.player.lane,0);tick(g,.57);assert.equal(g.player.slide,0);});
test('swept traffic collision hits at high relative speed',()=>{const g=game();empty(g);g.debug.speedOverride=100;g.spawnEntity('traffic',1,-2);g.update(.1);assert.equal(g.state,'CAUGHT');assert.equal(g.speed,0);});
test('jump clears a barricade and slide clears an overhead beam',()=>{let g=game();empty(g);g.debug.speedOverride=10;g.spawnEntity('jump',1,-3.5);g.input('jump');tick(g,.7);assert.equal(g.mistakes,0);g=game();empty(g);g.debug.speedOverride=10;g.spawnEntity('slide',1,-3);g.input('slide');tick(g,.6);assert.equal(g.mistakes,0);});
test('direct barrier hits capture immediately and retry resets',()=>{const g=game();empty(g);g.spawnEntity('jump',1,-.1);tick(g,.1);assert.equal(g.state,'CAUGHT');tick(g,CAPTURE_DURATION);assert.equal(g.state,'GAME_OVER');g.activatePower('magnet');g.start({skipIntro:true});assert.equal(g.state,'RUNNING');assert.equal(g.score,0);assert.equal(g.policeDistance,1.5);assert.equal(g.powers.active.size,0);assert.equal(g.player.slide,0);});
test('pause freezes intro, road movement and power durations',()=>{const g=game();g.activatePower('magnet');tick(g,.8);g.pause();const before=g.snapshot();g.update(1);assert.deepEqual(g.snapshot(),before);g.resume();assert.equal(g.state,'RUNNING');g.start();tick(g,.5);g.pause();let p=g.introProgress;tick(g,1);assert.equal(g.introProgress,p);g.resume();tick(g,INTRO_DURATION-.5);assert.equal(g.state,'RUNNING');});
test('endless chase passes several city loops and keeps its entity pool bounded over ten minutes',()=>{const g=game();g.debug.invincible=true;const pool=g.entities;tick(g,600,1/30);assert.equal(g.entities,pool);assert.equal(pool.length,256);assert.equal(g.theme,'HONG KONG');assert.equal(g.themeIndex,0);assert.ok(g.score>0);assert.ok(g.distance>8500);assert.equal(g.state,'RUNNING');assert.ok(g.entities.every(e=>!e.active||['traffic','scooter','crossTraffic','blocker','jump','slide','coin','magnet','moon','moped'].includes(e.type)));assert.ok(g.patternHistory.length<=32);});
test('coin collection and magnet expiration remain correct',()=>{const g=game();empty(g);g.spawnEntity('coin',1,-.1);g.update(.1);assert.equal(g.coins,1);assert.ok(g.score>=10);g.activatePower('magnet');tick(g,8.01);assert.equal(g.powers.has('magnet'),false);});
test('all normal spawns align traffic and static hazards to a shared encounter row',()=>{const g=game();for(const e of g.entities.filter(e=>e.active&&e.safeLane>=0)){const row=g.patternHistory.find(p=>p.id===e.rowId);assert.ok(e.delayedForBarrier?e.z/e.approachFactor+row.distance<0:Math.abs(e.z/e.approachFactor+row.distance)<1e-5);assert.notEqual(e.lane,row.safeLane);}});

test('cars and scooter riders can be cleared at the apex of a well-timed jump',()=>{
  for(const type of Object.keys(VEHICLES)){const g=game();empty(g);g.debug.speedOverride=10;
    g.spawnEntity(type,1,-4.1);g.input('jump');tick(g,.9);
    assert.equal(g.state,'RUNNING',type);assert.equal(g.mistakes,0,type);
  }
});
test('tall barriers remain too high even at maximum jump height',()=>{
  const g=game();empty(g);g.debug.speedOverride=10;g.spawnEntity('blocker',1,-4.1);
  g.input('jump');tick(g,.6);assert.equal(g.state,'CAUGHT');
});
test('a vehicle impact stops traffic and the world for the seated capture animation',()=>{
  const g=game();empty(g);const car=g.spawnEntity('traffic',1,-.25);
  tick(g,.1);assert.equal(g.state,'CAUGHT');assert.equal(car.stopped,true);assert.equal(car.active,true);
  const z=car.z,dist=g.distance;tick(g,1);assert.equal(car.z,z);assert.equal(g.distance,dist);
  assert.equal(g.input('jump'),false);assert.ok(g.captureProgress>=1/CAPTURE_DURATION);tick(g,CAPTURE_DURATION);assert.equal(g.state,'GAME_OVER');
});
test('moped boosts speed and protects exactly one collision before dismounting',()=>{
  const g=game();empty(g);g.debug.speedOverride=10;g.activatePower('moped');tick(g,.1);
  assert.equal(g.speed,15);g.spawnEntity('traffic',1,-.2);tick(g,.1);
  assert.equal(g.state,'RUNNING');assert.equal(g.powers.has('moped'),false);assert.equal(g.mistakes,0);
  tick(g,1.2);g.spawnEntity('scooter',1,-.2);tick(g,.1);assert.equal(g.state,'CAUGHT');
});
test('moped shield does not erase an earlier mistake and expires cleanly',()=>{
  const g=game();empty(g);g.mistakes=1;g.activatePower('moped');
  g.spawnEntity('blocker',1,-.1);tick(g,.1);assert.equal(g.mistakes,1);assert.equal(g.state,'RUNNING');
  tick(g,1.2);g.spawnEntity('jump',1,-.1);tick(g,.1);assert.equal(g.state,'CAUGHT');
  g.start({skipIntro:true});empty(g);g.activatePower('moped');tick(g,10.01);assert.equal(g.powers.has('moped'),false);
});
test('pause freezes the capture sequence and resumes the same stopped impact',()=>{
  const g=game();empty(g);g.spawnEntity('scooter',1,-.2);tick(g,.1);g.pause();
  const before=g.snapshot();tick(g,1);assert.deepEqual(g.snapshot(),before);g.resume();tick(g,CAPTURE_DURATION);
  assert.equal(g.state,'GAME_OVER');
});
test('a clean interval lets cops fall back without granting another mistake',()=>{
  const g=game();empty(g);tick(g,25);
  assert.equal(g.policeDistance,10);assert.equal(g.mistakes,0);g.spawnEntity('jump',1,-.1);tick(g,.1);
  assert.equal(g.state,'CAUGHT');
});
test('sidewalk paths and full pedestrian widths stay clear of vendor carts and lamps',async()=>{
  const {SIDEWALK,sidewalkPose}=await import('../dist/crowd.mjs');
  for(let i=0;i<32;i++)for(let t=0;t<600;t+=.7){const p=sidewalkPose(i,t*15,t);
    assert.ok(Math.abs(p.x)+SIDEWALK.pedestrianRadius<SIDEWALK.vendorEdge);
    assert.ok(Math.abs(p.x)-SIDEWALK.pedestrianRadius>SIDEWALK.lampEdge);
    const next=sidewalkPose(i,t*15,t+.001);assert.ok(Math.abs(next.x-p.x)<.001);
  }
});


test('cars and mopeds queue behind every barrier, independent of pool order',()=>{
  for(const reverse of [false,true])for(const type of ['jump','slide','blocker']){
    const g=game();empty(g);g.debug.invincible=true;g.debug.speedOverride=10;
    let barrier,car,bike;
    const spawns=[()=>barrier=g.spawnEntity(type,0,-50),()=>car=g.spawnEntity('traffic',0,-32),()=>bike=g.spawnEntity('scooter',0,-43)];
    for(const spawn of reverse?spawns.reverse():spawns)spawn();
    for(let i=0;i<480;i++){
      g.update(1/120);
      assert.ok(car.z+car.depth/2+.74<=barrier.z-barrier.depth/2);
      assert.ok(bike.z+bike.depth/2+.74<=car.z-car.depth/2);
    }
    assert.equal(car.blocked,true);assert.equal(bike.blocked,true);
    assert.ok(Math.abs(car.actualApproach-1)<1e-8);
  }
});
test('traffic starts moving again when the blocked lane clears',()=>{
  const g=game();empty(g);g.debug.invincible=true;g.debug.speedOverride=10;
  const bar=g.spawnEntity('jump',0,-50),car=g.spawnEntity('traffic',0,-32);
  tick(g,3);assert.equal(car.blocked,true);bar.active=false;const z=car.z;
  tick(g,.5);assert.equal(car.blocked,false);assert.ok(Math.abs(car.z-z-10.25)<1e-7);
});
test('traffic spawns farther away and reaches an open lane after the barrier clears',()=>{
  const g=game();empty(g);g.spawnEntity('blocker',0,-50);
  g._makePattern=()=>({slots:['traffic',null,null],safeLane:1});g._spawnPattern(30);
  const car=g.entities.find(e=>e.active&&e.type==='traffic');assert.ok(car);assert.ok(car.z < -120);
  g.debug.invincible=true;g.debug.speedOverride=10;
  for(let t=0;t<5.91;t+=1/120){g.update(1/120);assert.equal(car.blocked,false);assert.ok(car.z< -29);}
  tick(g,2);assert.ok(car.z> -1);assert.equal(car.blocked,false);
});
test('a full crowd never overlaps or overtakes on either sidewalk, including the wrap seam',async()=>{
  const {CROWD_COUNT,SIDEWALK,sidewalkPose}=await import('../dist/crowd.mjs');
  assert.ok(CROWD_COUNT>=64);
  for(let t=0;t<1800;t+=1.7)for(const side of [0,1]){
    const people=Array.from({length:CROWD_COUNT/2},(_,i)=>sidewalkPose(i*2+side,t*15,t)).sort((a,b)=>a.z-b.z);
    for(let i=0;i<people.length;i++){
      const gap=i===people.length-1?210+people[0].z-people[i].z:people[i+1].z-people[i].z;
      assert.ok(gap>2*SIDEWALK.pedestrianRadius+.5);
    }
  }
});


test('new barriers cannot block traffic already approaching in their lane',()=>{
 const g=game();empty(g);g.spawnEntity('traffic',0,-40);
 g._makePattern=()=>({slots:['jump',null,null],safeLane:1});g._spawnPattern(30);
 assert.ok(!g.entities.some(e=>e.active&&e.type==='jump'));
});
test('tall open-frame barriers can be slid under but cannot be jumped',()=>{
 const g=game();empty(g);g.debug.speedOverride=10;g.spawnEntity('blocker',1,-3);g.input('slide');tick(g,.6);assert.equal(g.mistakes,0);
});


test('scheduled traffic stays out of barriers across a long generated run',()=>{
 let seed=17;const g=new RunnerGame({random:()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)});
 g.start({skipIntro:true});g.debug.invincible=true;
 for(let frame=0;frame<9000;frame++){
  g.update(1/30);
  const hazards=g.entities.filter(e=>e.active&&['jump','slide','blocker','traffic','scooter'].includes(e.type));
  for(const car of hazards.filter(e=>VEHICLES[e.type]))for(const bar of hazards.filter(e=>!VEHICLES[e.type]&&e.lane===car.lane)){
   assert.ok(Math.abs(car.z-bar.z)>(car.depth+bar.depth)/2);
   if(bar.z>car.z)assert.ok(car.z < -28,'traffic stays back until a blocked lane clears');
  }
 }
});

test('busted appears as carrying starts and the arrest continues behind the screen',()=>{
 const g=game();empty(g);let events=0;const old=g.emit.bind(g);g.emit=(type,data)=>{if(type==='gameover')events++;old(type,data);};
 g._capture(g.spawnEntity('traffic',1,-.1));tick(g,CAPTURE_DURATION*.69);assert.equal(g.state,'CAUGHT');
 tick(g,CAPTURE_DURATION*.025);assert.equal(g.state,'CAUGHT');assert.ok(g.captureProgress<.75);
 const before=g.captureProgress;tick(g,.3);assert.ok(g.captureProgress>before);tick(g,CAPTURE_DURATION);assert.equal(g.captureProgress,1);assert.equal(events,1);
});
test('down action while riding uses the duck timer without dismounting',()=>{
 const g=game();empty(g);g.activatePower('moped');assert.equal(g.input('slide'),true);tick(g,.2);assert.ok(g.player.slide>0);assert.ok(g.powers.has('moped'));tick(g,.6);assert.equal(g.player.slide,0);
});
