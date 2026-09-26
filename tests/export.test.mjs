import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('standalone embeds exact model bytes and parses/clones them offline with vendored addons',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'18bro-export-'));
 try{
  const output=path.join(directory,'game.html');
  execFileSync(process.execPath,['scripts/export-game.mjs','dist',output],{cwd:root});
  const html=fs.readFileSync(output,'utf8');
  const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(code,'standalone contains the executable module');
  assert.doesNotMatch(code,/^\s*(?:import\s+(?!\()|export\s+)/m);
  assert.doesNotMatch(html,/<script[^>]+src="app\.mjs|<link[^>]+href="style\.css/);
  const app=fs.readFileSync(path.join(root,'dist/app.mjs'),'utf8');
  assert.equal(code.includes('// bundled: analytics.mjs'),/from\s+['"]\.\/analytics\.mjs/.test(app));
  // import.meta is valid in the browser module. Substitute its URL only for the
  // Node VM, which evaluates the complete bundled library without a browser UI.
  const executable=code.replaceAll('import.meta.url',JSON.stringify('file:///offline/game.html'));
  new vm.Script(executable); // Also syntax-check the real app wrapper.
  const libraries=executable.slice(0,executable.indexOf('// bundled: app.mjs'));
  const context=vm.createContext({console,TextDecoder,TextEncoder,atob,URL,Blob,setTimeout,clearTimeout,
   fetch(){throw new Error('Standalone attempted a network request');}});
  context.self=context;
  vm.runInContext(libraries+'\nglobalThis.testModules=standaloneModules;',context);
  const modules=context.testModules;
  assert.equal(modules['vendor/three.module.js'].REVISION,'169');
  assert.equal(typeof modules['vendor/addons/utils/BufferGeometryUtils.js'].toTrianglesDrawMode,'function');
  assert.equal(typeof modules['vendor/addons/utils/SkeletonUtils.js'].clone,'function');
  assert.equal(typeof modules['vendor/addons/loaders/GLTFLoader.js'].GLTFLoader,'function');
  assert.equal(modules['model-config.mjs'].normalizeModelSet('refreshed'),'refreshed');
  for(const name of fs.readdirSync(path.join(root,'dist/assets/models')).filter(name=>name.endsWith('.glb'))){
   assert.deepEqual(Buffer.from(context.__18BRO_EMBEDDED_MODELS__[name],'base64'),fs.readFileSync(path.join(root,'dist/assets/models',name)));
  }
  for(const name of fs.readdirSync(path.join(root,'dist/assets/icons')).filter(name=>/^powerup-.*[.]png$/.test(name))){
   const type=name.slice(8,-4),encoded=context.__18BRO_POWER_ICONS__[type];
   assert.ok(encoded.startsWith('data:image/png;base64,'),`${type} icon is embedded`);
   assert.deepEqual(Buffer.from(encoded.split(',')[1],'base64'),fs.readFileSync(path.join(root,'dist/assets/icons',name)));
  }
  for(const name of fs.readdirSync(path.join(root,'dist/assets/icons')).filter(name=>/^(?!powerup-).*[.]png$/.test(name))){
   const key=path.basename(name,'.png'),encoded=context.__18BRO_UI_IMAGES__[key];
   assert.ok(encoded.startsWith('data:image/png;base64,'),`${key} UI image is embedded`);
   assert.deepEqual(Buffer.from(encoded.split(',')[1],'base64'),fs.readFileSync(path.join(root,'dist/assets/icons',name)));
  }  const manifest=modules['model-manifest.mjs'].MODEL_MANIFEST;
  const store=modules['character-assets.mjs'].createCharacterAssetStore({manifest});
  try{
   for(const entry of manifest){
    const first=await store.instantiate(entry.assetId),second=await store.instantiate(entry.assetId);
    assert.ok(first.scene.isObject3D);assert.notEqual(first.scene,second.scene);
    assert.deepEqual(Array.from(first.animations,clip=>clip.name).sort(),Array.from(entry.clips).sort());
    for(const clip of first.animations)for(const track of clip.tracks)assert.equal(track.times[0],0,`${entry.assetId}/${clip.name}/${track.name} starts at zero`);
    for(const name of entry.sockets)assert.ok(first.scene.getObjectByName(name),name);
    const skins=[];first.scene.traverse(object=>{if(object.isSkinnedMesh)skins.push(object);});
    if(entry.category==='character')assert.ok(skins.length,'exported rig has a skinned mesh');
    else assert.equal(skins.length,0,'static prop set does not carry a skeleton');
    for(const skin of skins)assert.notEqual(skin.skeleton,second.scene.getObjectByName(skin.name).skeleton);
    first.dispose();second.dispose();
   }
  }finally{store.dispose();}
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
