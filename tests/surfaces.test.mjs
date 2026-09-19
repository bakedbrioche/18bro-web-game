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

test('former hallway blocks have closed storefronts at ground level',()=>{
 const s=factory();
 for(const [start,end] of [[850,1020],[1730,1900],[2970,3280],[3710,3900],[4240,4490],[4770,4940],[5480,5600]]){
  for(let at=start+5;at<end;at+=10)for(const side of [-1,1]){
   const g=new THREE.Group(),p=getRouteProfile(at),cx=routeCenter(at);
   s.building(g,side,cx,-at,at,8,p);g.updateMatrixWorld(true);
   const ray=new THREE.Raycaster(new THREE.Vector3(cx,1.6,-at),new THREE.Vector3(side,0,0),0,p.buildingEdge+.5);
   assert.ok(ray.intersectObject(g,true).length,`open hallway frontage at ${at}`);
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
