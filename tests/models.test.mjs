import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { GameScene } from '../dist/scene.mjs';
import { DistrictScene } from '../dist/district-scene.mjs';
import { VEHICLES, MOTION, BARRIERS } from '../dist/core.mjs';

function modelFactory(){
  const s=Object.create(GameScene.prototype), material=new THREE.MeshBasicMaterial();
  s.m=new Proxy({}, {get:(_,key)=>['shirt','pants','complexions','wall'].includes(key)?Array(6).fill(material):material});
  s.box=new THREE.BoxGeometry(1,1,1);s.sphere=new THREE.SphereGeometry(.5,20,14);s.plane=new THREE.PlaneGeometry(1,1);
  s.cylinder=new THREE.CylinderGeometry(.5,.5,1,16);return s;
}
test('district crowds reuse the articulated police build without retaining offscreen models',()=>{
  const owner=modelFactory(),d=Object.create(DistrictScene.prototype),chunk=new THREE.Group();
  d.owner=owner;d.humanPool=new Map();d.time=0;d.seed=18;
  chunk.userData={s:450};chunk.position.z=0;
  const p=new THREE.Group(),sprite=new THREE.Group();p.add(sprite);
  p.userData={sprite,rig:null,index:2,walking:true,at:455,side:1};chunk.add(p);
  d.updatePerson(p,chunk,450);const rig=p.userData.rig,cop=owner.makeCop();
  assert.equal(rig.root.userData.humanRig,cop.root.userData.humanRig);
  assert.equal(rig.root.scale.x,cop.root.scale.x);
  for(const key of ['legs','arms','knees','elbows','feet']){
    assert.equal(rig[key].length,2);
    rig[key].forEach((joint,i)=>assert.ok(joint.position.distanceTo(cop[key][i].position)<1e-9));
  }
  for(let n=0;n<30;n++){
    chunk.position.z=-100;d.updatePerson(p,chunk,350);
    assert.equal(p.userData.rig,null);assert.equal(d.humanPool.get(2).length,1);
    chunk.position.z=0;d.time=n*.3;d.updatePerson(p,chunk,450);
    assert.equal(p.userData.rig,rig);assert.equal(d.humanPool.get(2).length,0);
    assert.equal(sprite.visible,false);
  }
});
test('district pedestrians travel along the sidewalk and across both crossing directions',()=>{
 const owner=modelFactory(),d=Object.create(DistrictScene.prototype),chunk=new THREE.Group();
 d.owner=owner;d.humanPool=new Map();d.seed=18;chunk.userData={s:750};
 for(const side of [-1,1]){
  const p=new THREE.Group(),sprite=new THREE.Group();p.add(sprite);p.userData={sprite,rig:null,index:2,walking:true,at:755,side};chunk.add(p);
  d.time=0;d.updatePerson(p,chunk,750);const a=p.position.clone();d.time=3;d.updatePerson(p,chunk,750);assert.ok(a.distanceTo(p.position)>1);
  Object.assign(p.userData,{walking:false,crossing:true,cx:0,span:18,at:756});
  const xs=[];for(const t of [22,29.5,37,44.5,52]){d.trafficTime=t;d.updatePerson(p,chunk,750);assert.ok(Number.isFinite(p.position.x));xs.push(p.position.x);}
  assert.equal(xs[0],-18*side);assert.equal(xs[2],0);assert.equal(xs[4],18*side);
 }
});
test('officers keep their walking carry beyond the camera after the result is available',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),cops=[s.makeCop(),s.makeCop()];cat.root.scale.setScalar(.776);
 s.animateCapture(cat,cops,1);const before=cat.root.position.z;
 s.animateCapture(cat,cops,3);assert.ok(cat.root.position.z>8.8);assert.ok(cat.root.position.z>before+10);
 for(const cop of cops)assert.ok(cop.root.position.z>8.8);
});
test('every purchasable fur and hat creates a finite model with its packet attached',()=>{
 const s=modelFactory();for(const fur of ['black','cream','ginger','silver','pink','gold'])for(const hat of ['cap','none','beanie','sombrero','bucket','crown']){
  const cat=s.makeCat('18bro',{fur,hat}),bounds=new THREE.Box3().setFromObject(cat.root);
  assert.ok(Number.isFinite(bounds.max.y));assert.ok(bounds.max.y<3.6);assert.equal(cat.bag.parent,cat.arms[1]);
  assert.equal(s.furMaterials.size<=6,true);
 }
});
test('store fixtures, product stock, signs and refrigerator doors use only modeled surfaces',()=>{
  const s=modelFactory();s.scene=new THREE.Scene();s.mat=()=>new THREE.MeshBasicMaterial();
  s.makeMenuProps();let surfaces=0,triangles=0;
  s.store.traverse(o=>{if(o.isMesh){surfaces++;assert.equal(o.material.map,null);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  assert.ok(surfaces>20);assert.ok(triangles>20000);
  assert.equal(s.clerk.root.parent,s.store);assert.equal(s.doors.length,2);
});
test('collectible potato chips are thin curved geometry without a coin face image',()=>{
  const s=modelFactory(),chip=s.makeCrisp(),size=new THREE.Box3().setFromObject(chip).getSize(new THREE.Vector3());
  assert.ok(size.y>size.x);assert.ok(size.z<size.x*.6);
  chip.traverse(o=>{if(o.isMesh)assert.equal(o.material.map,null);});
});
test('chip packet stays attached to the wrist throughout run, jump, ride and capture poses',()=>{
  const s=modelFactory(),cat=s.makeCat('18bro');
  const grip=cat.bag.position.clone();assert.equal(cat.bag.parent,cat.arms[1]);
  for(const pose of ['menu','run','ride','caught'])for(let t=0;t<3;t+=.07){
    s.animateCat(cat,t,pose,{slide:pose==='run'?.4:0});cat.root.updateMatrixWorld(true);
    const wristLocal=cat.arms[1].worldToLocal(cat.bag.getWorldPosition(new THREE.Vector3()));
    assert.ok(wristLocal.distanceTo(grip)<1e-6);
  }
});
test('visible vehicle bodies and rider heights fit their collision limits and stay below jump apex',()=>{
  const s=modelFactory();for(const type of Object.keys(VEHICLES))for(let i=0;i<4;i++){
    const model=s.makeEntity(type,i),bounds=new THREE.Box3().setFromObject(model);
    assert.ok(bounds.max.y<=VEHICLES[type].height+.025,`${type} visual top ${bounds.max.y}`);
    assert.ok(bounds.max.y<MOTION.jumpHeight);
    assert.ok(bounds.getSize(new THREE.Vector3()).z<=VEHICLES[type].depth+.15);
  }
});
test('the large barrier visibly exceeds the highest jump',()=>{
  const s=modelFactory(),bounds=new THREE.Box3().setFromObject(s.makeEntity('blocker'));
  assert.ok(bounds.max.y>MOTION.jumpHeight+.7);assert.ok(Math.abs(bounds.max.y-BARRIERS.blocker.height)<.01);
});


test('slide eases in and out without snapping the body or limbs',async()=>{
  const {slidePose}=await import('../dist/choreography.mjs');
  assert.equal(slidePose(.72),0);assert.equal(slidePose(0),0);assert.equal(slidePose(.4),1);
  const s=modelFactory(),cat=s.makeCat('18bro');let last=null;
  for(let t=0;t<=.72;t+=.001){s.animateCat(cat,0,'run',{slide:Math.max(0,.72-t)});
    if(last!==null)assert.ok(Math.abs(cat.body.position.y-last)<.007);
    last=cat.body.position.y;
  }
});


test('front car windscreen is black and visible in front of the cabin body',()=>{
 const s=modelFactory(),base=s.m,black=new THREE.MeshBasicMaterial({color:0x040609});
 s.m=new Proxy({}, {get:(_,key)=>key==='carGlass'?black:base[key]});
 for(let id=0;id<3;id++){
   const car=s.makeCar(id);car.updateMatrixWorld(true);
   const ray=new THREE.Raycaster(new THREE.Vector3(0,1.2,4),new THREE.Vector3(0,0,-1));
   const hit=ray.intersectObject(car,true)[0];assert.ok(hit);assert.equal(hit.object.material,black);
 }
});
test('tall rail barriers have a real opening; low barriers retain their cream panels',()=>{
 const s=modelFactory();
 for(const type of ['blocker','slide']){
  const model=s.makeBarrier(type);model.updateMatrixWorld(true);
  const low=new THREE.Raycaster(new THREE.Vector3(0,.8,4),new THREE.Vector3(0,0,-1));
  const high=new THREE.Raycaster(new THREE.Vector3(.15,2.2,4),new THREE.Vector3(0,0,-1));
  assert.equal(low.intersectObject(model,true).length,0);assert.ok(high.intersectObject(model,true).length>0);
 }
 const low=s.makeBarrier('jump');low.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(.15,.8,4),new THREE.Vector3(0,0,-1));assert.ok(ray.intersectObject(low,true).length>0);
});

test('all six sidewalk texture cells map to equal square tiles with shared grout edges',()=>{
 const s=modelFactory(),tiles=[];
 for(let row=0;row<3;row++)for(let col=0;col<2;col++){
  const g=s.sidewalkTileGeometry(col,row);g.computeBoundingBox();
  const size=g.boundingBox.getSize(new THREE.Vector3());assert.equal(size.x,1);assert.equal(size.y,1);
  const uv=g.attributes.uv,us=[],vs=[];
  for(let i=0;i<uv.count;i++){us.push(uv.getX(i));vs.push(uv.getY(i));}
  assert.ok(Math.min(...us)>0&&Math.max(...us)<1);assert.ok(Math.min(...vs)>0&&Math.max(...vs)<1);
  tiles.push({left:Math.min(...us),right:Math.max(...us),top:Math.max(...vs),bottom:Math.min(...vs)});
 }
 for(let row=0;row<3;row++)assert.equal(tiles[row*2].right,tiles[row*2+1].left);
 for(let col=0;col<2;col++)for(let row=0;row<2;row++)assert.equal(tiles[row*2+col].bottom,tiles[(row+1)*2+col].top);
});

test('police grips remain attached and clear of the cat arms through lift, pivot and carry',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),cops=[s.makeCop(),s.makeCop()];cat.root.scale.setScalar(.776);
 for(let p=.36;p<1;p+=.008){
  s.animateCapture(cat,cops,p);cat.root.updateMatrixWorld(true);
  cops.forEach((c,i)=>{
   c.root.updateMatrixWorld(true);const inner=i?1:0;
   const hand=c.elbows[inner].localToWorld(new THREE.Vector3(0,-.34,.04));
   const target=cat.body.localToWorld(new THREE.Vector3((i?-1:1)*.39,.60,-.28));
   assert.ok(hand.distanceTo(target)<1e-6,`grip slips at ${p}`);
   assert.equal(c.baton.parent,c.body);
   const elbow=c.elbows[inner].getWorldPosition(new THREE.Vector3());
   const bones=[[c.arms[inner].getWorldPosition(new THREE.Vector3()),elbow],[elbow,hand]];
   for(const arm of cat.arms){
    const shoulder=arm.getWorldPosition(new THREE.Vector3()),paw=arm.localToWorld(new THREE.Vector3(0,-.43,.035));
    for(const [a,b] of bones)for(let step=0;step<=20;step++){
     const point=shoulder.clone().lerp(paw,step/20),nearest=new THREE.Line3(a,b).closestPointToPoint(point,true,new THREE.Vector3());
     assert.ok(point.distanceTo(nearest)>.22,`arm clearance lost at ${p}`);
    }
   }
  });
 }
});
test('officers bend through the planted lift and step through pivot and carry with level soles',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),cops=[s.makeCop(),s.makeCop()];cat.root.scale.setScalar(.776);
 for(const [a,b] of [[.53,.65],[.71,.9]]){
  s.animateCapture(cat,cops,a);const before=cops.map(c=>c.legs.map(l=>l.quaternion.clone()));
  const movement=cops.map(c=>c.legs.map(()=>0));
  for(let p=a;p<=b;p+=.01){s.animateCapture(cat,cops,p);
   cops.forEach((c,i)=>{c.root.updateMatrixWorld(true);c.legs.forEach((leg,j)=>{
    movement[i][j]=Math.max(movement[i][j],leg.quaternion.angleTo(before[i][j]));
    const up=new THREE.Vector3(0,1,0).applyQuaternion(c.feet[j].getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(up.distanceTo(new THREE.Vector3(0,1,0))<1e-6);
   });});
  }
  assert.ok(movement.flat().every(angle=>angle>.05),'every leg steps during pivot and carry');
 }
 // Resetting for a retry restores the baton to the officer's hand.
 s.animateCop(cops[0],0);assert.equal(cops[0].baton.parent,cops[0].elbows[1]);
});

