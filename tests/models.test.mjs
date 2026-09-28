import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { GameScene, airborneCameraFollow, characterSampleTime, chipVisualScale } from '../dist/scene.mjs';
import { DistrictScene } from '../dist/district-scene.mjs';
import { VEHICLES, MOTION, BARRIERS } from '../dist/core.mjs';

function modelFactory(){
  const s=Object.create(GameScene.prototype), material=new THREE.MeshBasicMaterial();
  const spriteMaterial=new THREE.SpriteMaterial({color:0xffd45a}),powerAura=Object.fromEntries(['magnet','moon','moped','shield','doublechips','jetpack','speedburst'].map((type,index)=>[type,new THREE.SpriteMaterial({color:[0x6cf0ca,0xd8eb58,0xff7541,0x62ddff,0xffc846,0xff6952,0x55bfff][index]})]));s.m=new Proxy({}, {get:(_,key)=>['shirt','pants','complexions','wall'].includes(key)?Array(6).fill(material):key==='chipAura'?spriteMaterial:key==='powerAura'?powerAura:material});
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
  const packet=cat.bag,packetBody=packet.getObjectByName('stolen_chip_packet_body'),packetSize=packetBody.geometry.boundingBox.getSize(new THREE.Vector3()),labels=packet.children.filter(o=>o.name.startsWith('stolen_chip_label'));
  assert.equal(packet.userData.packetStyle,'sealed-pillow');assert.equal(packet.userData.integratedCrimps,true);assert.equal(packet.userData.readableFaces,2);assert.equal(packetBody.geometry.userData.sealedPillow,true);assert.equal(packetBody.geometry.userData.integratedCrimps,true);
  assert.ok(packetSize.x>.6&&packetSize.y>.78&&packetSize.z>.31,'packet has a voluminous pillow silhouette');assert.equal(labels.length,2);assert.ok(labels.every(label=>label.getObjectByName('stolen_chip_wordmark')));assert.equal(packet.getObjectByName('stolen_chip_pouch'),undefined,'old overlapping ellipsoid packet is gone');
  assert.equal(cat.root.getObjectByName('18bro_panic_face'),undefined,'surprise does not add duplicate eyes');assert.equal(cat.expression.mode,'existing-procedural-face');assert.equal(cat.capMark.userData.mark,'seven-eleven-geometric');assert.equal(cat.capMark.userData.geometryOnly,true);assert.equal(cat.capMark.userData.frontSign,1);
  assert.equal(s.furMaterials.size<=6,true);
 }
});
test('stolen packet is one closed pillow volume with attached outward artwork on both faces',()=>{
 const s=modelFactory(),packet=new THREE.Group();s.makePacket(packet);const body=packet.getObjectByName('stolen_chip_packet_body'),geometry=body.geometry,size=geometry.boundingBox.getSize(new THREE.Vector3()),indices=geometry.index.array,edgeUse=new Map();
 for(let i=0;i<indices.length;i+=3)for(const [a,b] of [[indices[i],indices[i+1]],[indices[i+1],indices[i+2]],[indices[i+2],indices[i]]]){const key=a<b?String(a)+':'+String(b):String(b)+':'+String(a);edgeUse.set(key,(edgeUse.get(key)||0)+1);}
 assert.ok([...edgeUse.values()].every(count=>count===2),'every packet edge belongs to exactly two triangles');
 assert.deepEqual(geometry.groups.map(group=>group.materialIndex),[0,1,2],'body, heat seals and artwork are integrated material zones');
 assert.equal(geometry.userData.manifoldClosed,true);assert.equal(geometry.userData.integratedLabelPanels,true);assert.ok(size.x>.7&&size.y>.81&&size.z>.32);
 assert.ok(s.packetHalfDepth(0,-.02)>s.packetHalfDepth(0,-.425)*4.5,'soft body is substantially fuller than its sealed edge');
 assert.ok(s.packetHalfDepth(0,-.02)>s.packetHalfDepth(s.packetHalfWidth(-.02)*.95,-.02)*2,'side gussets taper without flattening the centre');
 const labels=packet.children.filter(child=>child.name.startsWith('stolen_chip_label'));assert.equal(labels.length,2);
 for(const label of labels){const outward=new THREE.Vector3(0,0,1).applyQuaternion(label.quaternion),wordmark=label.getObjectByName('stolen_chip_wordmark'),positions=wordmark.geometry.attributes.position;assert.ok(outward.dot(new THREE.Vector3(...label.userData.outwardNormal))>.999);assert.equal(Math.sign(label.position.z),label.userData.face);assert.equal(label.userData.surfaceBound,true);assert.ok(wordmark);assert.equal(wordmark.geometry.userData.surfaceConformed,true);for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),expected=s.packetHalfDepth(x,label.position.y+y)-Math.abs(label.position.z)+label.userData.surfaceOffset;assert.ok(Math.abs(positions.getZ(i)-expected)<1e-6,'letter follows the curved packet surface');}assert.equal(label.getObjectByName('stolen_chip_label_panel'),undefined,'red panel is part of the bag surface rather than a floating plane');}
});
test('seven mark uses a shallow ordered badge with a single 7 and readable ELEVEN geometry',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro',{hat:'cap'}),mark=cat.capMark,layers=mark.userData.layerDepths;
 assert.equal(mark.userData.mark,'seven-eleven-geometric');assert.equal(mark.userData.word,'ELEVEN');assert.ok(mark.getObjectByName('seven_mark_panel'));assert.ok(mark.getObjectByName('seven_mark_orange_bar'));assert.ok(mark.getObjectByName('seven_mark_red_seven'));assert.ok(mark.getObjectByName('seven_mark_word_eleven'));
 assert.ok(layers.panelFront<layers.orange&&layers.orange<layers.red+.0001);assert.ok(Math.max(layers.red,layers.word)-layers.panelFront<.004,'logo ink hugs the cap panel');assert.ok(mark.userData.maximumRelief<.02,'badge does not float in front of the cap');
 const panelBounds=new THREE.Box3().setFromObject(mark.getObjectByName('seven_mark_panel')),redBounds=new THREE.Box3().setFromObject(mark.getObjectByName('seven_mark_red_seven')),wordBounds=new THREE.Box3().setFromObject(mark.getObjectByName('seven_mark_word_eleven'));
 assert.ok(redBounds.min.x>panelBounds.min.x&&redBounds.max.x<panelBounds.max.x&&redBounds.min.y>panelBounds.min.y&&redBounds.max.y<panelBounds.max.y&&wordBounds.min.x>panelBounds.min.x&&wordBounds.max.x<panelBounds.max.x&&wordBounds.min.y>panelBounds.min.y&&wordBounds.max.y<panelBounds.max.y,'all logo geometry remains inside its white panel in the artwork plane');assert.ok(wordBounds.getSize(new THREE.Vector3()).x>panelBounds.getSize(new THREE.Vector3()).x*.48,'ELEVEN treatment remains readable at gameplay scale');
});
test('store surprise brings the existing full eyes forward and restores every transform exactly',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),parts=[...cat.expression.eyes,...cat.expression.pupils,...cat.expression.lids,...cat.expression.brows,cat.expression.mouth],snapshot=()=>parts.map(part=>[...part.position.toArray(),...part.scale.toArray(),...part.rotation.toArray()]),before=snapshot(),eyeDepths=cat.expression.eyes.map(eye=>eye.position.z),lidDepths=cat.expression.lids.map(lid=>lid.position.z),meshCount=cat.head.children.filter(child=>child.isMesh).length;
 s.applyCatSurprise(cat,1);assert.equal(cat.expression.amount,1);assert.notDeepEqual(snapshot(),before);assert.equal(cat.head.children.filter(child=>child.isMesh).length,meshCount,'surprise reuses the existing face meshes');
 cat.expression.eyes.forEach((eye,index)=>{assert.ok(eye.position.z-eyeDepths[index]>=.044,'eye white comes forward');assert.ok(eye.position.z>cat.expression.lids[index].position.z+.025,'full eye ellipse clears the retracted lid');assert.ok(cat.expression.lids[index].position.z<lidDepths[index]);});
 s.applyCatSurprise(cat,0);assert.deepEqual(snapshot(),before,'normal face restores exactly at the exit');assert.equal(cat.expression.amount,0);assert.equal(cat.expression.eyeForward,0);assert.equal(cat.expression.lidRetreat,0);
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

