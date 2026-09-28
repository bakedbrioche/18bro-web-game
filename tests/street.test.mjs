import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerGame,LANES,MOTION,POWER_DURATIONS,POWER_SPAWN,COIN_SEQUENCES,COIN_SECTIONS,PATTERNS,THEMES,BARRIERS,VEHICLES,INTRO_DURATION,CAPTURE_DURATION,validatePattern,obstacleSpacing} from '../dist/core.mjs';
function game(){const g=new RunnerGame({random:()=>.21});g.start({skipIntro:true});return g;}
function tick(g,t,dt=1/120){for(let n=0;n<Math.ceil(t/dt);n++)g.update(Math.min(dt,t-n*dt));}
function empty(g){g.entities.forEach(e=>e.active=false);g._spawnCursor=1e9;g._coinSectionCursor=1e9;}
test('street edition starts faster, keeps one level, and uses only supported powers',()=>{let g=game();assert.equal(g.speed,10.4);assert.deepEqual(THEMES,['HONG KONG']);assert.deepEqual(Object.keys(POWER_DURATIONS),['magnet','moon','speedburst','moped','shield','doublechips','jetpack']);assert.equal(g.activatePower('frenzy'),false);assert.equal(g.activatePower('rocket'),false);assert.equal(g.activatePower('giant'),false);assert.equal(g.activatePower('skateboard'),false);assert.equal(g.spawnEntity('chip',1,-30),null);});
test('power-up selection is weighted, sparse and excludes both preceding kinds',()=>{
 let seed=11;const g=new RunnerGame({random:()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)}),seen=[];
 for(let i=0;i<100000;i++)seen.push(g._nextPowerKind());
 for(let i=1;i<seen.length;i++){assert.notEqual(seen[i],seen[i-1]);if(i>1)assert.notEqual(seen[i],seen[i-2]);}
 const count=Object.fromEntries(Object.keys(POWER_SPAWN.weights).map(kind=>[kind,seen.filter(value=>value===kind).length]));
 assert.ok(count.magnet>count.moon&&count.moon>count.speedburst&&count.speedburst>count.doublechips);
 assert.ok(count.doublechips>count.moped&&count.moped>count.shield&&count.shield>count.jetpack,JSON.stringify(count));
 const cadence=new RunnerGame({random:()=>.21}),rows=[];
 cadence.entities.forEach(e=>e.active=false);cadence._rowId=0;
 for(let row=0;row<32;row++){cadence._spawnPattern(30+row*.01);if(cadence.entities.some(e=>e.active&&e.rowId===row&&Object.hasOwn(POWER_DURATIONS,e.type)))rows.push(row);cadence.entities.forEach(e=>e.active=false);}
 assert.deepEqual(rows,[3,11,19,27]);assert.equal(POWER_SPAWN.rowInterval,8);
});
function sampleCoinSequences(seed,count,{safeLane=null,speed=26}={}){
 let state=seed;const g=new RunnerGame({random:()=>((state=(state*1664525+1013904223)>>>0)/4294967296)});g.speed=speed;
 return Array.from({length:count},(_,row)=>{
  const lane=typeof safeLane==='function'?safeLane(row):safeLane;
  const coins=g._spawnCoinSequence({safeLane:lane,rowId:row,z:-100}).sort((a,b)=>a.sequenceIndex-b.sequenceIndex);
  const sample={pattern:coins[0].coinPattern,length:coins.length,lanes:coins.map(e=>e.lane),z:coins.map(e=>e.z),safeLane:lane};
  for(const coin of coins)coin.active=false;
  return sample;
 });
}
test('ordinary chip routes are seeded, varied and keep obstacle crossings accessible',()=>{
 assert.deepEqual(COIN_SEQUENCES.lengthWeights,{3:1,4:3,5:3,6:1});
 assert.deepEqual(COIN_SEQUENCES.patterns,['straight','lateral','weave']);
 const routes=sampleCoinSequences(73,600,{safeLane:row=>row%3});
 assert.deepEqual(routes,sampleCoinSequences(73,600,{safeLane:row=>row%3}));
 for(let i=0;i<routes.length;i++){
  const route=routes[i],centerStart=Math.floor((route.length-1)/2),centerEnd=Math.ceil((route.length-1)/2);
  assert.ok(route.length>=3&&route.length<=6);
  assert.equal(route.lanes[centerStart],route.safeLane);assert.equal(route.lanes[centerEnd],route.safeLane);
  const laneCount=new Set(route.lanes).size;
  assert.equal(laneCount,route.pattern==='straight'?1:route.pattern==='lateral'?2:3);
  for(let step=1;step<route.length;step++)if(route.lanes[step]!==route.lanes[step-1]){
   assert.ok((route.z[step-1]-route.z[step])/26>=MOTION.laneDuration);
  }
  if(i)assert.notDeepEqual([route.pattern,route.lanes[0]],[routes[i-1].pattern,routes[i-1].lanes[0]]);
 }
});
test('ordinary chip lengths follow the explicit 1:3:3:1 bell distribution',()=>{
 const routes=sampleCoinSequences(181,16000),counts=Object.fromEntries([3,4,5,6].map(length=>[length,0]));
 for(const route of routes)counts[route.length]++;
 const total=routes.length,expected={3:1/8,4:3/8,5:3/8,6:1/8};
 for(const [length,ratio]of Object.entries(expected))assert.ok(Math.abs(counts[length]/total-ratio)<.018,JSON.stringify(counts));
});
test('broad intersections keep ordinary ground routes streaming during Jetpack',()=>{
 let seed=29;const make=()=>new RunnerGame({random:()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)});
 const g=make();g.entities.forEach(e=>e.active=false);g._spawnPattern(700);
 const coins=g.entities.filter(e=>e.active&&e.ordinaryCoin);assert.ok(coins.length>=3&&coins.length<=6);
 assert.ok(COIN_SEQUENCES.patterns.includes(coins[0].coinPattern));
 const jet=make();jet.entities.forEach(e=>e.active=false);jet.activatePower('jetpack');jet._spawnPattern(700);
 assert.equal(jet.entities.some(e=>e.active&&e.ordinaryCoin),true);
});
test('new obstacle groups are meaningfully closer with safe recovery spacing',()=>{for(let speed of [10.4,15,26])for(let tier=1;tier<=4;tier++){const spacing=obstacleSpacing(speed,tier);assert.ok(spacing/speed>MOTION.slideDuration+.2);if(tier===1)assert.ok(spacing<Math.max(17,speed*1.6+4));}});
test('all templates and 10000 generated traffic patterns leave a clear lane',()=>{let seed=4;const g=new RunnerGame({random:()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)});PATTERNS.forEach(p=>assert.ok(validatePattern(p)));for(let i=0;i<10000;i++){g.tier=i%4+1;const p=g._makePattern();assert.ok(validatePattern(p));assert.equal(p.slots[p.safeLane],null);}assert.equal(validatePattern({slots:['traffic','traffic','traffic']}),false);});
test('traffic advances faster than road scenery but preserves encounter timing',()=>{const g=game();empty(g);g.debug.invincible=true;g.debug.speedOverride=10;const car=g.spawnEntity('traffic',0,-40),bar=g.spawnEntity('jump',2,-40);assert.equal(car.z,-82);assert.equal(bar.z,-40);tick(g,2);assert.ok(Math.abs(car.z+41)<1e-6);assert.ok(Math.abs(bar.z+20)<1e-6);tick(g,2);assert.ok(Math.abs(car.z)<1e-6);assert.ok(Math.abs(bar.z)<1e-6);});
test('quick lane switches finish in 160ms and respect bounds',()=>{const g=game();g.input('left');tick(g,.16);assert.equal(g.player.x,LANES[0]);assert.equal(g.input('left'),false);g.input('right');g.input('right');tick(g,.16);assert.equal(g.player.x,LANES[2]);});
test('roll, jump and airborne roll chain immediately without granting a double jump',()=>{const g=game();assert.equal(g.input('slide'),true);assert.equal(g.player.anim,'roll');assert.equal(g.input('jump'),true);assert.equal(g.player.slide,0);assert.ok(g.player.vy>0);tick(g,.16);const rising=g.player.vy;assert.equal(g.input('jump'),true);assert.equal(g.player.vy,rising);assert.equal(g.input('slide'),true);assert.equal(g.player.anim,'roll');assert.ok(g.player.vy<0);g.input('left');tick(g,.16);assert.equal(g.player.lane,0);tick(g,.7);assert.equal(g.player.y,0);assert.equal(g.player.slide,0);});
test('swept traffic collision hits at high relative speed',()=>{const g=game();empty(g);g.debug.speedOverride=100;g.spawnEntity('traffic',1,-2);g.update(.1);assert.equal(g.state,'CAUGHT');assert.equal(g.speed,0);});
test('jump clears a barricade and slide clears an overhead beam',()=>{let g=game();empty(g);g.debug.speedOverride=10;g.spawnEntity('jump',1,-3.5);g.input('jump');tick(g,.7);assert.equal(g.mistakes,0);g=game();empty(g);g.debug.speedOverride=10;g.spawnEntity('slide',1,-3);g.input('slide');tick(g,.6);assert.equal(g.mistakes,0);});
test('direct barrier hits capture immediately and retry resets',()=>{const g=game();empty(g);g.spawnEntity('jump',1,-.1);tick(g,.1);assert.equal(g.state,'CAUGHT');tick(g,CAPTURE_DURATION);assert.equal(g.state,'GAME_OVER');g.activatePower('magnet');g.start({skipIntro:true});assert.equal(g.state,'RUNNING');assert.equal(g.score,0);assert.equal(g.policeDistance,1.5);assert.equal(g.powers.active.size,0);assert.equal(g.player.slide,0);});
test('pause freezes intro, road movement and power durations',()=>{const g=game();g.activatePower('magnet');tick(g,.8);g.pause();const before=g.snapshot();g.update(1);assert.deepEqual(g.snapshot(),before);g.resume();assert.equal(g.state,'RUNNING');g.start();tick(g,.5);g.pause();let p=g.introProgress;tick(g,1);assert.equal(g.introProgress,p);g.resume();tick(g,INTRO_DURATION-.5);assert.equal(g.state,'RUNNING');});
test('endless chase passes several city loops and keeps its entity pool bounded over ten minutes',()=>{const g=game();g.debug.invincible=true;const pool=g.entities;tick(g,600,1/30);assert.equal(g.entities,pool);assert.equal(pool.length,256);assert.equal(g.theme,'HONG KONG');assert.equal(g.themeIndex,0);assert.ok(g.score>0);assert.ok(g.distance>8500);assert.equal(g.state,'RUNNING');assert.ok(g.entities.every(e=>!e.active||['traffic','scooter','crossTraffic','blocker','jump','slide','coin','magnet','moon','speedburst','moped','shield','doublechips','jetpack'].includes(e.type)));assert.ok(g.patternHistory.length<=32);});
test('coin collection and magnet expiration remain correct',()=>{const g=game();empty(g);g.spawnEntity('coin',1,-.1);g.update(.1);assert.equal(g.coins,1);assert.ok(g.score>=10);g.activatePower('magnet');tick(g,8.01);assert.equal(g.powers.has('magnet'),false);});
test('magnet expiration waits for every latched chip to finish collecting',()=>{const g=game();empty(g);g.activatePower('magnet');const chip=g.spawnEntity('coin',0,-9.5,{y:3});tick(g,.05);assert.equal(chip.magnetLatched,true);g.powers.active.get('magnet').remaining=.01;tick(g,.02);assert.equal(g.powers.has('magnet'),true);tick(g,1.2);assert.equal(chip.active,false);assert.equal(g.powers.has('magnet'),false);assert.equal(g.coins,1);});
test('all normal spawns align traffic and static hazards to a shared encounter row',()=>{const g=game();for(const e of g.entities.filter(e=>e.active&&e.safeLane>=0)){const row=g.patternHistory.find(p=>p.id===e.rowId);assert.ok(e.delayedForBarrier?e.z/e.approachFactor+row.distance<0:Math.abs(e.z/e.approachFactor+row.distance)<1e-5);assert.notEqual(e.lane,row.safeLane);}});

