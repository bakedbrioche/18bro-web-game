import * as THREE from './vendor/three.module.js';
import { ROUTE, BRANCHES, getRouteProfile, routeCenter, branchOffset, getTrafficPhase } from './route.mjs?v=street-26';

// A small rolling set of physical street sections. Coordinates are measured along
// the same continuous route as hazards and the player, including shop shortcuts.
const START=230, LENGTH=20, AHEAD=120, BEHIND=35;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rnd=(n)=>{let a=(n*1664525+1013904223)>>>0;return()=>((a=(a*1664525+1013904223)>>>0)/4294967296);};
const palette=['#ad322b','#246e4d','#e0b94f','#2b5892','#853a65','#bb6d32'];
const neon=['#ff5146','#6cff8b','#ffe878','#55b8ff','#ef71dd','#ffa344'];
const SHOPS=[['添記麵家','NOODLES'],['永安藥房','PHARMACY'],['榮華餅家','BAKERY'],['通訊專門','PHONE SHOP'],['電器修理','REPAIRS'],['金美時裝','CLOTHING'],['茶香閣','TEA HOUSE'],['佳記雜貨','GROCERY'],['華興押','PAWN'],['便利士多','MINI MART']];
const NIGHTS=[['金龍卡拉OK','KARAOKE'],['遊戲機中心','GAME CENTRE'],['明星夜總會','NIGHT CLUB'],['金華旅館','HOTEL'],['新世界酒吧','BAR'],['深夜食堂','RESTAURANT']];
function pixelTexture(draw,w=128,h=128){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;draw(c,w,h);
 const t=new THREE.CanvasTexture(canvas);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
function text(c,s,x,y,size,col='#f4e1b2'){c.fillStyle=col;c.font=`bold ${size}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(s,x,y);}
function verticalSign(c,s,w,h,col){c.fillStyle='#17151b';c.fillRect(0,0,w,h);c.strokeStyle=col;c.lineWidth=2;c.strokeRect(3,3,w-6,h-6);c.strokeRect(7,7,w-14,h-14);[...s].slice(0,5).forEach((v,i)=>text(c,v,w/2,18+i*(h-29)/Math.min(5,s.length),23,col));}

export class DistrictScene {
 constructor(owner){
  this.owner=owner;this.root=new THREE.Group();this.root.name='continuous-Hong-Kong-route';this.chunks=new Map();this.time=0;this.makeMaterials();
 }
 makeMaterials(){
  const o=this.owner,m=this.m={};
  const mat=(color,extra={})=>o.mat(color,extra);
  m.dark=mat(0x20242b);m.black=mat(0x111317);m.metal=mat(0x69756f);m.concrete=mat(0x867e71);m.cream=mat(0xc1ba98);m.white=mat(0xe1d9b8);m.wood=mat(0x73543a);m.yellow=mat(0xd0a626);m.red=mat(0x9f312a);m.green=mat(0x326c52);m.blue=mat(0x3a536c);m.skin=mat(0xb08c6e);
  m.colors=palette.map(c=>mat(c));m.lights=neon.map(c=>mat(c,{emissive:c,emissiveIntensity:1.1}));m.warm=mat(0xebbd6c,{emissive:0xebaa41,emissiveIntensity:.55});m.tube=mat(0xb4d9a4,{emissive:0x92ca81,emissiveIntensity:.65});
  m.road=mat(0xffffff,{map:pixelTexture((c,w,h)=>{const r=rnd(91);c.fillStyle='#36373b';c.fillRect(0,0,w,h);for(let i=0;i<900;i++){c.fillStyle=i%2?'#414046':'#292e33';c.fillRect(r()*w,r()*h,1+r()*2,1);}c.strokeStyle='#20282b';for(let i=0;i<4;i++){c.beginPath();c.moveTo(r()*w,0);c.lineTo(r()*w,32);c.lineTo(r()*w,h);c.stroke();}},64,64)});
  m.pavement=mat(0xffffff,{map:pixelTexture((c,w,h)=>{c.fillStyle='#837e71';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){c.fillStyle=((x+y)/16)%3?'#9b9585':'#8b877c';c.fillRect(x+1,y+1,14,14);c.fillStyle='#736e64';c.fillRect(x+4,y+5,2,1);} },64,64)});
  m.tile=mat(0xffffff,{map:pixelTexture((c,w,h)=>{c.fillStyle='#aca89a';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){c.fillStyle=((x+y)/8)%5?'#c3bba4':'#aba48f';c.fillRect(x+1,y+1,7,7);}},64,64)});
  m.shutter=mat(0xffffff,{map:pixelTexture((c,w,h)=>{c.fillStyle='#747b73';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=4){c.fillStyle='#444f4b';c.fillRect(0,y,w,1);c.fillStyle='#92938a';c.fillRect(0,y+1,w,1);}c.fillStyle='#6a5042';c.fillRect(13,32,2,19);c.fillRect(39,11,1,30);},64,64)});
  m.window=mat(0xffffff,{map:pixelTexture((c,w,h)=>{c.fillStyle='#162e33';c.fillRect(0,0,w,h);c.fillStyle='#596b65';c.fillRect(2,2,w-4,3);c.fillRect(2,2,3,h-4);c.fillRect(w/2,0,2,h);c.fillRect(0,h/2,w,2);c.fillStyle='#334c4c';c.fillRect(7,8,18,17);c.fillStyle='#828478';c.fillRect(38,6,18,28);},64,64)});
  m.facades=Array.from({length:5},(_,i)=>mat(0xffffff,{map:pixelTexture((c,w,h)=>{const r=rnd(120+i);c.fillStyle=['#9d9981','#74877c','#ac927a','#899da0','#a69884'][i];c.fillRect(0,0,w,h);for(let q=0;q<260;q++){c.fillStyle=q%2?'#4b54474b':'#b5ae9249';c.fillRect(r()*w,r()*h,1+r()*5,2+r()*11);}for(let y=0;y<h;y+=64){c.fillStyle='#656e61';c.fillRect(0,y,w,3);for(let x=0;x<w;x+=42){c.fillStyle='#b4b2a0';c.fillRect(x+7,y+12,30,38);c.fillStyle='#263a3c';c.fillRect(x+10,y+15,24,31);c.fillStyle='#757f76';c.fillRect(x+21,y+14,2,34);c.fillRect(x+9,y+29,26,2);c.fillStyle='#596660';c.fillRect(x+5,y+50,34,4);if((x+y+i)%3){c.fillStyle='#a4a596';c.fillRect(x+24,y+35,13,12);c.fillStyle='#51594f';for(let k=0;k<4;k++)c.fillRect(x+26,y+37+k*2,9,1);}}} },128,128)}));
  m.fascias=[...SHOPS,...NIGHTS].map(([cn,en],i)=>mat(0xffffff,{map:pixelTexture((c,w,h)=>{c.fillStyle=i<10?['#aa3931','#eee0ab','#25674c','#355987'][i%4]:'#15191c';c.fillRect(0,0,w,h);c.strokeStyle=i<10?'#edd7a3':neon[i%6];c.lineWidth=2;c.strokeRect(2,2,w-4,h-4);text(c,cn,w/2,21,21,i<10?(i%4===1?'#87312b':'#f2e0b6'):neon[i%6]);text(c,en,w/2,48,10,'#dcc9a7');},128,64),emissive:0xffffff,emissiveIntensity:i<10?.10:1.1}));
  m.vertical=[...SHOPS,...NIGHTS].map(([cn],i)=>mat(0xffffff,{map:pixelTexture((c,w,h)=>verticalSign(c,cn,w,h,i<10?['#c19a53','#e7d5ad','#b45642'][i%3]:neon[i%6]),64,128),side:THREE.DoubleSide,emissive:0xffffff,emissiveIntensity:i<10?.17:1.15}));
  m.menu=mat(0xffffff,{map:pixelTexture((c,w,h)=>{c.fillStyle='#dbca94';c.fillRect(0,0,w,h);text(c,'今日特餐',32,10,13,'#ab3929');for(let y=22;y<64;y+=8){c.fillStyle='#453e30';c.fillRect(5,y,28,2);c.fillRect(45,y,13,2);}},64,64)});
  m.crowds=Array.from({length:6},(_,i)=>mat(0xffffff,{map:pixelTexture((c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#34322c';c.fillRect(22,7,20,17);c.fillStyle='#b29472';c.fillRect(24,12,16,21);c.fillStyle=palette[i];c.fillRect(17,33,31,44);c.fillRect(12,38,8,40);c.fillRect(46,39,7,40);c.fillStyle='#343e45';c.fillRect(19,76,11,40);c.fillRect(36,76,11,40);c.fillStyle='#1c232b';c.fillRect(16,114,15,8);c.fillRect(35,114,17,8);},64,128),transparent:true,alphaTest:.5,side:THREE.DoubleSide}));
  m.wet=palette.map(col=>mat(0xffffff,{map:pixelTexture((c,w,h)=>{c.fillStyle='#393139';c.fillRect(0,0,w,h);c.fillStyle=col;const r=rnd(col.charCodeAt(2));for(let i=0;i<18;i++)c.fillRect(12+r()*34,r()*h,8+r()*24,1+r()*4);c.fillStyle='#655746';for(let i=0;i<8;i++)c.fillRect(r()*w,r()*h,2,1);},64,64)}));
  m.signRed=mat(0xaa2421,{emissive:0xe93727,emissiveIntensity:.7});m.signGreen=mat(0x48a74e,{emissive:0x5bdd5b,emissiveIntensity:.7});m.signAmber=mat(0xba8b24,{emissive:0xebba31,emissiveIntensity:.65});
  for(const material of [...m.fascias,...m.vertical,...m.crowds,m.menu,...m.wet])material.map.wrapS=material.map.wrapT=THREE.ClampToEdgeWrapping;
  for(const material of [...m.facades,...m.wet]){material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-2;}
  for(const material of m.crowds)material.transparent=false;
 }
 box(g,mat,x,y,z,w,h,d,ry=0){const mesh=this.owner.boxMesh(g,mat,x,y,z,w,h,d);mesh.rotation.y=ry;return mesh;}
 plane(g,mat,x,y,z,w,h,ry=0,rx=0,repeatX=1,repeatY=1){const geo=this.owner.plane.clone();const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*repeatX,uv.getY(i)*repeatY);const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,1);mesh.rotation.set(rx,ry,0);mesh.userData.districtOwned=true;g.add(mesh);return mesh;}
 line(g,mat,a,b,width=.06){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),mesh=this.box(g,mat,0,0,0,width,end.distanceTo(start),width);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize());return mesh;}
 solidStrip(g,mat,start,end,edges,bottom,top){
  // Closed volumes follow both edges of a bend. Adjacent bays share their end
  // vertices, so seeing a shop from the side cannot expose the sky behind it.
  for(let s=start;s<end-.001;s+=1){
   const t=Math.min(end,s+1),a=edges(s),b=edges(t);
   if(a[1]-a[0]<.0001&&b[1]-b[0]<.0001)continue;
   const geo=this.owner.box.clone(),p=geo.attributes.position;
   for(let i=0;i<p.count;i++){
    const edge=p.getZ(i)>0?a:b;
    p.setXYZ(i,edge[p.getX(i)>0?1:0],p.getY(i)>0?top:bottom,edge[2]);
   }
   geo.computeVertexNormals();geo.computeBoundingSphere();
   const mesh=new THREE.Mesh(geo,mat);mesh.userData.districtOwned=true;mesh.userData.buildingShell=true;g.add(mesh);
  }
 }
 ribbon(g,mat,start,end,left,right,y=0,uvScale=4){
  const p=[],u=[],n=[],base=routeCenter(g.userData.s);for(let s=start;s<end-.01;s+=2){const t=Math.min(end,s+2),edges=[s,t].map(a=>{const profile=getRouteProfile(a),cx=routeCenter(a)-base;return[cx+(typeof left==='function'?left(profile,a):left),cx+(typeof right==='function'?right(profile,a):right),g.userData.s-a];});const [a,b]=edges;
   for(const [x,z,ss]of[[a[0],a[2],s],[a[1],a[2],s],[b[0],b[2],t],[a[1],a[2],s],[b[1],b[2],t],[b[0],b[2],t]]){p.push(x,typeof y==='function'?y(ss):y,z);u.push((x+base)/uvScale,ss/uvScale);n.push(0,1,0);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));geo.computeBoundingSphere();const mesh=new THREE.Mesh(geo,mat);mesh.userData.districtOwned=true;g.add(mesh);
 }
 branchAt(s,side){return BRANCHES.find(b=>b.id!=='crossing'&&b.id!=='van-cover'&&s>=b.start-5&&s<=b.end+5&&(b.offset||0)*side>0);}
 makeChunk(key){
  const s=START+key*LENGTH,g=new THREE.Group();g.userData={s,people:[],signals:[]};const r=rnd(819+key*61),m=this.m;
  this.ribbon(g,m.road,s,s+LENGTH,p=>-p.roadHalfWidth,p=>p.roadHalfWidth,-.045,4);
  for(const side of [-1,1]){
   this.ribbon(g,m.pavement,s,s+LENGTH,p=>side<0?-p.buildingEdge:p.roadHalfWidth,p=>side<0?-p.roadHalfWidth:p.buildingEdge,.08,4);
   for(let i=0;i<2;i++){
    const at=s+5+i*10,profile=getRouteProfile(at),x=routeCenter(at)-routeCenter(s),z=s-at,edge=profile.buildingEdge;
    const cross=Math.abs(at-3150)<25;
    if(!cross)this.building(g,side,x,z,at,key*4+i+(side>0?2:0),profile);
    else this.crossStreet(g,at,side,x,z,profile);
    if(!cross&&(!this.branchAt(at,side)||profile.roadHalfWidth>10)){
     const px=x+side*(edge-.95),count=profile.night>.45?2:1;
     for(let q=0;q<count;q++)this.person(g,px+side*q*.32,z+q*2.4,(key*7+i+q+(side>0?2:0))%6);
     if(i===0&&key%3===0)this.props(g,x+side*(edge-.7),z+2,side,key,profile);
    }
    if(profile.night>.12&&r()<profile.night*.8)this.plane(g,m.wet[(key+i)%6],x+side*2,-.038,z,1.3,5,0,-Math.PI/2);
   }
  }
  if(key%3===0&&!(s>3070&&s<3210)){
   const p=getRouteProfile(s+11),cx=routeCenter(s+11)-routeCenter(s),zz=-11;
   for(let q=0;q<3;q++){this.line(g,m.black,[cx-p.buildingEdge,8+q*.9,zz-2],[cx,7.4+q*.9,zz],.035);this.line(g,m.black,[cx,7.4+q*.9,zz],[cx+p.buildingEdge,8+q*.9,zz+2],.035);}
  }
  if(s<410&&key%2===0)this.marketEdge(g,s,key);
  if(s>=2980&&s<3300)this.intersection(g,s,key);
  for(const branch of BRANCHES)if(branch.id!=='crossing'&&branch.id!=='van-cover'&&s<branch.end&&s+LENGTH>branch.start)this.branch(g,branch,s);
  if(s>=5400)this.ending(g,s,key);
  if(s>3520&&key%3===0)this.overheadSign(g,s,key);
  if(s>2750&&key%9===0){const at=s+12,p=getRouteProfile(at),x=routeCenter(at)-routeCenter(s)+(key%2?1:-1)*(p.buildingEdge-.85);this.person(g,x,-12,3);const cop=g.userData.people.at(-1);this.box(cop.userData.model,m.blue,0,1.22,.01,.51,.67,.31);this.box(cop.userData.model,m.blue,0,2.01,.035,.36,.1,.42);this.box(cop.userData.model,m.yellow,.12,1.41,.18,.07,.09,.025);}
  this.batch(g);
  return g;
 }
 overheadSign(g,s,key){
  const m=this.m,p=getRouteProfile(s+10),cx=routeCenter(s+10)-routeCenter(s),y=6.2+(key%3)*.4,z=-10,index=10+key%6;
  this.line(g,m.metal,[cx-p.buildingEdge,y+1.4,z],[cx+p.buildingEdge,y+1.4,z],.075);
  const w=key%2?6.2:4.6,h=key%2?1.5:2.0,col=m.lights[key%6];
  this.box(g,m.black,cx,y,z,w,h,.22);this.plane(g,m.fascias[index],cx,y,z+.13,w-.15,h-.12);
  for(const side of [-1,1]){this.box(g,col,cx,y+side*(h/2+.06),z+.16,w+.16,.06,.08);this.box(g,col,cx+side*(w/2+.06),y,z+.16,.06,h+.16,.08);this.line(g,m.metal,[cx+side*w*.36,y+h/2,z],[cx+side*w*.36,y+1.4,z],.055);}
  if(key%2===0){const badge=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.1,6),col);badge.rotation.x=Math.PI/2;badge.position.set(cx,y+h/2+.58,z);g.add(badge);this.box(g,m.black,cx,y+h/2+.58,z+.07,.44,.18,.05);}
 }
 batch(g){
  // Batching destroys temporary plane geometries, but retains animated people and
  // lamp groups. Geometry budgets stay bounded as old sections are recycled.
  const temp=g.children.filter(x=>x.isMesh&&x.userData.districtOwned).map(x=>x.geometry);this.owner.batchStatic(g);for(const geo of temp)geo.dispose();
 }
 building(g,side,cx,z,at,index,p){
  const m=this.m,r=rnd(index+328),branch=this.branchAt(at,side),opening=!!branch||(side>0&&at>5470);
  const face=p.buildingEdge,depth=8,height=(5+index%8)*2.6,night=p.night||0,kind=night>.25&&(index%5)/5<night?10+index%6:index%10;
  // Upper storeys continue above every shortcut. Ground floor openings expose
  // actual rooms and alleys rather than placing an opaque facade across a route.
  const upper=opening?7.2:3.4;
  this.box(g,m.concrete,cx+side*(face+depth/2),upper+(height-upper)/2,z,depth,height-upper,10.4);
  this.plane(g,m.facades[index%5],cx+side*(face-.015),upper+.2+(height-upper-.2)/2,z,10.1,height-upper-.2,side<0?Math.PI/2:-Math.PI/2,0,1,(height-upper-.2)/5.2);
  if(branch){this.branchBuildingBase(g,side,cx,z,at,index,p,branch,upper);return;}
  if(opening)return;
  if(!opening){
   this.box(g,m.concrete,cx+side*(face+depth/2),1.7,z,depth,3.4,10.4);
   this.box(g,m.dark,cx+side*(face+.24),1.6,z,.48,3.2,10.3);
   const closed=index%5===1;
   this.plane(g,closed?m.shutter:m.window,cx+side*(face-.04),1.57,z,8.7,2.9,side<0?Math.PI/2:-Math.PI/2);
   for(const dz of [-4.55,0,4.55])this.box(g,m.metal,cx+side*(face-.13),1.6,z+dz,.15,3.2,.13);
   if(index%3===0&&!closed){
    for(let q=0;q<5;q++){this.box(g,m.wood,cx+side*(face-.19),.62,z-3+q*1.4,.16,.05,1.18);this.box(g,m.colors[(index+q)%6],cx+side*(face-.28),.86,z-3+q*1.4,.21,.42,.6);}
   }
  }
  this.plane(g,m.fascias[kind],cx+side*(face-.22),3.25,z,9.1,.9,side<0?Math.PI/2:-Math.PI/2);
  if(index%4!==1){
   const col=m.colors[index%6];this.box(g,col,cx+side*(face-.8),2.77,z,1.55,.15,9.6);
   for(let q=0;q<12;q++){if(index%3!==0)this.box(g,q%2?col:m.cream,cx+side*(face-.8),2.85,z-4.4+q*.8,1.58,.025,.36);this.box(g,q%2?col:m.cream,cx+side*(face-1.56),2.61,z-4.4+q*.8,.06,.28,.78);}
  }
  const sy=5.5+index%3*1.3,sx=cx+side*(face-1.3);
  this.box(g,m.black,sx,sy,z-2.9,1.15,3.3,.22);this.plane(g,m.vertical[kind],sx,sy,z-2.77,1.08,3.21);this.box(g,m.metal,cx+side*(face-.63),sy+1.7,z-2.9,1.8,.1,.08);
  if(night>.35&&index%2===0){
   const col=m.lights[index%6];this.box(g,m.black,cx+side*(face-2.25),8.3,z+1.8,3.4,1.55,.25);this.plane(g,m.fascias[10+index%6],cx+side*(face-2.25),8.3,z+1.95,3.3,1.44);
   for(const e of [-1,1])this.box(g,col,cx+side*(face-2.25),8.3+e*.82,z+1.95,3.5,.045,.04);
  }
  // Only a few near storeys have protruding AC boxes; high detail is painted.
  for(let floor=0;floor<3;floor++){
   this.box(g,m.cream,cx+side*(face-.32),4.5+floor*2.6,z+2.8,.62,.55,1.0);
   for(let k=0;k<3;k++)this.box(g,m.dark,cx+side*(face-.65),4.34+floor*2.6+k*.13,z+2.8,.025,.035,.82);
   if((index+floor)%3===0){this.box(g,m.concrete,cx+side*(face-.45),5.15+floor*2.6,z-2,.9,.15,2.8);this.box(g,m.metal,cx+side*(face-.9),5.65+floor*2.6,z-2,.055,.9,2.8);}
  }
  this.box(g,m.metal,cx+side*(face-.17),height*.5,z+4.7,.13,height,.13);
  if(index%4===0){this.box(g,m.metal,cx+side*(face-.45),2.1,z+4,.75,.16,.16);this.box(g,m.cream,cx+side*(face-.84),2.05,z+4,.32,.2,.36);}
  if(index%7===0){this.box(g,m.black,cx+side*(face-.2),.62,z-3,.26,1.2,.8);this.plane(g,m.menu,cx+side*(face-.35),.73,z-3,.65,.7,side<0?Math.PI/2:-Math.PI/2);}
 }
 branchBuildingBase(g,side,cx,z,at,index,p,branch,upper){
  const m=this.m,front=Math.min(p.buildingEdge,Math.abs(branch.offset)-2.65),back=Math.max(p.buildingEdge+8,Math.abs(branch.offset)+2.7);
  // A complete shop shell supports the upper floors. Only the actual entrance
  // and exit are cut out; the old whole-block omission left the tower floating.
  this.box(g,m.concrete,cx+side*front,(upper+3.35)/2,z,.28,upper-3.35,10.4);
  this.plane(g,m.facades[index%5],cx+side*(front-.15),(upper+3.35)/2,z,10.1,upper-3.35,side<0?Math.PI/2:-Math.PI/2,0,1,(upper-3.35)/5.2);
  this.box(g,m.concrete,cx+side*back,upper/2,z,.3,upper,10.4);
  this.box(g,m.concrete,cx+side*(front+back)/2,upper,z,back-front,.2,10.4);
  // Fill the entire ground floor on either side of the playable corridor,
  // including the entrance/exit returns. Thin front panels alone left holes
  // through the ends of the block and beneath the upper floors.
  for(const outer of [false,true])this.solidStrip(g,m.concrete,at-5,at+5,distance=>{
   const profile=getRouteProfile(distance),f=Math.min(profile.buildingEdge,Math.abs(branch.offset)-2.65),b=Math.max(profile.buildingEdge+8,Math.abs(branch.offset)+2.7);
   const off=Math.abs(branchOffset(branch,distance).x),lo=outer?clamp(off+2.4,f,b):f,hi=outer?b:clamp(off-2.4,f,b);
   const center=cx+routeCenter(distance)-routeCenter(at),x1=center+side*lo,x2=center+side*hi;
   return [Math.min(x1,x2),Math.max(x1,x2),z+at-distance];
  },0,3.35);
  const fascia=branch.kind==='stairs'?10:branch.kind==='arcade'?11:branch.kind==='shop'?4:0;
  this.plane(g,m.fascias[fascia],cx+side*(front-.17),3.55,z,9.7,.8,side<0?Math.PI/2:-Math.PI/2);
  for(let dz=-4;dz<=4;dz+=2){
   const distance=at-dz,off=Math.abs(branchOffset(branch,distance).x);
   if(Math.abs(off-front)<2.5)continue;
   const x=cx+side*front;
   this.box(g,m.concrete,x,1.68,z+dz,.28,3.36,2.06);
   this.plane(g,m.window,cx+side*(front-.15),1.65,z+dz,1.7,2.25,side<0?Math.PI/2:-Math.PI/2);
   this.box(g,m.metal,cx+side*(front-.18),1.7,z+dz+1,.11,3.4,.1);
  }
  // Tie the recessed front to the tower at the ends of each shop bay.
  for(const dz of [-5.05,5.05])this.box(g,m.concrete,cx+side*(front+p.buildingEdge)/2,(upper+3.35)/2,z+dz,Math.abs(p.buildingEdge-front)+.28,upper-3.35,.18);
 }
 props(g,x,z,side,key,p){
  const m=this.m,kind=key%5;
  if(kind===0){this.box(g,m.metal,x,.73,z,.68,1.42,.55);this.box(g,m.dark,x-side*.36,.9,z,.03,.67,.42);}
  else if(kind===1){this.box(g,m.colors[key%6],x,.8,z,.56,1.55,.58);this.box(g,m.dark,x-side*.3,1.0,z,.04,.61,.43);this.box(g,m.cream,x-side*.32,.51,z,.045,.07,.28);}
  else if(kind===2){for(let n=0;n<2;n++){this.box(g,m.wood,x,.35,z+n*.78,.62,.7,.67);for(let k=0;k<3;k++)this.box(g,m.dark,x-side*.325,.2+k*.15,z+n*.78,.03,.02,.5);}}
  else if(kind===3){this.box(g,m.black,x,.3,z,.6,.52,.51);this.box(g,m.black,x+.3,.23,z+.4,.49,.4,.45);}
  else {this.box(g,m.blue,x,.52,z,.48,.45,1.5);this.box(g,m.black,x,.81,z-.2,.47,.14,.65);for(const zz of [-.56,.56]){const wheel=new THREE.Mesh(this.owner.cylinder,m.black);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.24,z+zz);wheel.scale.set(.48,.13,.48);g.add(wheel);}this.line(g,m.metal,[x,.52,z+.5],[x,1.24,z+.42],.075);this.box(g,m.metal,x,1.25,z+.42,.65,.07,.07);}
 }
 marketEdge(g,s,key){const m=this.m;for(const side of [-1,1]){const at=s+13,p=getRouteProfile(at),x=routeCenter(at)-routeCenter(s)+side*(p.buildingEdge-.95),z=-13;this.box(g,m.wood,x,.75,z,1.4,1.3,2);this.box(g,m.colors[key%6],x,2.4,z,2.2,.12,2.8);for(const dz of [-1.15,1.15])this.box(g,m.metal,x+side*.7,1.65,z+dz,.06,1.8,.06);for(let q=0;q<5;q++)this.box(g,m.colors[(q+key)%6],x-side*.75,.94,z-.8+q*.4,.08,.3,.27);this.box(g,m.red,x-side*.7,.45,z+1.9,.45,.13,.45);for(const xx of [-.15,.15])this.box(g,m.red,x-side*.7+xx,.24,z+1.9,.05,.4,.34);}}
 person(g,x,z,index){
  const root=new THREE.Group();root.position.set(x,.1,z);const model=new THREE.Group(),sprite=new THREE.Group();root.add(model,sprite);
  this.box(model,this.m.colors[index],0,1.22,0,.49,.65,.28);this.box(model,this.m.skin,0,1.78,0,.3,.37,.29);this.box(model,this.m.black,0,1.96,0,.32,.08,.31);
  const legs=[],arms=[];for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.13,.91,0);this.box(leg,this.m.dark,0,-.37,0,.19,.75,.2);this.box(leg,this.m.black,0,-.77,.05,.22,.12,.31);model.add(leg);legs.push(leg);const arm=new THREE.Group();arm.position.set(side*.31,1.5,0);this.box(arm,this.m.colors[index],0,-.29,0,.13,.53,.16);this.box(arm,this.m.skin,0,-.61,0,.12,.16,.13);model.add(arm);arms.push(arm);this.owner.batchStatic(leg);this.owner.batchStatic(arm);}
  this.owner.batchStatic(model);const card=this.plane(sprite,this.m.crowds[index],0,1.04,0,1,2.1);root.userData={model,sprite,legs,arms,index};g.userData.people.push(root);g.add(root);
 }
 crossStreet(g,at,side,cx,z,p){
  const m=this.m;this.box(g,m.road,cx+side*37,-.08,z,40,.08,10.2);
  // Side roads stay open across BOTH traffic streams. Only the outer rows have
  // corner buildings; repeating a facade in every row would block the crossing.
  const edge=at<3140?1:at>3160?-1:0;
  if(edge){this.box(g,m.concrete,cx+side*39,.02,z+edge*5.15,44,.2,.35);this.box(g,m.concrete,cx+side*40,13,z+edge*10.5,42,26,10);this.plane(g,m.facades[(Math.floor(at)+edge+7)%5],cx+side*40,14,z+edge*5.42,42,22,edge<0?0:Math.PI,0,4,4);}
 }
 intersection(g,s,key){
  const m=this.m;
  for(const at of [3126,3174])if(at>=s&&at<s+LENGTH){const cx=routeCenter(at)-routeCenter(s),p=getRouteProfile(at),z=s-at;
   for(let x=-p.roadHalfWidth+1;x<p.roadHalfWidth;x+=2.2)this.box(g,m.white,cx+x,-.026,z,1.25,.022,5);
   for(const side of [-1,1]){
    this.box(g,m.concrete,cx+side*5,.05,z+side*5,1.7,.21,4);this.box(g,m.metal,cx+side*(p.roadHalfWidth+.5),2.6,z,.13,5.2,.13);
    const signal=new THREE.Group();signal.position.set(cx+side*(p.roadHalfWidth+.5),4.2,z);this.box(signal,m.black,0,0,0,.53,1.27,.31);
    const lamps=[];for(let k=0;k<3;k++){const l=this.box(signal,m.black,0,.39-k*.39,.17,.31,.3,.04);lamps.push(l);}g.add(signal);g.userData.signals.push({lamps});
    for(let q=0;q<3;q++)this.person(g,cx+side*(p.roadHalfWidth+1+q*.52),z+3.4+q*.28,(key+q)%6);
   }
  }
  if(s<=3090&&s+LENGTH>3090){const at=3090,cx=routeCenter(at)-routeCenter(s);this.box(g,m.metal,cx,7.2,s-at,33,.17,.17);this.box(g,m.dark,cx,6.4,s-at,10,1.5,.2);this.plane(g,m.fascias[6],cx,6.4,s-at+.12,9.8,1.35);}
  if(s<=3120&&s+LENGTH>3120){const x=routeCenter(3120)-routeCenter(s)+7.5,z=s-3120;this.box(g,m.cream,x,1.15,z,1.95,1.65,4.7);this.box(g,m.black,x,1.7,z+1.8,1.65,.65,.06);for(const side of [-1,1]){this.box(g,m.black,x+side*.97,.3,z+1.45,.14,.6,.7);this.box(g,m.black,x+side*.97,.3,z-1.45,.14,.6,.7);this.box(g,m.cream,x+side*1.35,1.2,z+2.7,.85,1.7,.1,side*.75);}for(let q=0;q<2;q++)this.box(g,m.wood,x+1.6,.3,z+3+q*.7,.55,.6,.6);}
 }
 branch(g,b,s){
  const start=Math.max(s,b.start),end=Math.min(s+LENGTH,b.end),m=this.m,base=routeCenter(s),corridor=(at)=>routeCenter(at)-base+branchOffset(b,at).x;
  // Walkable shops, back rooms and alleys have one connected floor. The same
  // curved/elevated offset is used by the simulation and camera.
  this.ribbon(g,m.tile,start,end,(_,at)=>branchOffset(b,at).x-2.4,(_,at)=>branchOffset(b,at).x+2.4,at=>(branchOffset(b,at).y||0)+.1,2);
  for(let at=start+2.5;at<end;at+=5){
   const off=branchOffset(b,at),t=(at-b.start)/(b.end-b.start);if(Math.abs(off.x)<5.5)continue;
   const cx=corridor(at),z=s-at,y=off.y||0,shop=t<.45,alley=t>.68;
   for(const side of [-1,1]){
    this.box(g,alley?m.concrete:m.cream,cx+side*2.48,y+1.7,z,.2,3.4,5.1);
    if(shop){
     if(b.kind==='arcade'){this.box(g,m.dark,cx+side*2.03,y+.87,z,.68,1.7,1.2);this.box(g,m.lights[Math.floor(at)%6],cx+side*1.675,y+1.22,z,.025,.55,.78);this.box(g,m.black,cx+side*1.6,y+.84,z,.22,.1,.9);for(const q of [-1,1])this.box(g,m.red,cx+side*1.59,y+.915,z+q*.22,.07,.055,.07);}
     else if(b.kind==='stairs'){this.box(g,m.red,cx+side*2.03,y+.58,z,.75,.78,2.9);this.box(g,m.dark,cx+side*2.3,y+1.02,z,.19,.61,2.9);this.box(g,m.lights[Math.floor(at)%6],cx+side*2.35,y+2.14,z,.04,.75,1.15);}
     else{this.box(g,m.wood,cx+side*2.13,y+.95,z,.51,.08,4.3);for(let q=0;q<5;q++)this.box(g,m.colors[(q+Math.floor(at))%6],cx+side*2.14,y+1.18,z-1.8+q*.8,.35,.39,.38);}
    }
    else if(alley){this.box(g,m.metal,cx+side*2.25,y+2.1,z,.25,.49,.7);this.box(g,m.metal,cx+side*2.3,y+1.7,z+1.7,.12,3.4,.12);}
    else{this.box(g,m.metal,cx+side*2.1,y+.82,z,.62,1.62,1.6);this.box(g,m.dark,cx+side*1.75,y+.8,z,.025,.6,1.2);}
   }
   if(!alley){this.box(g,m.dark,cx,y+3.48,z,5.1,.15,5.1);this.box(g,m.tube,cx,y+3.33,z,1.5,.05,.22);}
   if(b.id==='karaoke'&&off.y>.25){this.box(g,m.metal,cx-2.2,y+.53,z,.065,1.08,5);this.box(g,m.metal,cx+2.2,y+.53,z,.065,1.08,5);for(let step=0;step<5;step++){const a=at-2+step,bo=branchOffset(b,a);this.box(g,m.dark,routeCenter(a)-base+bo.x,(bo.y||0)+.115,s-a,4.5,.04,.12);}}
  }
  for(const doorway of [b.start+b.entryLength+12,b.start+(b.end-b.start)*.68])if(doorway>=s&&doorway<s+LENGTH){const p=branchOffset(b,doorway),x=routeCenter(doorway)-base+p.x,z=s-doorway,y=p.y||0;for(const side of [-1,1])this.box(g,m.cream,x+side*2.02,y+1.62,z,1.04,3.24,.18);this.box(g,m.metal,x,y+3.04,z,3,.4,.2);}
  if(b.start>=s&&b.start<s+LENGTH){const at=b.start+13,off=branchOffset(b,at),side=(b.offset||off.x)<0?-1:1,x=routeCenter(at)-base+side*5.9,z=s-at;this.box(g,m.warm,x,2.9,z,2.8,.16,1.3);this.plane(g,m.fascias[b.id==='karaoke'?10:b.id==='electronics'?4:b.id==='arcade-alley'?11:0],x,2.48,z+.7,2.9,.76);}
 }
 ending(g,s,key){
  const m=this.m;
  if(s+LENGTH>5480){const a=Math.max(s,5480),b=Math.min(s+LENGTH,5562);if(a<b)this.ribbon(g,m.tile,a,b,(_,at)=>getRouteProfile(at).offsetX-2.6,(_,at)=>getRouteProfile(at).offsetX+2.6,.1,2);}
  if(s>=5480){const cx=routeCenter(s+10)-routeCenter(s);this.box(g,m.concrete,cx+13.2,2.35,-10,.28,4.7,20.1);for(const dz of [-5,-15]){this.box(g,m.dark,cx+13.02,2.25,dz,.04,1.7,3);this.box(g,m.metal,cx+12.98,2.25,dz,.05,.06,3.1);if(Math.abs(getRouteProfile(s-dz).offsetX-6.8)>4)this.box(g,m.concrete,cx+6.8,3.6,dz,.35,7.2,.35);} }
  if(s<=5564&&s+LENGTH>5564){const x=routeCenter(5564)-routeCenter(s)+10,z=s-5564;this.box(g,m.cream,x,1.65,z,5.4,3.3,.2);this.box(g,m.tube,x,2.95,z+.15,4.6,.15,.1);}
  if(s<=5535&&s+LENGTH>5535){const x=routeCenter(5535)-routeCenter(s),z=s-5535;this.box(g,m.white,x,1.05,z,6.8,2.1,2.1);this.box(g,m.blue,x,1.0,z+1.07,6.8,.52,.025);for(const side of [-1,1]){this.box(g,m.black,x+side*2.1,1.57,z+1.1,1.48,.63,.025);this.box(g,m.black,x+side*2.18,.31,z+1.04,.9,.62,.18);}this.box(g,m.signRed,x-.45,2.18,z,1.1,.17,.4);this.box(g,m.signGreen,x+.45,2.18,z,.5,.17,.4);for(const side of [-1,1]){this.box(g,m.yellow,x+side*4,1,z+.3,1.05,1.8,.25);this.person(g,x+side*4.8,z+2,3);const cop=g.userData.people.at(-1);this.box(cop.userData.model,m.blue,0,1.22,.01,.51,.67,.31);this.box(cop.userData.model,m.blue,0,2.01,.035,.36,.1,.42);this.box(cop.userData.model,m.black,.38,1.12,.02,.065,.64,.065);}}
  const at=5557;if(at>=s&&at<s+LENGTH){const x=routeCenter(at)-routeCenter(s)+10,z=s-at;this.box(g,m.dark,x-2.8,2.1,z,.48,4.2,1.2);this.box(g,m.dark,x+2.8,2.1,z,.48,4.2,1.2);this.box(g,m.dark,x,4.2,z,6.2,.5,1.2);this.plane(g,m.fascias[11],x,3.65,z+.66,5.5,1);for(const side of [-1,1]){this.box(g,m.lights[side<0?0:3],x+side*2.54,1.7,z+.68,.11,3.35,.1);this.box(g,m.cream,x+side*2.75,1.55,z-1.3,.12,3.1,3.5);}this.box(g,m.tube,x,3.07,z+.12,4.8,.1,.6);}
 }
 disposeChunk(chunk){this.root.remove(chunk);chunk.traverse(o=>{if(o.geometry&&o.geometry!==this.owner.box&&o.geometry!==this.owner.plane&&o.geometry!==this.owner.cylinder)o.geometry.dispose();});}
 update(game,dt){
  const distance=game.distance||0;this.time+=dt;this.root.visible=distance>START-AHEAD&&game.state!=='MENU'&&game.state!=='INTRO';if(!this.root.visible)return;
  const lo=Math.max(0,Math.floor((distance-BEHIND-START)/LENGTH)),hi=Math.min(Math.ceil((5565-START)/LENGTH),Math.ceil((distance+AHEAD-START)/LENGTH));
  for(const [key,chunk]of this.chunks)if(key<lo||key>hi){this.disposeChunk(chunk);this.chunks.delete(key);}
  for(let key=lo;key<=hi;key++)if(!this.chunks.has(key)){const chunk=this.makeChunk(key);this.chunks.set(key,chunk);this.root.add(chunk);}
  const phase=game.routeTraffic||getTrafficPhase(game.elapsed||this.time);
  for(const chunk of this.chunks.values()){
   chunk.position.set(routeCenter(chunk.userData.s)-routeCenter(distance),0,distance-chunk.userData.s);
   for(const p of chunk.userData.people){const far=-(chunk.position.z+p.position.z)>34;p.userData.model.visible=!far;p.userData.sprite.visible=far;const frame=Math.floor(this.time*9)/9,pulse=Math.sin(frame*3.4+p.userData.index);p.userData.legs.forEach((leg,i)=>leg.rotation.x=pulse*(i?-.22:.22));p.userData.arms.forEach((arm,i)=>arm.rotation.x=pulse*(i?.16:-.16));}
   for(const signal of chunk.userData.signals)signal.lamps.forEach((l,i)=>l.material=(phase.road||phase.signal?.road)===(['red','amber','green'][i])?[this.m.signRed,this.m.signAmber,this.m.signGreen][i]:this.m.black);
  }
 }
}
