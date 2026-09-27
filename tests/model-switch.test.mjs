import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/vendor/three.module.js';
import {GameScene} from '../dist/scene.mjs';
import {createCharacterAssetStore} from '../dist/character-assets.mjs';
import {MODEL_MANIFEST} from '../dist/model-manifest.mjs';

function sceneHarness(){
 globalThis.self??=globalThis;
 const scene=Object.create(GameScene.prototype),material=new THREE.MeshBasicMaterial();
 scene.m=new Proxy({}, {get:(_,key)=>['shirt','pants','complexions','wall'].includes(key)?Array(6).fill(material):material});
 scene.box=new THREE.BoxGeometry(1,1,1);scene.sphere=new THREE.SphereGeometry(.5,20,14);
 scene.plane=new THREE.PlaneGeometry(1,1);scene.cylinder=new THREE.CylinderGeometry(.5,.5,1,16);
 scene.scene=new THREE.Scene();scene.cat=scene.makeCat('18bro',{fur:'black',hat:'cap'});scene.cat.root.scale.setScalar(.776);scene.scene.add(scene.cat.root);
 scene.modelSetPreference='original';scene.effectiveModelSet='original';scene.modelSetStatus='original';scene.modelSetReason='';scene._modelGeneration=0;
 const embeddedModels=Object.fromEntries(MODEL_MANIFEST.map(entry=>[entry.output.split('/').at(-1),fs.readFileSync(new URL(`../${entry.output}`,import.meta.url))]));
 scene.characterAssets=createCharacterAssetStore({manifest:MODEL_MANIFEST,embeddedModels});
 return scene;
}

