import * as THREE from './vendor/three.module.js';
// User-supplied road and sidewalk surfaces; shop fixtures and stock stay modeled.
export function applyMaterialAssets(scene) {
  const m=scene.m;
  const pending=[];
  const load=(name,width=128,height=128)=>{let done;pending.push(new Promise(resolve=>done=resolve));return new THREE.TextureLoader().load(new URL(`./assets/textures/${name}`, import.meta.url).href,t=>{
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(t.image,0,0,width,height);t.image=canvas;t.generateMipmaps=true;t.needsUpdate=true;done();
  },undefined,()=>done());};
  const road=load('asphalt.png');
  road.colorSpace=THREE.SRGBColorSpace;
  road.magFilter=THREE.NearestFilter;road.minFilter=THREE.NearestMipmapLinearFilter;road.generateMipmaps=true;
  road.wrapS=road.wrapT=THREE.RepeatWrapping;road.repeat.set(2,7);
  m.asphalt=scene.mat(0xb8b8b8,{map:road});
  const capLogo=load('cap-logo.png',192,128);capLogo.colorSpace=THREE.SRGBColorSpace;capLogo.magFilter=THREE.LinearFilter;capLogo.minFilter=THREE.LinearMipmapLinearFilter;
  m.capLogo=scene.mat(0xffffff,{map:capLogo,transparent:true,alphaTest:.12,side:THREE.DoubleSide});
  m.storeFloor=scene.mat(0xe5e1d4);m.storeWall=scene.mat(0xe8e7d9);
  const pavement=load('sidewalk.png');pavement.colorSpace=THREE.SRGBColorSpace;
  pavement.magFilter=THREE.NearestFilter;pavement.minFilter=THREE.NearestMipmapLinearFilter;pavement.generateMipmaps=true;
  pavement.anisotropy=1;
  m.sidewalk=scene.mat(0xffffff,{map:pavement});m.shutter=scene.mat(0x54636a);
  scene.assetsReady=Promise.all(pending);
  m.bamboo=scene.mat(0xc49a63);m.ice=scene.mat(0xb6d8d8);
  m.marketTile=scene.mat(0x537a76);m.fish=scene.mat(0x92c4c7);
  m.fishPink=scene.mat(0xd58072);m.leaf=scene.mat(0x4c9f4f);m.purple=scene.mat(0x623962);
  m.wall=[0xa6a794,0x738f89,0xa88e7d,0xb7aa8c,0x828c9d,0xa2ada4].map(v=>scene.mat(v));
}
