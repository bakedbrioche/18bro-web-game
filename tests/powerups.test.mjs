import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerGame,INTRO_DURATION,LANES,MOTION,BARRIERS,POWER_DURATIONS,SHIELD_CHARGES,JETPACK_PHASES} from '../dist/core.mjs';
import {introPose} from '../dist/choreography.mjs';
const tick=(g,t)=>{for(let s=0;s<t;s+=1/120)g.update(Math.min(1/120,t-s));};
function empty(){const g=new RunnerGame();g.start({skipIntro:true});g.entities.forEach(e=>e.active=false);g._spawnCursor=1e9;g._coinSectionCursor=1e9;return g;}
test('double chips doubles pickups and pauses its timer without changing earlier chips',()=>{
 const g=empty();g._pickup(g.spawnEntity('coin',1,0));g.activatePower('doublechips');g._pickup(g.spawnEntity('coin',1,0));assert.equal(g.coins,3);
 g.pause();tick(g,20);assert.equal(g.powers.active.get('doublechips').remaining,12);
 g.resume();tick(g,12.1);g._pickup(g.spawnEntity('coin',1,0));assert.equal(g.coins,4);
});
test('shield grants three timed collision charges and reports each consumed charge',()=>{
 const events=[],g=new RunnerGame({onEvent:e=>events.push(e)});g.start({skipIntro:true});g.entities.forEach(e=>e.active=false);g._spawnCursor=1e9;g._coinSectionCursor=1e9;
 g.activatePower('shield');assert.equal(POWER_DURATIONS.shield,15);assert.equal(g.powers.shieldCharges,SHIELD_CHARGES);
 for(let remaining=2;remaining>=0;remaining--){g._hit(g.spawnEntity('blocker',1,0));assert.equal(g.state,'RUNNING');assert.equal(g.powers.shieldCharges,remaining);if(remaining)tick(g,1.2);}
 assert.equal(g.powers.has('shield'),false);
 assert.deepEqual(events.filter(e=>e.type==='shieldhit').map(e=>e.remaining),[2,1,0]);
 assert.equal(events.findLast(e=>e.type==='powerend'&&e.kind==='shield')?.reason,'depleted');
 tick(g,1.2);g._hit(g.spawnEntity('traffic',1,0));assert.equal(g.state,'CAUGHT');
 const timed=empty();timed.activatePower('shield');tick(timed,14.99);assert.equal(timed.powers.shieldCharges,3);tick(timed,.02);assert.equal(timed.powers.shieldCharges,0);
});
test('Moon Boots raise the jump above two-storey blockers without changing speed, score or protection',()=>{
 const ordinary=empty();ordinary.input('jump');let ordinaryApex=0;
 for(let t=0;t<.9;t+=1/120){ordinary.update(1/120);ordinaryApex=Math.max(ordinaryApex,ordinary.player.y);}
 assert.ok(Math.abs(ordinaryApex-MOTION.jumpHeight)<.04);
 const moon=empty();moon.activatePower('moon');assert.equal(POWER_DURATIONS.moon,10);assert.equal(moon.powers.speedMultiplier,1);assert.equal(moon.powers.scoreMultiplier,1);assert.equal(moon.powers.invulnerable,false);
 moon.input('jump');assert.equal(moon.player.jumpApex,MOTION.moonJumpHeight);let moonApex=0;
 moon.powers.active.get('moon').remaining=.1;
 for(let t=0;t<.58;t+=1/120){moon.update(1/120);moonApex=Math.max(moonApex,moon.player.y);}
 assert.equal(moon.powers.has('moon'),false);assert.equal(moon.player.jumpApex,MOTION.moonJumpHeight);
 assert.ok(moonApex>BARRIERS.blocker.height+.7);
 moon.spawnEntity('blocker',1,-.8);tick(moon,.04);assert.equal(moon.state,'RUNNING');
 tick(moon,1);assert.equal(moon.player.jumpApex,MOTION.jumpHeight);
 const vulnerable=empty();vulnerable.activatePower('moon');vulnerable._hit(vulnerable.spawnEntity('blocker',1,0));assert.equal(vulnerable.state,'CAUGHT');
});
test('speed burst is its own timed speed power and Moon Boots never accelerate it',()=>{
 const g=empty();g.activatePower('moon');tick(g,.1);const normal=g.speed;
 g.activatePower('speedburst');tick(g,.1);assert.ok(g.speed>normal*1.55&&g.speed<normal*1.7);
 assert.equal(g.powers.speedMultiplier,1.6);assert.equal(g.powers.scoreMultiplier,1);
 tick(g,POWER_DURATIONS.speedburst+.1);assert.equal(g.powers.has('speedburst'),false);assert.equal(g.powers.speedMultiplier,1);
});
test('jetpack lifts smoothly, pulls chips, clears hazards and lands exactly when its timer ends',()=>{
 const g=empty();g.activatePower('jetpack');let last=0;
 for(let t=0;t<1;t+=1/120){g.update(1/120);assert.ok(Math.abs(g.player.y-last)<.12);last=g.player.y;}
 assert.ok(g.player.y>5);g.spawnEntity('coin',0,-3);g.spawnEntity('blocker',1,-2);tick(g,.5);
 assert.equal(g.state,'RUNNING');assert.ok(g.coins>=1);assert.equal(g.input('slide'),false);
 tick(g,8.8);assert.equal(g.powers.has('jetpack'),false);assert.ok(g.shieldGrace>0);tick(g,1.3);assert.equal(g.player.y,0);assert.equal(g.player.grounded,true);
 g.start({skipIntro:true});assert.equal(g.powers.active.size,0);
});
test('jetpack reveals its lane-changing route only after lift-off and removes it at landing',()=>{
 let seed=7;const g=new RunnerGame({random:()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)});g.start({skipIntro:true});g.entities.forEach(e=>e.active=false);g._spawnCursor=1e9;g._coinSectionCursor=1e9;
 g.activatePower('jetpack');assert.equal(g.entities.filter(e=>e.active&&e.flightTrail).length,0);
 assert.ok(g._flightTrailPlan.length>=30);assert.deepEqual([...new Set(g._flightTrailPlan.map(e=>e.lane))].sort(),[0,1,2]);
 tick(g,.1);let visible=g.entities.filter(e=>e.active&&e.flightTrail).sort((a,b)=>a.trailIndex-b.trailIndex);
 assert.ok(g.player.y>.05);assert.equal(visible.length,8);assert.deepEqual(visible.map(e=>e.trailIndex),[0,1,2,3,4,5,6,7]);
 assert.ok(visible.every(e=>e.y>2.1));assert.equal(new Set(visible.map(e=>e.flightTrailId)).size,1);
 for(let second=0;second<8;second++){tick(g,1);visible=g.entities.filter(e=>e.active&&!e.retiring&&e.flightTrail&&e.z<3);assert.ok(visible.length>=1&&visible.length<=8,(second+1)+'s: '+visible.length+' visible');}
 assert.ok(g._flightTrailCursor>8,'new route chips are revealed as the player advances');
 tick(g,2);assert.equal(g.player.y,0);assert.equal(g.player.grounded,true);assert.ok(g.entities.filter(e=>e.active&&e.flightTrail).every(e=>e.retiring));tick(g,.3);assert.equal(g.entities.some(e=>e.active&&e.flightTrail),false);
});
test('speed burst cannot extend Jetpack chips or trigger a post-landing jump',()=>{
 const events=[];const g=new RunnerGame({onEvent:e=>events.push(e)});g.start({skipIntro:true});g.entities.forEach(e=>e.active=false);g._spawnCursor=1e9;g._coinSectionCursor=1e9;
 g.activatePower('speedburst');g.powers.active.get('speedburst').remaining=2;g.activatePower('jetpack');tick(g,9.9);
 assert.equal(g.powers.has('speedburst'),false);assert.equal(g.powers.has('jetpack'),true);assert.ok(g.player.y>0);
 assert.equal(g.powers.active.get('jetpack').descending,true);g.player.jumpBuffer=MOTION.jumpBuffer;
 tick(g,.11);assert.equal(g.powers.has('jetpack'),false);assert.equal(g.player.y,0);assert.equal(g.player.vy,0);
 assert.equal(g.player.grounded,true);assert.equal(g.player.anim,'run');assert.equal(g.player.jumpBuffer,0);
 assert.ok(g.entities.filter(e=>e.active&&e.flightTrail).every(e=>e.retiring));assert.equal(g._flightTrailPlan.length,0);
 assert.equal(events.findLast(e=>e.type==='powerend'&&e.kind==='jetpack')?.reason,'expired');
 tick(g,.5);assert.equal(g.player.y,0);assert.equal(g.player.anim,'run');
});
test('jetpack removes and suppresses ordinary chips without suppressing hazards or powers',()=>{
 const g=empty(),ahead=g.spawnEntity('coin',0,-20),behind=g.spawnEntity('coin',2,4);
 const hazard=g.spawnEntity('blocker',0,-25),power=g.spawnEntity('shield',2,-24);
 g.activatePower('magnet');g.activatePower('jetpack');
 assert.equal(ahead.active,true);assert.equal(ahead.retiring,true);assert.equal(behind.active,true);assert.equal(hazard.active,true);assert.equal(power.active,true);
 g._rowId=3;g._spawnPattern(80);
 assert.equal(g.entities.some(e=>e.active&&e.rowId===3&&e.type==='coin'&&!e.flightTrail),false);
 assert.ok(g.entities.some(e=>e.active&&e.rowId===3&&['blocker','jump','slide','traffic','scooter'].includes(e.type)));
 assert.ok(g.entities.some(e=>e.active&&e.rowId===3&&Object.hasOwn(POWER_DURATIONS,e.type)));
 const ordinary=g.spawnEntity('coin',0,-.5,{y:2.2});ordinary.magnetLatched=true;const x=ordinary.x;
 tick(g,.05);assert.equal(ordinary.active,true);assert.equal(ordinary.x,x);assert.equal(ordinary.x,LANES[0]);assert.equal(ordinary.magnetic,false);
 tick(g,.3);assert.equal(ahead.active,false,'cleared ground chips finish their visual retirement');
});
test('moped exposes mount, stunt-jump and randomized side-dodge animation state',()=>{
 const g=empty();g.activatePower('moped');assert.ok(g.player.mopedMount>0);
 tick(g,.7);assert.equal(g.player.mopedMount,0);g.input('jump');assert.ok(g.player.y===0&&g.player.vy>0);tick(g,.1);
 assert.equal(g.input('slide'),true);assert.equal(g.player.anim,'roll');assert.ok(Math.abs(g.player.mopedSlideSide)===1);
 tick(g,.8);assert.equal(g.player.mopedSlideSide,0);
});
test('jetpack and moped replace each other while independent powers can stack',()=>{
 const g=empty();g.activatePower('moped');g.activatePower('jetpack');assert.equal(g.powers.has('moped'),false);
 g.activatePower('shield');g.activatePower('doublechips');g.activatePower('moped');assert.equal(g.powers.has('jetpack'),false);assert.equal(g.powers.has('shield'),true);assert.equal(g.powers.has('doublechips'),true);
 const transitioning=empty();transitioning.activatePower('moped');tick(transitioning,.2);
 const scooterSpeed=transitioning.speed;transitioning.activatePower('jetpack');
 assert.ok(scooterSpeed>transitioning._projectSpeed());
 assert.equal(transitioning.entities.filter(e=>e.active&&e.flightTrail).length,0);assert.ok(transitioning._flightTrailPlan.length>=30);tick(transitioning,.1);assert.equal(transitioning.entities.filter(e=>e.active&&e.flightTrail).length,8);
 tick(transitioning,10.5);assert.equal(transitioning.powers.has('jetpack'),false);
});
test('the opening hazards already exist before the exit and keep their world positions at handoff',()=>{
 const g=new RunnerGame();g.start();const item=g.entities.find(e=>e.active&&e.type==='coin'),worldZ=item.z;
 tick(g,INTRO_DURATION-1/120);assert.equal(item.z,worldZ);assert.equal(g.state,'STARTING');
 tick(g,1/120);assert.ok(Math.abs(item.z-g.distance-worldZ)<.001);assert.ok(g.distance>=introPose(INTRO_DURATION).distance-.001);
});

