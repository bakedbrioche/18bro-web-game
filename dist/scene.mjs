import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const seeded=(n)=>{let s=n>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296)};

function texture(paint,w=64,h=w){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;paint(ctx,w,h);
  const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=false;
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
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x0a081b);this.scene.fog=new THREE.Fog(0x172331,38,155);
  this.camera=new THREE.PerspectiveCamera(65,16/9,.08,190);this.camera.position.set(0,3.6,6.8);
  this.scene.add(new THREE.HemisphereLight(0xd7dfff,0x5a483a,2.1));const key=new THREE.DirectionalLight(0xffdfb9,2.0);key.position.set(-8,14,8);this.scene.add(key);
  const rim=new THREE.DirectionalLight(0x6d82d5,1);rim.position.set(8,5,-12);this.scene.add(rim);
  this.snapUniform={value:new THREE.Vector2(512,288)};this.materials=[];this.box=new THREE.BoxGeometry(1,1,1);this.plane=new THREE.PlaneGeometry(1,1);this.cylinder=new THREE.CylinderGeometry(.5,.5,1,16);this.sphere=new THREE.SphereGeometry(.5,20,14);this.cone=new THREE.ConeGeometry(.5,1,4);
  this.makeMaterials();this.world=new THREE.Group();this.scene.add(this.world);this.chunks=[];
  for(let i=0;i<7;i++){const chunk=this.makeChunk(i);chunk.root.position.z=-i*30;this.world.add(chunk.root);this.chunks.push(chunk);}
  this.skyline=this.makeSkyline();this.scene.add(this.skyline);
  this.cat=this.makeCat('18bro');this.scene.add(this.cat.root);this.skin='18bro';
  this.cops=[this.makeCop()];this.cops.forEach(c=>this.scene.add(c.root));
  this.entities=new Map();this.lastTheme=-1;this.clock=0;this.lastDistance=0;this.lastState='';this.stateTime=0;this.target=new THREE.Vector3();this.cameraTarget=new THREE.Vector3(0,1,-10);
  this.makeMenuProps();this.makeParticles();this.makePedestrians();this.debugBoxes=new THREE.Group();this.scene.add(this.debugBoxes);this.debugPool=[];
  this.resize(canvas.clientWidth||1280,canvas.clientHeight||720);
 }
 mat(color,extra={}){
  const m=new THREE.MeshLambertMaterial({color,flatShading:true,...extra});
  if(m.map && extra.emissive) m.emissiveMap=m.map;
  m.onBeforeCompile=(shader)=>{
   shader.uniforms.retroResolution=this.snapUniform;
   shader.vertexShader='uniform vec2 retroResolution;\n#ifdef USE_MAP\nvarying vec2 vAffineUv;\nvarying float vAffineW;\n#endif\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>\nvec2 snapGrid = retroResolution * 1.4;\nvec2 rawNdc=gl_Position.xy / gl_Position.w;\ngl_Position.xy = mix(rawNdc, floor(rawNdc*snapGrid+0.5)/snapGrid,0.055) * gl_Position.w;\n#ifdef USE_MAP\nvAffineUv = vMapUv * gl_Position.w;\nvAffineW = gl_Position.w;\n#endif`);
   if(m.map){shader.fragmentShader='#ifdef USE_MAP\nvarying vec2 vAffineUv;\nvarying float vAffineW;\n#endif\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replaceAll('vMapUv','mix(vMapUv,vAffineUv/max(vAffineW,0.0001),0.035)'));}
  };
  m.customProgramCacheKey=()=>`retro-v2-${m.map?'map':'solid'}`;this.materials.push(m);return m;
 }
 makeMaterials(){
  const r=seeded(18),m=this.m={};
  const color=(name,v,extra={})=>m[name]=this.mat(v,extra);
  color('asphalt',0xa0a2b4,{map:texture((c,w,h)=>{c.fillStyle='#363940';c.fillRect(0,0,w,h);for(let i=0;i<3500;i++){c.fillStyle=['#515259','#252b35','#49454b','#65605a'][i%4];c.fillRect(r()*w,r()*h,r()*3+1,1)}c.strokeStyle='#242a32';c.lineWidth=1;for(let j=0;j<5;j++){c.beginPath();c.moveTo(r()*w,0);c.lineTo(r()*w,h/2);c.lineTo(r()*w,h);c.stroke()}},128)});
  color('concrete',0x818182);color('curb',0xa19b8f);color('white',0xe7e1cf);color('yellow',0xf8bb32);color('black',0x13151a);color('metal',0x687580);color('orange',0xf07829);color('wood',0x966139);color('green',0x128b54);color('red',0xca3032);color('blue',0x2e6190);color('skin',0xc89975);
  color('tire',0x111518);color('glass',0x2b4953);color('police',0x7eacbf);color('policeDark',0x1e3346);color('eye',0xe5e0d6);color('pupil',0x090c10);color('earRed',0xb52f3e);color('earGreen',0x126148);color('capGreen',0x145740);color('gold',0xe3b64b);
  color('cyan',0x36cdd1,{emissive:0x136a83,emissiveIntensity:.45});color('lamp',0xffeabb,{emissive:0xffe1a5,emissiveIntensity:1.2});color('siren',0xee322d,{emissive:0xa41110,emissiveIntensity:.7});color('lantern',0xf65327,{emissive:0xd62208,emissiveIntensity:.45});color('neonPink',0xf053b0,{emissive:0xb5218a,emissiveIntensity:.6});
  m.wall=[];for(let k=0;k<6;k++)m.wall.push(this.mat(0xeeeeeb,{map:texture((c,w,h)=>{c.fillStyle=['#9a987f','#617f7e','#978174','#b3a177','#7f8290','#969e98'][k];c.fillRect(0,0,w,h);for(let i=0;i<1000;i++){c.fillStyle=i%2?'#171f2420':'#f5e0b718';c.fillRect(r()*w,r()*h,r()*4+1,r()*16+2)}for(let y=5;y<h;y+=32){for(let x=5;x<w;x+=32){c.fillStyle='#aab2aa';c.fillRect(x,y,23,24);c.fillStyle='#273d47';c.fillRect(x+2,y+2,19,19);c.fillStyle=r()>.42?['#c4b976','#3b5c69','#cca685'][k%3]:'#1d2e37';c.fillRect(x+3,y+3,17,17);c.fillStyle='#87918a';c.fillRect(x+11,y+1,2,20);c.fillRect(x+1,y+11,21,2);c.fillStyle='#343d42';c.fillRect(x-1,y+24,25,2)}c.fillStyle='#565f5f';c.fillRect(0,y+30,w,2)}},128,256)}));
  const signs=[['香港','#ffdec4','#d52e23'],['十八','#daffad','#17894d'],['茶餐廳','#fff4b2','#cd3334'],['霓虹','#ffd4f2','#b81b79'],['電器','#c7ffff','#078893'],['藥房','#fff6be','#287236'],['好味','#ffd984','#a91625'],['旺角','#fff7c5','#cc6415'],['金記','#ffed79','#bb1f2c'],['士多','#ffedd5','#205fb4']];
  m.signs=signs.map(([txt,fg,bg])=>this.mat(0xffffff,{emissive:0xffffff,emissiveIntensity:.85,map:texture((c,w,h)=>{c.fillStyle='#19241d';c.fillRect(0,0,w,h);c.fillStyle=bg;c.fillRect(4,3,w-8,h-6);c.strokeStyle=fg;c.lineWidth=3;c.strokeRect(9,9,w-18,h-18);[...txt].forEach((s,i)=>pixelText(c,s,w/2,28+(i+.5)*(h-56)/txt.length,50,fg));},128,256),side:THREE.DoubleSide}));
  const shopNames=[['金記茶餐廳','KAM KEE CAFE','#b62e24','#ffecca'],['新鮮生果','FRESH FRUIT','#2b894a','#fffba8'],['永安藥房','WING ON PHARMACY','#f6eee0','#d62822'],['添記麵家','TIM KEE NOODLES','#edc33a','#a02a20'],['旺角電器','MONG KOK ELECTRONICS','#2361a0','#e1f5ff'],['時裝服飾','FASHION & TAILOR','#cf637e','#fff4cf'],['榮華餅家','WING WAH BAKERY','#883334','#f9d888'],['海味雜貨','GROCERY & DRIED GOODS','#447a76','#f6e9c3']];
  m.fascias=shopNames.map(([a,b,bg,fg])=>this.mat(0xffffff,{emissive:0xffffff,emissiveIntensity:.45,map:texture((c,w,h)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.strokeStyle=fg;c.lineWidth=3;c.strokeRect(3,3,w-6,h-6);pixelText(c,a,w/2,24,31,fg);pixelText(c,b,w/2,51,10,fg)},256,64)}));
  m.shops=shopNames.map((_,k)=>this.mat(0xffffff,{emissive:0xfff1c5,emissiveIntensity:.28,map:texture((c,w,h)=>{c.fillStyle=['#9c6733','#315445','#b4b9ac','#775b36','#1b284c','#6f4659','#a5713b','#725d33'][k];c.fillRect(0,0,w,h);c.fillStyle='#181d25';c.fillRect(2,4,w-4,h-8);c.fillStyle='#fff4b0';c.fillRect(6,5,w-12,5);if(k===5){for(let x=10;x<w;x+=24){c.fillStyle=['#eaa253','#d35570','#418287','#deded0'][Math.floor(x/24)%4];c.fillRect(x,23,16,53);c.fillRect(x-4,24,24,15);c.fillStyle='#98917e';c.fillRect(x+6,14,3,10)}}else{for(let y=20;y<h-15;y+=28){c.fillStyle='#afa18a';c.fillRect(5,y+21,w-10,3);for(let x=7;x<w-8;x+=13){c.fillStyle=['#da4847','#64a54a','#ecd254','#759bbe','#ea9143'][Math.floor(r()*5)];if(k===1||k===6){c.beginPath();c.arc(x+5,y+12,k===1?6:4,0,TAU);c.fill()}else{c.fillRect(x,y+4,9,16);c.fillStyle='#e9e6cf';c.fillRect(x+1,y+8,7,4)}}}}c.fillStyle='#b4ae96';c.fillRect(w/2-2,0,4,h);c.fillRect(0,h-8,w,8)},128,128)}));
  m.shop=m.shops[0];m.shelf=m.shops[7];
  const seven=(c,w,h,hat=false)=>{c.fillStyle='#f5f0df';c.fillRect(0,0,w,h);if(!hat){for(const [i,col]of ['#f47419','#03bc53','#ea172c'].entries()){c.fillStyle=col;c.fillRect(0,10+i*22,w*.34,12);c.fillRect(w*.66,10+i*22,w*.34,12);}}c.fillStyle='#ef771e';c.fillRect(w*.41,h*.16,w*.19,h*.13);pixelText(c,'7',w*.51,h*.44,h*.7,'#df192a');c.fillStyle='#f5f0df';c.fillRect(w*.35,h*.56,w*.3,h*.18);pixelText(c,'ELEVEN',w*.5,h*.64,h*.15,'#126d42');};
  m.storeSign=this.mat(0xffffff,{emissive:0xffffff,emissiveIntensity:.6,map:texture((c,w,h)=>seven(c,w,h),256,96)});
  m.capLabel=this.mat(0xffffff,{map:texture((c,w,h)=>seven(c,w,h,true),128,128),side:THREE.DoubleSide});m.cap=this.mat(0xefeddf);
  m.chip=this.mat(0xffffff,{map:texture((c,w,h)=>{c.fillStyle='#d9b347';c.fillRect(0,0,w,h);c.fillStyle='#f0d582';c.fillRect(5,5,w-10,h-10);pixelText(c,'18',w/2,29,47,'#ca372d');pixelText(c,'18',w/2,66,43,'#32774b');pixelText(c,'CHIPS',w/2,99,16,'#674722');for(let x=0;x<w;x+=5){c.fillStyle='#ac8936';c.fillRect(x,0,2,5);c.fillRect(x,h-5,2,5)}},96,128)});
  m.coin=this.mat(0xf5bd35,{emissive:0xb6770b,emissiveIntensity:.2});m.coinFace=this.mat(0xffffff,{emissive:0xfac14b,emissiveIntensity:.15,map:texture((c,w,h)=>{c.fillStyle='#f9cf4e';c.fillRect(0,0,w,h);c.strokeStyle='#b88517';c.lineWidth=4;c.strokeRect(4,4,w-8,h-8);catMark(c,w/2,h/2,16)},64)});
  m.posters=Array.from({length:4},(_,k)=>this.mat(0xffffff,{map:texture((c,w,h)=>{c.fillStyle=['#f4efba','#d14d38','#157956','#445e98'][k];c.fillRect(0,0,w,h);pixelText(c,['特價','新到','雪糕','優惠'][k],w/2,25,22,k?'#fff1cc':'#bc3328');pixelText(c,['$18','$9.9','18','$7'][k],w/2,60,29,k?'#fff1cc':'#176944');c.fillStyle='#f5e9b3';c.fillRect(6,84,w-12,6);c.fillRect(6,98,w-22,4)},64,128)}));
  m.taxiLabel=this.mat(0xffffff,{map:texture((c,w,h)=>{c.fillStyle='#f4e9c9';c.fillRect(0,0,w,h);pixelText(c,'TAXI',w/2,h/2,22,'#b52924')},128,32)});
  m.shirt=[0xbb5638,0xcfb15d,0x437f8c,0x5466a2,0xd0798b,0x79994c].map(v=>this.mat(v));m.pants=[0x273b4b,0x5f574a,0x455e5c].map(v=>this.mat(v));m.complexions=[0xbf906c,0xc89974,0xd7ab84,0xb18163].map(v=>this.mat(v));
 }
 boxMesh(parent,mat,x,y,z,sx,sy,sz,rz=0){const a=new THREE.Mesh(this.box,mat);a.position.set(x,y,z);a.scale.set(sx,sy,sz);a.rotation.z=rz;parent.add(a);return a;}
 makeChunk(index){
  const rand=seeded(924+index*431),b=new Batch(),m=this.m,box=(mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>b.add(this.box,mat,x,y,z,sx,sy,sz,rx,ry,rz);
  box(m.asphalt,0,-.18,-15,8.4,.28,30);for(const side of [-1,1]){box(m.curb,side*5.65,-.06,-15,3.1,.34,30);box(m.yellow,side*3.94,-.025,-15,.065,.025,30);box(m.yellow,side*3.76,-.025,-15,.065,.025,30);}
  for(let z=-1;z>-30;z-=4.8){for(const x of [-1.25,1.25])box(m.white,x,-.015,z,.07,.025,1.8);}
  for(let z=-4;z>-30;z-=11){for(const side of [-1,1]){box(m.metal,side*3.6,-.01,z,.55,.025,1);for(let a=0;a<5;a++)box(m.black,side*3.6,.01,z-.4+a*.2,.43,.01,.055);}}
  b.add(this.cylinder,m.metal,-.4,-.013,-18,1.0,.035,1.0);for(let z=-18.35;z<-17.6;z+=.15)box(m.black,-.4,.009,z,.72,.015,.035);
  for(const side of [-1,1]){
   for(let n=0;n<4;n++){
    const z=-3.75-n*7.5,h=15+rand()*15,w=5+rand()*3,kind=(index*3+n+(side>0?2:0))%8,face=7.25+rand()*.22;
    box(m.wall[(n+index+(side>0?1:0))%6],side*(face+w/2),h/2,z,w,h,7.25);
    box(m.black,side*(face-.06),2.04,z,.18,4.15,7.2);
    b.add(this.plane,m.shops[kind],side*(face-.17),1.65,z,6.3,2.8,1,0,side<0?Math.PI/2:-Math.PI/2,0);
    b.add(this.plane,m.fascias[kind],side*(face-.6),3.47,z,7,.76,1,0,side<0?Math.PI/2:-Math.PI/2,0);
    box([m.red,m.green,m.yellow,m.blue][kind%4],side*(face-.67),3.0,z,1.1,.14,7.1,0,0,side*.13);
    for(let a=0;a<7;a++)box(kind%2?m.white:m.yellow,side*(face-1.12),2.91,z-3+a, .04,.14,.44);
    box(m.lamp,side*(face-.26),2.92,z,.1,.07,5.8);
    // Grilles, bay windows, AC cages, pipes and ledges give each tenement a different silhouette.
    for(let y=4.8;y<h-2;y+=3.2){for(let a=0;a<2;a++){const zz=z-1.8+a*3.5;box(m.concrete,side*(face-.27),y-.9,zz,.8,.12,2.1);box(m.metal,side*(face-.38),y+.1,zz,.53,.62,.88);for(let sl=0;sl<4;sl++)box(m.black,side*(face-.665),y-.12+sl*.12,zz,.025,.025,.69);if((n+a+index)%2===0){box(m.metal,side*(face-.42),y+1.15,zz,.06,.06,2.25);for(let q=0;q<4;q++)box(m.metal,side*(face-.43),y+.81,zz-.9+q*.6,.045,.7,.045);}}box(m.concrete,side*(face-.12),y+1.55,z,.23,.12,7.35);}
    box(m.metal,side*(face-.3),h/2,z+3.35,.11,h,.11);
    const si=(n+index*2+(side>0?3:0))%m.signs.length,signY=5.4+rand()*3;
    box(m.black,side*5.9,signY,z-1.5,1.25,3.2,.24);
    for(const f of [-1,1])b.add(this.plane,m.signs[si],side*5.9,signY,z-1.5+f*.13,1.2,3.13,1,0,f<0?Math.PI:0,0);
    box(m.metal,side*6.55,signY+1.5,z-1.5,1.6,.09,.09);
    b.add(this.plane,m.posters[(kind+1)%4],side*(face-.19),1.5,z+3.1,.6,1.35,1,0,side<0?Math.PI/2:-Math.PI/2,0);
    // Shop-specific street displays: fruit, food steamers, clothes racks or boxes of goods.
    const vx=side*5.9,vz=z+.9;
    if(kind===1||kind===3||kind===6||n===index%4){
      box(m.wood,vx,.61,vz,1.2,1.12,2.3);box(m.metal,vx,1.2,vz,1.4,.12,2.5);
      box([m.red,m.green,m.yellow][kind%3],vx,2.48,vz,2,.11,2.8,0,0,side*.08);
      for(const q of [-1,1])box(m.metal,vx+side*.55,1.8,vz+q*1.17,.055,1.6,.055);
      box(m.lamp,vx,2.34,vz,.06,.06,1.8);
      if(kind%2){for(let q=0;q<4;q++)for(let a=0;a<3;a++)b.add(this.sphere,[m.yellow,m.orange,m.green][(a+q)%3],vx-.4+a*.33,1.37,vz-.78+q*.5,.29,.27,.3);}
      else{for(let q of [-.65,.1,.65]){b.add(this.cylinder,m.metal,vx,1.45,vz+q,.6,.45,.6);b.add(this.cone,m.white,vx,1.76,vz+q,.57,.14,.57);}}
      b.add(this.plane,m.posters[kind%4],vx, .65,vz+1.19,.67,.87,1);
    }else if(kind===5){box(m.metal,vx,2.1,vz,.045,.045,2.5);for(let a=0;a<5;a++){box(m.shirt[a%6],vx,1.6,vz-.9+a*.43,.3,.8,.35);box(m.shirt[a%6],vx,1.9,vz-.9+a*.43,.2,.22,.55);}}
    else{for(let a=0;a<3;a++)box(a%2?m.wood:m.concrete,vx,.25+a*.32,vz-a*.35,.65,.48,.75);}
    box(m.concrete,side*(face+1),h+.25,z,2.2,.5,2.8);b.add(this.cylinder,m.metal,side*(face+1),h+1.2,z,1.6,1.5,1.6);
   }
   for(let z=-5;z>-30;z-=15){box(m.metal,side*4.38,2.8,z,.1,5.6,.1);box(m.metal,side*4.08,5.55,z,.7,.08,.1);box(m.lamp,side*3.77,5.47,z,.55,.13,.3);}
   // A parked scooter lives off the road, next to a vendor rather than repeating at every shop.
   const zz=-6-index*2;box(m.blue,side*5.3,.82,zz,.55,.5,1);for(let z of [-.6,.6])b.add(this.cylinder,m.tire,side*5.3,.33,zz+z,.61,.14,.61,0,0,Math.PI/2);box(m.black,side*5.3,1.11,zz-.2,.5,.14,.65);box(m.metal,side*5.3,1.4,zz+.6,.65,.04,.04);
  }
  // Warm lanterns and signs suspended between the old buildings.
  for(let z=-8;z>-30;z-=15){box(m.black,0,7.2,z,14,.035,.045);for(let x=-4;x<=4;x+=2){b.add(this.sphere,m.lantern,x,6.85,z,.49,.62,.49);b.add(this.cylinder,m.gold,x,6.49,z,.1,.16,.1);}}
  if(index%2===0){box(m.metal,0,5.85,-22,8,.07,.08);for(let f of [-1,1])b.add(this.plane,m.fascias[(index+3)%8],0,5.15,-22+f*.05,5.7,1.15,1,0,f<0?Math.PI:0,0);}
  for(let z=-2;z>-30;z-=10){box(m.black,0,11,z,15,.025,.035,0,0,.015);box(m.black,0,10.7,z+.3,15,.025,.035,0,0,-.02);}
  const root=b.group();return {root};
 }
 makeSkyline(){
  const b=new Batch(),rand=seeded(1877);for(let i=0;i<50;i++){const x=(rand()-.5)*180,z=-70-rand()*65,h=12+rand()*45;b.add(this.box,this.m.wall[i%6],x,h/2,z,3+rand()*5,h,4+rand()*5);if(i%4===0)b.add(this.box,this.m.signs[i%8],x,h+1,z,1.3,2,1.3)}return b.group();
 }
 ellipsoid(parent,mat,x,y,z,sx,sy,sz){const mesh=new THREE.Mesh(this.sphere,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;}
 makeCat(skin){
  const root=new THREE.Group(),body=new THREE.Group(),m=this.m;root.add(body);
  const coat=skin==='gold'?m.gold:skin==='business'?m.concrete:m.black,suit=skin==='police'?m.police:skin==='astronaut'?m.white:skin==='business'?m.white:coat;
  this.ellipsoid(body,suit,0,.65,0,.83,.96,.7);
  const head=new THREE.Group();head.position.set(0,1.4,.04);body.add(head);
  this.ellipsoid(head,coat,0,0,0,1.68,1.34,1.22);this.ellipsoid(head,coat,-.43,-.23,.17,.78,.7,.9);this.ellipsoid(head,coat,.43,-.23,.17,.78,.7,.9);
  for(const side of [-1,1]){
    const ear=new THREE.Group();ear.position.set(side*.58,.42,-.07);ear.rotation.z=-side*.22;head.add(ear);
    const shape=new THREE.Shape();shape.moveTo(-.3,0);shape.quadraticCurveTo(-.34,.06,-.25,.55);shape.quadraticCurveTo(-.2,.76,-.09,.67);shape.lineTo(.29,.13);shape.quadraticCurveTo(.33,0,.19,-.03);shape.closePath();
    // The inset is a scaled copy of the outer ear silhouette, with a broad black rim on every edge.
    const outer=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.045,bevelThickness:.035,curveSegments:7}),coat);if(side>0)outer.scale.x=-1;ear.add(outer);
    const inset=new THREE.Mesh(new THREE.ShapeGeometry(shape,7),side<0?m.earRed:m.earGreen);inset.scale.set(side>0?-.66:.66,.64,1);inset.position.set(side<0?-.015:.015,.085,.174);ear.add(inset);
    this.ellipsoid(head,m.eye,side*.36,-.12,.545,.55,.5,.19);
    this.ellipsoid(head,m.pupil,side*.33,-.12,.642,.23,.31,.07);
    // Sloping lids cover the upper eyes; brows are rounded instead of rectangular pixels.
    const lid=this.ellipsoid(head,coat,side*.35,.092,.62,.65,.28,.22);lid.rotation.z=side*.12;
    const brow=this.ellipsoid(head,coat,side*.36,.25,.59,.72,.15,.22);brow.rotation.z=side*.22;
  }
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.5,12,8),m.orange);nose.position.set(0,-.27,.682);nose.scale.set(.24,.17,.19);nose.rotation.z=Math.PI;head.add(nose);
  this.ellipsoid(head,m.pupil,0,-.395,.606,.12,.025,.035);
  const cap=new THREE.Group();cap.position.set(0,.6,-.04);cap.rotation.z=.025;head.add(cap);
  const hatColor=skin==='police'?m.policeDark:m.capGreen;
  const dome=new THREE.Mesh(new THREE.SphereGeometry(.48,20,12,0,TAU,0,1.59),hatColor);dome.scale.set(1.14,.77,1);cap.add(dome);
  const panel=new THREE.Mesh(new THREE.SphereGeometry(.485,12,9,.45,Math.PI-.9,.12,1.36),m.cap);panel.scale.set(1.14,.77,1);cap.add(panel);
  const brimShape=new THREE.Shape();brimShape.moveTo(-.49,.17);brimShape.quadraticCurveTo(-.7,.68,-.45,.83);brimShape.quadraticCurveTo(0,.98,.45,.83);brimShape.quadraticCurveTo(.7,.68,.49,.17);brimShape.quadraticCurveTo(0,.32,-.49,.17);
  const brim=new THREE.Mesh(new THREE.ExtrudeGeometry(brimShape,{depth:.042,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:.023,bevelThickness:.012,curveSegments:10}),hatColor);brim.rotation.x=Math.PI/2;brim.position.y=.03;cap.add(brim);
  const label=new THREE.Mesh(this.plane,m.capLabel);label.position.set(0,.19,.432);label.rotation.x=-.25;label.scale.set(.31,.3,1);cap.add(label);
  this.ellipsoid(cap,hatColor,0,.382,0,.12,.06,.12);
  if(skin==='business')this.boxMesh(body,m.red,0,.76,.365,.09,.36,.025);
  if(skin==='ceo'){for(const side of [-1,1])this.boxMesh(head,m.pupil,side*.35,-.05,.7,.55,.25,.05);this.boxMesh(head,m.gold,0,-.01,.725,.22,.025,.025);this.boxMesh(body,m.gold,0,.93,.33,.5,.045,.04);this.ellipsoid(body,m.gold,0,.81,.4,.13,.17,.045);}
  if(skin==='astronaut'){const rim=new THREE.Mesh(new THREE.TorusGeometry(.88,.05,8,24),m.white);rim.position.set(0,1.45,.09);body.add(rim);this.boxMesh(body,m.cyan,0,.68,.37,.33,.22,.04);}
  const legs=[],arms=[];
  for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.24,.4,0);body.add(leg);this.ellipsoid(leg,coat,0,-.13,0,.3,.48,.34);this.ellipsoid(leg,skin==='astronaut'?m.white:coat,0,-.31,.11,.36,.21,.48);legs.push(leg);const arm=new THREE.Group();arm.position.set(side*.45,.96,0);body.add(arm);this.ellipsoid(arm,suit,0,-.2,0,.31,.55,.34);this.ellipsoid(arm,coat,0,-.43,.035,.32,.3,.33);arm.rotation.z=side*.12;arms.push(arm);}
  const tail=new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,.8,10),coat);tail.position.set(.14,.66,-.53);tail.rotation.x=-.75;body.add(tail);
  const bag=new THREE.Group();this.boxMesh(bag,m.chip,0,0,0,.38,.61,.17);bag.position.set(.47,.42,.3);bag.rotation.z=-.22;body.add(bag);
  return {root,body,head,legs,arms,tail,bag};
 }
 makePerson(index=0,police=false){
  const root=new THREE.Group(),body=new THREE.Group(),m=this.m;root.add(body);
  const skin=m.complexions[index%4],shirt=police?m.police:m.shirt[index%6],pants=police?m.policeDark:m.pants[index%3];
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.33,.26,.71,8),shirt);torso.position.y=1.33;torso.scale.z=.66;body.add(torso);
  this.ellipsoid(body,pants,0,.94,0,.65,.34,.42);this.ellipsoid(body,skin,0,1.8,0,.19,.27,.2);
  this.ellipsoid(body,skin,0,2.05,0,.48,.59,.43);this.ellipsoid(body,skin,0,1.94,.045,.39,.35,.39);
  // Natural compact facial proportions, dark hair and softly defined almond-shaped eyes.
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.255,12,8,0,TAU,0,1.85),m.black);hair.position.set(0,2.13,-.025);hair.scale.set(1,1, .93);body.add(hair);
  for(const side of [-1,1]){this.ellipsoid(body,skin,side*.235,2.03,0,.08,.15,.08);const eye=this.ellipsoid(body,m.pupil,side*.103,2.07,.204,.095,.026,.025);eye.rotation.z=side*.04;this.ellipsoid(body,m.black,side*.106,2.128,.2,.12,.02,.035);}
  this.ellipsoid(body,skin,0,2.015,.225,.09,.11,.09);this.ellipsoid(body,m.wood,0,1.91,.197,.11,.017,.025);
  const legs=[],arms=[];
  for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.16,.92,0);body.add(leg);const thigh=new THREE.Mesh(new THREE.CylinderGeometry(.135,.105,.51,8),pants);thigh.position.y=-.23;leg.add(thigh);const shin=new THREE.Mesh(new THREE.CylinderGeometry(.105,.08,.43,8),pants);shin.position.set(0,-.64,.015);leg.add(shin);this.ellipsoid(leg,m.black,0,-.84,.075,.23,.17,.4);legs.push(leg);const arm=new THREE.Group();arm.position.set(side*.34,1.61,0);body.add(arm);const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.135,.1,.35,8),shirt);sleeve.position.y=-.13;arm.add(sleeve);const forearm=new THREE.Mesh(new THREE.CylinderGeometry(.085,.065,.34,8),skin);forearm.position.set(0,-.44,.025);arm.add(forearm);this.ellipsoid(arm,skin,0,-.63,.04,.14,.18,.16);arms.push(arm);}
  if(police){this.boxMesh(body,m.policeDark,0,1,.017,.59,.095,.42);this.boxMesh(body,m.policeDark,0,1.43,.239,.045,.38,.02);this.boxMesh(body,m.gold,-.19,1.5,.207,.085,.11,.022);this.boxMesh(body,m.policeDark,.21,1.12,.19,.12,.2,.07);const hat=new THREE.Mesh(new THREE.CylinderGeometry(.27,.285,.14,16),m.policeDark);hat.position.set(0,2.36,-.005);body.add(hat);this.ellipsoid(body,m.policeDark,0,2.3,.22,.6,.07,.34);this.ellipsoid(body,m.gold,0,2.37,.264,.105,.125,.02);}
  else if(index%3===0){this.ellipsoid(body,m.wood,.4,.91,.04,.37,.45,.22);}
  return {root,body,legs,arms};
 }
 makeCop(){return this.makePerson(1,true);}
 makePedestrians(){
  this.people=Array.from({length:32},(_,i)=>{const p=this.makePerson(i);p.root.scale.setScalar(.83+(i%4)*.045);this.scene.add(p.root);return {...p,seed:i*6.15,side:i%2?1:-1,speed:.28+(i%5)*.08};});
 }
 updatePeople(dist,time){for(let i=0;i<this.people.length;i++){const p=this.people[i];let z=((dist+p.seed+p.speed*time)%195)-175;p.root.position.set(p.side*(4.55+(i%3)*.32),.11,z);p.root.rotation.y=i%3?Math.PI:0;const step=Math.floor(time*24)/24,s=Math.sin(step*4.8+i);p.legs.forEach((l,j)=>l.rotation.x=s*(j?1:-1)*.29);p.arms.forEach((a,j)=>a.rotation.x=s*(j?-1:1)*.23);}}
 makeEntity(type,id=0){
  const g=new THREE.Group(),m=this.m,bx=(mat,x,y,z,sx,sy,sz,rz=0)=>this.boxMesh(g,mat,x,y,z,sx,sy,sz,rz);
  if(type==='coin'){const disc=new THREE.Mesh(this.cylinder,m.coin);disc.rotation.x=Math.PI/2;disc.scale.set(.63,.12,.63);g.add(disc);for(const side of [-1,1]){const f=new THREE.Mesh(this.plane,m.coinFace);f.position.z=side*.066;f.scale.set(.48,.48,1);f.rotation.y=side<0?Math.PI:0;g.add(f);}}
  else if(type==='traffic'){
   const col=id%4===0?m.green:m.red,bus=id%4===0,len=bus?3.2:3.0;
   bx(col,0,.59,0,1.73,.57,len);bx(m.white,0,bus?1.36:1.14,-.12,bus?1.63:1.43,bus?1.04:.65,bus?2.9:1.65);bx(m.glass,0,bus?1.53:1.27,bus?1.38:.71,1.36,bus?.49:.4,.045);
   bx(col,0,bus?.98:.89,.79,1.67,.19,1.33);bx(m.metal,0,.38,len/2+.03,1.75,.13,.06);bx(m.black,0,.63,len/2+.04,.69,.18,.026);bx(m.white,0,.43,len/2+.07,.44,.11,.02);
   for(const side of [-1,1]){bx(m.lamp,side*.63,.75,len/2+.055,.31,.19,.03);bx(m.orange,side*.78,.75,len/2+.05,.08,.16,.02);bx(m.siren,side*.63,.72,-len/2-.035,.28,.15,.03);bx(m.metal,side*.92,.98,.45,.15,.08,.18);for(const z of [-1.01,1.01]){const tire=new THREE.Mesh(this.cylinder,m.tire);tire.rotation.z=Math.PI/2;tire.position.set(side*.88,.32,z);tire.scale.set(.58,.15,.58);g.add(tire);const hub=new THREE.Mesh(this.cylinder,m.metal);hub.rotation.z=Math.PI/2;hub.position.set(side*.966,.32,z);hub.scale.set(.28,.025,.28);g.add(hub);}for(const z of (bus?[-.92,0,.9]:[-.46,.4]))bx(m.glass,side*(bus?.824:.728),bus?1.55:1.24,z,.025,bus?.45:.33,bus?.72:.58);bx(m.metal,side*.88,.9,-.15,.025,.045,.21);}
   if(!bus){bx(m.white,0,1.52,-.05,.55,.12,.28);const sign=new THREE.Mesh(this.plane,m.taxiLabel);sign.position.set(0,1.53,.095);sign.scale.set(.49,.1,1);g.add(sign);}else bx(m.green,0,1.92,0,1.64,.13,3.1);
  }else if(type==='blocker'){if(id%2){bx(m.green,0,.69,0,1.4,1.36,1.3);bx(m.black,0,1.43,0,1.51,.12,1.41);for(const x of [-.47,.47])bx(m.tire,x,.12,.45,.21,.22,.2);}else{for(let i=0;i<3;i++){bx(m.wood,i===2?0:(i?-.42:.42),i===2?1.31:.54,0,.83,1,.94);bx(m.white,i===2?0:(i?-.42:.42),i===2?1.31:.54,.481,.15,.9,.015);}}}
  else if(type==='jump'){bx(m.orange,0,.5,0,1.9,.76,.43);for(let x=-.7;x<=.7;x+=.46)bx(m.white,x,.51,.222,.2,.7,.02,-.5);for(const x of [-.73,.73])bx(m.black,x,.08,0,.43,.16,.65);}
  else if(type==='slide'){for(const x of [-1.02,1.02]){bx(m.metal,x,1.44,0,.12,2.88,.18);bx(m.black,x,.08,0,.35,.16,.65);}bx(m.yellow,0,2.02,0,2.16,.93,.35);for(let x=-.7;x<=.7;x+=.43)bx(m.black,x,2.02,.183,.19,.86,.02,-.5);}
  else{const ring=new THREE.Mesh(new THREE.TorusGeometry(.46,.055,8,24),type==='moon'?m.gold:m.cyan);g.add(ring);if(type==='moon')this.ellipsoid(g,m.gold,0,0,0,.54,.54,.3);else{bx(m.red,-.16,0,0,.14,.4,.15);bx(m.red,.16,0,0,.14,.4,.15);bx(m.red,0,-.16,0,.35,.12,.15);bx(m.white,-.16,.17,0,.14,.11,.16);bx(m.white,.16,.17,0,.14,.11,.16);}}
  return g;
 }
 makeMenuProps(){
  const m=this.m;this.menuProps=new THREE.Group();this.scene.add(this.menuProps);this.menuCoins=[];
  for(let i=0;i<12;i++){const coin=this.makeEntity('coin',i);coin.position.set(i%3===0?-2.5:i%3===1?0:2.5,.9,-8-i*2.3);this.menuProps.add(coin);this.menuCoins.push(coin);}
  // A complete, lit convenience-store frontage anchors the only opening sequence.
  this.store=new THREE.Group();this.store.position.set(-7.0,0,-2);this.store.rotation.y=Math.PI/2;this.scene.add(this.store);
  const bx=(mat,x,y,z,sx,sy,sz)=>this.boxMesh(this.store,mat,x,y,z,sx,sy,sz);
  bx(m.white,0,2.3,-.4,7.7,4.6,.9);bx(m.black,0,1.8,.1,7.45,3.5,.3);
  for(const side of [-1,1]){const win=new THREE.Mesh(this.plane,m.shops[7]);win.position.set(side*2.35,1.78,.28);win.scale.set(2.32,3.07,1);this.store.add(win);bx(m.metal,side*3.58,1.8,.36,.085,3.45,.11);bx(m.metal,side*1.12,1.8,.36,.08,3.45,.11);}
  const sign=new THREE.Mesh(this.plane,m.storeSign);sign.position.set(0,4.2,.27);sign.scale.set(7.95,1.44,1);this.store.add(sign);
  bx(m.lamp,0,3.52,.5,7.6,.1,.5);bx(m.white,0,.05,1,7.7,.1,1.4);
  // Shelves are visible through the open central doorway.
  bx(m.white,0,1.6,-1.3,2.25,3.2,.1);for(const side of [-1,1]){const shelf=new THREE.Mesh(this.plane,m.shops[7]);shelf.position.set(side*.85,1.5,-.4);shelf.rotation.y=side<0?Math.PI/2:-Math.PI/2;shelf.scale.set(2.3,2.8,1);this.store.add(shelf);}bx(m.lamp,0,3.15,-.25,1.8,.1,1.8);
  this.doors=[];const doorGlass=this.mat(0x98c4bc,{transparent:true,opacity:.22});
  for(const side of [-1,1]){const door=new THREE.Group();this.boxMesh(door,doorGlass,0,1.73,.43,1.08,3.25,.035);for(const x of [-.53,.53])this.boxMesh(door,m.metal,x,1.73,.46,.045,3.3,.055);for(const y of [.12,3.36])this.boxMesh(door,m.metal,0,y,.46,1.1,.04,.055);this.boxMesh(door,m.white,side*.36,1.55,.51,.045,.47,.035);door.position.x=side*.56;this.store.add(door);this.doors.push(door);const poster=new THREE.Mesh(this.plane,m.posters[side<0?0:2]);poster.position.set(side*2.42,2.05,.33);poster.scale.set(.59,1.05,1);this.store.add(poster);}
  for(let i=0;i<4;i++){const rack=new THREE.Mesh(this.plane,m.posters[i]);rack.position.set(-3.2+i*.45,1.3,1.06);rack.scale.set(.4,.95,1);this.store.add(rack);}bx(m.wood,-2.53,.59,.94,2.1,.4,.65);
 }
 makeParticles(){this.particleMesh=new THREE.InstancedMesh(this.box,this.m.gold,48);this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particleMesh.frustumCulled=false;this.scene.add(this.particleMesh);this.particleDummy=new THREE.Object3D();this.particleMesh.count=0;}
 resize(width,height,{quality='sharp'}={}){const ratio=Math.max(.35,width/Math.max(1,height)),targetH=quality==='low'?420:quality==='retro'?560:780;const h=Math.round(Math.min(targetH,1400/ratio)),w=Math.round(h*ratio);this.renderer.setSize(w,h,false);this.camera.aspect=ratio;this.camera.updateProjectionMatrix();this.snapUniform.value.set(w,h);this.width=width;this.height=height;this.canvas.style.imageRendering='auto';}
 animateCat(cat,time,mode,player={},reducedMotion=false){const t=Math.floor(time*24)/24,s=Math.sin(t*17),run=mode==='run',slide=(player.slide||0)>0;cat.body.rotation.set(slide?-1.0:0,0,0);cat.body.position.y=slide?-.62:run&&!reducedMotion?Math.abs(s)*.035:0;cat.head.rotation.z=mode==='caught'?-.13:mode==='menu'&&!reducedMotion?Math.sin(t*1.5)*.025:0;cat.legs.forEach((l,i)=>l.rotation.x=run&&!slide?s*(i?1:-1)*.8:0);cat.arms.forEach((a,i)=>a.rotation.x=run?s*(i?-1:1)*.6:mode==='caught'?(i?-.8:-.2):-.1);cat.tail.rotation.z=Math.sin(t*4)*.14;cat.bag.rotation.z=-.2;cat.bag.position.y=mode==='caught'?.65:.42;}
 animateCop(c,t,strength=1){const s=Math.sin(Math.floor(t*24)/24*12);c.legs.forEach((l,i)=>l.rotation.x=s*(i?1:-1)*.59*strength);c.arms.forEach((a,i)=>{a.rotation.x=s*(i?-1:1)*.7*strength;a.rotation.z=0});c.body.position.y=Math.abs(s)*.03*strength;}
 render(game={},dt=1/60,{skin='18bro',menu=false,reducedMotion=false}={}){
  const state=game.state||'MAIN_MENU',isMenu=menu||state==='MAIN_MENU',isOver=state==='GAME_OVER',isPaused=state==='PAUSED',isStarting=state==='STARTING'||isPaused&&game._beforePause==='STARTING';
  dt=Math.min(dt,.05);if(!isPaused)this.clock+=dt;if(state!==this.lastState){if(!(state==='PAUSED'||this.lastState==='PAUSED'))this.stateTime=0;this.lastState=state;}if(!isPaused)this.stateTime+=dt;
  if(skin!==this.skin){this.scene.remove(this.cat.root);this.cat=this.makeCat(skin);this.scene.add(this.cat.root);this.skin=skin;}
  const p=game.player||{},dist=game.distance||0,t=isOver?Math.min(this.stateTime,1.3):(isMenu?this.clock:game.time||0),moon=game.powers?.has('moon');
  const wd=isMenu?this.clock*.28:dist;for(let i=0;i<7;i++)this.chunks[i].root.position.z=((wd+i*30)%210)-170;
  this.updatePeople(wd,isPaused?this.frozenClock:this.clock);if(!isPaused)this.frozenClock=this.clock;
  this.store.visible=isMenu||isStarting;this.menuProps.visible=isMenu;const cop=this.cops[0];cop.root.visible=false;
  this.menuCoins.forEach((c,i)=>{c.rotation.y=t*1.3+i;});
  this.cat.root.visible=!(p.hit>0&&Math.floor(t*14)%2===0);
  let scale=1,goalFov=65;
  if(isMenu){const narrow=this.camera.aspect<1.1;scale=narrow?1.17:1.5;this.cat.root.position.set(narrow?1.45:2.3,narrow?.28:.1,narrow?-.6:1);this.cat.root.rotation.set(0,-.17,0);this.animateCat(this.cat,t,'menu',{},reducedMotion);this.target.set(narrow?.25:.35,narrow?3.6:3.1,narrow?9.3:8.1);this.cameraTarget.set(0,narrow?1.45:1.75,-7);goalFov=narrow?62:59;this.doors.forEach((d,i)=>d.position.x=(i?1:-1)*.56);}
  else if(isStarting){const it=game.introProgress*3.8,escape=clamp((it-.35)/1.85,0,1),turn=clamp((it-1.9)/.65,0,1),blend=clamp((it-1.45)/2.1,0,1),smooth=blend*blend*(3-2*blend);this.doors.forEach((d,i)=>d.position.x=(i?1:-1)*(.56+clamp((it-.12)/.35,0,1)*.98));this.cat.root.position.set(-6.35*(1-escape),Math.sin(clamp((it-.35)/.85,0,1)*Math.PI)*.56,-2*(1-escape));this.cat.root.rotation.set(0,Math.PI/2+turn*Math.PI/2,0);this.animateCat(this.cat,this.clock,'run',{},reducedMotion);this.target.set(-.5*(1-smooth),2.6+smooth*1.2,4.5+smooth*2.8);this.cameraTarget.set(-5.9*(1-smooth),1.65,-2-8*smooth);const ce=clamp((it-.9)/2,0,1);cop.root.visible=true;cop.root.position.set(-6.5*(1-ce),0,-2*(1-ce)+Math.max(0,(it-2.5))*2.9);cop.root.rotation.y=Math.PI/2+clamp((it-2.5)/.5,0,1)*Math.PI/2;this.animateCop(cop,this.clock);}
  else if(isOver){scale=1.18;this.cat.root.position.set(1.95,0,.2);this.cat.root.rotation.set(0,-.16,0);this.animateCat(this.cat,t,'caught',{},reducedMotion);cop.root.visible=true;cop.root.position.set(3.05,0,.06);cop.root.rotation.y=-.22;this.animateCop(cop,0,0);cop.arms[0].rotation.z=-.65;this.target.set(0,3.1,8.4);this.cameraTarget.set(.7,1.5,-1);goalFov=59;}
  else{const px=p.x||0,py=p.y||0;this.cat.root.position.set(px,py,0);this.cat.root.rotation.set(0,Math.PI,0);this.animateCat(this.cat,t,'run',p,reducedMotion);if(py>.1){this.cat.legs[0].rotation.x=-.55;this.cat.legs[1].rotation.x=.4;}this.target.set(px*.1,3.85+Math.min(py*.14,.6),7.3);this.cameraTarget.set(px*.12,1.4,-10);const pd=game.policeDistance??10;cop.root.visible=pd<7.5;if(cop.root.visible){cop.root.position.set(px+.85,0,1.2+pd*.38);cop.root.rotation.y=Math.PI;this.animateCop(cop,t);}goalFov=moon?78:65+clamp(((game.speed||9.4)-9.4)/18,0,1)*7;}
  this.cat.root.scale.setScalar(scale);
  for(const slot of this.entities.values())slot.group.visible=false;
  for(const e of game.entities||[]){if(!e.active||isMenu||isOver||isStarting)continue;let slot=this.entities.get(e.id);if(!slot){slot={group:new THREE.Group(),variants:new Map(),type:''};this.scene.add(slot.group);this.entities.set(e.id,slot);}if(!slot.variants.has(e.type)){const mesh=this.makeEntity(e.type,e.id);slot.group.add(mesh);slot.variants.set(e.type,mesh);}if(slot.type!==e.type){for(const [type,mesh] of slot.variants)mesh.visible=type===e.type;slot.type=e.type;}slot.group.visible=true;slot.group.position.set(e.x,e.y||0,e.z);slot.group.rotation.set(0,['coin','magnet','moon'].includes(e.type)?Math.floor(t*18)/18*2:0,0);}
  if(!isPaused){this.camera.position.lerp(this.target,isMenu||isOver?1:1-Math.exp(-dt*14));this.camera.lookAt(this.cameraTarget);this.camera.fov+=(goalFov-this.camera.fov)*(1-Math.exp(-dt*9));this.camera.updateProjectionMatrix();}
  this.particleMesh.count=moon?48:0;if(moon){for(let i=0;i<48;i++){const q=(t*1.6+i*.09)%1;this.particleDummy.position.set((p.x||0)+Math.sin(i*2.3)*(1+q*3),.2+i%7*.3,q*15-12);this.particleDummy.scale.set(.018,.018,.2+q*.4);this.particleDummy.updateMatrix();this.particleMesh.setMatrixAt(i,this.particleDummy.matrix);}this.particleMesh.instanceMatrix.needsUpdate=true;}
  this.updateDebug(game,isMenu||isOver);this.renderer.render(this.scene,this.camera);
 }
 updateDebug(game,hide){const show=game.debug?.showColliders&&!hide;this.debugBoxes.visible=!!show;if(!show)return;const es=game.entities.filter(e=>e.active&&['traffic','blocker','jump','slide'].includes(e.type));for(let i=0;i<=es.length;i++){if(!this.debugPool[i]){const mesh=new THREE.LineSegments(new THREE.EdgesGeometry(this.box),new THREE.LineBasicMaterial({color:0x76f55a,depthTest:false}));mesh.renderOrder=100;this.debugBoxes.add(mesh);this.debugPool.push(mesh);}const m=this.debugPool[i];m.visible=true;if(i===0){const p=game.player; m.position.set(p.x,p.y+(p.slide>0?.32:.85),0);m.scale.set(.6,p.slide>0?.64:1.7,.5);}else{const e=es[i-1];m.position.set(e.x,e.type==='slide'?2:e.type==='jump'?.5:1.2,e.z);m.scale.set(e.width,e.type==='slide'?.96:e.type==='jump'?1:2.4,e.depth);}}for(let i=es.length+1;i<this.debugPool.length;i++)this.debugPool[i].visible=false;}
 get stats(){return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,chunks:this.chunks.length};}
 dispose(){this.renderer.dispose();this.scene.traverse(o=>o.geometry?.dispose());this.materials.forEach(m=>{m.map?.dispose();m.dispose()});}
}