test('magnet is held upright with one centred signal that fades through a roll',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),magnet=cat.magnet,arm=cat.arms[0];
 assert.equal(magnet.parent,arm);assert.equal(magnet.userData.gripAtBottom,true);assert.equal(magnet.userData.raisedToPlayerRight,true);
 const waves=magnet.getObjectByName('magnet_wave_arcs');assert.equal(waves.children.length,3);assert.equal(waves.userData.centered,true);
 assert.ok(waves.children.every(arc=>arc.userData.signalColor==='blue'&&arc.geometry.parameters.radius>=.26&&arc.geometry.parameters.arc===Math.PI));
 magnet.visible=true;s.animateCat(cat,0,'run');s.animateMagnet(magnet,1,false,false,1/60);
 assert.ok(arm.rotation.z<-2,'arm points outward and upward');assert.ok(arm.quaternion.clone().multiply(magnet.quaternion).angleTo(new THREE.Quaternion())<1e-6,'magnet stays upright at the lower bridge');
 for(let i=0;i<30;i++)s.animateMagnet(magnet,1+i/60,false,true,1/60);
 assert.ok(waves.userData.fade<.01);assert.equal(waves.visible,false,'rolling hides the ground-parallel signal');
 for(let i=0;i<30;i++)s.animateMagnet(magnet,2+i/60,false,false,1/60);
 assert.ok(waves.userData.fade>.99);assert.equal(waves.visible,true,'signal eases back after the roll');
 s.animateMagnet(magnet,3,true,true);assert.equal(waves.visible,false,'Reduced Motion hides immediately during a roll');
 s.animateMagnet(magnet,3,true,false);assert.ok(waves.children.every(arc=>arc.visible&&arc.scale.x===1));
 magnet.visible=false;s.animateCat(cat,0,'run');assert.equal(arm.rotation.z,-.12,'ordinary run restores the arm immediately when Magnet ends');
});