test('officers plant both feet during pickup instead of cycling their stride',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),cops=[s.makeCop(),s.makeCop()];cat.root.scale.setScalar(.776);
 const poses=[];
 for(const p of [.36,.40,.45,.50]){s.animateCapture(cat,cops,p);poses.push(cops.flatMap(c=>{c.root.updateMatrixWorld(true);return c.feet.map(f=>f.getWorldPosition(new THREE.Vector3()));}));}
 for(const pose of poses)pose.forEach((foot,i)=>{assert.ok(Math.abs(foot.z-poses[0][i].z)<.002);assert.ok(Math.abs(foot.y-poses[0][i].y)<.002);});
});
test('moped duck lowers the head smoothly and returns to the upright riding pose',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro');
 s.animateCat(cat,0,'ride',{slide:0});cat.root.updateMatrixWorld(true);const upright=cat.head.getWorldPosition(new THREE.Vector3()).y;
 s.animateCat(cat,0,'ride',{slide:.4});cat.root.updateMatrixWorld(true);
 assert.ok(cat.head.rotation.x>.4);assert.ok(cat.head.getWorldPosition(new THREE.Vector3()).y<upright-.1);
 s.animateCat(cat,0,'ride',{slide:0});assert.equal(cat.head.rotation.x,0);
});
test('officers follow their lane directly instead of detouring around obstacles',()=>{
 const s=modelFactory();s.cops=[s.makeCop(),s.makeCop()];s.chaseZ=2.8;s.cops.forEach((c,i)=>c.root.position.set(i?.96:-.96,0,2.8));
 s.updateChasingCops({player:{x:0},speed:18,entities:[]},1/60,0);
 assert.ok(s.cops[0].root.position.x<0);assert.ok(s.cops[1].root.position.x>0);
});
test('fatal impact begins at the collision position then rebounds into a seated pose',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),cops=[s.makeCop(),s.makeCop()];cat.root.scale.setScalar(.776);
 s.animateCapture(cat,cops,0);assert.equal(cat.root.position.z,0);
 s.animateCapture(cat,cops,.06);assert.ok(cat.root.position.z>.4);assert.ok(cat.root.position.y>.1);
 s.animateCapture(cat,cops,.2);assert.ok(cat.root.position.y<.1);assert.ok(cat.legs.every(l=>l.rotation.x<-1.4));
});