test('Jetpack chip generation stops at descent while flight ends on its own timer',()=>{
 const g=empty();g.debug.speedOverride=14;g.activatePower('jetpack');
 tick(g,POWER_DURATIONS.jetpack-JETPACK_PHASES.descent-.02);
 assert.equal(g.powers.active.get('jetpack').descending,false);
 const survivor=g.spawnEntity('coin',1,-12,{y:8,flightTrail:true,flightTrailId:g._jetpackTrailId,trailIndex:999}),before=[survivor],cursor=g._flightTrailCursor;
 tick(g,.04);
 const flight=g.powers.active.get('jetpack');
 assert.ok(flight);assert.equal(flight.descending,true);assert.ok(g.player.y>0);
 assert.ok(before.some(e=>e.active&&!e.retiring),'already-visible flight chips survive the descent boundary');
 assert.equal(g._flightTrailCursor,cursor);g._spawnFlightTrailWindow();assert.equal(g._flightTrailCursor,cursor,'descent cannot reveal another chip');
 tick(g,JETPACK_PHASES.descent);
 assert.equal(g.powers.has('jetpack'),false);assert.equal(g.player.y,0);assert.equal(g.player.grounded,true);
 assert.ok(g.entities.filter(e=>e.active&&e.flightTrail).every(e=>e.retiring));tick(g,.3);assert.equal(g.entities.some(e=>e.active&&e.flightTrail),false);
});