test('Refreshed hero stays active through every pose and cosmetic',async()=>{
 const scene=sceneHarness();
 assert.equal(await scene.setModelSetPreference('refreshed'),'refreshed',scene.modelSetError);
 assert.equal(scene.modelSetStatus,'ready');assert.ok(scene.authoredHero.root.parent===scene.scene);
 const game={state:'MAIN_MENU',player:{anim:'idle',y:0,slide:0,hit:0},powers:new Map()};
 scene.cat.root.position.set(1,2,3);scene.updateAuthoredHero(game,1/60,{skin:'18bro',fur:'black',hat:'cap',menu:true});
 assert.equal(scene.effectiveModelSet,'refreshed');assert.equal(scene.authoredHero.root.visible,true);
 assert.deepEqual(scene.authoredHero.root.position.toArray(),[1,2,3]);
 assert.equal(scene.authoredHero.packet.parent,scene.authoredHero.hand);
 assert.equal(scene.authoredHero.magnet.parent,scene.authoredHero.leftHand);
 assert.equal(scene.authoredHero.root.getObjectByName('18bro_magnet_raised_arm'),undefined,'authored hero must not gain a duplicate display arm');
 assert.equal(scene.authoredHero.magnet.userData.gripAtBottom,true);assert.equal(scene.authoredHero.magnet.userData.raisedToPlayerRight,true);
 assert.equal(scene.authoredHero.magnet.getObjectByName('magnet_wave_arcs').children.length,3);
 for(const [name,held] of Object.entries(scene.authoredHero.magnetClips)){const base=scene.authoredHero.actions[name].getClip();assert.equal(held.tracks.length,base.tracks.length);for(let i=0;i<base.tracks.length;i++)if(!['arm_L.quaternion','forearm_L.quaternion'].includes(base.tracks[i].name))assert.deepEqual([...held.tracks[i].values],[...base.tracks[i].values],`${name} must preserve ${base.tracks[i].name}`);}
 scene.authoredHero.magnet.geometry.computeBoundingBox();
 assert.ok(scene.authoredHero.magnet.geometry.boundingBox.min.y<=0&&scene.authoredHero.magnet.geometry.boundingBox.min.y>-.06,'magnet origin stays in its lower bridge');
 assert.ok(scene.authoredHero.magnet.geometry.boundingBox.max.y>.45,'the U rises above the paw grip');
 assert.equal(scene.authoredHero.moonBoots[0].parent,scene.authoredHero.leftFoot);
 assert.equal(scene.authoredHero.moonBoots[1].parent,scene.authoredHero.rightFoot);
 assert.equal(scene.authoredHero.jetFlames?.name,'jet_flames');
 assert.ok([scene.authoredHero.magnet,...scene.authoredHero.moonBoots].every(item=>item.quaternion.toArray().every(Number.isFinite)));
 assert.ok(scene._hiddenHeroMeshes.some(([mesh])=>mesh.visible===false));

 game.state='RUNNING';game.player.y=1;
 scene.updateAuthoredHero(game,1/60,{skin:'18bro',fur:'black',hat:'cap'});
 assert.equal(scene.effectiveModelSet,'refreshed');
 scene.cat.magnet.visible=true;scene.cat.moonBoots.forEach(boot=>boot.visible=true);
 scene.updateAuthoredHero(game,1/60,{skin:'18bro',fur:'black',hat:'cap'});
 assert.equal(scene.authoredHero.magnet.visible,true);assert.ok(scene.authoredHero.moonBoots.every(boot=>boot.visible));assert.equal(scene.authoredHero.action,scene.authoredHero.magnetActions[scene.authoredHero.clip]);
 scene.authoredHero.asset.scene.updateMatrixWorld(true);const shoulder=scene.authoredHero.asset.scene.getObjectByName('arm_L').getWorldPosition(new THREE.Vector3()),elbow=scene.authoredHero.asset.scene.getObjectByName('forearm_L').getWorldPosition(new THREE.Vector3()),grip=scene.authoredHero.leftHand.getWorldPosition(new THREE.Vector3()),armDirection=grip.clone().sub(shoulder),raiseAngle=Math.atan2(armDirection.y,Math.abs(armDirection.x));
 assert.ok(raiseAngle>35*Math.PI/180&&raiseAngle<50*Math.PI/180,`magnet arm raises ${raiseAngle*180/Math.PI} degrees`);assert.ok(elbow.clone().sub(shoulder).angleTo(grip.clone().sub(elbow))<.02,'magnet arm stays straight');
 const bones=[];scene.authoredHero.asset.scene.traverse(object=>{if(object.isBone)bones.push(object);});const heldBones=bones.flatMap(bone=>bone.quaternion.toArray());scene.animateMagnet(scene.authoredHero.magnet,1,false);assert.deepEqual(bones.flatMap(bone=>bone.quaternion.toArray()),heldBones,'magnet effects must not write imported bones');
 scene.cat.magnet.visible=false;scene.updateAuthoredHero(game,1/60,{skin:'18bro',fur:'black',hat:'cap'});assert.equal(scene.authoredHero.action,scene.authoredHero.actions[scene.authoredHero.clip],'base mixer action restores immediately when Magnet ends');assert.equal(scene.authoredHero.magnetHeld,false);
 game.player.y=0;game.player.slide=.4;
 scene.updateAuthoredHero(game,1/60,{skin:'18bro',fur:'black',hat:'cap'});
 assert.equal(scene.effectiveModelSet,'refreshed');assert.equal(scene.modelSetReason,'');
 assert.equal(scene.authoredHero.root.visible,true);assert.ok(scene._hiddenHeroMeshes.length>0);
 for(const fur of ['black','cream','ginger','silver','pink','gold'])for(const hat of ['cap','none','beanie','sombrero','bucket','crown']){
  scene.updateAuthoredHero(game,1/60,{skin:'18bro',fur,hat});
  assert.equal(scene.effectiveModelSet,'refreshed');assert.equal(scene.authoredHero.root.visible,true);
  assert.equal(scene.authoredHero.hat.visible,hat==='cap');
  for(const [kind,accessory] of scene.authoredHero.hats)assert.equal(accessory.visible,kind===hat);
 }
 game.state='CAUGHT';scene.updateAuthoredHero(game,1/60,{skin:'18bro',fur:'gold',hat:'crown'});
 assert.equal(scene.effectiveModelSet,'refreshed');assert.equal(scene.authoredHero.root.visible,true);

 assert.equal(await scene.setModelSetPreference('original'),'original');
 assert.equal(scene.modelSetStatus,'original');scene.disposeCharacterModels();
});