test('all boosters share a camera-facing soft aura tinted to their identity',()=>{
 const s=modelFactory(),types=['magnet','moon','moped','shield','doublechips','jetpack','speedburst'];
 for(const type of types){const power=s.makeEntity(type,3),aura=power.getObjectByName('powerup_soft_aura');assert.ok(aura?.isSprite,type+' aura is a billboard');assert.equal(aura.material,s.m.powerAura[type]);assert.equal(aura.material.isSpriteMaterial,true);s.animatePowerup(power,type,.25,3,false);assert.ok(aura.scale.x>1.6&&aura.scale.x<1.85);}
});

test('Refreshed humans sample every frame while Original keeps intentional 12 fps stepping',()=>{
 assert.equal(characterSampleTime(1/60,'refreshed'),1/60);assert.equal(characterSampleTime(2/60,'refreshed'),2/60);
 assert.equal(characterSampleTime(1/60,'original'),characterSampleTime(2/60,'original'));
 assert.notEqual(characterSampleTime(4/60,'original'),characterSampleTime(6/60,'original'));
});

test('chips use a bouncy scale lifecycle and a reusable golden aura',()=>{
 const s=modelFactory(),coin=s.makeEntity('coin',1),aura=coin.getObjectByName('chip_golden_aura');assert.ok(aura?.isSprite,'gold glow is one camera-facing billboard');assert.equal(coin.getObjectByName('chip_aura_outer'),undefined);assert.equal(coin.getObjectByName('chip_aura_inner'),undefined);assert.equal(aura.material.isSpriteMaterial,true);
 assert.ok(chipVisualScale({age:0})<.04);assert.ok(chipVisualScale({age:.156})>=1.2&&chipVisualScale({age:.156})<=1.25);assert.ok(Math.abs(chipVisualScale({age:.3})-1)<1e-9);
 assert.ok(chipVisualScale({age:1,retiring:true,retireElapsed:.088,retireDuration:.26})>1.18);assert.ok(chipVisualScale({age:1,retiring:true,retireElapsed:.26,retireDuration:.26})<.01);assert.equal(chipVisualScale({age:.1},true),1);
});

