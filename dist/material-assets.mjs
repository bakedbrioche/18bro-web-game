import * as THREE from './vendor/three.module.js';

// Images are local project assets, so the game and all visual materials work offline.
export function applyMaterialAssets(scene) {
  const m = scene.m, loader = new THREE.TextureLoader();
  const load = (name, repeat = [1, 1], ready = undefined) => {
    const t = loader.load(new URL(`./assets/textures/${name}`, import.meta.url).href, ready);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
    return t;
  };
  m.storeFloor = scene.mat(0xe9e4d7, {map:load('store-floor.png', [2, 2])});
  m.storeWall = scene.mat(0xeae3ce, {map:load('store-plaster.png')});
  m.sidewalk = scene.mat(0xb8b6b1, {map:load('sidewalk.png', [1, 8])});
  m.fridges = scene.mat(0xffffff, {map:load('drink-fridges.png'), emissive:0xffffff, emissiveIntensity:.25});
  const atlasCells = [];
  const atlas = load('hong-kong-atlas.png', [1,1], () => atlasCells.forEach(t => {t.needsUpdate=true;}));
  const cell = (index, color = 0xffffff, extra = {}, tiles = [1,1]) => {
    // Share image data, but only request a GPU upload after the source image finishes loading.
    const t = new THREE.Texture(); t.source=atlas.source; t.colorSpace=atlas.colorSpace;
    t.magFilter=atlas.magFilter; t.minFilter=atlas.minFilter;
    const rows=[0,1/3,.646,1],row=Math.floor(index/3),height=rows[row+1]-rows[row]-.003;
    t.repeat.set(1/3-.003,height);t.offset.set(index%3/3+.0015,1-rows[row+1]+.0015);
    atlasCells.push(t);if(atlas.image)t.needsUpdate=true;
    const material=scene.mat(color,{map:t,...extra});
    if(tiles[0]!==1||tiles[1]!==1){
      const hook=material.onBeforeCompile,min=`vec2(${t.offset.x.toFixed(6)},${t.offset.y.toFixed(6)})`,size=`vec2(${t.repeat.x.toFixed(6)},${t.repeat.y.toFixed(6)})`;
      material.onBeforeCompile=shader=>{hook(shader);const uv='mix(vMapUv,vAffineUv/max(vAffineW,0.0001),0.035)';shader.fragmentShader=`vec2 atlasRepeat(vec2 uv){return ${min}+fract((uv-${min})/${size}*vec2(${tiles[0].toFixed(1)},${tiles[1].toFixed(1)}))*${size};}\n`+shader.fragmentShader.replaceAll(uv,`atlasRepeat(${uv})`);};
      material.customProgramCacheKey=()=>`atlas-${index}-${tiles.join('-')}`;
    }
    return material;
  };
  m.asphalt = cell(0, 0x9099a1, {}, [2,8]);
  m.brick = cell(1,0xffffff,{},[2,6]); m.shutter = cell(2); m.awning = cell(3);
  m.bamboo = cell(4); m.ice = cell(5); m.groceries = cell(6, 0xffffff, {emissive:0xffedcc, emissiveIntensity:.12});
  m.marketTile = cell(7); m.wall.push(cell(8,0xffffff,{},[1,3]));
  m.wall[0] = m.brick; m.wall[2] = cell(8,0xffffff,{},[1,3]);
  m.fish = scene.mat(0x92c4c7, {flatShading:false});
  m.fishPink = scene.mat(0xd58072, {flatShading:false});
  m.leaf = scene.mat(0x4c9f4f); m.purple = scene.mat(0x623962);
}
