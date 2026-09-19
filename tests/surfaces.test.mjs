import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { GameScene } from '../dist/scene.mjs';
import { DistrictScene } from '../dist/district-scene.mjs';
import { BRANCHES, routeCenter, branchOffset, getRouteProfile } from '../dist/route.mjs';

function factory(){
 const owner=Object.create(GameScene.prototype),s=Object.create(DistrictScene.prototype);
 owner.box=new THREE.BoxGeometry(1,1,1);owner.plane=new THREE.PlaneGeometry(1,1);
 const material=new THREE.MeshBasicMaterial();s.owner=owner;
 s.m=new Proxy({}, {get:(_,key)=>['facades','fascias','vertical','colors','lights'].includes(key)?Array(16).fill(material):material});
 return s;
}

test('curved road, pavement and shortcut UVs meet across streamed section boundaries',()=>{
 const s=factory();
 for(const distance of [890,1770,3030,4270,4810])for(const width of [2.4,6.8]){
  const chunks=[distance-20,distance].map(start=>{
   const g=new THREE.Group();g.userData.s=start;
   s.ribbon(g,s.m.concrete,start,start+20,-width,width,.08,4);
   return g;
  });
  const edges=chunks.map(g=>{
   const geo=g.children[0].geometry,p=geo.attributes.position,uv=geo.attributes.uv,points=[];
   for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i)-(g.userData.s-distance))<1e-5)
    points.push([p.getX(i)+routeCenter(g.userData.s),uv.getX(i),uv.getY(i)]);
   return points;
  });
  for(const point of edges[0])assert.ok(edges[1].some(other=>point.every((v,i)=>Math.abs(v-other[i])<1e-4)),`${distance}: texture phase changed at boundary`);
 }
});

test('shortcut building shells support the facade without blocking entrances or elevated routes',()=>{
 const s=factory();
 for(const b of BRANCHES.filter(b=>!['crossing','cover'].includes(b.kind))){
  const shell=new THREE.Group(),side=Math.sign(b.offset);
  for(let at=Math.floor(b.start/10)*10+5;at<=b.end+5;at+=10)
   s.branchBuildingBase(shell,side,routeCenter(at),-at,at,0,getRouteProfile(at),b,7.2);
  shell.updateMatrixWorld(true);
  const bounds=shell.children.filter(o=>o.geometry===s.owner.box||o.userData.buildingShell).map(o=>new THREE.Box3().setFromObject(o));
  for(let at=b.start;at<=b.end;at+=.5){
   const off=branchOffset(b,at),x=routeCenter(at)+off.x;
   const body=new THREE.Box3(new THREE.Vector3(x-.55,off.y+.15,-at-.25),new THREE.Vector3(x+.55,off.y+1.85,-at+.25));
   assert.ok(bounds.every(box=>!box.intersectsBox(body)),`${b.id}: wall blocks runner at ${at}`);
  }
  const at=(b.start+b.end)/2;
  const ray=new THREE.Raycaster(new THREE.Vector3(routeCenter(at),1.6,-at),new THREE.Vector3(side,0,0));
  assert.ok(ray.intersectObject(shell,true).length>0,`${b.id}: missing ground-floor frontage`);
 }
});

test('shortcut outer walls stay closed through bends, bay seams and the noodle-shop exit',()=>{
 const s=factory();
 for(const b of BRANCHES.filter(b=>!['crossing','cover'].includes(b.kind))){
  const shell=new THREE.Group(),side=Math.sign(b.offset);
  for(let at=Math.floor(b.start/10)*10+5;at<=b.end+5;at+=10)
   s.branchBuildingBase(shell,side,routeCenter(at),-at,at,0,getRouteProfile(at),b,7.2);
  shell.updateMatrixWorld(true);
  // The outside of the alley must have solid backing even where no individual
  // five-metre interior wall panel was placed. Test at foot and eye height.
  for(let at=b.start+1;at<b.end;at+=.5){
   const off=branchOffset(b,at),p=getRouteProfile(at),front=Math.min(p.buildingEdge,Math.abs(b.offset)-2.65),back=Math.max(p.buildingEdge+8,Math.abs(b.offset)+2.7);
   if(Math.abs(off.x)<front-2.4)continue;
   for(const height of [.4,1.6]){
    const origin=new THREE.Vector3(routeCenter(at)+off.x,off.y+height,-at);
    const ray=new THREE.Raycaster(origin,new THREE.Vector3(side,0,0),0,back-Math.abs(off.x)+.4);
    assert.ok(ray.intersectObject(shell,true).length,`${b.id}: exposed outside wall at ${at}, height ${height}`);
   }
  }
 }
});

test('ordinary storefronts have solid side returns below the upper storeys',()=>{
 const s=factory();
 for(const at of [825,1025,1695,1905,3905,4955])for(const side of [-1,1]){
  const shell=new THREE.Group(),p=getRouteProfile(at),cx=routeCenter(at);
  s.building(shell,side,cx,-at,at,8,p);shell.updateMatrixWorld(true);
  for(const depth of [1,4,7])for(const height of [.4,1.6,3.3]){
   const origin=new THREE.Vector3(cx+side*(p.buildingEdge+depth),height,-at+8);
   const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1),0,4);
   assert.ok(ray.intersectObject(shell,true).length,`open shop side at ${at}, depth ${depth}, height ${height}`);
  }
 }
});
