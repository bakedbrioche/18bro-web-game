import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerGame,INTRO_DURATION} from '../dist/core.mjs';
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
test('jetpack lifts smoothly, pulls chips, clears hazards and lands with a short grace period',()=>{
 const g=empty();g.activatePower('jetpack');let last=0;
 for(let t=0;t<1;t+=1/120){g.update(1/120);assert.ok(Math.abs(g.player.y-last)<.12);last=g.player.y;}
 assert.ok(g.player.y>5);g.spawnEntity('coin',0,-3);g.spawnEntity('blocker',1,-2);tick(g,.5);
 assert.equal(g.state,'RUNNING');assert.equal(g.coins,1);assert.equal(g.input('slide'),false);
 tick(g,5.6);assert.equal(g.powers.has('jetpack'),false);assert.ok(g.shieldGrace>0);tick(g,1.3);assert.equal(g.player.y,0);assert.equal(g.player.grounded,true);
 g.start({skipIntro:true});assert.equal(g.powers.active.size,0);
});
test('jetpack and moped replace each other while independent powers can stack',()=>{
 const g=empty();g.activatePower('moped');g.activatePower('jetpack');assert.equal(g.powers.has('moped'),false);
 g.activatePower('shield');g.activatePower('doublechips');g.activatePower('moped');assert.equal(g.powers.has('jetpack'),false);assert.equal(g.powers.has('shield'),true);assert.equal(g.powers.has('doublechips'),true);
});
test('the opening hazards already exist before the exit and keep their world positions at handoff',()=>{
 const g=new RunnerGame();g.start();const item=g.entities.find(e=>e.active&&e.type==='coin'),worldZ=item.z;
 tick(g,INTRO_DURATION-1/120);assert.equal(item.z,worldZ);assert.equal(g.state,'STARTING');
 tick(g,1/120);assert.ok(Math.abs(item.z-g.distance-worldZ)<.001);assert.ok(g.distance>=introPose(INTRO_DURATION).distance-.001);
});