test('arrest officers start outside the camera and move into view before pickup on all viewport shapes',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),cops=[s.makeCop(),s.makeCop()];cat.root.scale.setScalar(.776);
 for(const aspect of [.55,.85,16/9,2.4])for(const px of [-2.7,0,2.7])for(const raised of [false,true]){
  const offset=new THREE.Vector3(raised?9:0,raised?3:0,0),scale=raised?.32:1;
  s.camera=new THREE.PerspectiveCamera(65,aspect,.08,190);
  s.camera.position.set(offset.x+px*.1,offset.y+3.85,7.3);
  s.camera.lookAt(offset.x,offset.y+1.4,-10);s.camera.updateMatrixWorld(true);
  const arrival=s.camera.clone();arrival.position.set(offset.x+px*.35,offset.y+3.25,8.8);
  arrival.fov=64;arrival.lookAt(offset.x+px*.3,offset.y+1.15,-1);arrival.updateProjectionMatrix();arrival.updateMatrixWorld(true);
  const views=[s.camera,arrival].map(camera=>new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)));
  const starts=s.captureEntryPositions(px,offset,scale,arrival);
  s.animateCapture(cat,cops,0,{x:px},starts);
  for(const cop of cops){
   cop.root.position.x=cop.root.position.x*scale+offset.x;cop.root.position.y+=offset.y;
   for(const view of views)assert.equal(view.intersectsBox(new THREE.Box3().setFromObject(cop.root)),false,`visible teleport at aspect ${aspect}, lane ${px}`);
  }
  s.animateCapture(cat,cops,.35,{x:px},starts);
  cops.forEach((cop,i)=>{
   assert.ok(Math.abs(cop.root.position.x-(px+(i?1:-1)*1.04))<1e-6);
   assert.ok(Math.abs(cop.root.position.z-.72)<1e-6);
  });
 }
});

