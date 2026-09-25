import * as THREE from './vendor/three.module.js';
import { clone as cloneSkeleton } from './vendor/addons/utils/SkeletonUtils.js';
import { sidewalkPose, CROWD_COUNT } from './crowd.mjs?v=street-28';
import { INTRO_DURATION, CAPTURE_DURATION, STORE, introPose, capturePose, smooth, slidePose } from './choreography.mjs?v=street-28';
import { applyMaterialAssets } from './material-assets.mjs?v=street-28';
import { BARRIERS } from './core.mjs?v=graphics2-1';
import { ROUTE, BRANCHES, getRouteProfile, routeCenter, branchOffset } from './route.mjs?v=street-28';
import { DistrictScene } from './district-scene.mjs?v=street-28';
import { FURS } from './customization.mjs?v=street-28';
import { MODEL_MANIFEST } from './model-manifest.mjs';
import { createCharacterAssetStore } from './character-assets.mjs';
import { HERO_CLIPS, selectHeroAnimation } from './character-animation.mjs';

const TAU = Math.PI * 2;
const POWER_TYPES=Object.freeze(['magnet','moon','moped','shield','doublechips','jetpack','speedburst']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const seeded=(n)=>{let s=n>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296)};

function texture(paint,w=64,h=w){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;paint(ctx,w,h);
  const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;
  return t;
}
function pixelText(ctx,text,x,y,size,color='#fff',align='center'){
 ctx.fillStyle=color;ctx.font=`900 ${size}px monospace`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(text,x,y);
}
function catMark(ctx,x,y,r,color='#4c2b06'){
 ctx.fillStyle=color;ctx.fillRect(x-r,y-r*.6,r*2,r*1.3);ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x-r,y-r*1.1);ctx.lineTo(x-r*.25,y-r*.5);ctx.lineTo(x+r*.3,y-r*.5);ctx.lineTo(x+r,y-r*1.1);ctx.lineTo(x+r,y);ctx.fill();
 ctx.fillStyle='#ffe897';ctx.fillRect(x-r*.55,y-r*.1,r*.35,r*.2);ctx.fillRect(x+r*.2,y-r*.1,r*.35,r*.2);
}

// Static geometry is combined by material. A whole block uses only a few draw calls.
class Batch {
 constructor(){this.items=new Map();this.matrix=new THREE.Matrix4();this.quat=new THREE.Quaternion();this.scale=new THREE.Vector3();this.pos=new THREE.Vector3();this.euler=new THREE.Euler();}
 add(geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
  this.pos.set(x,y,z);this.scale.set(sx,sy,sz);this.euler.set(rx,ry,rz);this.quat.setFromEuler(this.euler);this.matrix.compose(this.pos,this.quat,this.scale);
  const g=geo.index?geo.toNonIndexed():geo;const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  let out=this.items.get(mat);if(!out){out={p:[],n:[],u:[]};this.items.set(mat,out)}
  const v=new THREE.Vector3(),normal=new THREE.Vector3(),nm=new THREE.Matrix3().getNormalMatrix(this.matrix);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(this.matrix);out.p.push(v.x,v.y,v.z);normal.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();out.n.push(normal.x,normal.y,normal.z);out.u.push(uv?uv.getX(i):0,uv?uv.getY(i):0);}
  if(g!==geo)g.dispose();
 }
 group(){const g=new THREE.Group();for(const [mat,a] of this.items){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(a.p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(a.n,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(a.u,2));geo.computeBoundingSphere();g.add(new THREE.Mesh(geo,mat));}return g;}
}