test('cars and scooter riders can be cleared at the apex of a well-timed jump',()=>{
  for(const type of Object.keys(VEHICLES)){const g=game();empty(g);g.debug.speedOverride=10;
    g.spawnEntity(type,1,-4.1);g.input('jump');tick(g,.9);
    assert.equal(g.state,'RUNNING',type);assert.equal(g.mistakes,0,type);
  }
});
test('descending roll lands safely on a car roof and continues off the far edge',()=>{
  const g=game();empty(g);g.debug.speedOverride=10;const car=g.spawnEntity('traffic',1,-.2);
  g.player.y=2;g.player.vy=-4;g.player.grounded=false;g.player.slide=MOTION.slideDuration;g.player.anim='roll';
  tick(g,.01);assert.equal(g.state,'RUNNING');assert.equal(g.player.roofEntityId,car.id);assert.equal(g.player.y,car.height);
  tick(g,.7);assert.equal(g.state,'RUNNING');assert.equal(g.player.roofEntityId,null);assert.equal(g.mistakes,0);
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

test('seeded chip sections stay spaced as one non-crossing trail',()=>{
 const make=()=>{let seed=41;const g=new RunnerGame({random:()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)});g.start({skipIntro:true});return g;};
 const summarize=g=>{
  const groups=new Map();
  for(const coin of g.entities.filter(e=>e.active&&e.coinSectionId>=0)){
   if(!groups.has(coin.coinSectionId))groups.set(coin.coinSectionId,[]);
   groups.get(coin.coinSectionId).push(coin);
  }
  return [...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([id,coins])=>{
   const distances=coins.map(e=>e.spawnDistance),indices=coins.map(e=>e.sequenceIndex);
   return {id,pattern:coins[0].coinSectionPattern,count:coins.length,center:distances.reduce((sum,value)=>sum+value,0)/distances.length,
    min:Math.min(...distances),max:Math.max(...distances),indices,lanes:coins.map(e=>e.lane)};
  });
 };
 const first=summarize(make()),second=summarize(make());
 assert.deepEqual(first,second);assert.ok(first.length>=4,'doubling cadence keeps at least four visible sections in the initial streamed window');
 for(const section of first){
  assert.ok(['straight','lateral','weave','jump'].includes(section.pattern));
  assert.ok(section.count>=3&&section.count<=6);
  assert.equal(new Set(section.indices).size,section.count,'a section contains one trail, not crossing lines');
 }
 for(let index=1;index<first.length;index++){
  const gap=first[index].center-first[index-1].center;
  assert.ok(gap>=COIN_SECTIONS.gapMin-1e-8,gap);
  assert.ok(gap<=COIN_SECTIONS.gapMax+30,gap);
  assert.ok(first[index-1].max<first[index].min,'chip sections do not overlap');
 }
 const jet=make();jet.entities.forEach(e=>e.active=false);jet.activatePower('jetpack');jet._coinSectionCursor=jet.distance;
 const duringFlight=jet._maybeSpawnCoinSection({safeLane:1,rowId:999,z:-45,y:1,spawnDistance:jet.distance+45});
 assert.ok(duringFlight.length>=3&&duringFlight.every(e=>!e.flightTrail));
 assert.equal(jet.entities.some(e=>e.active&&e.coinSectionId===duringFlight[0].coinSectionId),true);
});

test('broad roads retain sparse forward cars with at least two open lanes',()=>{
 const g=new RunnerGame({random:()=>.2});g.entities.forEach(e=>e.active=false);g._rowId=0;
 const rows=20,cars=[];
 for(let row=0;row<rows;row++){
  g._spawnPattern(700+row*.01);
  cars.push(...g.entities.filter(e=>e.active&&e.intersectionFlow));
  g.entities.forEach(e=>e.active=false);
 }
 assert.equal(cars.length,rows/2);
 assert.ok(cars.every(car=>car.type==='traffic'&&(car.lane===0||car.lane===2)));
 assert.ok(cars.every(car=>car.safeLane!==car.lane));
});

test('descending landings on reachable obstacle roofs continue the run',()=>{
 for(const type of Object.keys(BARRIERS)){
  const g=game();empty(g);g.debug.speedOverride=10;const obstacle=g.spawnEntity(type,1,-.15);
  g.player.y=obstacle.height+.04;g.player.vy=-1;g.player.grounded=false;
  tick(g,.02);
  assert.equal(g.state,'RUNNING',type);assert.equal(g.player.roofEntityId,obstacle.id,type);
  assert.equal(g.player.y,obstacle.height,type);assert.equal(g.mistakes,0,type);
 }
});

test('pursuit and Jetpack landing planners reserve reachable lanes without deleting hazards',()=>{
 const g=game();empty(g);g._startNetPursuit();const lane=g.netPursuit.safety.keepClearLanes[0];
 for(let row=0;row<40;row++){
  g.entities.forEach(e=>e.active=false);const rowId=g._rowId;g._spawnPattern(80+row*.01);
  const hazards=g.entities.filter(e=>e.active&&e.rowId===rowId&&['blocker','jump','slide','traffic','scooter'].includes(e.type));
  assert.ok(hazards.length>0);assert.equal(hazards.some(e=>e.lane===lane),false);
 }
 const existing=g.spawnEntity('blocker',lane,-4);g.update(1/120);assert.equal(existing.active,true,'fair planning never despawns an existing hazard');
});

test('power pickups defer past chip trails and obstacle rows keep every ordinary chip reachable',()=>{
 const g=game();empty(g);g._rowId=3;g._coinSectionCursor=60;
 g._makePattern=()=>({slots:['slide',null,'blocker'],safeLane:1});
 const firstRow=g._rowId;g._spawnPattern(60);
 const coins=g.entities.filter(e=>e.active&&e.rowId===firstRow&&e.ordinaryCoin);
 assert.ok(coins.length>=3);assert.ok(coins.every(e=>e.lane===1&&e.coinPattern==='straight'));
 assert.equal(g.entities.some(e=>e.active&&e.rowId===firstRow&&Object.hasOwn(POWER_DURATIONS,e.type)),false,'booster is deferred when the chip section owns the row');
 const nextRow=g._rowId;g._spawnPattern(90);
 const pickup=g.entities.find(e=>e.active&&e.rowId===nextRow&&Object.hasOwn(POWER_DURATIONS,e.type));
 assert.ok(pickup,'deferred booster appears on the next clear reward row');
 assert.ok(g.entities.filter(e=>e.active&&e.type==='coin').every(coin=>Math.abs(coin.z-pickup.z)>=7.5));
 assert.equal(g.entities.some(e=>e.active&&e.rowId===nextRow&&['blocker','jump','slide','traffic','scooter'].includes(e.type)&&e.lane===pickup.lane),false);
});