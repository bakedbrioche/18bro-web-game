import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { GameScene } from '../dist/scene.mjs';
import { VEHICLES, MOTION } from '../dist/core.mjs';

function modelFactory(){
  const s=Object.create(GameScene.prototype), material=new THREE.MeshBasicMaterial();
  s.m=new Proxy({}, {get:(_,key)=>['shirt','pants','complexions'].includes(key)?Array(6).fill(material):material});
  s.box=new THREE.BoxGeometry(1,1,1);s.sphere=new THREE.SphereGeometry(.5,20,14);s.plane=new THREE.PlaneGeometry(1,1);
  s.cylinder=new THREE.CylinderGeometry(.5,.5,1,16);return s;
}
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
  assert.ok(bounds.max.y>MOTION.jumpHeight+.7);assert.ok(Math.abs(bounds.max.y-3.5)<.01);
});