test('police nets stay rigid, contain 18Bro and leave in one two-guard carry',()=>{
 const s=modelFactory();s.materials=[];s.scene=new THREE.Scene();s.cat=s.makeCat('18bro');s.scene.add(s.cat.root);
 s.cops=[s.makeCop(),s.makeCop()];s.cops.forEach((cop,i)=>{cop.catchNet=s.makeCatchNet(i);s.attachCatchNet(cop,cop.catchNet);cop.root.rotation.y=Math.PI;s.animateCop(cop,1+i*.2,1);s.scene.add(cop.root);});
 s.catchTargetMark=s.makeCatchTargetMark();s.scene.add(s.catchTargetMark);s.captureNet=s.makeCatchNet(2);s.scene.add(s.captureNet);s.routeLateralScale=.8;s.routeWorldOffset=new THREE.Vector3(5,.2,0);s.clock=1.25;
 const net=s.cops[1].catchNet,envelope=net.userData.heroEnvelope;
 assert.ok(net.userData.hoopRadius*2>=envelope.headWidth+.12,'hoop clears the authored head');
 assert.equal(net.userData.openWebPattern,'sagging-square-lattice','open net must read as woven mesh rather than a wheel');
 assert.ok(net.userData.sackDepth>=envelope.height+.1,'sack contains the full hero');
 const approach=s.updateNetPursuit({active:true,guardIndex:1,phase:'approach',targetX:2,telegraphProgress:0},1/60,false);assert.equal(approach.guardIndex,1);assert.equal(s.cops[1].catchNet.visible,true);assert.equal(s.cops[0].catchNet.visible,false,'only the acting guard presents a net');assert.ok(s.cops.every(cop=>!cop.baton.visible));
 assert.equal(s.cops[0].catchNet.userData.attachedTo,'procedural_hand_R');assert.equal(s.cops[0].catchNet.parent,s.cops[0].hands[1]);assert.equal(net.userData.attachedTo,'procedural_hand_L');assert.equal(net.parent,s.cops[1].hands[0]);
 const selected=s.cops[1],legsBefore=selected.legs.flatMap(leg=>leg.quaternion.toArray()),baseScale=net.scale.x;
 s.updateNetPursuit({active:true,guardIndex:1,phase:'telegraph',targetX:2,telegraphProgress:0,blink:.8,blinkFrequency:4.2},1/60,false);selected.root.updateMatrixWorld(true);const lowHand=net.parent.getWorldPosition(new THREE.Vector3()).y;
 s.updateNetPursuit({active:true,guardIndex:1,phase:'telegraph',targetX:2,telegraphProgress:.5,blink:.8,blinkFrequency:4.2},1/60,false);selected.root.updateMatrixWorld(true);const middleHand=net.parent.getWorldPosition(new THREE.Vector3()).y;
 s.updateNetPursuit({active:true,guardIndex:1,phase:'telegraph',targetX:2,telegraphProgress:1,blink:.8,blinkFrequency:4.2},1/60,false);selected.root.updateMatrixWorld(true);const highHand=net.parent.getWorldPosition(new THREE.Vector3()).y;
 assert.ok(lowHand<middleHand&&middleHand<highHand);assert.deepEqual(selected.legs.flatMap(leg=>leg.quaternion.toArray()),legsBefore);assert.equal(s.catchTargetMark.visible,true);assert.equal(s.catchTargetMark.userData.blinkHz,4.2);
 s.clock=2;s.updateNetPursuit({active:true,guardIndex:1,phase:'strike',targetX:2,telegraphProgress:1},1/60,false);const strikeScale=net.scale.x;s.clock=2.13;s.updateNetPursuit({active:true,guardIndex:1,phase:'strike',targetX:2,telegraphProgress:1},1/60,false);assert.equal(net.scale.x,strikeScale,'aim never stretches the prop');
 const netted=s.updateNetPursuit({active:true,guardIndex:1,phase:'netted',targetX:2,caught:true,captureProgress:.1,capture:{phaseProgress:1}},1/60,false);assert.equal(netted.caught,true);assert.equal(net.visible,true);assert.equal(s.cops[0].catchNet.visible,false,'escort never blocks the captured hero');assert.equal(net.userData.sack.visible,true);assert.equal(net.userData.openWeb.visible,false);assert.equal(net.scale.x,baseScale);assert.equal(net.parent,selected.hands[0]);
 selected.root.updateMatrixWorld(true);s.cat.root.updateMatrixWorld(true);const payload=net.userData.payloadRoot.getWorldPosition(new THREE.Vector3()),hoop=net.getObjectByName('catch_net_hoop').getWorldPosition(new THREE.Vector3()),bagDown=new THREE.Vector3(0,0,-1).applyQuaternion(net.getWorldQuaternion(new THREE.Quaternion()));
 assert.ok(s.cat.root.position.distanceTo(payload)<.02,'hero root follows the sack payload socket');assert.ok(bagDown.dot(new THREE.Vector3(0,-1,0))>.96,'sack hangs down in world space');assert.ok(hoop.y-(s.cat.root.position.y+envelope.height)>.04,'hero top stays below the hoop');
 assert.ok(net.getWorldPosition(new THREE.Vector3()).distanceTo(net.parent.getWorldPosition(new THREE.Vector3()))<.03,'grip stays on the hand');
 s.updateNetPursuit({active:true,guardIndex:1,phase:'lift',targetX:2,caught:true,captureProgress:.3,capture:{phaseProgress:.1}},1/60,false);const lowPayload=net.userData.payloadRoot.getWorldPosition(new THREE.Vector3()).y;
 s.updateNetPursuit({active:true,guardIndex:1,phase:'lift',targetX:2,caught:true,captureProgress:.5,capture:{phaseProgress:.9}},1/60,false);const highPayload=net.userData.payloadRoot.getWorldPosition(new THREE.Vector3()).y;assert.ok(highPayload>lowPayload);assert.equal(net.scale.x,baseScale);
 const carry={active:true,guardIndex:1,phase:'carry',targetX:2,caught:true,captureProgress:.8,capture:{phaseProgress:.5}};s.updateNetPursuit(carry,1/60,false);const repeated={cat:s.cat.root.position.clone(),cops:s.cops.map(cop=>cop.root.position.clone()),scale:net.scale.x};s.updateNetPursuit(carry,1/60,false);assert.ok(s.cat.root.position.distanceTo(repeated.cat)<1e-12);s.cops.forEach((cop,i)=>assert.ok(cop.root.position.distanceTo(repeated.cops[i])<1e-12));assert.equal(net.scale.x,repeated.scale);const shoulderAttachment=net.userData.presentation.attachment;assert.equal(shoulderAttachment.shoulderResting,true);assert.ok(shoulderAttachment.contactDistance<1e-6,'pole centreline rests directly on the selected shoulder');assert.ok(shoulderAttachment.gripToShoulder>.15&&shoulderAttachment.gripToShoulder<.7,'acting hand grips the pole beside the shoulder');assert.ok(shoulderAttachment.shaftWorld.y>.2,'resting pole rises diagonally from the hand to the shoulder');assert.ok(s.cat.root.position.z<selected.root.position.z-.15,'payload trails the carrier');
 s.updateNetPursuit({active:true,guardIndex:0,phase:'strike',targetX:0,telegraphProgress:1},1/60,true);assert.equal(s.cops[0].catchNet.userData.presentation.swing,1);
 s.clock=4;const complete={active:false,guardIndex:1,phase:'complete',outcome:'caught',caught:true,captureProgress:1,capture:{phaseProgress:1}};s.updateNetPursuit(complete,1/60,false);const beforeExit=s.cops.map(cop=>cop.root.position.z);s.clock=5;s.updateNetPursuit(complete,1/60,false);const deltas=s.cops.map((cop,i)=>cop.root.position.z-beforeExit[i]);assert.ok(deltas.every(delta=>delta>0));assert.ok(Math.abs(deltas[0]-deltas[1])<.05,'both guards leave at one pace');assert.ok(s.cops.every(cop=>cop.root.visible));assert.equal(s.cops[1].catchNet.visible,true);assert.equal(s.cops[0].catchNet.visible,false);
 s.clock=7.4;const exited=s.updateNetPursuit(complete,1/60,false);assert.equal(exited.exited,true);assert.ok(s.cops.every(cop=>!cop.root.visible&&!cop.catchNet.visible));assert.equal(s.cat.root.visible,false);
 s.updateNetPursuit(null,1/60,false);assert.ok(s.cops.every(cop=>cop.root.visible&&cop.baton.visible&&!cop.catchNet.visible));assert.equal(s.cat.root.visible,true);
});