test('magnet is gripped at the U bridge and emits three restrained wave arcs',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),magnet=cat.magnet;
 assert.equal(magnet.parent,cat.arms[0]);assert.equal(magnet.userData.gripAtBottom,true);
 const waves=magnet.getObjectByName('magnet_wave_arcs');assert.equal(waves.children.length,3);
 magnet.visible=true;s.animateMagnet(magnet,1,false);
 assert.ok(waves.children.every(arc=>Number.isFinite(arc.scale.x)));
 s.animateMagnet(magnet,2,true);assert.ok(waves.children.every(arc=>arc.visible&&arc.scale.x===1));
});

test('shield presents three four-toe charge badges and collapses after its final charge',()=>{
 const s=modelFactory();s.materials=[];const shield=s.makeShield(),stripe=shield.getObjectByName('shield_charge_stripe');
 assert.equal(stripe.children.length,3);assert.equal(shield.getObjectByName('shield_heart_orbit'),undefined);
 for(let i=0;i<3;i++){assert.equal(shield.getObjectByName(`shield_paw_${i}`).userData.toes,4);assert.equal(stripe.children[i].position.y,0);}
 s.updateShieldVisual(shield,true,3,1,1/60,false);const before=stripe.rotation.y;s.updateShieldVisual(shield,true,2,2,.5,false);
 assert.ok(stripe.rotation.y<before,'charge stripe rotates clockwise');assert.equal(stripe.children.filter(item=>item.visible).length,2);
 s.updateShieldVisual(shield,true,1,2.5,.5,false);assert.equal(stripe.children.filter(item=>item.visible).length,1);
 s.updateShieldVisual(shield,false,0,3,1,false);assert.equal(shield.visible,true,'expiry keeps one graceful fade frame');
 s.updateShieldVisual(shield,false,0,4,1,false);assert.equal(shield.visible,false);
});

test('capture escort keeps one continuous pace through the completed turn',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),cops=[s.makeCop(),s.makeCop()];cat.root.scale.setScalar(.776);
 const samples=[];for(const progress of [.68,.70,.72,.74]){s.animateCapture(cat,cops,progress);samples.push({cat:cat.root.position.z,cops:cops.map(c=>c.root.position.z)});}
 const catSteps=samples.slice(1).map((sample,i)=>sample.cat-samples[i].cat);assert.ok(catSteps.every(step=>step>.13));
 for(let officer=0;officer<2;officer++){const steps=samples.slice(1).map((sample,i)=>sample.cops[officer]-samples[i].cops[officer]);assert.ok(steps.every(step=>step>.13),`officer ${officer} pauses after turning`);}
});