export class GameScene {
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0x0a081b);this.renderer.toneMapping=THREE.NoToneMapping;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x101b2a);this.scene.fog=new THREE.Fog(0x172c3c,24,108);
  this.camera=new THREE.PerspectiveCamera(65,16/9,.08,190);this.camera.position.set(0,3.6,6.8);
  this.hemi=new THREE.HemisphereLight(0xd7dfff,0x5a483a,2.1);this.scene.add(this.hemi);const key=this.keyLight=new THREE.DirectionalLight(0xffdfb9,2.0);key.position.set(-8,14,8);this.scene.add(key);
  const rim=this.rimLight=new THREE.DirectionalLight(0x6d82d5,1);rim.position.set(8,5,-12);this.scene.add(rim);
  this.snapUniform={value:new THREE.Vector2(320,240)};this.wobbleUniform={value:1};this.materials=[];this.box=new THREE.BoxGeometry(1,1,1);this.plane=new THREE.PlaneGeometry(1,1);this.cylinder=new THREE.CylinderGeometry(.5,.5,1,8);this.sphere=new THREE.SphereGeometry(.5,10,7);this.cone=new THREE.ConeGeometry(.5,1,4);
  this.makeMaterials();applyMaterialAssets(this);this.world=new THREE.Group();this.scene.add(this.world);this.chunks=[];
  for(let i=0;i<7;i++){const chunk=this.makeChunk(i);chunk.root.position.z=-i*30;this.world.add(chunk.root);this.chunks.push(chunk);}
  this.skyline=this.makeSkyline();this.scene.add(this.skyline);
  this.cat=this.makeCat('18bro');this.scene.add(this.cat.root);this.skin='18bro';
  this.modelSetPreference='original';this.effectiveModelSet='original';this.modelSetStatus='original';this.modelSetReason='';this._modelGeneration=0;
  this.cops=[this.makeCop(),this.makeCop()];this.cops.forEach(c=>this.scene.add(c.root));
  this.chaseZ=2.825;
  this.entities=new Map();this.lastTheme=-1;this.clock=0;this.lastDistance=0;this.lastState='';this.stateTime=0;this.target=new THREE.Vector3();this.cameraTarget=new THREE.Vector3(0,1,-10);
  this.makeMenuProps();this.makeParticles();this.makePedestrians();this.moped=this.makeMoped(2);this.moped.scale.setScalar(.82);this.scene.add(this.moped);this.makeDizzyStars();this.debugBoxes=new THREE.Group();this.scene.add(this.debugBoxes);this.debugPool=[];
  this.district=new DistrictScene(this);this.scene.add(this.district.root);
  this.extraCops=[this.makeCop(),this.makeCop()];this.extraCops.forEach(c=>{c.root.visible=false;this.scene.add(c.root);});
  this.resize(canvas.clientWidth||1280,canvas.clientHeight||720);
 }
 // The procedural rig remains authoritative for root placement, choreography and
 // gameplay attachments. The optional authored rig only supplies a visible skin.
 async setModelSetPreference(value){
  const preference=value==='refreshed'?'refreshed':'original';
  if(this._modelDisposed)return 'original';
  if(preference===this.modelSetPreference&&this.modelSetStatus==='loading')return this._modelLoad;
  if(preference===this.modelSetPreference&&this.modelSetStatus==='ready')return this.effectiveModelSet;
  this.modelSetPreference=preference;const generation=this._modelGeneration=(this._modelGeneration||0)+1;
  if(preference==='original'){
   this.restoreOriginalHero();if(this.authoredHero)this.authoredHero.root.visible=false;
   this.applyHumanModelSet('original');this.effectiveModelSet='original';this.modelSetStatus='original';this.modelSetReason='';return 'original';
  }
  if(this.authoredHero&&this.authoredHumanTemplate&&this.authoredPowerupTemplate){this.applyHumanModelSet('refreshed');this.effectiveModelSet='refreshed';this.modelSetStatus='ready';this.modelSetReason='';return 'refreshed';}
  this.modelSetStatus='loading';this.modelSetReason='loading';this.effectiveModelSet='original';
  this.characterAssets??=createCharacterAssetStore({manifest:MODEL_MANIFEST,embeddedModels:globalThis.__18BRO_EMBEDDED_MODELS__||{}});
  const pending=this._modelLoad=(async()=>{
    let asset,humanAsset,powerupAsset;
    try{
     [asset,humanAsset,powerupAsset]=await Promise.all([this.characterAssets.instantiate('18bro-v1'),this.characterAssets.instantiate('human-v1'),this.characterAssets.instantiate('powerups-v1')]);
     if(this._modelDisposed||generation!==this._modelGeneration){asset.dispose();humanAsset.dispose();powerupAsset.dispose();return this.effectiveModelSet;}
     this.authoredHumanAsset=humanAsset;this.authoredHumanTemplate=this.prepareAuthoredHuman(humanAsset);
     this.authoredPowerupAsset=powerupAsset;this.authoredPowerupTemplate=this.prepareAuthoredPowerups(powerupAsset);
     this.authoredHero=this.prepareAuthoredHero(asset);this.scene.add(this.authoredHero.root);for(const person of this.humanRigs||[])this.attachAuthoredHuman(person);this.applyHumanModelSet('refreshed');
    this.effectiveModelSet='refreshed';this.modelSetStatus='ready';this.modelSetReason='';return 'refreshed';
   }catch(error){
     asset?.dispose();humanAsset?.dispose();powerupAsset?.dispose();this.authoredHumanAsset=null;this.authoredHumanTemplate=null;this.authoredPowerupAsset=null;this.authoredPowerupTemplate=null;
    if(!this._modelDisposed&&generation===this._modelGeneration){
     this.restoreOriginalHero();this.applyHumanModelSet('original');this.effectiveModelSet='original';this.modelSetStatus='fallback';this.modelSetReason='load-failed';
     this.modelSetError=error instanceof Error?error.message:String(error);
    }
    return 'original';
   }
  })();
  return pending;
 }
 prepareAuthoredPowerups(asset){
  const roots=new Map();
  for(const type of POWER_TYPES){const root=asset.scene.getObjectByName(`powerup_${type}`);if(!root)throw new Error(`Authored power-up is missing powerup_${type}`);roots.set(type,root);}
  const wearableNames=['wearable_magnet','wearable_moon_L','wearable_moon_R'],wearables=new Map();
  for(const name of wearableNames){const wearable=asset.scene.getObjectByName(name);if(!wearable)throw new Error(`Authored power-up is missing ${name}`);wearables.set(name,wearable);}
  return {roots,wearables};
 }
 makeAuthoredPowerup(type){
  const source=this.authoredPowerupTemplate?.roots.get(type);if(!source)return null;
  const group=new THREE.Group();group.name=`powerup_refreshed_${type}`;const model=source.clone(true);model.position.set(0,0,0);model.rotation.set(0,0,0);group.add(model);return this.decoratePowerup(group,type);
 }
 prepareAuthoredHuman(asset){
  const required=['idle','walk','run','chase','alert','clerk','panic','ride','carry','carry_left','carry_right','crouch'],clips=new Map(asset.animations.map(clip=>[clip.name,clip]));
  const roles=['role_police','role_cashier','role_rider'];
  if(required.some(name=>!clips.has(name))||roles.some(name=>!asset.scene.getObjectByName(name)))throw new Error('Authored human is missing required clips or role meshes');
  const min=asset.definition.bounds?.min?.[1]||0,max=asset.definition.bounds?.max?.[1]||2.293;
  return {scene:asset.scene,clips,scale:1,min,roles};
 }
 attachAuthoredHuman(person){
  if(person.authored||!this.authoredHumanTemplate)return person.authored||null;
  const template=this.authoredHumanTemplate,scene=cloneSkeleton(template.scene);scene.name=`human_refreshed_${person.role}_${person.index}`;scene.scale.setScalar(template.scale);scene.position.y=-template.min*template.scale;
  const clothes=['#d98373','#d6b85a','#6ca7a1','#778bc7','#b978a0','#8ba55c'],skins=['#c9916e','#d4a27d','#b67f60','#dfb28c'],materialClones=new Map();
  scene.traverse(object=>{
   if(object.isSkinnedMesh)object.frustumCulled=false;
   if(object.isMesh&&object.material){
    const cloneMaterial=material=>{if(!materialClones.has(material))materialClones.set(material,material.clone());return materialClones.get(material);};
    object.material=Array.isArray(object.material)?object.material.map(cloneMaterial):cloneMaterial(object.material);
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
     if(material.name==='clothes')material.color.set(person.role==='police'?'#bfdce7':person.role==='cashier'?'#fff3dc':clothes[person.index%clothes.length]);
     if(material.name==='skin')material.color.set(skins[person.index%skins.length]);
    }
   }
  });
  for(const role of template.roles){const group=scene.getObjectByName(role);group.visible=role===`role_${person.role}`;}
  const shortHair=scene.getObjectByName('hair_short'),bobHair=scene.getObjectByName('hair_bob');
  const covered=person.role==='police'||person.role==='rider';
  if(shortHair)shortHair.visible=!covered&&(person.role==='cashier'||person.index%2!==0);if(bobHair)bobHair.visible=!covered&&person.role==='pedestrian'&&person.index%2===0;
  const mixer=new THREE.AnimationMixer(scene),actions=Object.fromEntries([...template.clips].map(([name,clip])=>[name,mixer.clipAction(clip)]));
  person.root.add(scene);person.authored={scene,mixer,actions,materials:[...materialClones.values()],clip:null};this.applyHumanRigModelSet(person,this.effectiveModelSet||'original');
  return person.authored;
 }
 updateAuthoredHuman(person,clip='idle',phase=0,frozen=false){
  const rig=person.authored;if(!rig||this.effectiveModelSet!=='refreshed')return;
  const action=rig.actions[clip]||rig.actions.idle;
  if(rig.clip!==clip){rig.mixer.stopAllAction();action.reset().setLoop(THREE.LoopRepeat,Infinity).play();rig.clip=clip;}
  const duration=action.getClip().duration||1,normal=((phase%TAU)+TAU)%TAU/TAU;action.time=normal*duration;rig.mixer.update(0);rig.scene.visible=!frozen||rig.scene.visible;
 }
 prepareAuthoredHero(asset){
  const hand=asset.scene.getObjectByName('socket_carry_R'),leftHand=asset.scene.getObjectByName('socket_carry_L'),leftFoot=asset.scene.getObjectByName('foot_L'),rightFoot=asset.scene.getObjectByName('foot_R'),hat=asset.scene.getObjectByName('18bro_hat'),hatSocket=asset.scene.getObjectByName('socket_hat'),backSocket=asset.scene.getObjectByName('socket_back'),hips=asset.scene.getObjectByName('hips');
  const clips=new Map(asset.animations.map(clip=>[clip.name,clip]));
  if(HERO_CLIPS.some(name=>!clips.has(name))||!hand||!leftHand||!leftFoot||!rightFoot||!hat||!hatSocket||!backSocket||!hips)throw new Error('Authored hero is missing required clips, mesh or sockets');
  const root=new THREE.Group();root.name='18bro_refreshed';root.visible=false;root.add(asset.scene);
  // Match the original 2.4-unit silhouette using the exported glTF Y-up bounds.
  const min=asset.definition.bounds?.min?.[1]||0,max=asset.definition.bounds?.max?.[1]||2.736;
  const scale=2.4/(max-min);asset.scene.scale.setScalar(scale);asset.scene.position.y=-min*scale;
  const mixer=new THREE.AnimationMixer(asset.scene),actions=Object.fromEntries(HERO_CLIPS.map(name=>[name,mixer.clipAction(clips.get(name))])),furMaterials=[];
  asset.scene.traverse(object=>{
   // Skinned bounds can differ between clips; this one small hero is always relevant.
   if(object.isSkinnedMesh)object.frustumCulled=false;
   for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
    if(material.name==='fur')furMaterials.push({material,map:material.map});
   }
  });
  const hats=new Map();for(const kind of ['beanie','sombrero','bucket','crown']){const accessory=this.makeHat(kind);accessory.position.set(0,0,0);accessory.scale.setScalar(1/scale);accessory.visible=false;hatSocket.add(accessory);hats.set(kind,accessory);}
  // These attachments outlive procedural cat rebuilds, so they must own their
  // geometry instead of cloning references that cosmetic changes later dispose.
  const jetpack=this.makeJetpack();jetpack.position.set(0,0,0);jetpack.rotation.set(0,0,0);jetpack.scale.setScalar(.8/scale);backSocket.add(jetpack);const jetFlames=jetpack.getObjectByName('jet_flames');
  const shield=this.makeShield();shield.position.y=1.05;root.add(shield);
  asset.scene.updateMatrixWorld(true);
  const cloneWearable=(name,parent,rotationZ=0)=>{const source=this.authoredPowerupTemplate?.wearables.get(name);if(!source)throw new Error(`Authored hero cannot attach ${name}`);const wearable=source.clone(true);wearable.name=`18bro_${name}`;wearable.position.set(0,0,0);wearable.scale.setScalar(1);const sceneQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion();asset.scene.getWorldQuaternion(sceneQ);parent.getWorldQuaternion(parentQ);wearable.quaternion.copy(sceneQ.invert().multiply(parentQ).invert());if(rotationZ)wearable.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),rotationZ));wearable.visible=false;parent.add(wearable);return wearable;};
  const magnet=cloneWearable('wearable_magnet',leftHand,.9),moonBootL=cloneWearable('wearable_moon_L',leftFoot),moonBootR=cloneWearable('wearable_moon_R',rightFoot);
  return {root,asset,mixer,actions,hand,leftHand,leftFoot,rightFoot,hat,hatSocket,backSocket,hats,jetpack,jetFlames,shield,magnet,moonBoots:[moonBootL,moonBootR],hips,furMaterials,assetScale:scale,clip:null,packet:null,packetSource:null,look:null};
 }
 restoreOriginalHero(){
  if(this._hiddenHeroMeshes){for(const [object,visible] of this._hiddenHeroMeshes)object.visible=visible;this._hiddenHeroMeshes=null;}
 }
 updateAuthoredHero(game,dt,{skin='18bro',fur='black',hat='cap',menu=false,reducedMotion=false}={}){
  this.restoreOriginalHero();
  const hero=this.authoredHero,state=game.state||'MAIN_MENU',paused=state==='PAUSED';
  const poseState=menu?'MAIN_MENU':paused?(game._beforePause||this._modelLastState):state;
  if(!paused)this._modelLastState=poseState;
  if(hero)hero.root.visible=false;
  this.effectiveModelSet='original';
  if(this.modelSetPreference!=='refreshed'||!hero)return;
  this.modelSetReason='';this.effectiveModelSet='refreshed';hero.root.visible=true;
  hero.root.position.copy(this.cat.root.position);hero.root.quaternion.copy(this.cat.root.quaternion);hero.root.scale.copy(this.cat.root.scale);
  if(poseState==='CAUGHT'||poseState==='GAME_OVER'){hero.root.position.y+=this.cat.body.position.y;hero.root.rotateX(this.cat.body.rotation.x);}
  const look=`${fur}:${hat}`;
  if(hero.look!==look){
   const coat=FURS.find(item=>item.id===fur)||FURS[0];
   for(const {material,map} of hero.furMaterials){
    const nextMap=fur==='black'||!coat?map:null;
    if(material.map!==nextMap){material.map=nextMap;material.needsUpdate=true;}
    material.color.set(nextMap?0xffffff:coat.color);
   }
   hero.hat.visible=hat==='cap';for(const [kind,accessory] of hero.hats)accessory.visible=hat===kind;hero.look=look;
  }
  const selection=selectHeroAnimation(game,{menu,previousState:this._modelLastState,reducedMotion});
  const clip=selection.clip;
  if(hero.clip!==clip){
   const previous=hero.clip?hero.actions[hero.clip]:null,next=hero.actions[clip];
   next.reset().setLoop(selection.loop?THREE.LoopRepeat:THREE.LoopOnce,selection.loop?Infinity:1);next.clampWhenFinished=!selection.loop;next.setEffectiveWeight(1).play();
   if(previous&&previous!==next)next.crossFadeFrom(previous,selection.blend,false);hero.clip=clip;
  }
  const action=hero.actions[clip];action.setEffectiveTimeScale(selection.rate);
  if(selection.sample!==null){hero.mixer.update(selection.frozen?0:Math.max(0,Math.min(dt,.05)));action.time=selection.sample*action.getClip().duration;hero.mixer.update(0);}
  else hero.mixer.update(selection.frozen?0:Math.max(0,Math.min(dt,.05)));
  if(hero.packetSource!==this.cat.bag){
   hero.packet?.removeFromParent();hero.packet=this.cat.bag.clone(true);hero.packet.name='18bro_refreshed_packet';
   hero.hand.add(hero.packet);hero.packet.position.set(0,0,0);hero.packet.rotation.set(0,0,-.12);hero.packet.scale.setScalar(1/hero.assetScale);hero.packetSource=this.cat.bag;
  }
  hero.packet.visible=this.cat.bag.visible;
  hero.jetpack.visible=this.cat.jetpack.visible;if(hero.jetFlames){hero.jetFlames.visible=hero.jetpack.visible;hero.jetFlames.scale.copy(this.cat.jetpack.userData.flames.scale);hero.jetFlames.children.forEach((plume,index)=>plume.rotation.copy(this.cat.jetpack.userData.flames.children[index]?.rotation||new THREE.Euler()));}hero.shield.visible=this.cat.shield.visible;hero.magnet.visible=this.cat.magnet.visible;hero.moonBoots.forEach(boot=>boot.visible=this.cat.moonBoots.some(item=>item.visible));
  this._hiddenHeroMeshes=[];
  this.cat.root.traverse(object=>{if(object.isMesh){this._hiddenHeroMeshes.push([object,object.visible]);object.visible=false;}});
 }
 disposeCharacterModels(){
  this._modelDisposed=true;this._modelGeneration=(this._modelGeneration||0)+1;this.restoreOriginalHero();
  const hero=this.authoredHero;
  if(hero){hero.mixer.stopAllAction();hero.mixer.uncacheRoot(hero.asset.scene);hero.root.removeFromParent();hero.asset.dispose();this.authoredHero=null;}
  for(const person of this.humanRigs||[]){const rig=person.authored;if(!rig)continue;rig.mixer.stopAllAction();rig.mixer.uncacheRoot(rig.scene);for(const material of rig.materials||[])material.dispose();rig.scene.removeFromParent();person.authored=null;}
  this.authoredHumanAsset?.dispose();this.authoredHumanAsset=null;this.authoredHumanTemplate=null;
  this.authoredPowerupAsset?.dispose();this.authoredPowerupAsset=null;this.authoredPowerupTemplate=null;
  this.characterAssets?.dispose();for(const material of this._refreshedHumanMaterials?.values()||[])material.dispose();this._refreshedHumanMaterials?.clear();this.effectiveModelSet='original';
 }
 mat(color,extra={}){
  const m=new THREE.MeshLambertMaterial({color,flatShading:true,...extra});
  if(m.map && extra.emissive) m.emissiveMap=m.map;
  m.onBeforeCompile=(shader)=>{
   shader.uniforms.retroResolution=this.snapUniform;
   shader.uniforms.retroWobble=this.wobbleUniform;
   // Diffuse, emissive and alpha maps all retain the same perspective-correct
   // coordinates. Independent affine sampling made neon lettering double and
   // large road/wall triangles fold as the camera passed their vertices.
   shader.vertexShader='uniform vec2 retroResolution;\nuniform float retroWobble;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>\nif(gl_Position.w>0.08){\n vec2 snapGrid=retroResolution*0.5;\n vec2 rawNdc=gl_Position.xy/gl_Position.w;\n float amount=${m.map?'0.0':'0.12'}*smoothstep(25.0,75.0,gl_Position.w)*retroWobble;\n gl_Position.xy=mix(rawNdc,floor(rawNdc*snapGrid+0.5)/snapGrid,amount)*gl_Position.w;\n}`);
   // Ordered colour quantization is applied in display space, after fog. No blur,
   // modern bloom, temporal noise, shadow maps or reflective material pipeline.
   shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>\nvec2 dp=mod(floor(gl_FragCoord.xy),4.0);\nfloat b0=mod(dp.x,2.0)*2.0+mod(dp.y,2.0)*3.0;\nfloat b1=floor(dp.x/2.0)*2.0+floor(dp.y/2.0)*3.0;\nfloat ordered=(mod(b0,4.0)*4.0+mod(b1,4.0))/16.0-0.5;\ngl_FragColor.rgb=clamp(floor(gl_FragColor.rgb*31.0+ordered+0.5)/31.0,0.0,1.0);`);
  };
  m.customProgramCacheKey=()=>`psx-stable-surfaces-v2-${m.map?'map':'solid'}`;this.materials.push(m);return m;
 }
 makeMaterials(){
  const r=seeded(18),m=this.m={};
  const color=(name,v,extra={})=>m[name]=this.mat(v,extra);
  color('asphalt',0xa0a2b4,{map:texture((c,w,h)=>{c.fillStyle='#363940';c.fillRect(0,0,w,h);for(let i=0;i<3500;i++){c.fillStyle=['#515259','#252b35','#49454b','#65605a'][i%4];c.fillRect(r()*w,r()*h,r()*3+1,1)}c.strokeStyle='#242a32';c.lineWidth=1;for(let j=0;j<5;j++){c.beginPath();c.moveTo(r()*w,0);c.lineTo(r()*w,h/2);c.lineTo(r()*w,h);c.stroke()}},128)});
  color('concrete',0x818182);color('curb',0xa19b8f);color('white',0xe7e1cf);color('yellow',0xf8bb32);color('black',0x13151a);color('metal',0x687580);color('orange',0xf07829);color('wood',0x966139);color('green',0x128b54);color('red',0xca3032);color('blue',0x2e6190);color('skin',0xc89975);
  color('tire',0x111518);color('glass',0x254750);color('carGlass',0x040609);color('police',0x7eacbf);color('policeDark',0x1e3346);color('eye',0xe5e0d6);color('pupil',0x090c10);color('earRed',0xb52f3e);color('earGreen',0x126148);color('capGreen',0x145740);color('gold',0xe3b64b);color('brow',0x45474c,{flatShading:false});
  color('carPearl',0xcfdce0,{flatShading:false});color('carJade',0x439b94,{flatShading:false});color('carBlue',0x254b85,{flatShading:false});color('skyGlass',0x223e52);color('skyTrim',0x1a7891,{emissive:0x123f58,emissiveIntensity:.4});
  color('cyan',0x36cdd1,{emissive:0x136a83,emissiveIntensity:.45});color('lamp',0xffeabb,{emissive:0xffe1a5,emissiveIntensity:1.2});color('siren',0xee322d,{emissive:0xa41110,emissiveIntensity:.7});color('lantern',0xf65327,{emissive:0xd62208,emissiveIntensity:.45});color('neonPink',0xf053b0,{emissive:0xb5218a,emissiveIntensity:.6});
  m.wall=[0xa6a794,0x738f89,0xa88e7d,0xb7aa8c,0xa2ada4].map(v=>this.mat(v));
  const signs=[['香港','#ffdec4','#d52e23'],['十八','#daffad','#17894d'],['茶餐廳','#fff4b2','#cd3334'],['霓虹','#ffd4f2','#b81b79'],['電器','#c7ffff','#078893'],['藥房','#fff6be','#287236'],['好味','#ffd984','#a91625'],['旺角','#fff7c5','#cc6415'],['金記','#ffed79','#bb1f2c'],['士多','#ffedd5','#205fb4']];
  m.signs=signs.map(([txt,fg,bg],i)=>this.mat(0xffffff,{emissive:0xffffff,emissiveIntensity:.85,map:texture((c,w,h)=>{c.fillStyle='#19241d';c.fillRect(0,0,w,h);c.fillStyle=bg;c.fillRect(4,3,w-8,h-6);c.strokeStyle=fg;c.lineWidth=3;c.strokeRect(9,9,w-18,h-18);if(i%3===0){c.strokeRect(15,15,w-30,h-30);for(let y=22;y<h-15;y+=16){c.fillStyle=fg;c.fillRect(5,y,3,3);c.fillRect(w-8,y,3,3);}}if(i%3===1){c.fillStyle=fg;c.beginPath();c.arc(w/2,25,10,0,Math.PI*2);c.fill();c.fillRect(w/2-18,h-25,36,3);}[...txt].forEach((s,i)=>pixelText(c,s,w/2,28+(i+.5)*(h-56)/txt.length,50,fg));},128,256),side:THREE.DoubleSide}));
  const shopNames=[['金記茶餐廳','KAM KEE CAFE','#b62e24','#ffecca'],['新鮮生果','FRESH FRUIT','#2b894a','#fffba8'],['永安藥房','WING ON PHARMACY','#f6eee0','#d62822'],['添記麵家','TIM KEE NOODLES','#edc33a','#a02a20'],['旺角電器','MONG KOK ELECTRONICS','#2361a0','#e1f5ff'],['時裝服飾','FASHION & TAILOR','#cf637e','#fff4cf'],['榮華餅家','WING WAH BAKERY','#883334','#f9d888'],['海味雜貨','GROCERY & DRIED GOODS','#447a76','#f6e9c3'],['霓虹遊戲','NEON ARCADE','#5d348e','#8de8ff'],['手打檸檬茶','LEMON TEA','#ebd442','#183c3d'],['花墟鮮花','FLOWER MARKET','#944a75','#ffe4eb'],['上海理髮','SHANGHAI BARBER','#225f74','#f5eded']];
  shopNames.push(['生猛海鮮','LIVE SEAFOOD','#1b7c91','#e7f8ef'],['潮州滷味','CHIU CHOW DELI','#a73924','#ffeabd'],['蒸籠點心','DIM SUM','#b88136','#fff0c8'],['有機蔬菜','FRESH GREENS','#387947','#f8f0b3']);
  m.fascias=shopNames.map(([a,b,bg,fg])=>this.mat(0xffffff,{emissive:0xffffff,emissiveIntensity:.45,map:texture((c,w,h)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.strokeStyle=fg;c.lineWidth=3;c.strokeRect(3,3,w-6,h-6);pixelText(c,a,w/2,24,31,fg);pixelText(c,b,w/2,51,10,fg)},256,64)}));
  m.shops=shopNames.map(()=>m.glass);
  m.shop=m.shops[0];m.shelf=m.shops[7];
  m.banners=Array.from({length:14},(_,i)=>this.mat(0xffffff,{side:THREE.DoubleSide,emissive:0xffffff,emissiveIntensity:.3,map:texture((c,w,h)=>{c.fillStyle=['#ba2c25','#187269','#273c74','#d8a63c','#a5396c'][i%5];c.fillRect(0,0,w,h);c.strokeStyle='#f9e7b0';c.lineWidth=5;c.strokeRect(8,8,w-16,h-16);if(i%3===0){c.strokeRect(14,14,w-28,h-28);for(let x=25;x<w-20;x+=26){c.fillStyle='#ffdb82';c.fillRect(x,3,4,4);c.fillRect(x,h-7,4,4);}}else if(i%3===1){for(const x of [35,w-35]){c.fillStyle='#f7d35d';c.beginPath();c.arc(x,h/2,19,0,Math.PI*2);c.fill();c.fillStyle='#923b32';c.fillRect(x-4,h/2-7,8,14);}}else{c.fillStyle='#f6cb70';for(let x=0;x<w;x+=28){c.beginPath();c.moveTo(x,0);c.lineTo(x+16,0);c.lineTo(x+8,8);c.closePath();c.fill();}}pixelText(c,['夜市美食','生猛海鮮','歡迎光臨','旺角夜市','龍鳳茶樓','新鮮生果','香港製造','手工點心','十八士多','霓虹大道','金龍冰室','深夜食堂','廟街好味','街坊市集'][i],w/2,h*.4,38,'#fff4d7');pixelText(c,['TEMPLE STREET','FRESH SEAFOOD','WELCOME TO HONG KONG','MONG KOK NIGHT MARKET','TEA & DIM SUM','FRESH FRUIT DAILY','MADE IN HONG KONG','BAMBOO STEAMERS','OPEN ALL NIGHT','NEON NIGHTS','GOLDEN DRAGON CAFE','MIDNIGHT KITCHEN','TASTE OF TEMPLE STREET','NEIGHBOURHOOD MARKET'][i],w/2,h*.76,14,'#ffe1a0');},512,128)}));
  const seven=(c,w,h,hat=false)=>{c.fillStyle='#f5f0df';c.fillRect(0,0,w,h);if(!hat){for(const [i,col]of ['#f47419','#03bc53','#ea172c'].entries()){c.fillStyle=col;c.fillRect(0,10+i*22,w*.34,12);c.fillRect(w*.66,10+i*22,w*.34,12);}}c.fillStyle='#ef771e';c.fillRect(w*.41,h*.16,w*.19,h*.13);pixelText(c,'7',w*.51,h*.44,h*.7,'#df192a');c.fillStyle='#f5f0df';c.fillRect(w*.35,h*.56,w*.3,h*.18);pixelText(c,'ELEVEN',w*.5,h*.64,h*.15,'#126d42');};
  m.capLabel=this.mat(0xffffff,{map:texture((c,w,h)=>seven(c,w,h,true),256,256),flatShading:false});m.cap=this.mat(0xefeddf,{flatShading:false});
  m.chip=this.mat(0xe7bf53);m.chipEdge=this.mat(0xbc852f);m.chipLight=this.mat(0xffdc84);
  m.posters=Array.from({length:4},(_,k)=>this.mat(0xffffff,{map:texture((c,w,h)=>{c.fillStyle=['#f4efba','#d14d38','#157956','#445e98'][k];c.fillRect(0,0,w,h);pixelText(c,['特價','新到','雪糕','優惠'][k],w/2,25,22,k?'#fff1cc':'#bc3328');pixelText(c,['$18','$9.9','18','$7'][k],w/2,60,29,k?'#fff1cc':'#176944');c.fillStyle='#f5e9b3';c.fillRect(6,84,w-12,6);c.fillRect(6,98,w-22,4)},64,128)}));
  m.taxiLabel=this.mat(0xffffff,{map:texture((c,w,h)=>{c.fillStyle='#f4e9c9';c.fillRect(0,0,w,h);pixelText(c,'TAXI',w/2,h/2,22,'#b52924')},128,32)});
  m.shirt=[0xbb5638,0xcfb15d,0x437f8c,0x5466a2,0xd0798b,0x79994c].map(v=>this.mat(v));m.pants=[0x273b4b,0x5f574a,0x455e5c].map(v=>this.mat(v));m.complexions=[0xbf906c,0xc89974,0xd7ab84,0xb18163].map(v=>this.mat(v));
 }
 boxMesh(parent,mat,x,y,z,sx,sy,sz,rz=0){const a=new THREE.Mesh(this.box,mat);a.position.set(x,y,z);a.scale.set(sx,sy,sz);a.rotation.z=rz;parent.add(a);return a;}
 batchStatic(parent){const b=new Batch();for(const mesh of [...parent.children])if(mesh.isMesh&&!Array.isArray(mesh.material)){b.add(mesh.geometry,mesh.material,...mesh.position.toArray(),...mesh.scale.toArray(),mesh.rotation.x,mesh.rotation.y,mesh.rotation.z);parent.remove(mesh);}const group=b.group();parent.add(...[...group.children]);}
 sidewalkTileGeometry(column,row){
  // Each of the six source slabs maps to one square metre. UV boundaries follow
  // grout centers, so neighboring tiles share a seam without stretching an atlas.
  const xs=[29,630,1230],ys=[22,423,815,1215],g=new THREE.PlaneGeometry(1,1),uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++){
    const u=uv.getX(i),v=uv.getY(i);
    uv.setXY(i,(xs[column]+u*(xs[column+1]-xs[column]))/1254,1-(ys[row]+v*(ys[row+1]-ys[row]))/1254);
  }
  return g;
 }
 makeChunk(index){
  const rand=seeded(924+index*431),b=new Batch(),infill=new Batch(),m=this.m,box=(mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>(filling?infill:b).add(this.box,mat,x,y,z,sx,sy,sz,rx,ry,rz);let filling=false;
  box(m.asphalt,0,-.18,-15,8.4,.28,30);
  const pavementTiles=Array.from({length:6},(_,i)=>this.sidewalkTileGeometry(i%2,Math.floor(i/2)));
  for(const side of [-1,1]){
    box(m.curb,side*5.65,-.06,-15,3.1,.34,30);
    for(let col=0;col<3;col++)for(let row=0;row<30;row++){
      const x=(side<0?-7.2:4.2)+col+.5,z=-row-.5;
      b.add(pavementTiles[(row%3)*2+col%2],m.sidewalk,x,.113,z,1,1,1,-Math.PI/2);
    }
  }
  pavementTiles.forEach(g=>g.dispose());
  // Flush with the asphalt, against the curb; one inlet on selected blocks only.
  if(index%3===0){const side=index%2?1:-1,z=-11;
    box(m.metal,side*3.89,-.035,z,.4,.012,.72);
    for(let a=0;a<5;a++)box(m.black,side*3.89,-.028,z-.28+a*.14,.3,.004,.045);
  }
  if(index===2||index===5){const z=-21;
    b.add(this.cylinder,m.metal,0,-.036,z,.8,.014,.8);
    for(let q=-.25;q<=.25;q+=.125)box(m.black,0,-.027,z+q,.55,.003,.028);
  }
  for(const side of [-1,1]){
   for(let n=0;n<4;n++){
    filling=index===6&&side<0&&(n===1||n===2); // Reserve these modeled bays for after the store passes.
    const z=-3.75-n*7.5,h=15+rand()*15,w=5+rand()*3,kind=(index*3+n+(side>0?2:0))%m.shops.length,face=7.25;
    box(m.wall[(n+index+(side>0?1:0))%m.wall.length],side*(face+w/2),h/2,z,w,h,7.52);
    box(m.black,side*(face-.06),2.04,z,.18,4.15,7.2);
    box(m.glass,side*(face-.17),1.65,z,.04,2.8,6.3);
    for(const zz of [-2.1,0,2.1])box(m.metal,side*(face-.2),1.65,z+zz,.07,2.8,.065);
    box(m.white,side*(face-.22),.38,z,.09,.09,6.35);
    (filling?infill:b).add(this.plane,m.fascias[kind],side*(face-.6),3.47,z,7,.76,1,0,side<0?Math.PI/2:-Math.PI/2,0);
    box([m.red,m.green,m.yellow,m.blue][kind%4],side*(face-.67),3.0,z,1.1,.14,7.1,0,0,side*.13);
    const canopy=[m.red,m.green,m.yellow,m.blue,m.capGreen,m.neonPink][(kind+index)%6],pattern=(kind+index)%4;
    box(canopy,side*(face-.67),3.012,z,1.12,.15,7.12,0,0,side*.13);
    for(let a=0;a<14;a++){
      const zz=z-3.25+a*.5,trim=pattern===0?canopy:pattern===1?(a%2?canopy:m.white):pattern===2?(a%3?canopy:m.yellow):(a%2?m.white:canopy);
      if(pattern===1||pattern===2)box(trim,side*(face-.67),3.097,zz,1.13,.018,.24,0,0,side*.13);
      if(pattern===3)for(let q=0;q<3;q++)box((a+q)%2?canopy:m.white,side*(face-.25-q*.35),3.055+q*.045,zz,.34,.015,.24);
      box(trim,side*(face-1.22),2.87,zz,.045,.24,.47);
      if(pattern===2)(filling?infill:b).add(this.sphere,trim,side*(face-1.22),2.75,zz,.047,.16,.47);
    }
    box(m.lamp,side*(face-.26),2.92,z,.1,.07,5.8);
    if((n+index+(side>0?1:0))%3===0){
      const display=filling?infill:b,front=side*(face-.36);
      for(const y of [.75,1.48]){
        box(m.wood,front,y,z,.37,.055,5.7);
        for(let item=0;item<7;item++){
          const zz=z-2.5+item*.8;
          if(kind%3===0){display.add(this.sphere,m.chipLight,front,y+.17,zz,.24,.25,.48);box(m.white,front,y+.03,zz,.32,.03,.59);}
          else if(kind%3===1){box([m.green,m.red,m.yellow][item%3],front,y+.23,zz,.2,.38,.29);box(m.white,front-side*.11,y+.24,zz,.012,.1,.18);}
          else {box(m.black,front,y+.26,zz,.11,.43,.3);box([m.cyan,m.neonPink,m.blue][item%3],front-side*.063,y+.26,zz,.013,.34,.23);}
        }
      }
    }
    // Grilles, bay windows, AC cages, pipes and ledges give each tenement a different silhouette.
    for(let y=4.8;y<h-2;y+=3.2){for(let a=0;a<2;a++){const zz=z-1.8+a*3.5;box(m.glass,side*(face-.025),y+.28,zz,.065,1.9,2.15);box(m.white,side*(face-.07),y+.28,zz,.09,1.9,.065);box(m.white,side*(face-.07),y+.28,zz,.09,.055,2.15);box(m.concrete,side*(face-.27),y-.9,zz,.8,.12,2.1);box(m.metal,side*(face-.38),y+.1,zz,.53,.62,.88);for(let sl=0;sl<4;sl++)box(m.black,side*(face-.665),y-.12+sl*.12,zz,.025,.025,.69);if((n+a+index)%2===0){box(m.metal,side*(face-.42),y+1.15,zz,.06,.06,2.25);for(let q=0;q<4;q++)box(m.metal,side*(face-.43),y+.81,zz-.9+q*.6,.045,.7,.045);}}box(m.concrete,side*(face-.12),y+1.55,z,.23,.12,7.35);}
    box(m.metal,side*(face-.3),h/2,z+3.35,.11,h,.11);
    const si=(n+index*2+(side>0?3:0))%m.signs.length,signY=5.4+rand()*3;
    box(m.black,side*5.9,signY,z-1.5,1.25,3.2,.24);
    for(const f of [-1,1])(filling?infill:b).add(this.plane,m.signs[si],side*5.9,signY,z-1.5+f*.13,1.2,3.13,1,0,f<0?Math.PI:0,0);
    box(m.metal,side*6.55,signY+1.5,z-1.5,1.6,.09,.09);
    const glow=[m.cyan,m.neonPink,m.gold][(index+n)%3];
    for(const edge of [-1,1]){box(glow,side*5.9+edge*.64,signY,z-1.35,.045,3.22,.04);box(glow,side*5.9,signY+edge*1.61,z-1.35,1.3,.045,.04);}
    if((n+index)%3===0){box(m.black,side*5.9,signY-1.91,z-1.5,1.5,.39,.18);for(let j=0;j<5;j++)box(glow,side*5.9-.5+j*.25,signY-1.91,z-1.39,.12,.09,.035);}

    // Shop-specific street displays: fruit, food steamers, clothes racks or boxes of goods.
    const vx=side*5.95,vz=z+.9;
    if(kind>=12){this.marketStall(filling?infill:b,kind,vx,vz);}
    else
    if(kind===1||kind===3||kind===6||n===index%4){
      box(m.wood,vx,.61,vz,1.2,1.12,2.3);box(m.metal,vx,1.2,vz,1.4,.12,2.5);
      box([m.red,m.green,m.yellow][kind%3],vx,2.48,vz,2,.11,2.8,0,0,side*.08);
      for(const q of [-1,1])box(m.metal,vx+side*.55,1.8,vz+q*1.17,.055,1.6,.055);
      box(m.lamp,vx,2.34,vz,.06,.06,1.8);
      if(kind%2){for(let q=0;q<4;q++)for(let a=0;a<3;a++)(filling?infill:b).add(this.sphere,[m.yellow,m.orange,m.green][(a+q)%3],vx-.4+a*.33,1.37,vz-.78+q*.5,.29,.27,.3);}
      else{for(let q of [-.65,.1,.65]){(filling?infill:b).add(this.cylinder,m.metal,vx,1.45,vz+q,.6,.45,.6);(filling?infill:b).add(this.cone,m.white,vx,1.76,vz+q,.57,.14,.57);}}
    }else if(kind===5){box(m.metal,vx,2.1,vz,.045,.045,2.5);for(let a=0;a<5;a++){box(m.shirt[a%6],vx,1.6,vz-.9+a*.43,.3,.8,.35);box(m.shirt[a%6],vx,1.9,vz-.9+a*.43,.2,.22,.55);}}
    if(kind===8){for(let a=0;a<3;a++){box(m.policeDark,side*6.8,.8,z-1.6+a*1.5,.65,1.6,.85);box(m.neonPink,side*6.44,1.3,z-1.6+a*1.5,.045,.5,.65);box(m.cyan,side*6.4,.96,z-1.6+a*1.5,.1,.1,.72);}}
    if(kind===9){box(m.white,side*6.7,1.0,z,.7,1.7,4.3);for(let a=0;a<7;a++)(filling?infill:b).add(this.cylinder,m.yellow,side*6.65,1.96,z-1.5+a*.5,.17,.25,.17);}
    if(kind===10){for(let a=0;a<5;a++){(filling?infill:b).add(this.cylinder,m.wood,side*6.5,.4,z-1.5+a*.75,.45,.65,.45);box(m.green,side*6.5,.97,z-1.5+a*.75,.06,.8,.06);for(let q=0;q<3;q++)(filling?infill:b).add(this.sphere,q%2?m.neonPink:m.yellow,side*(6.5+(q-1)*.13),1.3+q*.06,z-1.5+a*.75,.3,.3,.3);}}
    if(kind===11){for(let a=0;a<8;a++)(filling?infill:b).add(this.cylinder,a%3===0?m.red:a%3===1?m.white:m.blue,side*6.7,1.8+a*.1,z+2.8,.25,.1,.25);}
    box(m.concrete,side*(face+1),h+.25,z,2.2,.5,2.8);(filling?infill:b).add(this.cylinder,m.metal,side*(face+1),h+1.2,z,1.6,1.5,1.6);
   }
   filling=false;
   for(let z=-5;z>-30;z-=15){box(m.metal,side*4.12,2.8,z,.1,5.6,.1);box(m.metal,side*3.82,5.55,z,.7,.08,.1);box(m.lamp,side*3.51,5.47,z,.55,.13,.3);}
   // A parked scooter lives off the road, next to a vendor rather than repeating at every shop.
   if(!(index===6&&side<0)){const zz=-6-index*2;box(m.blue,side*6.84,.82,zz,.55,.5,1);for(let z of [-.6,.6])b.add(this.cylinder,m.tire,side*6.84,.33,zz+z,.61,.14,.61,0,0,Math.PI/2);box(m.black,side*6.84,1.11,zz-.2,.5,.14,.65);box(m.metal,side*6.84,1.4,zz+.6,.65,.04,.04);}
  }
  // Warm lanterns and signs suspended between the old buildings.
  for(let z=-8;z>-30;z-=15){box(m.black,0,7.2,z,14,.035,.045);for(let x=-4;x<=4;x+=2){b.add(this.sphere,m.lantern,x,6.85,z,.49,.62,.49);b.add(this.cylinder,m.gold,x,6.49,z,.1,.16,.1);}}
  if(index%3!==1){box(m.metal,0,6.5,-22,10,.07,.08);for(let f of [-1,1])b.add(this.plane,m.banners[(index*2)%m.banners.length],0,5.65,-22+f*.05,7.1,1.5,1,0,f<0?Math.PI:0,0);}
  if(index%2===1){
    box(m.metal,0,8.9,-5,9,.055,.055);
    for(const x of [-2.35,2.35])box(m.metal,x,8.35,-5,.035,1.1,.035);
    box(m.black,0,7.85,-5,5.15,1.17,.12);
    for(const f of [-1,1])b.add(this.plane,m.banners[(index*2+1)%m.banners.length],0,7.85,-5+f*.07,5.06,1.08,1,0,f<0?Math.PI:0,0);
  }
  if(index%3===1){for(let j=0;j<9;j++){const flag=new THREE.Shape();flag.moveTo(-.35,0);flag.lineTo(.35,0);flag.lineTo(0,-.72);flag.closePath();b.add(new THREE.ShapeGeometry(flag),[m.red,m.yellow,m.cyan,m.neonPink][j%4],-4+j,6.5,-12,1,1,1);}}
  for(let z=-2;z>-30;z-=10){box(m.black,0,11,z,15,.025,.035,0,0,.015);box(m.black,0,10.7,z+.3,15,.025,.035,0,0,-.02);}
  const root=b.group();if(index===6){this.storeInfill=infill.group();root.add(this.storeInfill);this.storeInfill.visible=false;}return {root,index};
 }
 makeSkyline(){
  const b=new Batch(),rand=seeded(1877),m=this.m;for(let i=0;i<38;i++){const x=(rand()-.5)*160,z=-72-rand()*50,h=26+rand()*40,w=3+rand()*5;b.add(this.box,m.skyGlass,x,h/2,z,w,h,w*.8);for(const s of [-1,1])b.add(this.box,m.skyTrim,x+s*w*.45,h/2,z+w*.41,.075,h,.08);for(let y=6;y<h;y+=6)b.add(this.box,m.skyTrim,x,y,z+w*.42,w,.035,.035);if(i%3===0){b.add(this.box,m.skyGlass,x,h+2,z,w*.7,4,w*.6);b.add(this.cylinder,m.skyTrim,x,h+7,z,.15,10,.15);for(let y=10;y<h-6;y+=9)b.add(this.box,m.skyTrim,x,y,z+w*.44,w*1.3,.1,.1,0,0,i%2?.63:-.63);}}return b.group();
 }
 ellipsoid(parent,mat,x,y,z,sx,sy,sz){const mesh=new THREE.Mesh(this.sphere,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;}
 makeCat(skin,look={}){
  const root=new THREE.Group(),body=new THREE.Group(),m=this.m;root.add(body);
  const fur=FURS.find(f=>f.id===look.fur);
  this.furMaterials??=new Map();if(fur&&!this.furMaterials.has(fur.id))this.furMaterials.set(fur.id,new THREE.MeshLambertMaterial({color:fur.color,flatShading:true}));
  const coat=fur?this.furMaterials.get(fur.id):skin==='gold'?m.gold:skin==='business'?m.concrete:m.black,suit=skin==='police'?m.police:skin==='astronaut'?m.white:skin==='business'?m.white:coat;
  this.ellipsoid(body,suit,0,.65,0,.83,.96,.7);
  const head=new THREE.Group();head.position.set(0,1.4,.04);body.add(head);
  this.ellipsoid(head,coat,0,0,0,1.68,1.34,1.22);this.ellipsoid(head,coat,-.43,-.23,.17,.78,.7,.9);this.ellipsoid(head,coat,.43,-.23,.17,.78,.7,.9);
  for(const side of [-1,1]){
    const ear=new THREE.Group();ear.position.set(side*.54,.28,-.03);ear.rotation.z=-side*.16;head.add(ear);
    const shape=new THREE.Shape();shape.moveTo(-.3,0);shape.quadraticCurveTo(-.34,.06,-.25,.55);shape.quadraticCurveTo(-.2,.76,-.09,.67);shape.lineTo(.29,.13);shape.quadraticCurveTo(.33,0,.19,-.03);shape.closePath();
    // The inset is a scaled copy of the outer ear silhouette, with a broad black rim on every edge.
    const outer=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.045,bevelThickness:.035,curveSegments:7}),coat);if(side>0)outer.scale.x=-1;ear.add(outer);
    const inset=new THREE.Mesh(new THREE.ShapeGeometry(shape,7),side<0?m.earRed:m.earGreen);inset.scale.set(side>0?-.66:.66,.64,1);inset.position.set(side<0?-.015:.015,.085,.174);ear.add(inset);
    this.ellipsoid(head,m.eye,side*.355,-.12,.625,.5,.45,.065);
    this.ellipsoid(head,m.pupil,side*.34,-.065,.665,.245,.285,.025);
    const lid=this.ellipsoid(head,coat,side*.355,.085,.66,.57,.25,.12);lid.rotation.z=-side*.16;
    const brow=this.ellipsoid(head,m.brow,side*.36,.165,.695,.66,.14,.13);brow.rotation.z=-side*.23;
  }
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.5,12,8),m.orange);nose.position.set(0,-.27,.682);nose.scale.set(.24,.17,.19);nose.rotation.z=Math.PI;head.add(nose);
  this.ellipsoid(head,m.pupil,0,-.395,.606,.12,.025,.035);
  const cap=new THREE.Group();cap.position.set(0,.6,-.04);cap.rotation.z=.025;head.add(cap);
  const hatColor=skin==='police'?m.policeDark:m.capGreen;
  const dome=new THREE.Mesh(new THREE.SphereGeometry(.48,20,12,0,TAU,0,1.59),hatColor);dome.scale.set(1.14,.77,1);cap.add(dome);
  const panel=new THREE.Mesh(new THREE.SphereGeometry(.485,12,9,.45,Math.PI-.9,.12,1.36),m.cap);panel.scale.set(1.14,.77,1);cap.add(panel);
  const brimShape=new THREE.Shape();brimShape.moveTo(-.49,.17);brimShape.quadraticCurveTo(-.7,.68,-.45,.83);brimShape.quadraticCurveTo(0,.98,.45,.83);brimShape.quadraticCurveTo(.7,.68,.49,.17);brimShape.quadraticCurveTo(0,.32,-.49,.17);
  const brim=new THREE.Mesh(new THREE.ExtrudeGeometry(brimShape,{depth:.042,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:.023,bevelThickness:.012,curveSegments:10}),hatColor);brim.rotation.x=Math.PI/2;brim.position.y=.03;cap.add(brim);
  // The logo uses a curved decal following the cap surface, with only 1 mm of offset.
  const decalGeo=new THREE.SphereGeometry(.486,28,18,Math.PI/2-.43,.86,.40,.99);
  const label=new THREE.Mesh(decalGeo,m.capLabel);label.scale.set(1.14,.77,1);cap.add(label);
  this.ellipsoid(cap,hatColor,0,.382,0,.12,.06,.12);
  if(look.hat&&look.hat!=='cap'){
   cap.visible=false;const hat=this.makeHat(look.hat);head.add(hat);
  }
  if(skin==='business')this.boxMesh(body,m.red,0,.76,.365,.09,.36,.025);
  if(skin==='ceo'){for(const side of [-1,1])this.boxMesh(head,m.pupil,side*.35,-.05,.7,.55,.25,.05);this.boxMesh(head,m.gold,0,-.01,.725,.22,.025,.025);this.boxMesh(body,m.gold,0,.93,.33,.5,.045,.04);this.ellipsoid(body,m.gold,0,.81,.4,.13,.17,.045);}
  if(skin==='astronaut'){const rim=new THREE.Mesh(new THREE.TorusGeometry(.88,.05,8,24),m.white);rim.position.set(0,1.45,.09);body.add(rim);this.boxMesh(body,m.cyan,0,.68,.37,.33,.22,.04);}
  const legs=[],arms=[];
  for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.24,.4,0);body.add(leg);this.ellipsoid(leg,coat,0,-.13,0,.3,.48,.34);this.ellipsoid(leg,skin==='astronaut'?m.white:coat,0,-.31,.11,.36,.21,.48);legs.push(leg);const arm=new THREE.Group();arm.position.set(side*.45,.96,0);body.add(arm);this.ellipsoid(arm,suit,0,-.2,0,.31,.55,.34);this.ellipsoid(arm,coat,0,-.43,.035,.32,.3,.33);arm.rotation.z=side*.12;arms.push(arm);}
  const tail=new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,.8,10),coat);tail.position.set(.14,.66,-.53);tail.rotation.x=-.75;body.add(tail);
  const bag=new THREE.Group();this.makePacket(bag);bag.position.set(0,-.42,.09);bag.rotation.z=-.12;arms[1].add(bag);
  const magnet=new THREE.Group();magnet.name='magnet_wearable';magnet.position.set(-.03,-.55,.09);magnet.rotation.set(.08,0,.25);arms[0].add(magnet);const magnetArc=new THREE.Mesh(new THREE.TorusGeometry(.22,.07,8,18,Math.PI),m.red);magnetArc.rotation.z=Math.PI/2;magnet.add(magnetArc);for(const side of [-1,1])this.boxMesh(magnet,side<0?m.red:m.cyan,side*.22,.01,0,.13,.16,.14);magnet.visible=false;
  const moonBoots=legs.map((leg,index)=>{const boot=new THREE.Group();boot.name=`moon_boot_${index?'R':'L'}`;boot.position.set(0,-.34,.14);leg.add(boot);this.roundedMesh(boot,m.blue,0,0,0,.48,.3,.56,.08);this.boxMesh(boot,m.cyan,0,.1,.18,.4,.08,.12);this.ellipsoid(boot,m.lamp,0,-.11,.21,.28,.06,.13);boot.visible=false;return boot;});
  const jetpack=this.makeJetpack();jetpack.position.set(0,.85,-.46);jetpack.scale.setScalar(.8);body.add(jetpack);jetpack.visible=false;
  const shield=this.makeShield();root.add(shield);shield.position.y=1.05;
  shield.visible=false;
  return {root,body,head,legs,arms,tail,bag,magnet,moonBoots,jetpack,shield};
 }
 makeShield(){
  const m=this.m,shield=new THREE.Group();shield.name='shield_aura';
  const shieldGlass=this.materials?this.mat(0x51dff1,{transparent:true,opacity:.105,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}):m.cyan.clone();
  shieldGlass.transparent=true;shieldGlass.opacity=.105;shieldGlass.depthWrite=false;shieldGlass.side=THREE.DoubleSide;shieldGlass.blending=THREE.AdditiveBlending;
  const bubble=new THREE.Mesh(new THREE.SphereGeometry(1.02,16,11),shieldGlass);bubble.name='shield_bubble';bubble.scale.set(1,.98,.78);shield.add(bubble);
  for(let i=0;i<6;i++){const regionMaterial=this.materials?this.mat(i%2?0x7cecff:0x6e8cff,{transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}):m.cyan.clone();regionMaterial.color.setHex(i%2?0x7cecff:0x6e8cff);regionMaterial.transparent=true;regionMaterial.opacity=.08;regionMaterial.depthWrite=false;regionMaterial.side=THREE.DoubleSide;regionMaterial.blending=THREE.AdditiveBlending;const region=new THREE.Mesh(new THREE.SphereGeometry(1.035,14,9,i*TAU/6,.82,.25+(i%3)*.62,.55),regionMaterial);region.name=`shield_region_${i}`;region.scale.set(1,.98,.78);region.rotation.z=i*.47;shield.add(region);}
  const heartShape=new THREE.Shape();heartShape.moveTo(0,-.12);heartShape.bezierCurveTo(-.31,-.31,-.45,.03,-.24,.18);heartShape.bezierCurveTo(-.1,.29,0,.18,0,.1);heartShape.bezierCurveTo(0,.18,.1,.29,.24,.18);heartShape.bezierCurveTo(.45,.03,.31,-.31,0,-.12);heartShape.closePath();
  const heartGeo=new THREE.ExtrudeGeometry(heartShape,{depth:.035,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.018,bevelThickness:.012,curveSegments:5});const heartOrbit=new THREE.Group();heartOrbit.name='shield_heart_orbit';shield.add(heartOrbit);
  for(let i=0;i<9;i++){const a=i*TAU/9,heart=new THREE.Group();heart.name=`shield_heart_${i}`;heart.position.set(Math.cos(a)*1.08,Math.sin(a)*.96,Math.sin(a*2)*.13);heart.rotation.y=-a;heart.rotation.z=-a+Math.PI/2;heart.scale.setScalar(.39);heart.add(new THREE.Mesh(heartGeo,m.red));this.ellipsoid(heart,m.white,0,.015,.052,.095,.07,.025);for(let toe=0;toe<4;toe++){const ta=-.72+toe*.48;this.ellipsoid(heart,m.white,Math.sin(ta)*.115,.105+Math.cos(ta)*.05,.052,.038,.045,.021);}heartOrbit.add(heart);}
  shield.visible=false;
  return shield;
 }
 makeHat(kind){
  const g=new THREE.Group(),m=this.m;g.position.set(0,.63,-.04);
  const disc=(mat,r,rt,h,y)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,r,h,16),mat);mesh.position.y=y;g.add(mesh);return mesh;};
  if(kind==='sombrero'){g.position.y=.98;disc(m.yellow,1.1,1.1,.065,0);disc(m.yellow,.5,.17,.66,.34);disc(m.red,.47,.43,.12,.16);for(let i=0;i<16;i++){const a=i*TAU/16;this.ellipsoid(g,i%2?m.red:m.green,Math.cos(a)*.94,.055,Math.sin(a)*.94,.14,.065,.14);}}
  else if(kind==='beanie'){const dome=new THREE.Mesh(new THREE.SphereGeometry(.5,16,10,0,TAU,0,Math.PI/2),m.red);dome.scale.y=.95;g.add(dome);disc(m.red,.54,.54,.14,.03);this.ellipsoid(g,m.white,0,.53,0,.2,.2,.2);}
  else if(kind==='bucket'){disc(m.blue,.77,.72,.07,0);disc(m.blue,.52,.43,.43,.23);disc(m.white,.53,.50,.09,.12);}
  else if(kind==='crown'){disc(m.gold,.5,.5,.18,.07);for(let i=0;i<7;i++){const a=i*TAU/7,spike=new THREE.Mesh(new THREE.ConeGeometry(.16,.36,4),m.gold);spike.position.set(Math.cos(a)*.43,.3,Math.sin(a)*.43);g.add(spike);this.ellipsoid(g,i%2?m.red:m.cyan,Math.cos(a)*.51,.09,Math.sin(a)*.51,.09,.11,.08);}}
  g.userData.hat=kind;return g;
 }
 makeJetpack(){
  const g=new THREE.Group(),m=this.m;g.name='jetpack';this.boxMesh(g,m.metal,0,0,0,.56,.65,.22);
  const flames=new THREE.Group();flames.name='jet_flames';g.add(flames);g.userData.flames=flames;flames.visible=false;
  for(const side of [-1,1]){const tank=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.66,10),m.blue);tank.position.set(side*.3,0,0);g.add(tank);this.ellipsoid(g,m.cyan,side*.3,.34,0,.31,.14,.31);this.boxMesh(g,m.orange,side*.3,-.38,0,.18,.18,.18);const plume=new THREE.Group();plume.name=`jet_plume_${side<0?'L':'R'}`;plume.position.set(side*.3,-.49,0);flames.add(plume);const outer=new THREE.Mesh(new THREE.ConeGeometry(.16,.82,8),m.orange);outer.name='jet_flame_outer';outer.rotation.z=Math.PI;outer.position.y=-.39;plume.add(outer);const inner=new THREE.Mesh(new THREE.ConeGeometry(.095,.58,8),m.lamp);inner.name='jet_flame_inner';inner.rotation.z=Math.PI;inner.position.y=-.29;plume.add(inner);for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.08+i*.025,.018,5,16),i===0?m.white:m.cyan);ring.name=`jet_exhaust_ring_${i}`;ring.rotation.x=Math.PI/2;ring.position.y=-.62-i*.18;plume.add(ring);}}
  return g;
 }
 animateShield(shield,time,reducedMotion=false){
  if(!shield?.visible)return;
  const pulse=reducedMotion?1:1+Math.sin(time*3.2)*.018;shield.scale.setScalar(pulse);
  const bubble=shield.getObjectByName('shield_bubble');if(bubble){bubble.rotation.y=-time*.18;bubble.material.opacity=reducedMotion?.085:.075+Math.sin(time*2.4)*.025;}
  for(let i=0;i<6;i++){const region=shield.getObjectByName(`shield_region_${i}`);if(region){region.rotation.y=time*(i%2?.11:-.08);region.material.opacity=reducedMotion?.07:.04+(Math.sin(time*(1.7+i*.09)+i*1.8)+1)*.045;}}
  const hearts=shield.getObjectByName('shield_heart_orbit');if(hearts){hearts.rotation.set(.48+Math.sin(time*.31)*.18,time*(reducedMotion?.16:.42),-.25+Math.cos(time*.27)*.2);}
 }
 decoratePowerup(group,type){
  const colors={magnet:0x6cf0ca,moon:0xd8eb58,moped:0xff7541,shield:0x62ddff,doublechips:0xffc846,jetpack:0xff6952,speedburst:0x55bfff},color=colors[type]||0x6cf0ca;
  const material=this.materials?this.mat(color,{transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending}):this.m.cyan.clone();
  material.color.setHex(color);material.transparent=true;material.opacity=.72;material.depthWrite=false;material.blending=THREE.AdditiveBlending;group.userData.powerupType=type;
  const aura=new THREE.Group();aura.name='powerup_aura';group.add(aura);
  const ringA=new THREE.Mesh(new THREE.TorusGeometry(.67,.018,5,28),material);ringA.name='powerup_ring_a';ringA.rotation.x=Math.PI/2;aura.add(ringA);
  const ringB=new THREE.Mesh(new THREE.TorusGeometry(.52,.012,5,24),material);ringB.name='powerup_ring_b';ringB.rotation.y=Math.PI/2;aura.add(ringB);
  for(let i=0;i<4;i++){const spark=new THREE.Mesh(new THREE.OctahedronGeometry(.045,0),material);spark.name=`powerup_spark_${i}`;spark.userData.phase=i*TAU/4;aura.add(spark);}
  if(type==='moon')for(let i=0;i<3;i++){const rise=new THREE.Mesh(new THREE.ConeGeometry(.08,.22,4),material);rise.name=`powerup_rise_${i}`;rise.position.x=(i-1)*.28;aura.add(rise);}
  if(type==='moped')for(let i=0;i<3;i++){const dash=new THREE.Mesh(new THREE.BoxGeometry(.18,.035,.035),material);dash.name=`powerup_dash_${i}`;dash.position.set((i-1)*.24,-.22,-.65-i*.16);aura.add(dash);}
  if(type==='shield')for(let i=0;i<2;i++){const shell=new THREE.Mesh(new THREE.TorusGeometry(.74+i*.09,.012,5,30),material);shell.name=`powerup_shell_${i}`;shell.rotation.x=Math.PI/2;aura.add(shell);}
  if(type==='doublechips')for(let i=0;i<2;i++){const orbit=new THREE.Mesh(new THREE.TorusGeometry(.46+i*.14,.014,5,28),material);orbit.name=`powerup_orbit_${i}`;orbit.rotation.set(Math.PI/2,i*.7,i);aura.add(orbit);}
  if(type==='jetpack')for(let i=0;i<2;i++){const exhaust=new THREE.Mesh(new THREE.ConeGeometry(.095,.42,6),material);exhaust.name=`powerup_exhaust_${i}`;exhaust.position.set((i?1:-1)*.29,-.65,0);exhaust.rotation.z=Math.PI;aura.add(exhaust);}
  if(type==='speedburst')for(let i=0;i<4;i++){const streak=new THREE.Mesh(new THREE.ConeGeometry(.045,.62+i*.09,5),material);streak.name=`powerup_streak_${i}`;streak.rotation.x=Math.PI/2;streak.position.set((i-1.5)*.17,.08-Math.abs(i-1.5)*.06,-.5-i*.12);aura.add(streak);}
  return group;
 }
 animatePowerup(group,type,time,id=0,reducedMotion=false){
  if(!group)return;const phase=time*(type==='moped'?.9:1.25)+id*.73,bob=reducedMotion?0:Math.sin(phase*2.1)*.12;
  group.position.y=bob;group.rotation.y=phase*(type==='shield'?1.2:type==='doublechips'?.82:.65);
  const aura=group.getObjectByName('powerup_aura');if(!aura)return;aura.rotation.x=Math.sin(phase)*.22;aura.rotation.z=-phase*.47;
  const ringA=group.getObjectByName('powerup_ring_a'),ringB=group.getObjectByName('powerup_ring_b');if(ringA)ringA.scale.setScalar(1+Math.sin(phase*3)*.09);if(ringB)ringB.scale.setScalar(1+Math.cos(phase*2.6)*.12);
  for(let i=0;i<4;i++){const spark=group.getObjectByName(`powerup_spark_${i}`);if(!spark)continue;const a=(spark.userData.phase||0)+phase*(i%2?-.9:1);spark.position.set(Math.cos(a)*.76,Math.sin(a*1.7)*.42,Math.sin(a)*.58);}
  if(type==='magnet'){if(ringA)ringA.rotation.z=phase*1.4;if(ringB)ringB.rotation.x=-phase*1.7;}
  if(type==='moon')for(let i=0;i<3;i++){const rise=group.getObjectByName(`powerup_rise_${i}`);if(rise)rise.position.y=-.55+((phase*.45+i*.31)%1)*1.2;}
  if(type==='moped')for(let i=0;i<3;i++){const dash=group.getObjectByName(`powerup_dash_${i}`);if(dash){dash.position.z=-.55-((phase*.7+i*.28)%1)*.8;dash.scale.x=.65+Math.sin(phase*4+i)*.25;}}
  if(type==='shield')for(let i=0;i<2;i++){const shell=group.getObjectByName(`powerup_shell_${i}`);if(shell)shell.scale.setScalar(.92+((Math.sin(phase*2+i)+1)*.5)*.18);}
  if(type==='doublechips')for(let i=0;i<2;i++){const orbit=group.getObjectByName(`powerup_orbit_${i}`);if(orbit){orbit.rotation.y=phase*(i?-.9:1.1);orbit.rotation.z=phase*(i?.55:-.7);}}
  if(type==='jetpack')for(let i=0;i<2;i++){const exhaust=group.getObjectByName(`powerup_exhaust_${i}`);if(exhaust)exhaust.scale.y=.75+Math.sin(phase*7+i)*.25;}
  if(type==='speedburst')for(let i=0;i<4;i++){const streak=group.getObjectByName(`powerup_streak_${i}`);if(streak){streak.position.z=-.35-((phase*1.25+i*.21)%1)*1.05;streak.scale.y=.7+Math.sin(phase*8+i)*.28;}}
 }
 humanProfile(parent,material,rings,segments=20){
  // Multiple anatomical cross-sections keep the silhouette angular but articulated.
  rings=[...rings].sort((a,b)=>a[0]-b[0]);
  const positions=[],indices=[];
  for(const [y,rx,rz,z=0] of rings)for(let i=0;i<segments;i++){
    const a=i*TAU/segments;positions.push(Math.cos(a)*rx,y,z+Math.sin(a)*rz);
  }
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<segments;i++){
    const a=r*segments+i,b=r*segments+(i+1)%segments,c=a+segments,d=b+segments;
    indices.push(a,c,b,b,c,d);
  }
  for(const end of [0,rings.length-1]){
    const center=positions.length/3,[y,,,z=0]=rings[end];positions.push(0,y,z);
    for(let i=0;i<segments;i++){const a=end*segments+i,b=end*segments+(i+1)%segments;indices.push(center,...(end?[b,a]:[a,b]));}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);parent.add(mesh);return mesh;
 }
 humanHand(parent,skin,side){
  const hand=new THREE.Group();hand.position.set(0,-.34,.04);parent.add(hand);
  this.roundedMesh(hand,skin,0,0,0,.115,.15,.095,.025);
  for(let finger=0;finger<4;finger++){
    const x=-.043+finger*.029,length=[.095,.12,.115,.085][finger];
    this.ellipsoid(hand,skin,x,-.063-length*.22,.005,.032,length*.7,.042);
    this.ellipsoid(hand,skin,x,-.07-length*.64,.022,.03,length*.42,.04);
    this.ellipsoid(hand,skin,x,-.062,.037,.032,.034,.024);
  }
  const thumb=this.ellipsoid(hand,skin,-side*.072,-.015,.035,.054,.105,.05);thumb.rotation.z=-side*.45;
  this.batchStatic(hand);return hand;
 }
 makePerson(index=0,police=false,role=police?'police':'pedestrian'){
  const root=new THREE.Group(),body=new THREE.Group(),m=this.m;root.add(body);
  const female=!police&&index%4<2,skirt=female&&index%3===0;
  const skin=m.complexions[index%4],shirt=police?m.police:m.shirt[index%6],pants=police?m.policeDark:m.pants[index%3];
  const torso=this.humanProfile(body,shirt,[[.99,.25,.15],[1.12,.23,.145],[1.29,.275,.18],[1.48,.32,.18],[1.60,.35,.145],[1.69,.12,.105]],24);
  torso.scale.x=1;
  this.humanProfile(body,pants,[[.8,.21,.145],[.94,.28,.185],[1.03,.255,.16]],24);
  this.humanProfile(body,skin,[[1.66,.085,.08],[1.76,.093,.085],[1.86,.083,.08]],20);
  const head=this.humanProfile(body,skin,[[1.79,.064,.073,.016],[1.84,.115,.099,.01],[1.92,.16,.127],[2.015,.174,.143],[2.105,.156,.129],[2.16,.105,.091],[2.185,.03,.027]],24);
  for(const side of [-1,1]){
    this.ellipsoid(body,skin,side*.175,1.99,0,.075,.12,.065);
    this.ellipsoid(body,m.pupil,side*.075,2.017,.133,.068,.023,.02);
    const brow=this.ellipsoid(body,m.black,side*.077,2.057,.132,.087,.018,.025);brow.rotation.z=side*.07;
    this.ellipsoid(body,skin,side*.095,1.943,.11,.105,.064,.038);
  }
  this.roundedMesh(body,skin,0,1.979,.156,.057,.102,.077,.012);
  this.ellipsoid(body,m.wood,0,1.878,.109,.09,.018,.02);
  const hair=this.humanProfile(body,m.black,[[2.055,.174,.143,-.012],[2.105,.173,.143,-.012],[2.164,.12,.102,-.008],[2.195,.035,.029]],20);
  if(female){
    if(index%2===0){this.ellipsoid(body,m.black,0,1.94,-.125,.37,.57,.17);for(const side of [-1,1])this.ellipsoid(body,m.black,side*.157,1.9,-.065,.1,.43,.12);}
    else {this.ellipsoid(body,m.black,0,2.16,-.155,.22,.23,.2);this.ellipsoid(body,m.black,0,1.94,-.215,.13,.47,.135);}
    this.ellipsoid(body,m.earRed,0,1.877,.119,.084,.012,.022);
  }else if(!police&&index%5===0){this.ellipsoid(body,m.capGreen,0,2.192,-.018,.42,.13,.35);this.ellipsoid(body,m.capGreen,0,2.155,.157,.4,.045,.24);}
  // Collar, placket, seams and pockets give the clothed torso readable structure.
  for(const side of [-1,1]){
    const collar=this.boxMesh(body,police?m.policeDark:m.white,side*.073,1.625,.133,.1,.15,.028);collar.rotation.z=side*.36;
    this.boxMesh(body,shirt,side*.18,1.425,.174,.15,.17,.023);
    this.boxMesh(body,police?m.policeDark:shirt,side*.18,1.495,.189,.16,.025,.023);
  }
  for(const y of [1.53,1.4,1.27])this.ellipsoid(body,m.metal,0,y,.186,.021,.021,.012);
  if(skirt){const dress=new THREE.Mesh(new THREE.CylinderGeometry(.26,.43,.67,14),shirt);dress.position.y=.95;dress.scale.z=.78;body.add(dress);}
  if(!police&&index%6===2){this.boxMesh(body,m.wood,0,1.4,-.26,.45,.62,.24);for(const side of [-1,1])this.boxMesh(body,m.wood,side*.22,1.41,.19,.055,.53,.035);}
  const legs=[],arms=[],knees=[],elbows=[],feet=[];let baton=null;
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.16,.92,0);body.add(leg);
    this.humanProfile(leg,skirt?skin:pants,[[.015,.13,.14],[-.1,.15,.15],[-.25,.125,.13],[-.39,.105,.105],[-.45,.095,.095]],20);this.ellipsoid(leg,skirt?skin:pants,0,-.405,.027,.215,.18,.205);
    const knee=new THREE.Group();knee.position.y=-.44;leg.add(knee);knees.push(knee);
    this.humanProfile(knee,skirt?skin:pants,[[0,.095,.095],[-.1,.116,.12,.015],[-.22,.092,.105,.02],[-.34,.072,.073,.025],[-.38,.075,.075,.03]],20);const foot=new THREE.Group();foot.position.set(0,-.4,.075);knee.add(foot);this.roundedMesh(foot,m.black,0,0,0,.22,.145,.37,.034);this.boxMesh(foot,m.policeDark,0,-.065,0,.225,.035,.375);for(let lace=0;lace<3;lace++)this.boxMesh(foot,m.metal,0,.078,-.025+lace*.043,.105,.009,.012);this.batchStatic(foot);feet.push(foot);legs.push(leg);
    const arm=new THREE.Group();arm.position.set(side*.34,1.61,0);body.add(arm);this.humanProfile(arm,shirt,[[.105,.05,.06],[.065,.102,.107],[.015,.122,.13],[-.08,.128,.125],[-.21,.106,.104],[-.295,.087,.09]],20);this.humanProfile(arm,police?m.policeDark:shirt,[[-.255,.108,.106],[-.288,.104,.102]],20);
    const elbow=new THREE.Group();elbow.position.y=-.29;arm.add(elbow);elbows.push(elbow);
    this.ellipsoid(elbow,skin,0,-.01,.015,.17,.16,.17);this.humanProfile(elbow,skin,[[0,.083,.085,.017],[-.09,.092,.085,.022],[-.2,.074,.07,.028],[-.29,.058,.058,.035]],20);this.humanHand(elbow,skin,side);arms.push(arm);
  }
  if(police){this.boxMesh(body,m.policeDark,0,1,.017,.59,.095,.42);this.boxMesh(body,m.policeDark,0,1.43,.239,.045,.38,.02);this.boxMesh(body,m.gold,-.19,1.5,.207,.085,.11,.022);this.boxMesh(body,m.policeDark,.21,1.12,.19,.12,.2,.07);const hat=new THREE.Mesh(new THREE.CylinderGeometry(.207,.218,.12,24),m.policeDark);hat.position.set(0,2.207,-.005);body.add(hat);this.ellipsoid(body,m.policeDark,0,2.155,.157,.43,.055,.245);this.ellipsoid(body,m.gold,0,2.215,.211,.08,.092,.02);}
  else if(index%3===0){this.ellipsoid(body,m.wood,.31,.91,.04,.3,.45,.22);}
  if(police){baton=new THREE.Group();baton.position.set(0,-.49,.055);baton.rotation.x=-.25;elbows[1].add(baton);baton.add(new THREE.Mesh(new THREE.CylinderGeometry(.031,.039,.7,12),m.black));this.ellipsoid(baton,m.metal,0,.18,0,.105,.04,.105);}
  this.batchStatic(body);for(const limb of [...legs,...arms,...knees,...elbows])this.batchStatic(limb);
  root.userData.humanRig='shared-police-build';
  const person={root,body,legs,arms,knees,elbows,feet,baton,female,skirt,index,role,police};this.registerHumanRig(person);return person;
 }
 registerHumanRig(person){
  this.humanRigs??=new Set();this._refreshedHumanMaterials??=new Map();person.modelMaterials=[];
  person.root.traverse(object=>{
   if(!object.isMesh||!object.material)return;
   const original=object.material;let refreshed=this._refreshedHumanMaterials.get(original);
   if(!refreshed){refreshed=original.clone();refreshed.flatShading=false;refreshed.onBeforeCompile=original.onBeforeCompile;refreshed.customProgramCacheKey=original.customProgramCacheKey;refreshed.needsUpdate=true;this._refreshedHumanMaterials.set(original,refreshed);}
   person.modelMaterials.push({object,original,refreshed});
  });
  this.humanRigs.add(person);this.attachAuthoredHuman(person);this.applyHumanRigModelSet(person,this.effectiveModelSet||'original');
 }
 applyHumanRigModelSet(person,modelSet){
  const refreshed=modelSet==='refreshed'&&!!person.authored;
  for(const style of person.modelMaterials||[])style.object.material=refreshed?style.refreshed:style.original;
  person.body.visible=!refreshed;if(person.authored)person.authored.scene.visible=refreshed;person.root.userData.modelSet=refreshed?'refreshed':'original';
 }
 applyHumanModelSet(modelSet){for(const person of this.humanRigs||[])this.applyHumanRigModelSet(person,modelSet);}
 makeCop(){const c=this.makePerson(1,true);c.root.scale.setScalar(1.12);return c;}
 makePedestrians(){
  this.people=Array.from({length:CROWD_COUNT},(_,i)=>{const p=this.makePerson(i);p.root.scale.setScalar(1.12);this.scene.add(p.root);return p;});
 }
 animateHumanWalk(person,phase,stride=1){
  if(person.authored&&this.effectiveModelSet==='refreshed'){this.updateAuthoredHuman(person,stride>.08?'walk':'idle',phase);return;}
  const s=Math.sin(phase);person.body.position.y=(1-Math.cos(phase*2))*.013*stride;person.body.rotation.z=s*.018*stride;person.body.rotation.y=s*.04*stride;
  person.legs.forEach((leg,i)=>{const wave=s*(i?1:-1)*stride;leg.rotation.x=wave*.34;person.knees[i].rotation.x=Math.max(0,-wave)*.4;});
  person.arms.forEach((arm,i)=>{arm.rotation.x=s*(i?-1:1)*.24*stride;person.elbows[i].rotation.x=-.15-Math.max(0,s*(i?1:-1))*.13*stride;});
 }
 updatePeople(dist,time,inside=false){for(let i=0;i<this.people.length;i++){const p=this.people[i],pose=sidewalkPose(i,dist,time),s=Math.sin(pose.phase);p.root.position.set(pose.x,.11,pose.z);p.root.rotation.y=pose.yaw;p.root.visible=pose.z>-100&&!(inside&&pose.x<0&&Math.abs(pose.z+2)<6);p.body.position.y=pose.bob;p.body.rotation.z=Math.sin(pose.phase)*.018;p.body.rotation.y=Math.sin(pose.phase)*.04;p.legs.forEach((l,j)=>{const wave=s*(j?1:-1);l.rotation.x=wave*.34;p.knees[j].rotation.x=Math.max(0,-wave)*.4;});p.arms.forEach((a,j)=>{a.rotation.x=s*(j?-1:1)*.24;p.elbows[j].rotation.x=-.15-Math.max(0,s*(j?1:-1))*.13;});this.updateAuthoredHuman(p,'walk',pose.phase);}}
 roundedMesh(parent,mat,x,y,z,w,h,d,r=.09){
  const shape=new THREE.Shape();shape.moveTo(-w/2+r,-h/2+r);shape.lineTo(w/2-r,-h/2+r);shape.lineTo(w/2-r,h/2-r);shape.lineTo(-w/2+r,h/2-r);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.01,d-2*r),steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:r,bevelThickness:r,curveSegments:6});geometry.translate(0,0,-d/2+r);
  const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 }
 wheel(parent,x,y,z,r=.29,width=.16){
  const wheel=new THREE.Group();wheel.position.set(x,y,z);parent.add(wheel);
  const tire=new THREE.Mesh(new THREE.TorusGeometry(r*.74,r*.26,8,24),this.m.tire);tire.rotation.y=Math.PI/2;wheel.add(tire);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*.55,r*.55,width,16),this.m.metal);hub.rotation.z=Math.PI/2;wheel.add(hub);
  for(const side of [-1,1])for(let i=0;i<5;i++){const spoke=this.boxMesh(wheel,this.m.carPearl,side*width*.53,0,0,.02,r*1.05,.035);spoke.rotation.x=i*TAU/5;}
  (parent.userData.wheels??=[]).push(wheel);return wheel;
 }
 makeCar(id){
  const g=new THREE.Group(),m=this.m,taxi=id%3===0,col=taxi?m.red:[m.carPearl,m.carJade,m.carBlue][id%3],bx=(mat,x,y,z,w,h,d)=>this.boxMesh(g,mat,x,y,z,w,h,d);
  this.roundedMesh(g,col,0,.65,0,1.72,.65,3.08,.14);
  this.roundedMesh(g,col,0,.92,.83,1.63,.16,1.17,.06);
  // Sloping cabin silhouette, narrow roof and a raked windscreen on a rounded sedan chassis.
  const profile=new THREE.Shape();profile.moveTo(-.83,.88);profile.lineTo(-.46,1.48);profile.quadraticCurveTo(-.38,1.55,-.25,1.55);profile.lineTo(.59,1.55);profile.quadraticCurveTo(.72,1.55,.79,1.41);profile.lineTo(1.13,.89);profile.closePath();
  const cabGeo=new THREE.ExtrudeGeometry(profile,{depth:1.38,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:3,steps:1});cabGeo.translate(0,0,-.69);cabGeo.rotateY(Math.PI/2);g.add(new THREE.Mesh(cabGeo,taxi?m.white:col));
  const windshield=this.boxMesh(g,m.carGlass,0,1.185,.704,1.3,.58,.035);windshield.rotation.x=-.528;
  const rearWindow=this.boxMesh(g,m.carGlass,0,1.185,-.997,1.28,.54,.035);rearWindow.rotation.x=.578;
  this.roundedMesh(g,taxi?m.white:col,0,1.54,-.15,1.38,.065,.89,.026);
  for(const side of [-1,1]){
    const glassProfile=new THREE.Shape();glassProfile.moveTo(-.7,.99);glassProfile.lineTo(-.4,1.44);glassProfile.lineTo(.59,1.44);glassProfile.lineTo(.93,.99);glassProfile.closePath();
    const glass=new THREE.Mesh(new THREE.ShapeGeometry(glassProfile),m.carGlass);glass.rotation.y=side*Math.PI/2;glass.position.x=side*.734;g.add(glass);
    bx(m.policeDark,side*.742,1.22,-.14,.035,.5,.055);bx(m.metal,side*.86,.88,-.39,.018,.035,.19);bx(m.black,side*.865,.63,-.16,.012,.37,.012);
    this.roundedMesh(g,col,side*.91,1.04,.56,.18,.11,.24,.03);
    for(const z of [-1.04,.99])this.wheel(g,side*.84,.31,z);
    this.roundedMesh(g,m.lamp,side*.55,.83,1.52,.5,.095,.075,.025);
    this.roundedMesh(g,m.siren,side*.56,.85,-1.53,.5,.09,.045,.02);
  }
  bx(m.black,0,.48,1.56,1.2,.13,.025);for(let i=0;i<4;i++)bx(m.metal,0,.44+i*.034,1.578,.93,.014,.015);
  bx(m.metal,0,.31,1.45,1.54,.07,.07);bx(m.white,0,.6,1.576,.4,.1,.018);bx(m.yellow,0,.61,-1.563,.4,.1,.02);
  this.ellipsoid(g,m.metal,0,.91,1.52,.09,.055,.022);
  if(taxi){bx(m.white,0,1.61,-.16,.46,.13,.25);const sign=new THREE.Mesh(this.plane,m.taxiLabel);sign.position.set(0,1.62,-.02);sign.scale.set(.44,.105,1);g.add(sign);}
  this.batchStatic(g);g.scale.setScalar(1.12);return g;
 }
 makeMoped(id=0,rider=false){
  const g=new THREE.Group(),m=this.m,col=[m.carJade,m.carPearl,m.red,m.carBlue][id%4];
  this.wheel(g,0,.27,-.65,.27,.13);this.wheel(g,0,.27,.69,.27,.13);
  this.roundedMesh(g,col,0,.47,-.26,.55,.42,.92,.08);this.roundedMesh(g,m.black,0,.76,-.25,.53,.12,.69,.045);
  this.roundedMesh(g,col,0,.72,.57,.54,.95,.3,.08);this.roundedMesh(g,m.black,0,.36,.25,.58,.1,.67,.035);
  const fork=this.boxMesh(g,m.metal,0,.52,.7,.07,.6,.09);fork.rotation.x=-.15;
  this.ellipsoid(g,col,0,1.26,.55,.68,.32,.3);this.ellipsoid(g,m.lamp,0,1.28,.7,.31,.17,.035);
  this.boxMesh(g,m.metal,0,1.31,.44,.9,.05,.06);for(const side of [-1,1]){this.boxMesh(g,m.black,side*.4,1.31,.45,.15,.08,.08);const mirror=this.boxMesh(g,m.metal,side*.34,1.49,.48,.025,.32,.025);mirror.rotation.z=-side*.16;this.ellipsoid(g,m.glass,side*.38,1.65,.48,.18,.11,.07);}
  this.ellipsoid(g,m.siren,0,.59,-.74,.24,.095,.035);this.boxMesh(g,m.yellow,0,.4,-.73,.24,.15,.02);
  if(rider){const person=this.makePerson(id,false,'rider');person.root.scale.setScalar(.91);person.root.position.set(0,.12,-.18);person.legs.forEach(l=>l.rotation.x=-1.17);person.knees.forEach(k=>k.rotation.x=1.65);person.arms.forEach(a=>a.rotation.x=-.68);person.elbows.forEach(e=>e.rotation.x=-.62);g.add(person.root);this.ellipsoid(person.body,id%2?m.orange:m.white,0,2.16,-.04,.43,.25,.4);g.userData.rider=person;}
  this.batchStatic(g);return g;
 }
 makeDizzyStars(){
  this.stars=new THREE.Group();this.scene.add(this.stars);const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.095:.21;i?shape.lineTo(Math.cos(a)*r,Math.sin(a)*r):shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);}shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false});
  for(let i=0;i<5;i++){const star=new THREE.Mesh(geo,this.m.lamp);this.stars.add(star);}this.stars.visible=false;
 }
 makeEntity(type,id=0){
  const g=new THREE.Group(),m=this.m,bx=(mat,x,y,z,sx,sy,sz,rz=0)=>this.boxMesh(g,mat,x,y,z,sx,sy,sz,rz);
  if(this.effectiveModelSet==='refreshed'&&POWER_TYPES.includes(type))return this.makeAuthoredPowerup(type)||g;
  if(type==='coin'){const crisp=this.makeCrisp();crisp.rotation.set(.15,0,-.3);g.add(crisp);}
  else if(type==='crossTraffic')return this.makeRouteVehicle(id%4);
  else if(type==='traffic')return this.makeCar(id);
  else if(type==='scooter')return this.makeMoped(id,true);
  else if(type==='moped'){const bike=this.makeMoped(0);bike.scale.setScalar(.65);bike.position.y=-.42;bike.rotation.y=-.35;g.add(bike);const ring=new THREE.Mesh(new THREE.TorusGeometry(.7,.045,8,32),m.cyan);ring.position.y=.14;g.add(ring);}
  else if(type==='jetpack')g.add(this.makeJetpack());
  else if(type==='shield'){const shape=new THREE.Shape();shape.moveTo(-.42,.4);shape.lineTo(.42,.4);shape.lineTo(.36,-.12);shape.lineTo(0,-.46);shape.lineTo(-.36,-.12);shape.closePath();g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:false}),m.cyan));bx(m.white,0,0,.12,.08,.5,.03);bx(m.white,0,.12,.12,.38,.08,.03);}
  else if(type==='doublechips'){for(const side of [-1,1]){const chip=this.makeCrisp();chip.position.x=side*.23;chip.scale.setScalar(.7);g.add(chip);}this.blockLetters(g,'2',0,.52,.15,.09,m.gold);}
  else if(type==='speedburst'){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.48,1),m.cyan);gem.scale.set(.75,1.15,.38);gem.rotation.z=-.28;g.add(gem);for(let i=0;i<3;i++){const streak=this.boxMesh(g,i?m.blue:m.white,-.38-i*.18,-.1-i*.12,-.1,.42-i*.06,.065,.08);streak.rotation.z=-.5;}}
  else if(BARRIERS[type])return this.makeBarrier(type);
  else{const ring=new THREE.Mesh(new THREE.TorusGeometry(.46,.055,8,24),type==='moon'?m.gold:m.cyan);g.add(ring);if(type==='moon')this.ellipsoid(g,m.gold,0,0,0,.54,.54,.3);else{bx(m.red,-.16,0,0,.14,.4,.15);bx(m.red,.16,0,0,.14,.4,.15);bx(m.red,0,-.16,0,.35,.12,.15);bx(m.white,-.16,.17,0,.14,.11,.16);bx(m.white,.16,.17,0,.14,.11,.16);}}
  if(POWER_TYPES.includes(type))this.decoratePowerup(g,type);
  return g;
 }
 makeRouteVehicle(kind=0){
  const g=new THREE.Group(),m=this.m,bx=(mat,x,y,z,w,h,d)=>this.boxMesh(g,mat,x,y,z,w,h,d);
  const bus=kind===2,van=kind===1,police=kind===3,body=bus?m.white:van||police?m.carPearl:m.red;
  const length=bus?6.8:van?4.7:3.55,height=bus?2.9:van?2.25:1.6;
  bx(body,0,height*.48,0,1.96,height*.72,length);
  bx(bus?m.green:m.white,0,height*.84,-.12,1.74,height*.27,length*.72);
  bx(m.carGlass,0,height*.77,length*.362+.02,1.6,height*.19,.035);
  for(const side of [-1,1]){
    for(let z=-length*.3;z<length*.3;z+=bus?.85:.65)bx(m.carGlass,side*.884,height*.78,z,.035,height*.19,bus?.64:.47);
    for(const z of [-length*.3,length*.3]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.2,8),m.tire);w.rotation.z=Math.PI/2;w.position.set(side*.96,.34,z);g.add(w);}
    bx(m.lamp,side*.64,.75,length/2+.02,.43,.15,.025);bx(m.siren,side*.64,.75,-length/2-.02,.4,.16,.025);
    if(bus)bx(m.red,side*.991,.77,0,.012,.29,length*.96);
  }
  bx(m.black,0,.41,length/2+.03,1.4,.18,.045);bx(m.yellow,0,.59,length/2+.045,.42,.12,.01);
  if(!bus&&!van)bx(m.white,0,height+.02,0,.46,.16,.24);
  if(police){for(const side of [-1,1]){bx(m.blue,side*.99,.85,0,.025,.25,length*.85);bx(side>0?m.siren:m.blue,side*.29,height+.16,0,.38,.17,.27);}}
  this.batchStatic(g);return g;
 }
 makeBarrier(type){
  const g=new THREE.Group(),m=this.m,d=BARRIERS[type],tall=type!=='jump',h=d.height,w=d.width;
  const bx=(mat,x,y,z,sx,sy,sz)=>this.boxMesh(g,mat,x,y,z,sx,sy,sz);
  const half=w/2-.055,top=h-.05,r=.23,path=new THREE.CurvePath();
  const v=(x,y)=>new THREE.Vector3(x,y,0);
  path.add(new THREE.LineCurve3(v(-half,.14),v(-half,top-r)));
  path.add(new THREE.QuadraticBezierCurve3(v(-half,top-r),v(-half,top),v(-half+r,top)));
  path.add(new THREE.LineCurve3(v(-half+r,top),v(half-r,top)));
  path.add(new THREE.QuadraticBezierCurve3(v(half-r,top),v(half,top),v(half,top-r)));
  path.add(new THREE.LineCurve3(v(half,top-r),v(half,.14)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(path,44,.045,8,false),m.metal));
  const bottom=tall?1.6:.43,panelTop=top-.26;
  for(const side of [-1,1]){
    bx(m.black,side*(half-.01),.095,0,.18,.19,d.depth);
    bx(m.black,side*(half-.01),.24,0,.12,.34,.21);
  }
  const rail=(x1,y1,x2,y2)=>{const a=new THREE.Mesh(this.cylinder,m.orange),dx=x2-x1,dy=y2-y1;a.position.set((x1+x2)/2,(y1+y2)/2,.015);a.scale.set(.085,Math.hypot(dx,dy),.085);a.rotation.z=-Math.atan2(dx,dy);g.add(a);};
  rail(-half-.03,bottom,half+.03,bottom);rail(-half-.03,panelTop,half+.03,panelTop);
  const count=5,gap=(half*2-.12)/count;
  for(let i=0;i<count;i++){
    const x=-half+.06+gap*(i+.5);bx(m.white,x,(bottom+panelTop)/2,0,gap-.045,panelTop-bottom-.06,.045);
    rail(-half+.06+gap*i,bottom,-half+.06+gap*i,panelTop);
  }
  for(const x of [-.45,0,.45]){rail(x,panelTop,x,top-.02);bx(m.orange,x,top,.02,.2,.07,.06);}
  this.batchStatic(g);g.userData.opening=tall?1.55:0;return g;
 }
 marketStall(b,kind,x,z){
  const m=this.m,box=(mat,xx,y,zz,w,h,d)=>b.add(this.box,mat,xx,y,zz,w,h,d);
  box(kind===12?m.marketTile:m.wood,x,.55,z,1.2,1.1,2.5);
  box(kind===12?m.ice:m.bamboo,x,1.14,z,1.38,.12,2.7);
  box(m.awning,x,2.75,z,1.65,.13,2.95);
  for(const q of [-1,1])box(m.metal,x+.5,1.9,z+q*1.25,.055,1.65,.055);
  box(m.lamp,x,2.55,z,.08,.05,2.2);
  for(const f of [-1,1])b.add(this.plane,m.fascias[kind],x,2.41,z+f*1.4,1.4,.4,1,0,f<0?Math.PI:0,0);
  if(kind===12){
    for(let j=0;j<7;j++){const zz=z-.98+j*.31;b.add(this.sphere,j%2?m.fish:m.fishPink,x,1.28,zz,.69,.13,.23,0,j*.19,0);b.add(this.cone,m.fish,x-.41,1.29,zz,.26,.27,.05,0,0,-Math.PI/2);b.add(this.sphere,m.pupil,x+.23,1.345,zz+.065,.035,.025,.035);}
    box(m.glass,x, .52,z+1.45,1.15,.8,.4);box(m.cyan,x,.55,z+1.68,1.04,.56,.018);
  }else if(kind===14){
    for(let j=0;j<3;j++)for(let k=0;k<2;k++){const zz=z-.8+j*.75;b.add(this.cylinder,m.bamboo,x,1.32+k*.2,zz,.76,.18,.76);for(let n=0;n<4;n++)b.add(this.sphere,m.white,x+Math.sin(n*1.8)*.18,1.67,zz+Math.cos(n*1.8)*.18,.2,.16,.19);}
  }else if(kind===13){
    for(let j=0;j<5;j++){box(m.metal,x,2.37,z-.95+j*.45,.035,.25,.035);b.add(this.sphere,m.wood,x,1.95,z-.95+j*.45,.31,.57,.28);b.add(this.sphere,m.orange,x,1.7,z-.95+j*.45,.36,.24,.25);}
    box(m.white,x,1.24,z,1.1,.09,2.1);
  }else{for(let j=0;j<4;j++)for(let k=0;k<3;k++){const xx=x-.35+k*.32,zz=z-.93+j*.57;b.add(this.sphere,j%2?m.leaf:m.purple,xx,1.35,zz,.32,.28,.38);if(j%2===0)box(m.leaf,xx,1.53,zz,.04,.17,.04);}}
 }

 makeCrisp(){
  const g=new THREE.Group(),m=this.m,geo=new THREE.SphereGeometry(1,24,12),p=geo.attributes.position;
  // A thin saddle-shaped potato slice, with a toasted rim and raised ridges.
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,x*.34,y*.47,z*.032+.14*(x*x-y*y));}
  geo.computeVertexNormals();g.add(new THREE.Mesh(geo,m.chip));
  for(let i=-3;i<=3;i++){const y=i*.097,w=.29*Math.sqrt(1-(y/.47)**2),curve=new THREE.CatmullRomCurve3(Array.from({length:9},(_,j)=>{const x=-w+j*w/4;return new THREE.Vector3(x,y,.038+.14*((x/.34)**2-(y/.47)**2));}));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,10,.009,4,false),m.chipLight));}
  return g;
 }
 makeProduct(parent,kind,x,y,z,colorIndex=0,scale=1){
  const m=this.m,col=[m.red,m.green,m.blue,m.orange,m.yellow,m.capGreen][colorIndex%6];
  const bx=(mat,xx,yy,zz,sx,sy,sz)=>this.boxMesh(parent,mat,x+xx*scale,y+yy*scale,z+zz*scale,sx*scale,sy*scale,sz*scale);
  const cyl=(mat,yy,r,h)=>{const a=new THREE.Mesh(this.cylinder,mat);a.position.set(x,y+yy*scale,z);a.scale.set(r*scale,h*scale,r*scale);parent.add(a);};
  if(kind===0){ // crimped snack packet and embossed potato badge
    bx(col,0,.23,0,.3,.44,.12);bx(m.white,0,.28,.065,.28,.085,.012);
    bx(col,0,.46,0,.34,.035,.13);bx(col,0,.02,0,.34,.035,.13);
    this.ellipsoid(parent,m.chip,x,y+.14*scale,z+.075*scale,.14*scale,.105*scale,.018*scale);
  }else if(kind===1){cyl(col,.23,.2,.34);cyl(col,.41,.1,.09);cyl(m.white,.47,.12,.045);bx(m.white,0,.23,.101,.14,.13,.009);}
  else if(kind===2){cyl(col,.17,.23,.31);cyl(m.metal,.33,.235,.02);cyl(m.metal,.015,.235,.02);bx(m.white,0,.18,.117,.12,.1,.008);}
  else if(kind===3){bx(col,0,.22,0,.26,.43,.2);bx(m.white,0,.37,.103,.23,.065,.01);bx(m.yellow,0,.17,.105,.15,.16,.012);bx(m.white,0,.44,0,.25,.04,.2);}
  else if(kind===4){cyl(m.white,.16,.3,.27);cyl(col,.33,.34,.065);bx(col,0,.16,.152,.21,.09,.012);}
  else { // Solid triangular sandwich packs and seaweed-wrapped rice balls.
    const shape=new THREE.Shape();shape.moveTo(-.15,0);shape.lineTo(.15,0);shape.lineTo(0,.34);shape.closePath();
    const wedge=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSize:.015,bevelThickness:.01,bevelSegments:1}),kind===5?m.chipLight:m.white);
    wedge.position.set(x,y+.02*scale,z-.065*scale);wedge.scale.setScalar(scale);parent.add(wedge);
    bx(kind===5?m.green:m.capGreen,0,.12,.087,.1,.2,.026);bx(col,0,.13,.106,.055,.06,.014);
  }
 }
 blockLetters(parent,text,x,y,z,size,material){
  const glyph={E:['111','100','110','100','111'],L:['100','100','100','100','111'],V:['101','101','101','101','010'],N:['101','111','111','111','101'],S:['111','100','111','001','111'],A:['010','101','111','101','101'],C:['111','100','100','100','111'],K:['101','110','100','110','101'],D:['110','101','101','101','110'],R:['110','101','110','101','101'],I:['111','010','010','010','111'],H:['101','101','111','101','101'],'2':['111','001','111','100','111'],'4':['101','101','111','001','001']};
  [...text].forEach((letter,i)=>(glyph[letter]||[]).forEach((row,j)=>[...row].forEach((bit,k)=>{if(bit==='1')this.boxMesh(parent,material,x+(i*4+k-text.length*2)*size,y+(2-j)*size,z,size*.96,size*.96,.035);})));
 }
 makeMenuProps(){
  const m=this.m;this.menuProps=new THREE.Group();this.scene.add(this.menuProps);this.menuCoins=[];
  this.store=new THREE.Group();this.store.position.set(STORE.x,0,STORE.z);this.store.rotation.y=Math.PI/2;this.scene.add(this.store);
  const bx=(mat,x,y,z,sx,sy,sz)=>this.boxMesh(this.store,mat,x,y,z,sx,sy,sz);
  // A 15m shop spanning two tenement bays. All merchandise, fixtures and signage are modeled.
  bx(m.storeFloor,0,-.05,-4.6,15,.15,10.6);
  for(let x=-7.5;x<=7.5;x+=.75)bx(m.concrete,x,.031,-4.6,.012,.005,10.6);
  for(let z=-9.9;z<=.7;z+=.75)bx(m.concrete,0,.032,z,15,.005,.012);
  bx(m.storeWall,0,2.7,-9.95,15,5.4,.15);
  for(const x of [-7.45,7.45])bx(m.storeWall,x,2.7,-4.6,.15,5.4,10.6);
  bx(m.white,0,5.32,-4.6,15,.16,10.6);
  for(const x of [-5,0,5])for(const z of [-1,-4.7,-8.2]){
    bx(m.metal,x,5.16,z,2.4,.08,.52);bx(m.lamp,x,5.1,z,2.25,.055,.4);
  }
  for(const [y,mat] of [[3.95,m.orange],[3.75,m.green],[3.55,m.red]])bx(mat,0,y,-9.85,14.9,.14,.035);
  // Real wall-length checkout: clerk has standing room behind the counter.
  bx(m.capGreen,-2.7,.75,-7.95,7.4,1.5,1.1);
  bx(m.white,-2.7,1.54,-7.95,7.65,.15,1.25);
  bx(m.orange,-2.7,1.27,-7.38,7.4,.08,.035);
  for(const x of [-5.5,-3.5,-1.5]){bx(m.white,x,.76,-7.375,1.7,1.18,.035);bx(m.metal,x,.9,-7.345,.34,.04,.04);}
  bx(m.black,-2.1,1.91,-7.85,.75,.46,.15);bx(m.cyan,-2.1,1.93,-7.75,.6,.31,.018);
  bx(m.metal,-2.1,1.69,-7.65,.75,.09,.46);bx(m.black,-1.35,1.66,-7.55,.38,.1,.33);
  bx(m.white,-5.2,1.95,-8.02,1.12,.67,.65);bx(m.black,-5.2,1.98,-7.68,.9,.45,.03);
  for(let j=0;j<3;j++){this.makeProduct(this.store,4,-.65+j*.37,1.62,-7.8,j);this.makeProduct(this.store,2,-.65+j*.37,1.62,-8.18,j+2);}
  // Hot-food cabinet with physical trays and buns, and a coffee dispenser.
  const clear=this.mat(0xcde7de,{transparent:true,opacity:.12,depthWrite:false});
  bx(m.metal,-3.65,1.64,-7.9,1.3,.08,.65);bx(clear,-3.65,2.03,-7.56,1.3,.75,.025);
  for(const x of [-4.3,-3])bx(m.metal,x,2.02,-7.9,.04,.8,.7);
  for(const yy of [1.8,2.12]){bx(m.metal,-3.65,yy,-7.9,1.3,.04,.65);for(let j=0;j<4;j++)this.ellipsoid(this.store,m.chipLight,-4.1+j*.29,yy+.1,-7.84,.24,.17,.26);}
  bx(m.black,-6,1.98,-7.95,.42,.75,.45);bx(m.metal,-6,1.9,-7.69,.32,.11,.11);
  // Behind-counter tobacco cubbies: individual cartons, packs and small goods.
  bx(m.storeWall,-2.7,2.55,-9.76,6.4,1.72,.2);
  for(const x of [-5.92,.52])bx(m.metal,x,2.56,-9.57,.055,1.75,.35);
  for(let row=0;row<4;row++){
    const y=1.83+row*.4;
    bx(m.white,-2.7,y,-9.52,6.4,.045,.42);
    bx(m.gold,-2.7,y+.025,-9.30,6.4,.045,.025);
    for(let col=0;col<25;col++){
      const x=-5.75+col*.25,tint=[m.red,m.blue,m.capGreen,m.gold,m.black][(Math.floor(col/5)+row)%5];
      bx(m.white,x,y+.19,-9.51,.205,.31,.13);
      bx(tint,x,y+.27,-9.437,.207,.095,.018);
      bx(tint,x,y+.15,-9.437,.09,.028,.018);
      bx(m.gold,x,y+.08,-9.434,.145,.012,.015);
      if(col%5===4)bx(m.metal,x+.13,y+.19,-9.52,.022,.34,.32);
    }
  }
  // A small peg rack of lighters, gum and batteries beside the tobacco display.
  bx(m.capGreen,1.13,2.6,-9.75,.95,1.65,.1);
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const x=.78+col*.23,y=2.06+row*.44,colMat=[m.blue,m.red,m.orange,m.green][col];
    bx(m.white,x,y,-9.67,.18,.31,.04);
    bx(m.metal,x,y+.17,-9.63,.035,.035,.06);
    if(row===0){bx(colMat,x,y,-9.60,.1,.22,.07);bx(m.metal,x,y+.13,-9.60,.1,.045,.07);}
    else if(row===1){bx(colMat,x,y,-9.60,.16,.13,.08);bx(m.white,x,y,-9.551,.12,.035,.012);}
    else for(const dx of [-.043,.043]){bx(m.black,x+dx,y,-9.60,.057,.21,.06);bx(m.gold,x+dx,y+.08,-9.56,.059,.055,.022);}
  }
  this.clerk=this.makePerson(9,false,'cashier');this.clerk.root.scale.setScalar(1.12);this.clerk.root.position.set(-2.2,0,-9.05);this.store.add(this.clerk.root);
  this.boxMesh(this.clerk.body,m.green,0,1.31,.25,.52,.67,.035);
  this.boxMesh(this.clerk.body,m.orange,0,1.55,.276,.52,.065,.02);
  this.boxMesh(this.clerk.body,m.white,-.14,1.48,.28,.15,.085,.025);
  // Four glass-door coolers, with individual bottles and cans on deep shelves.
  for(let door=0;door<4;door++){
    const x=2.5+door*1.18;
    bx(m.black,x,.1,-9.15,1.16,.2,1.15);bx(m.black,x,3.43,-9.15,1.16,.14,1.15);
    for(const side of [-1,1])bx(m.metal,x+side*.57,1.75,-9.15,.04,3.5,1.15);
    bx(m.white,x,1.8,-9.67,1.06,3.3,.06);
    for(const y of [.26,.83,1.4,1.97,2.54]){
      bx(m.metal,x,y,-9.12,1.08,.05,.99);
      for(let j=0;j<4;j++)for(let depth=0;depth<2;depth++)this.makeProduct(this.store,(door+j)%2?1:2,x-.41+j*.27,y+.03,-8.8-depth*.4,door+j+depth,.87);
    }
    bx(clear,x,1.72,-8.555,1.08,3.23,.025);
    for(const side of [-1,1])bx(m.metal,x+side*.55,1.74,-8.52,.055,3.47,.055);
    bx(m.metal,x+.4,1.73,-8.47,.05,.64,.06);bx(m.lamp,x,3.27,-8.6,.94,.08,.06);
  }
  // Cream pegboard gondolas, yellow price rails and individually stocked 3D packs.
  const shelf=(x,z,width,seed,angle=0,doubleSided=false)=>{
    const unit=new THREE.Group();unit.position.set(x,0,z);unit.rotation.y=angle;this.store.add(unit);
    const box=(mat,xx,y,zz,w,h,d)=>this.boxMesh(unit,mat,xx,y,zz,w,h,d);
    const depth=doubleSided?1.3:.78,back=doubleSided?0:-.35;
    box(m.storeWall,0,1.73,back,width,3.42,.09);
    for(const side of [-1,1])box(m.white,side*width/2,1.72,0,.09,3.44,depth);
    box(m.white,0,.12,0,width,.24,depth);
    for(const face of doubleSided?[-1,1]:[1]){
      for(let y=.4;y<3.2;y+=.17)for(let xx=-width/2+.18;xx<width/2-.1;xx+=.2)
        box(m.metal,xx,y,back+face*.05,.026,.035,.009);
      for(const [i,mat] of [m.orange,m.green,m.red].entries()){
        box(mat,0,3.32-i*.085,back+face*.052,width,.065,.013);
        box(mat,0,.21-i*.065,face*(depth/2+.015),width,.047,.025);
      }
      for(let level=0;level<6;level++){
        const y=.31+level*.47;
        box(m.white,0,y,face*(depth/4),width,.055,depth/2+.03);
        box(m.yellow,0,y+.005,face*(depth/2+.025),width,.06,.04);
        const count=Math.floor(width/.34);
        for(let j=0;j<count;j++){
          const xx=-width/2+.2+j*.34,kind=(level*2+Math.floor(j/2)+seed)%7;
          for(let row=0;row<(doubleSided?1:2);row++){
            if((j+level+seed+row)%13===0)continue; // Naturally uneven stock, not copied shelves.
            this.makeProduct(unit,kind,xx,y+.03,face*(depth/2-.12-row*.23),(j+level+seed)%6,.76+(j%3)*.025);
          }
          box(m.white,xx,y,face*(depth/2+.05),.14,.055,.015);
          box(m.black,xx-.02,y,face*(depth/2+.059),.034,.018,.008);
        }
      }
    }
    this.batchStatic(unit);return unit;
  };
  shelf(2.45,-4.75,3.8,3,-Math.PI/2,true);shelf(5.4,-4.75,3.8,5,-Math.PI/2,true);
  // To the cat's right: its front faces the clear dance space. The exit aisle stays open.
  shelf(-.55,-4.75,3.8,0,-Math.PI/2);
  // A raised facade, solid upper floors and adjoining party walls close the city block.
  bx(m.wall[0],0,15,-4.7,15,19.4,10.65);
  for(let y=7;y<24;y+=3.2){
    bx(m.concrete,0,y-1,.74,15,.15,.2);
    for(let x=-6;x<=6;x+=3){
      bx(m.glass,x,y,.66,1.85,1.85,.045);
      bx(m.white,x,y,.71,.065,1.85,.045);bx(m.white,x,y,.71,1.85,.065,.045);
      bx(m.metal,x+.6,y-.92,.92,.72,.45,.47);
      for(let j=0;j<4;j++)bx(m.black,x+.6,y-1.06+j*.09,1.16,.6,.025,.02);
    }
  }
  for(const side of [-1,1]){
    const cx=side*4.52;
    bx(clear,cx,2.3,.48,5.9,4.4,.025);
    for(const x of [side*1.56,side*7.47,side*4.5])bx(m.metal,x,2.3,.52,.07,4.6,.09);
    for(const [y,mat] of [[1.1,m.orange],[.95,m.green],[.8,m.red]])bx(mat,cx,y,.515,5.84,.1,.035);
  }
  bx(m.white,0,4.93,.83,15.1,1.08,.54);
  for(const side of [-1,1])for(const [i,mat] of [m.orange,m.green,m.red].entries())bx(mat,side*4.24,5.24-i*.28,1.11,6.05,.16,.03);
  bx(m.orange,0,5.27,1.15,.76,.17,.05);
  bx(m.red,.18,4.98,1.16,.22,.56,.05);bx(m.red,0,5.13,1.16,.64,.15,.05);
  bx(m.white,0,4.92,1.21,1.4,.21,.04);this.blockLetters(this.store,'ELEVEN',.045,4.92,1.25,.041,m.green);
  bx(m.lamp,0,4.31,.73,14.8,.1,.36);bx(m.white,0,.04,.92,15,.09,1);
  this.doors=[];
  for(const side of [-1,1]){
    const door=new THREE.Group();door.position.set(side*1.55,0,.49);this.store.add(door);
    this.boxMesh(door,clear,-side*.77,2.09,0,1.52,4.1,.03);
    for(const xx of [0,-side*1.54])this.boxMesh(door,m.metal,xx,2.09,0,.06,4.18,.065);
    for(const y of [.03,4.17])this.boxMesh(door,m.metal,-side*.77,y,0,1.58,.06,.065);
    this.boxMesh(door,m.metal,-side*1.32,1.6,.09,.045,.63,.09);this.doors.push(door);
  }
  // Small details: door mat, waste sorting bins, security dome and ceiling ventilation.
  bx(m.capGreen,0,.04,-.08,2.7,.025,1.2);
  for(let j=0;j<3;j++){bx([m.green,m.orange,m.blue][j],6.7-j*.6,.51,-.2,.49,1,.48);bx(m.black,6.7-j*.6,1.03,-.2,.32,.04,.28);}
  this.ellipsoid(this.store,m.black,6.85,4.73,-.25,.25,.23,.25);
  for(const x of [-3,3]){bx(m.white,x,5.12,-5.7,1.6,.12,1.4);for(let j=0;j<7;j++)bx(m.metal,x-.6+j*.2,5.049,-5.7,.055,.01,1.12);}
  this.batchStatic(this.store);
  this.shelfBag=new THREE.Group();this.makePacket(this.shelfBag);this.shelfBag.scale.setScalar(.776);this.scene.add(this.shelfBag);
 }
 makePacket(parent){
  const m=this.m;this.boxMesh(parent,m.chip,0,-.19,.01,.34,.54,.15);
  for(const y of [-.44,.07])this.boxMesh(parent,m.orange,0,y,.01,.36,.035,.16);
  this.boxMesh(parent,m.red,0,-.11,.091,.32,.09,.014);
  this.ellipsoid(parent,m.chipLight,0,-.28,.097,.17,.13,.018);
 }
 makeParticles(){
  this.particleMesh=new THREE.InstancedMesh(this.box,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthWrite:false}),256);
  this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particleMesh.frustumCulled=false;this.scene.add(this.particleMesh);this.particleDummy=new THREE.Object3D();this.particleMesh.count=0;
  this.effects=Array.from({length:256},()=>({life:0}));this.effectCursor=0;this.effectClock=0;this.lastIntroTime=0;
 }
 burst(x,y,z,count=16,color=0xffdb76,speed=2,size=.055){
  for(let i=0;i<count;i++){const e=this.effects[this.effectCursor++%this.effects.length],a=Math.random()*TAU;
    Object.assign(e,{x,y,z,vx:Math.cos(a)*speed*(.3+Math.random()),vy:1+Math.random()*speed,vz:Math.sin(a)*speed,life:.4+Math.random()*.55,maxLife:1,size,color});}
 }
 emitJetThrust(x,y,z,reducedMotion=false){
  const count=reducedMotion?1:3;
  for(const side of [-1,1])for(let i=0;i<count;i++){const e=this.effects[this.effectCursor++%this.effects.length];Object.assign(e,{x:x+side*.23+(Math.random()-.5)*.05,y:y+.31,z:z+.31+(Math.random()-.5)*.05,vx:(Math.random()-.5)*.22,vy:-2.4-Math.random()*1.5,vz:(Math.random()-.5)*.28,life:.28+Math.random()*.28,maxLife:.56,size:.035+Math.random()*.025,color:i%2?0xff8a2c:0x7defff});}
 }
 handleEvent(e){
  if(e.type==='state'&&e.state==='STARTING'){this.effects.forEach(p=>p.life=0);this.lastIntroTime=0;this.chaseZ=2.825;this.lastState='';}
  if(e.type==='state'&&e.state==='CAUGHT')this.captureStarts=null;
  if(e.type==='pickup'){
    if(e.kind==='coin'){this.cat.root.updateMatrixWorld(true);for(const side of [-1,1]){const mouth=this.cat.head.localToWorld(new THREE.Vector3(side*.2,-.36,.68));this.burst(mouth.x,mouth.y,mouth.z,5,0xffd578,.65,.033);}}
    else this.burst(e.x,e.y,0,32,0x62f7eb,2,.045);
  }
  if(e.type==='jump'||e.type==='land'||e.type==='slide')this.burst(e.x||this.cat.root.position.x,.09,0,12,0xa8abb0,1.2,.06);
  if(e.type==='hit'||e.type==='crash'||e.type==='shieldbreak'||e.type==='smash')this.burst(e.x||this.cat.root.position.x,.55,.1,36,e.type==='shieldbreak'?0x69f3e1:0xffbf65,3.6,.08);
 }
 updateEffects(game,dt,freeze,reducedMotion){
  const state=game.state,active=state==='RUNNING',moving=active?game.speed:0;
  if(!freeze){
    this.effectClock+=dt;

    // Ambient road particles stay disabled. Bursts are reserved for player
    // actions, pickups and damaged props so distant white pixels carry meaning.
  }
  let count=0;const dummy=this.particleDummy;
  for(const e of this.effects){if(e.life<=0)continue;if(!freeze){e.life-=dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.z+=(e.vz+moving)*dt;e.vy-=3*dt;}if(e.life<=0)continue;
    const size=e.size*Math.min(1,e.life*3);dummy.position.set(e.x,e.y,e.z);dummy.rotation.set(e.life*4,e.x,e.z);dummy.scale.setScalar(size);dummy.updateMatrix();this.particleMesh.setMatrixAt(count,dummy.matrix);this.particleMesh.setColorAt(count,new THREE.Color(e.color));count++;}
  this.particleMesh.count=count;this.particleMesh.instanceMatrix.needsUpdate=true;if(this.particleMesh.instanceColor)this.particleMesh.instanceColor.needsUpdate=true;
 }
 resize(width,height,{quality='clear'}={}){
  const ratio=Math.max(.35,width/Math.max(1,height)),clear=quality==='clear';let w,h;
  if(clear){const pixelRatio=Math.min(1.5,Math.max(1,globalThis.devicePixelRatio||1));this.renderer.setPixelRatio(pixelRatio);w=Math.max(1,Math.round(width));h=Math.max(1,Math.round(height));this.renderer.setSize(w,h,false);this.snapUniform.value.set(w*pixelRatio,h*pixelRatio);this.wobbleUniform.value=0;this.canvas.style.imageRendering='auto';}
  else {this.renderer.setPixelRatio(1);const pixels=quality==='low'?256*192:320*240;h=Math.max(120,Math.round(Math.sqrt(pixels/ratio)));w=Math.round(h*ratio);this.renderer.setSize(w,h,false);this.snapUniform.value.set(w,h);this.wobbleUniform.value=1;this.canvas.style.imageRendering='pixelated';}
  this.camera.aspect=ratio;this.camera.updateProjectionMatrix();this.width=width;this.height=height;this.canvas.dataset.renderResolution=(clear?'clear:':'')+w+'x'+h;
 }
 animateCat(cat,time,mode,player={},reducedMotion=false){
  const s=Math.sin(time*17),run=mode==='run',slide=slidePose(player.slide||0),stumble=(player.hit||0)>.3;
  cat.body.rotation.set(-slide+(stumble?.32:0)*(1-slide),0,stumble?Math.sin(time*25)*.09:0);cat.body.position.set(0,-.55*slide+(1-slide)*(stumble?-.2*Math.sin(clamp((1.15-(player.hit||0))/1.15,0,1)*Math.PI):run&&!reducedMotion?(1-Math.cos(time*34))*.018:0),0);
  cat.head.rotation.set(0,0,mode==='menu'&&!reducedMotion?Math.sin(time*1.5)*.025:0);
  cat.legs.forEach((l,i)=>l.rotation.x=run?s*(i?1:-1)*.8*(1-slide)+slide*.35:0);cat.arms.forEach((a,i)=>{a.rotation.x=run?s*(i?-1:1)*.6*(1-slide)-slide*.75:-.1;a.rotation.z=(i?1:-1)*.12;});cat.tail.rotation.z=Math.sin(time*4)*.14;cat.bag.rotation.x=0;
  if(mode==='ride'){cat.body.position.y=.24-slide*.12;cat.body.rotation.x=.04+slide*.30;cat.head.rotation.x=slide*.55;cat.legs.forEach(l=>l.rotation.x=-.6);cat.arms.forEach(a=>{a.rotation.x=-1.48-slide*.2;a.rotation.z=0;});}
  if(run&&player.hit>0){
    const impact=1.15-player.hit,fall=smooth(impact/.26),rise=smooth((impact-.6)/.55),seated=fall*(1-rise);
    cat.body.position.y=-.22*seated+Math.sin(Math.min(1,impact/.35)*Math.PI)*.14;
    cat.body.rotation.x=-.42*seated;cat.legs.forEach(l=>l.rotation.x=-1.45*seated);
    cat.arms.forEach((a,i)=>a.rotation.set(-.35*seated,0,(i?1:-1)*(.12+.3*seated)));
  }
  // The chip bag inherits every arm transform from the wrist attachment.
 }
 animateCop(c,t,strength=1,carrying=false,carrySide=0){
  if(c.authored&&this.effectiveModelSet==='refreshed'){this.updateAuthoredHuman(c,carrying?(carrySide<0?'carry_left':carrySide>0?'carry_right':'carry'):strength>.15?'chase':'alert',t*12);return;}
  if(c.baton){const parent=carrying?c.body:c.elbows[1];if(c.baton.parent!==parent)parent.add(c.baton);c.baton.position.set(carrying?.38:0,carrying?.87:-.49,carrying?-.13:.055);c.baton.rotation.set(carrying?0:-.25,0,carrying?-.12:0);}
  c.feet.forEach(f=>f.quaternion.identity());
  const s=Math.sin(t*12);c.legs.forEach((l,i)=>{const w=s*(i?1:-1);l.rotation.set(w*.59*strength,0,0);c.knees[i].rotation.set(Math.max(0,-w)*.85*strength,0,0);});c.arms.forEach((a,i)=>{a.rotation.set(s*(i?-1:1)*.65*strength,0,0);c.elbows[i].rotation.set(-.65*strength,0,0);});c.body.position.y=(1-Math.cos(t*24))*.017*strength;}
 updateChasingCops(game,dt,time){
  const px=game.player?.x||0;
  this.cops.forEach((cop,i)=>{
    cop.root.visible=true;cop.localChaseX??=px+(i?1:-1)*.96;cop.localChaseX+=(clamp(px+(i?1:-1)*.96,-3.55,3.55)-cop.localChaseX)*(1-Math.exp(-dt*6));
    cop.root.position.set(cop.localChaseX,0,this.chaseZ+i*.26);cop.root.rotation.y=Math.PI;this.animateCop(cop,time+i*.2,game.speed>0?1:0);
  });
 }
 // Solve a shoulder/elbow or hip/knee chain in its parent's coordinates.
 poseLimb(joint,hinge,end,target,pole,blend=1){
  const a=hinge.position.length(),b=end.length(),direction=target.clone().sub(joint.position);
  const distance=clamp(direction.length(),Math.abs(a-b)+.001,a+b-.001);direction.normalize();
  const bend=pole.clone().addScaledVector(direction,-pole.dot(direction));
  if(bend.lengthSq()<.00001)bend.set(1,0,0);bend.normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
  const upper=direction.clone().multiplyScalar(along).addScaledVector(bend,height);
  const upperQ=new THREE.Quaternion().setFromUnitVectors(hinge.position.clone().normalize(),upper.clone().normalize());
  const lower=direction.clone().multiplyScalar(distance).sub(upper).applyQuaternion(upperQ.clone().invert()).normalize();
  const lowerQ=new THREE.Quaternion().setFromUnitVectors(end.clone().normalize(),lower);
  joint.quaternion.slerp(upperQ,blend);hinge.quaternion.slerp(lowerQ,blend);
 }
 captureEntryPositions(px,offset=new THREE.Vector3(),lateralScale=1,arrivalCamera=this.camera){
  // Put the whole officer just beyond the nearest camera edge, rather than
  // waiting for his old chase position or making him pop in beside the cat.
  const views=[this.camera,arrivalCamera].map(camera=>{
   camera.updateMatrixWorld(true);
   return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  });
  const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0);right.y=0;right.normalize();
  const back=this.camera.getWorldDirection(new THREE.Vector3()).negate();back.y=0;back.normalize();
  return [-1,1].map(side=>{
   const center=new THREE.Vector3(offset.x+(px+side*1.04)*lateralScale,offset.y+1.35,.72);
   const sideways=right.clone().multiplyScalar(side),directions=[sideways,back,sideways.clone().add(back).normalize()];
   let nearest=null,length=Infinity;
   for(const direction of directions){
    // The arrest camera pulls back; remain outside both ends of that move.
    const distance=Math.max(...views.map(view=>{
     let exit=Infinity;
     for(const plane of view.planes){
      const slope=plane.normal.dot(direction);if(slope>=-.0001)continue;
      const n=plane.normal,radius=.85*Math.abs(n.x)+1.35*Math.abs(n.y)+.85*Math.abs(n.z);
      exit=Math.min(exit,Math.max(0,(plane.distanceToPoint(center)+radius+.35)/-slope));
     }
     return exit;
    }));
    if(distance<length){length=distance;nearest=center.clone().addScaledVector(direction,distance);}
   }
   return new THREE.Vector3((nearest.x-offset.x)/lateralScale,0,nearest.z);
  });
 }
 animateCapture(cat,cops,progress,crash={},starts=null,reducedMotion=false){
  const {fall,gather,lift,turn,carry}=capturePose(progress),seconds=progress*CAPTURE_DURATION,px=crash.x||0;
  const grip=smooth((progress-.25)/.11),fold=smooth((progress-.15)/.13),yaw=Math.PI*(1-turn);
  const travel=carry*2.8+Math.max(0,progress-1)*CAPTURE_DURATION*1.8,phase=turn*4+travel*4.2;
  const bob=reducedMotion?0:Math.sin(phase*2)*.014*lift;
  const recoil=.72*smooth(seconds/.4),carriedZ=recoil+travel;
  cat.root.position.set(px,(crash.y||0)*(1-fall)+Math.sin(Math.min(1,seconds/.6)*Math.PI)*.26+fall*.06+lift*.94+bob,carriedZ);
  cat.root.rotation.set(0,yaw,0);this.animateCat(cat,seconds,'caught',{},reducedMotion);
  cat.body.position.y=-.2*fall*(1-lift);cat.body.rotation.x=-.45*Math.sin(Math.min(1,seconds/.75)*Math.PI)*(1-grip);
  cat.head.rotation.z=Math.sin(seconds*2)*.045*(1-carry);
  cat.legs.forEach((leg,i)=>{leg.position.y=.4;leg.rotation.x=-1.5*fall*(1-lift)+Math.sin(phase+i*Math.PI)*.1*lift;});
  // Paws stay in front of the chest; officers support the hips from behind them.
  cat.arms.forEach((arm,i)=>{arm.rotation.set(-.2-fold*1.12,0,(i?-.22:.22)*fold);});
  cat.root.updateMatrixWorld(true);
  cops.forEach((cop,i)=>{
    const side=i?1:-1,start=starts?.[i]||new THREE.Vector3(px+side*1.1,0,3);
    const radius=1.04+.08*lift,angle=turn*Math.PI;
    cop.root.visible=true;
    cop.root.position.set(start.x+(px+side*radius*Math.cos(angle)-start.x)*gather,0,
      start.z+(.72+side*radius*Math.sin(angle)-start.z)*gather+travel);
    const entryYaw=Math.atan2(px+side*1.04-start.x,.72-start.z);
    const entryTurn=Math.atan2(Math.sin(entryYaw-Math.PI),Math.cos(entryYaw-Math.PI));
    cop.root.rotation.set(0,yaw+entryTurn*(1-smooth(gather/.8)),0);
    // Gait follows distance traveled, then stops completely for the planted lift.
    const approachDistance=Math.hypot(px+side*1.04-start.x,.72-start.z)*gather;
    const approachWeight=Math.sin(Math.PI*gather)*(progress<.35?1:0);
    const turnWeight=Math.sin(Math.PI*turn),carryWeight=smooth((progress-.67)/.04);
    const walking=Math.max(approachWeight,turnWeight*.55,carryWeight);
    const gait=approachDistance*4.2+phase+i*.35;
    this.animateCop(cop,gait/12,walking*.35,true,i?1:-1);
    const crouch=.79*smooth((progress-.19)/.14)*(1-lift);
    cop.body.position.y=-crouch+bob;cop.body.rotation.set(0,0,0);
    // Plant/lift alternating feet throughout the squat, lift, pivot and carry.
    const stride=.23*walking;
    cop.legs.forEach((leg,j)=>{
      const step=gait+j*Math.PI;
      const foot=new THREE.Vector3(leg.position.x,.09+Math.max(0,Math.sin(step))*.045*walking-cop.body.position.y,Math.cos(step)*stride);
      this.poseLimb(leg,cop.knees[j],new THREE.Vector3(0,-.4,.075),foot,new THREE.Vector3(0,0,1));
      cop.feet[j].quaternion.copy(leg.quaternion).multiply(cop.knees[j].quaternion).invert();
    });
    cop.root.updateMatrixWorld(true);
    const inner=i?1:0;
    const hand=cat.body.localToWorld(new THREE.Vector3(-side*.39,.60,-.28));
    cop.body.worldToLocal(hand);
    this.poseLimb(cop.arms[inner],cop.elbows[inner],new THREE.Vector3(0,-.34,.04),hand,new THREE.Vector3(0,0,-1),grip);
  });
  return {carriedX:px,carriedZ,lift,carry};
 }
 replaceCat(skin,look={},lookKey=[skin,look.fur,look.hat].join(':')){
  const old=this.cat;this.scene.remove(old.root);
  old.root.traverse(object=>{if(object.geometry&&![this.box,this.sphere,this.cylinder,this.plane].includes(object.geometry))object.geometry.dispose();});
  this.cat=this.makeCat(skin,look);this.scene.add(this.cat.root);this.skin=skin;this.lookKey=lookKey;
  return this.cat;
 }
 render(game={},dt=1/60,{skin='18bro',fur,hat,menu=false,reducedMotion=false}={}){
  this.restoreOriginalHero();
  const state=game.state||'MAIN_MENU',isMenu=menu||state==='MAIN_MENU',isOver=state==='GAME_OVER',isPaused=state==='PAUSED',isStarting=state==='STARTING'||isPaused&&game._beforePause==='STARTING',isCaught=state==='CAUGHT'||isPaused&&game._beforePause==='CAUGHT';
  dt=Math.min(dt,.05);if(!isPaused)this.clock+=dt;if(state!==this.lastState){if(!(state==='PAUSED'||this.lastState==='PAUSED'))this.stateTime=0;this.lastState=state;}if(!isPaused)this.stateTime+=dt;
  const lookKey=[skin,fur,hat].join(':');if(lookKey!==this.lookKey)this.replaceCat(skin,{fur,hat},lookKey);
  const p=game.player||{},dist=isStarting?introPose(game.introProgress*INTRO_DURATION).distance:game.distance||0,t=Math.floor(this.clock*12)/12,moon=game.powers?.has('moon'),speedburst=game.powers?.has('speedburst'),riding=game.powers?.has('moped')&&!isCaught&&!isOver;
  const route=game.route||getRouteProfile(dist),newStreet=dist>=230&&!isMenu&&!isStarting;
  const worldCurve=routeCenter(dist),offsetX=route.offsetX||0,offsetY=route.offsetY||0;
  const branch=BRANCHES.find(b=>b.id===route.branch),branchEase=branch?Math.min(1,Math.abs(offsetX)/(Math.abs(branch.offset)||10)):(route.arcade||0),lateralScale=1-branchEase*.68;
  this.routeWorldOffset=new THREE.Vector3(offsetX,offsetY,0);
  this.routeLateralScale=lateralScale;
  this.wobbleUniform.value=reducedMotion?.18:1;
  const night=route.night||0,cityFog=new THREE.Color(0x5a6764).lerp(new THREE.Color(0x181526),night);
  const lightingBlend=smooth((dist-230)/140)*(isMenu||isStarting?0:1);
  this.hemi.intensity=2.1+(1.15-night*.58-2.1)*lightingBlend;
  this.keyLight.intensity=2+(1.05-night*.65-2)*lightingBlend;
  this.rimLight.intensity=1+(.35-1)*lightingBlend;
  this.scene.fog.color.set(0x172c3c).lerp(cityFog,lightingBlend);this.scene.background.set(0x101b2a).lerp(cityFog,lightingBlend);
  this.scene.fog.near=isMenu||isStarting?24:(route.fogNear||23);
  this.scene.fog.far=isMenu||isStarting?108:(route.fogFar||90);
  const it=isStarting?game.introProgress*INTRO_DURATION:0,inside=isMenu||isStarting&&it<2.65,freeze=isPaused||isCaught||isOver;
  for(let i=0;i<7;i++){const root=this.chunks[i].root;const s=Math.round((170-i*30+210*Math.floor((dist+i*30)/210))*1e6)/1e6;root.position.z=dist-s;root.visible=s<230;root.position.x=routeCenter(s)-worldCurve;}
  this.world.visible=true;this.skyline.position.z=-smooth((dist-160)/90)*90;this.skyline.visible=dist<270;
  this.district.update(game,freeze?0:dt);
  this.updatePeople(dist,freeze?this.frozenClock:t,isMenu||isStarting);if(!freeze)this.frozenClock=t;
  for(const person of this.people){const s=dist-person.root.position.z;person.root.visible=person.root.visible&&s<230;person.root.position.x+=routeCenter(s)-worldCurve;}
  this.store.visible=isMenu||isStarting||dist<55;this.store.position.z=STORE.z+dist;this.menuProps.visible=false;if(this.storeInfill)this.storeInfill.visible=dist>=55;
  this.cat.root.visible=true;this.cat.root.scale.setScalar(.776);this.cat.bag.visible=!isMenu&&(!isStarting||it>=.95);
  this.cat.magnet.visible=!!game.powers?.has('magnet')&&!isCaught&&!isOver;this.cat.moonBoots.forEach(boot=>boot.visible=!!moon&&!isCaught&&!isOver);
  this.cat.jetpack.visible=!!game.powers?.has('jetpack')&&!isCaught&&!isOver;this.cat.shield.visible=!!game.powers?.has('shield')&&!isCaught&&!isOver;
  this.cat.jetpack.userData.flames.visible=this.cat.jetpack.visible;this.cat.jetpack.userData.flames.scale.y=1.12+Math.sin(t*29)*.24;for(const plume of this.cat.jetpack.userData.flames.children)plume.rotation.z=Math.sin(t*23+plume.position.x*8)*.045;
  this.animateShield(this.cat.shield,t,reducedMotion);if(this.authoredHero)this.animateShield(this.authoredHero.shield,t,reducedMotion);
  this.moped.visible=!!riding;this.stars.visible=(isCaught||isOver)&&!!game.crash;this.shelfBag.visible=isMenu||isStarting&&it<.95;
  let goalFov=65;
  if(isMenu||isStarting){
    const pose=introPose(it),dance=pose.dance;
    this.cat.root.position.set(pose.x,.09+Math.abs(dance)*.13,pose.z);
    this.cat.root.rotation.set(0,pose.yaw,0);
    this.animateCat(this.cat,this.clock,pose.running?'run':'menu',{},reducedMotion);
    if(it<1.45){this.cat.arms[1].rotation.x=pose.arm;this.cat.head.rotation.y=-.08* smooth(it/.8);}
    if(!pose.running){
      const step=pose.turnStep;
      this.cat.legs.forEach((leg,i)=>{const swing=Math.sin(it*19+i*Math.PI);leg.rotation.x=swing*.32*step;leg.position.y=.4+Math.max(0,swing)*.055*step;});
      this.cat.body.position.y+=Math.abs(Math.sin(it*19))*.018*step;
    }else this.cat.legs.forEach(leg=>leg.position.y=.4);
    if(pose.burst>0){this.cat.body.rotation.x=-.2*pose.burst;this.cat.arms[0].rotation.x=-1.5*pose.burst;this.cat.head.rotation.x=.12*pose.burst;this.cat.root.position.y+=.1*pose.burst;}

    if(dance){this.cat.body.rotation.z=dance*.19;this.cat.head.rotation.z=-dance*.12;this.cat.arms[0].rotation.z=-.75-Math.abs(dance)*.45;this.cat.arms[1].rotation.x=-.68;this.cat.legs[0].rotation.x=dance*.45;this.cat.legs[1].rotation.x=-dance*.45;}
    // The shelf packet has exactly the same world transform as the wrist at contact, with no pop.
    const rootPos=this.cat.root.position.clone(),rootQuat=this.cat.root.quaternion.clone(),armAngle=this.cat.arms[1].rotation.x;
    this.cat.root.position.set(-11.6,.09,-3.4);this.cat.root.rotation.y=Math.PI;this.cat.arms[1].rotation.x=-1.32;this.cat.root.updateMatrixWorld(true);
    this.cat.bag.getWorldPosition(this.shelfBag.position);this.cat.bag.getWorldQuaternion(this.shelfBag.quaternion);
    this.cat.root.position.copy(rootPos);this.cat.root.quaternion.copy(rootQuat);this.cat.arms[1].rotation.x=armAngle;
    this.doors.forEach((d,i)=>{const side=i?1:-1;d.rotation.y=side*(pose.doors*1.52+Math.sin(Math.max(0,it-3.06)*18)*Math.exp(-Math.max(0,it-3.06)*3)*.19*pose.doors);});
    const e=pose.exterior,c=pose.chase;
    this.target.set(-8.9+e*8.6,2.35+e*.95,-.35+e*2.15+dist*(1-c)).lerp(new THREE.Vector3(0,3.85,7.3),c);
    this.cameraTarget.set(-12.6+e*5.4,1.22+e*1.13,-2.95-e*2.05+dist*(1-c)).lerp(new THREE.Vector3(0,1.4,-10),c);
    goalFov=67-c*2+pose.burst*7;
    if(!reducedMotion){this.target.y+=Math.sin(it*52)*.08*pose.burst;this.target.x+=Math.sin(it*39)*.05*pose.burst;}
    this.clerk.arms.forEach((arm,i)=>{arm.rotation.x=-2.45*pose.clerk;arm.rotation.z=(i?1:-1)*(.12+.28*pose.clerk);this.clerk.elbows[i].rotation.x=-.85*pose.clerk;});
    this.clerk.body.rotation.z=Math.sin(it*21)*.035*pose.clerk;this.updateAuthoredHuman(this.clerk,pose.clerk>.05?'panic':'clerk',it*4);
    this.cops.forEach((cop,i)=>{const pos=pose.officers[i];cop.root.visible=!isMenu;cop.root.position.set(pos.x,0,pos.z);cop.root.rotation.y=Math.PI;this.animateCop(cop,this.clock+i*.19,it>3.5?1:.14);});this.chaseZ=2.825;
    if(!isPaused&&isStarting){if(this.lastIntroTime<.95&&it>=.95)this.burst(-11.9,1.1,-3.4,14,0xffdc7b,1.2,.045);if(this.lastIntroTime<3.02&&it>=3.02){this.burst(-6.75,.45,STORE.z+dist,48,0xf3e3be,3.1,.06);for(const side of [-1,1])this.burst(-6.6,1.5,STORE.z+dist+side*1.4,16,0xffffd2,2.6,.035);}this.lastIntroTime=it;}
  }else if(isCaught||isOver){
    const progress=(game.captureProgress??1)+(isOver?Math.min(8,this.stateTime)/CAPTURE_DURATION:0),px=game.crash?.x??p.x??0;
    this.target.set(px*.35,3.25,8.8);this.cameraTarget.set(px*.3,1.15,-1);goalFov=64;
    if(!this.captureStarts){
     const arrival=this.camera.clone(),look=this.cameraTarget.clone();arrival.position.copy(this.target);arrival.fov=goalFov;
     if(newStreet){
      arrival.position.x+=offsetX;arrival.position.y+=offsetY;
      look.x+=(branch?branchOffset(branch,dist+10).x:offsetX)+(routeCenter(dist+16)-worldCurve);look.y+=offsetY;
      if(branch){arrival.position.z=6.2-branchEase*1.4;arrival.position.y-=1.3*branchEase;look.z=-5;arrival.fov=70;}
     }
     arrival.lookAt(look);arrival.updateProjectionMatrix();
     this.captureStarts=this.captureEntryPositions(px,newStreet?this.routeWorldOffset:new THREE.Vector3(),newStreet?lateralScale:1,arrival);
    }
    const {carriedX,carriedZ,lift,carry}=this.animateCapture(this.cat,this.cops,progress,{...game.crash,x:px},this.captureStarts,reducedMotion);
    this.stars.position.set(carriedX,1.9+lift*.92,carriedZ);this.stars.children.forEach((star,i)=>{const a=this.clock*3+i*TAU/5;star.position.set(Math.cos(a)*.56,Math.sin(a*2)*.055,Math.sin(a)*.3);star.rotation.set(0,-a*.3,Math.sin(a)*.2);});
  }else{
    const px=p.x||0,py=p.y||0;this.cat.root.position.set(px,py+(riding?.08:0),p.hit>0?.65*Math.sin(Math.PI*smooth((1.15-p.hit)/1.15)):0);this.cat.root.rotation.set(0,Math.PI,0);this.animateCat(this.cat,t,riding?'ride':p.anim==='idle'?'menu':'run',p,reducedMotion);
    if(py>.1&&!riding){this.cat.legs[0].rotation.x=-.65;this.cat.legs[1].rotation.x=.45;}
    this.moped.position.set(px,py,0);this.moped.rotation.y=Math.PI;this.moped.userData.wheels?.forEach(w=>w.rotation.x=-dist*3.7);
    const flying=game.powers?.has('jetpack')||py>3.2;
    this.target.set(px*.1,3.85+(flying?py*.9:Math.min(py*.14,.6)),7.3);this.cameraTarget.set(px*.12,1.4+(flying?py*.9:0),-10);
    const targetZ=1.1+(game.policeDistance??10)*1.15;this.chaseZ+=clamp((targetZ-this.chaseZ)*(1-Math.exp(-dt*2.2)),-dt*5,dt*4)*(isPaused?0:1);
    // Officers fall behind in world space and leave below the camera naturally. Never toggle them at a distance threshold.
    this.updateChasingCops(game,isPaused?0:dt,t);
    goalFov=riding?77:moon?78:65+clamp(((game.speed||10.4)-10.4)/18,0,1)*7;
  }
  if(newStreet){
    this.cat.root.position.x=this.cat.root.position.x*lateralScale+offsetX;this.cat.root.position.y+=offsetY;
    if(!isCaught&&!isOver){const ahead=branch?branchOffset(branch,dist+1):{x:offsetX,y:offsetY};this.cat.root.rotation.y-=Math.atan2((ahead.x-offsetX)+(routeCenter(dist+1)-worldCurve),1);if(game.state==='ARCADE')this.animateCat(this.cat,t,'menu',{},reducedMotion);}
    this.moped.position.x=this.moped.position.x*lateralScale+offsetX;this.moped.position.y+=offsetY;
    this.cops.forEach(c=>{c.root.position.x=c.root.position.x*lateralScale+offsetX;c.root.position.y+=offsetY;});
    this.target.x+=offsetX;this.target.y+=offsetY;this.cameraTarget.x+=(branch?branchOffset(branch,dist+10).x:offsetX)+(routeCenter(dist+16)-worldCurve);this.cameraTarget.y+=offsetY;
    if(branch){this.target.z=6.2-branchEase*1.4;this.target.y-=1.3*branchEase;this.cameraTarget.z=-5;goalFov=70;}
    if(this.stars.visible){this.stars.position.x=this.stars.position.x*lateralScale+offsetX;this.stars.position.y+=offsetY;}
  }
  this.extraCops.forEach((cop,i)=>{const pressure=smooth(((route.night||0)-.42)/.58);cop.root.visible=newStreet&&!isCaught&&!isOver&&state!=='ARCADE'&&pressure>0;const retreat=Math.max(0,this.chaseZ-12.6);cop.root.position.set(offsetX+(i?1:-1)*2.25*lateralScale,offsetY,12-pressure*9+i*.7+retreat);cop.root.rotation.y=Math.PI;this.animateCop(cop,t+i*.4,game.speed>0?.85:0);});
  for(const slot of this.entities.values())slot.group.visible=false;
  for(const e of game.entities||[]){
    if(!e.active||isMenu||e.z < -170)continue;
    let slot=this.entities.get(e.id);if(!slot){slot={group:new THREE.Group(),variants:new Map(),type:''};this.scene.add(slot.group);this.entities.set(e.id,slot);}
    const type=e.type,isPower=POWER_TYPES.includes(type),variantKey=type==='crossTraffic'?`${type}-${e.vehicleKind||e.variant||0}`:isPower?`${type}-${this.effectiveModelSet}`:type;
    if(!slot.variants.has(variantKey)){const mesh=type==='crossTraffic'?(e.vehicleKind==='scooter'?this.makeMoped(e.id,true):this.makeRouteVehicle(e.vehicleKind==='bus'?2:e.vehicleKind==='van'?1:e.vehicleKind==='police'?3:0)):this.makeEntity(type,e.id);slot.group.add(mesh);slot.variants.set(variantKey,mesh);}
    if(slot.type!==variantKey){for(const [key,mesh] of slot.variants)mesh.visible=key===variantKey;slot.type=variantKey;}
    const visualZ=e.z+(isStarting?dist:0),s=dist-visualZ,entityBranch=e.routeBranch||null,branchPose=entityBranch?branchOffset(entityBranch,s):{x:e.finale?getRouteProfile(s).offsetX:0,y:0};
    const sameBranch=!!entityBranch&&entityBranch===route.branch,scale=sameBranch?lateralScale:1;
    slot.group.visible=!(type==='crossTraffic'&&e.x>20.7);slot.group.scale.set(scale,1,1);
    slot.group.position.set(e.x*scale+routeCenter(s)-worldCurve+(branchPose.x||0),(e.y||0)+(branchPose.y||0),visualZ);
    slot.group.rotation.set(0,e.yaw??(type==='coin'?t*2:0),0);
    const mesh=slot.variants.get(variantKey);if(!freeze)mesh.userData.wheels?.forEach(w=>w.rotation.x+=dt*(game.speed||0)*Math.max(0,(e.actualApproach??e.approachFactor)-1)*3.3);if(mesh.userData.rider)this.updateAuthoredHuman(mesh.userData.rider,'ride',this.clock*5,freeze);if(isPower)this.animatePowerup(mesh,type,t,e.id,reducedMotion);
  }
  if(!isPaused){this.camera.position.lerp(this.target,isMenu?1:1-Math.exp(-dt*(isStarting?8:9)));this.camera.lookAt(this.cameraTarget);this.camera.fov+=(goalFov-this.camera.fov)*(1-Math.exp(-dt*9));this.camera.updateProjectionMatrix();}
  if((moon||riding||speedburst)&&!freeze&&this.clock-(this.lastBoost||0)>.05){this.lastBoost=this.clock;this.burst(this.cat.root.position.x,this.cat.root.position.y+.4,.9,reducedMotion?2:5,speedburst?0x59c9ff:moon?0xffd44f:0x71f9ed,speedburst?3.1:2,.05);}
  if(this.cat.jetpack.visible&&!freeze&&this.clock-(this.lastJetThrust||0)>.035){this.lastJetThrust=this.clock;this.emitJetThrust(this.cat.root.position.x,this.cat.root.position.y,this.cat.root.position.z,reducedMotion);}
  this.updateEffects(game,isPaused?0:dt,isPaused||isOver,reducedMotion);
  this.updateAuthoredHero(game,dt,{skin,fur,hat,menu,reducedMotion});
  this.updateDebug(game,isMenu||isOver||isStarting);this.renderer.render(this.scene,this.camera);
 }
 updateDebug(game,hide){const show=game.debug?.showColliders&&!hide;this.debugBoxes.visible=!!show;if(!show)return;const es=game.entities.filter(e=>e.active&&['traffic','blocker','jump','slide'].includes(e.type));for(let i=0;i<=es.length;i++){if(!this.debugPool[i]){const mesh=new THREE.LineSegments(new THREE.EdgesGeometry(this.box),new THREE.LineBasicMaterial({color:0x76f55a,depthTest:false}));mesh.renderOrder=100;this.debugBoxes.add(mesh);this.debugPool.push(mesh);}const m=this.debugPool[i];m.visible=true;if(i===0){const p=game.player; m.position.set(p.x,p.y+(p.slide>0?.32:.85),0);m.scale.set(.6,p.slide>0?.64:1.7,.5);}else{const e=es[i-1];m.position.set(e.x,e.type==='slide'?2:e.type==='jump'?.5:1.2,e.z);m.scale.set(e.width,e.type==='slide'?.96:e.type==='jump'?1:2.4,e.depth);}}for(let i=es.length+1;i<this.debugPool.length;i++)this.debugPool[i].visible=false;}
 get stats(){return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,chunks:this.chunks.length};}
 dispose(){this.disposeCharacterModels();this.renderer.dispose();this.scene.traverse(o=>o.geometry?.dispose());this.materials.forEach(m=>{m.map?.dispose();m.dispose()});}
}