test('Jetpack reach budget integrates only the remaining Speed Burst time',()=>{
 const g=empty();g.debug.speedOverride=14;g.activatePower('jetpack');const flight=g.powers.active.get('jetpack');flight.remaining=6;
 const normal=g._projectSpeed(1),boosted=g._projectSpeed(1.6),cruise=6-JETPACK_PHASES.descent;
 assert.ok(Math.abs(g._remainingJetpackTravel(flight)-normal*cruise)<1e-9);
 g.activatePower('speedburst');g.powers.active.get('speedburst').remaining=2;
 assert.ok(Math.abs(g._remainingJetpackTravel(flight)-(boosted*2+normal*(cruise-2)))<1e-9);
 g.powers.active.get('speedburst').remaining=20;
 assert.ok(Math.abs(g._remainingJetpackTravel(flight)-boosted*cruise)<1e-9);
});

test('Double Chips changes chip value without changing Jetpack distance or duration',()=>{
 const make=()=>{const g=empty();g.debug.speedOverride=14;return g;},plain=make(),doubled=make();
 doubled.activatePower('doublechips');
 assert.equal(plain._projectSpeed(),doubled._projectSpeed());
 plain.activatePower('jetpack');doubled.activatePower('jetpack');
 assert.equal(plain._flightTrailPlan.length,doubled._flightTrailPlan.length);
 tick(plain,POWER_DURATIONS.jetpack);tick(doubled,POWER_DURATIONS.jetpack);
 assert.ok(Math.abs(plain.distance-doubled.distance)<1e-8);
 assert.equal(plain.powers.has('jetpack'),false);assert.equal(doubled.powers.has('jetpack'),false);
 assert.equal(doubled.powers.has('doublechips'),true);
});
