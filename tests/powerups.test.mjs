import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerGame,INTRO_DURATION,MOTION,BARRIERS,POWER_DURATIONS} from '../dist/core.mjs';
import {introPose} from '../dist/choreography.mjs';
const tick=(g,t)=>{for(let s=0;s<t;s+=1/120)g.update(Math.min(1/120,t-s));};
function empty(){const g=new RunnerGame();g.start({skipIntro:true});g.entities.forEach(e=>e.active=false);g._spawnCursor=1e9;return g;}
test('double chips doubles pickups and pauses its timer without changing earlier chips',()=>{
 const g=empty();g._pickup(g.spawnEntity('coin',1,0));g.activatePower('doublechips');g._pickup(g.spawnEntity('coin',1,0));assert.equal(g.coins,3);
 g.pause();tick(g,20);assert.equal(g.powers.active.get('doublechips').remaining,12);
 g.resume();tick(g,12.1);g._pickup(g.spawnEntity('coin',1,0));assert.equal(g.coins,4);
});
test('shield protects one direct hit and the next unprotected hit captures',()=>{
 const g=empty();g.activatePower('shield');g._hit(g.spawnEntity('blocker',1,0));assert.equal(g.state,'RUNNING');assert.equal(g.powers.has('shield'),false);
 tick(g,1.2);g._hit(g.spawnEntity('traffic',1,0));assert.equal(g.state,'CAUGHT');
});
test('Moon Boots raise the jump above two-storey blockers without changing speed, score or protection',()=>{
 const ordinary=empty();ordinary.input('jump');let ordinaryApex=0;
 for(let t=0;t<.9;t+=1/120){ordinary.update(1/120);ordinaryApex=Math.max(ordinaryApex,ordinary.player.y);}
 assert.ok(Math.abs(ordinaryApex-MOTION.jumpHeight)<.04);
 const moon=empty();moon.activatePower('moon');assert.equal(moon.powers.speedMultiplier,1);assert.equal(moon.powers.scoreMultiplier,1);assert.equal(moon.powers.invulnerable,false);
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
test('jetpack lifts smoothly, pulls chips, clears hazards and lands when the last chip arrives',()=>{
 const g=empty();g.activatePower('jetpack');let last=0;
 for(let t=0;t<1;t+=1/120){g.update(1/120);assert.ok(Math.abs(g.player.y-last)<.12);last=g.player.y;}
 assert.ok(g.player.y>5);g.spawnEntity('coin',0,-3);g.spawnEntity('blocker',1,-2);tick(g,.5);
 assert.equal(g.state,'RUNNING');assert.ok(g.coins>=1);assert.equal(g.input('slide'),false);
 tick(g,8.8);assert.equal(g.powers.has('jetpack'),false);assert.ok(g.shieldGrace>0);tick(g,1.3);assert.equal(g.player.y,0);assert.equal(g.player.grounded,true);
 g.start({skipIntro:true});assert.equal(g.powers.active.size,0);
});
test('jetpack creates a connected, ten-second airborne chip route immediately at pickup',()=>{
 const g=empty();g.activatePower('jetpack');const route=g.entities.filter(e=>e.active&&e.flightTrail).sort((a,b)=>a.trailIndex-b.trailIndex);
 assert.ok(route.length>=30);assert.equal(route[0].trailIndex,0);assert.equal(route.at(-1).trailFinal,true);
 assert.equal(new Set(route.map(e=>e.flightTrailId)).size,1);
 const gaps=route.slice(1).map((e,i)=>Math.abs(e.z-route[i].z));
 assert.ok(Math.max(...gaps)-Math.min(...gaps)<1e-6);assert.ok(gaps[0]>=2.5&&gaps[0]<=4.5);
 assert.ok(route[0].y<route[Math.floor(route.length/2)].y);
 assert.ok(route.at(-1).y<route[Math.floor(route.length/2)].y);
 assert.ok(Math.abs(-route.at(-1).z/g.speed-POWER_DURATIONS.jetpack)<1);
 tick(g,2);assert.ok(g.coins>0,'the pre-existing line is pulled into the cat while airborne');
});
test('the final route chip ends Jetpack, with a bounded escape for an unreachable chip',()=>{
 const events=[];const g=new RunnerGame({onEvent:e=>events.push(e)});g.start({skipIntro:true});g.entities.forEach(e=>e.active=false);g._spawnCursor=1e9;
 g.activatePower('jetpack');const last=g._jetpackFinalChip;tick(g,9.5);assert.equal(g.powers.has('jetpack'),true);
 tick(g,.7);assert.equal(last.active,false);assert.equal(g.powers.has('jetpack'),false);
 assert.equal(events.findLast(e=>e.type==='powerend'&&e.kind==='jetpack')?.reason,'trail-complete');
 const stalled=empty();stalled.activatePower('jetpack');stalled._jetpackFinalChip.z=-1000;stalled._jetpackFinalChip.y=100;
 tick(stalled,10.5);assert.equal(stalled.powers.has('jetpack'),true);
 tick(stalled,1.6);assert.equal(stalled.powers.has('jetpack'),false);
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
 assert.ok(-transitioning._jetpackFinalChip.z<transitioning._projectSpeed()*POWER_DURATIONS.jetpack*1.1);
 tick(transitioning,10.5);assert.equal(transitioning.powers.has('jetpack'),false);
});
test('the opening hazards already exist before the exit and keep their world positions at handoff',()=>{
 const g=new RunnerGame();g.start();const item=g.entities.find(e=>e.active&&e.type==='coin'),worldZ=item.z;
 tick(g,INTRO_DURATION-1/120);assert.equal(item.z,worldZ);assert.equal(g.state,'STARTING');
 tick(g,1/120);assert.ok(Math.abs(item.z-g.distance-worldZ)<.001);assert.ok(g.distance>=introPose(INTRO_DURATION).distance-.001);
});