test('shield badges are large, equally spaced, orbit in three seconds and shatter on use',()=>{
 const s=modelFactory();s.materials=[];const shield=s.makeShield(),stripe=shield.getObjectByName('shield_charge_stripe');
 assert.equal(stripe.children.length,3);assert.equal(stripe.userData.orbitSeconds,3);assert.equal(shield.getObjectByName('shield_heart_orbit'),undefined);
 const angles=stripe.children.map(badge=>Math.atan2(badge.position.x,badge.position.z)).sort((a,b)=>a-b),gaps=angles.map((angle,i)=>(angles[(i+1)%3]-angle+Math.PI*2)%(Math.PI*2));
 for(let i=0;i<3;i++){const badge=stripe.children[i];assert.equal(shield.getObjectByName(`shield_paw_${i}`).userData.toes,4);assert.equal(badge.position.y,0);assert.ok(badge.userData.baseScale>=1);assert.ok(Math.abs(gaps[i]-Math.PI*2/3)<1e-10);}
 s.updateShieldVisual(shield,true,3,0,1/60,false);s.updateShieldVisual(shield,true,3,1.5,1/60,false);
 assert.ok(Math.abs(Math.abs(stripe.rotation.y)-Math.PI)<1e-10,'half an orbit takes 1.5 seconds');
 s.updateShieldVisual(shield,true,2,1.6,.12,false);const spent=stripe.children[2],shards=spent.getObjectByName('shield_break_2');
 assert.equal(spent.visible,true,'spent charge remains for its break animation');assert.equal(shards.visible,true);assert.ok(shards.children.some(shard=>shard.position.length()>.05));
 s.updateShieldVisual(shield,true,2,2.2,.6,false);assert.equal(spent.visible,false);
 s.updateShieldVisual(shield,true,1,2.3,.12,true);assert.equal(stripe.rotation.y,0,'reduced motion freezes the orbit');assert.equal(stripe.children[1].getObjectByName('shield_break_1').visible,false,'reduced motion omits flying shards');
 s.updateShieldVisual(shield,false,0,3,1,false);assert.equal(shield.visible,true,'expiry keeps one graceful fade frame');
 s.updateShieldVisual(shield,false,0,4,1,false);assert.equal(shield.visible,false);
});