test('sampled authored poses never accumulate quaternion drift and reset cleanly',async()=>{
 const scene=sceneHarness();await scene.setModelSetPreference('refreshed');
 const game={state:'RUNNING',player:{anim:'slide',y:0,vy:0,slide:.36,hit:0},powers:new Set(),speed:10.4};
 for(let i=0;i<30;i++)scene.updateAuthoredHero(game,1/60,{fur:'black',hat:'cap'});
 const bones=[];scene.authoredHero.asset.scene.traverse(object=>{if(object.isBone)bones.push(object);});
 const snapshot=()=>bones.flatMap(bone=>bone.quaternion.toArray());
 const fixed=snapshot();for(let i=0;i<240;i++)scene.updateAuthoredHero(game,1/120,{fur:'black',hat:'cap'});
 assert.deepEqual(snapshot(),fixed,'a fixed slide sample must remain bit-for-bit stable');
 for(const clip of scene.authoredHero.asset.animations)assert.equal(clip.tracks.length,60,`${clip.name} must own all 20 bone transforms`);
 for(const state of [
  {state:'RUNNING',player:{anim:'run',y:0,vy:0,slide:0,hit:0}},
  {state:'RUNNING',player:{anim:'jump',y:1.2,vy:2,slide:0,hit:0}},
  {state:'RUNNING',player:{anim:'fall',y:1.2,vy:-2,slide:0,hit:0}},
  {state:'CAUGHT',captureProgress:.4,player:{anim:'caught',y:0,vy:0,slide:0,hit:0}},
  {state:'GAME_OVER',captureProgress:1,player:{anim:'caught',y:0,vy:0,slide:0,hit:0}},
  {state:'MAIN_MENU',player:{anim:'idle',y:0,vy:0,slide:0,hit:0}}
 ]){
  Object.assign(game,state);scene.updateAuthoredHero(game,1/60,{fur:'pink',hat:'crown'});
  assert.ok(snapshot().every(Number.isFinite),`${state.state} contains only finite bone rotations`);
 }
 scene.disposeCharacterModels();
});

test('cosmetic cat replacement preserves active Refreshed shield and jetpack geometry',async()=>{
 const scene=sceneHarness();await scene.setModelSetPreference('refreshed');
 const persistent=new Set();for(const attachment of [scene.authoredHero.shield,scene.authoredHero.jetpack])attachment.traverse(object=>{if(object.geometry)persistent.add(object.geometry);});
 const shared=new Set([scene.box,scene.sphere,scene.cylinder,scene.plane]),disposableProcedural=new Set();
 scene.cat.root.traverse(object=>{if(object.geometry&&!shared.has(object.geometry))disposableProcedural.add(object.geometry);});
 assert.ok(persistent.size>0);assert.ok([...persistent].every(geometry=>!disposableProcedural.has(geometry)),'persistent authored attachments must not share disposable cosmetic geometry');
 let disposed=0;for(const geometry of persistent)geometry.addEventListener('dispose',()=>disposed++);
 const materialCount=scene.materials.length,retiredMaterials=scene.cat.shield.userData.ownedMaterials;let retired=0;for(const material of retiredMaterials)material.addEventListener('dispose',()=>retired++);
 scene.replaceCat('18bro',{fur:'pink',hat:'crown'});
 assert.equal(retired,retiredMaterials.length);assert.equal(scene.materials.length,materialCount,'cosmetic replacement must not retain discarded shield materials');
 scene.cat.jetpack.visible=true;scene.cat.shield.visible=true;
 const game={state:'RUNNING',player:{anim:'run',y:0,slide:0,hit:0},powers:new Set(['jetpack','shield'])};
 scene.updateAuthoredHero(game,1/60,{skin:'18bro',fur:'pink',hat:'crown'});
 assert.equal(disposed,0);assert.equal(scene.authoredHero.jetpack.visible,true);assert.equal(scene.authoredHero.shield.visible,true);
  scene.replaceCat('18bro',{fur:'gold',hat:'bucket'});assert.equal(scene.materials.length,materialCount);
 scene.disposeCharacterModels();
});