test('Moon Boots and Jetpack lift camera and look target together without an apex tilt',()=>{
 for(const power of ['moon','jetpack']){
  const powers=new Set([power]),low=airborneCameraFollow(powers,1.2),nearThreshold=airborneCameraFollow(powers,3.19),pastThreshold=airborneCameraFollow(powers,3.21);
  assert.equal(low.constantPitch,true);assert.equal(low.cameraLift,low.targetLift);
  assert.ok(Math.abs((pastThreshold.cameraLift-nearThreshold.cameraLift)-.018)<1e-12,'camera follow stays continuous through the former height threshold');
  assert.equal(pastThreshold.cameraLift,pastThreshold.targetLift);
 }
 const ordinary=airborneCameraFollow(new Set(),5);assert.equal(ordinary.constantPitch,false);assert.equal(ordinary.cameraLift,.6);assert.equal(ordinary.targetLift,0);
});

test('capture escort keeps one continuous pace through the completed turn',()=>{
 const s=modelFactory(),cat=s.makeCat('18bro'),cops=[s.makeCop(),s.makeCop()];cat.root.scale.setScalar(.776);
 const samples=[];for(const progress of [.68,.70,.72,.74]){s.animateCapture(cat,cops,progress);samples.push({cat:cat.root.position.z,cops:cops.map(c=>c.root.position.z)});}
 const catSteps=samples.slice(1).map((sample,i)=>sample.cat-samples[i].cat);assert.ok(catSteps.every(step=>step>.13));
 for(let officer=0;officer<2;officer++){const steps=samples.slice(1).map((sample,i)=>sample.cops[officer]-samples[i].cops[officer]);assert.ok(steps.every(step=>step>.13),`officer ${officer} pauses after turning`);}
});