test('Refreshed model selection applies to guards and the reusable crowd family',async()=>{
 const scene=sceneHarness(),guard=scene.makePerson(1,true),pedestrian=scene.makePerson(2,false),cashier=scene.makePerson(9,false,'cashier'),rider=scene.makePerson(3,false,'rider');guard.catchNet=scene.makeCatchNet(0);scene.attachCatchNet(guard,guard.catchNet);
 assert.equal(guard.root.userData.modelSet,'original');assert.equal(pedestrian.root.userData.modelSet,'original');
 assert.equal(await scene.setModelSetPreference('refreshed'),'refreshed');
 assert.equal(guard.root.userData.modelSet,'refreshed');assert.equal(pedestrian.root.userData.modelSet,'refreshed');
 assert.ok(guard.authored&&pedestrian.authored);assert.equal(guard.body.visible,false);assert.equal(pedestrian.body.visible,false);assert.equal(guard.catchNet.userData.attachedTo,'socket_carry_R');assert.equal(guard.catchNet.parent.name,'socket_carry_R');
 const chase=guard.authored.actions.chase.getClip(),ready=guard.authored.actions.net_ready_R.getClip(),aim=guard.authored.actions.net_aim_R.getClip();
 for(let i=0;i<chase.tracks.length;i++)if(!/^(arm|forearm|hand|socket_carry)_R[.]/.test(chase.tracks[i].name)){
  assert.deepEqual([...ready.tracks[i].values],[...chase.tracks[i].values],`ready pose preserves ${chase.tracks[i].name}`);
  assert.deepEqual([...aim.tracks[i].values],[...chase.tracks[i].values],`aim pose preserves ${chase.tracks[i].name}`);
 }
 scene.updateAuthoredNetArm(guard,1,0,0);guard.root.updateMatrixWorld(true);
 const socket=guard.authored.scene.getObjectByName('socket_carry_R'),low=socket.getWorldPosition(new THREE.Vector3()).y;
 const legBones=['leg_L','shin_L','foot_L','leg_R','shin_R','foot_R'].map(name=>guard.authored.scene.getObjectByName(name)),legs=legBones.flatMap(bone=>bone.quaternion.toArray());
 scene.updateAuthoredNetArm(guard,1,0,1);guard.root.updateMatrixWorld(true);const high=socket.getWorldPosition(new THREE.Vector3()).y;
 assert.ok(high>low+.35,`Refreshed net hand rises from ${low} to ${high}`);assert.deepEqual(legBones.flatMap(bone=>bone.quaternion.toArray()),legs,'Refreshed net-arm blend preserves locomotion bones');
 assert.equal(guard.authored.scene.getObjectByName('role_police').visible,true);
 assert.equal(pedestrian.authored.scene.getObjectByName('role_police').visible,false);
 assert.equal(cashier.authored.scene.getObjectByName('role_cashier').visible,true);assert.equal(rider.authored.scene.getObjectByName('role_rider').visible,true);
 assert.equal(guard.authored.scene.getObjectByName('hair_short').visible,false);assert.equal(guard.authored.scene.getObjectByName('hair_bob').visible,false);
 assert.equal(rider.authored.scene.getObjectByName('hair_short').visible,false);assert.equal(rider.authored.scene.getObjectByName('hair_bob').visible,false);
 assert.equal(cashier.authored.scene.getObjectByName('hair_short').visible,true);
 assert.notEqual(pedestrian.authored.scene.getObjectByName('human_clothes').material.color.getHex(),0xffffff);
 await scene.setModelSetPreference('original');assert.equal(pedestrian.body.visible,true);assert.equal(pedestrian.authored.scene.visible,false);
 scene.disposeCharacterModels();
});

test('missing refreshed assets keep Original playable without changing the preference',async()=>{
 const scene=sceneHarness();scene.characterAssets.dispose();
 assert.equal(await scene.setModelSetPreference('refreshed'),'original');
 assert.equal(scene.modelSetPreference,'refreshed');assert.equal(scene.effectiveModelSet,'original');
 assert.equal(scene.modelSetStatus,'fallback');assert.equal(scene.modelSetReason,'load-failed');
 assert.equal(scene.cat.root.visible,true);
});

test('Clear Retro renders at viewport resolution without pixel snapping',()=>{
 const scene=Object.create(GameScene.prototype),calls=[];
 scene.renderer={setPixelRatio:value=>calls.push(['ratio',value]),setSize:(w,h)=>calls.push(['size',w,h])};
 scene.camera={aspect:0,updateProjectionMatrix(){}};scene.snapUniform={value:new THREE.Vector2()};scene.wobbleUniform={value:1};scene.canvas={style:{},dataset:{}};
 scene.resize(1280,720,{quality:'clear'});
 assert.deepEqual(calls.at(-1),['size',1280,720]);assert.equal(scene.wobbleUniform.value,0);assert.equal(scene.canvas.style.imageRendering,'auto');
 assert.equal(scene.canvas.dataset.renderResolution,'clear:1280x720');
 calls.length=0;scene.resize(1280,720,{quality:'retro'});
 assert.notDeepEqual(calls.at(-1),['size',1280,720]);assert.equal(scene.wobbleUniform.value,1);assert.equal(scene.canvas.style.imageRendering,'pixelated');
});
