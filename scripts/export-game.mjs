import fs from 'node:fs';
import path from 'node:path';
const [src,out]=process.argv.slice(2);
const read=file=>fs.readFileSync(path.join(src,file),'utf8');
const importPattern=/^import\s+(\{[\s\S]*?\}|\*\s+as\s+\w+)\s+from\s+(['"])([^'"]+)\2\s*;/gm;
const compiled=new Set();

function dependency(file,specifier){
 const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier.split('?')[0]));
 if(!compiled.has(resolved))throw new Error(`Unbundled dependency ${specifier} in ${file}`);
 return `standaloneModules[${JSON.stringify(resolved)}]`;
}
function entries(list){
 return list.split(',').map(item=>item.trim()).filter(Boolean).map(item=>{
  const match=item.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
  if(!match)throw new Error(`Unsupported module binding: ${item}`);
  return {local:match[1],alias:match[2]||match[1]};
 });
}
function bundle(file){
 let source=read(file),exports=[];
 source=source.replace(importPattern,(_,bindings,quote,specifier)=>{
  const module=dependency(file,specifier);
  if(bindings.startsWith('*'))return `const ${bindings.match(/as\s+(\w+)/)[1]}=${module};`;
  return `const {${entries(bindings.slice(1,-1)).map(({local,alias})=>`${local}:${alias}`).join(',')}}=${module};`;
 });
 source=source.replace(/^export\s*\{([\s\S]*?)\}\s*(?:from\s+(['"])([^'"]+)\2\s*)?;/gm,(_,list,quote,specifier)=>{
  const module=specifier?dependency(file,specifier):null;
  for(const {local,alias} of entries(list))exports.push(`${alias}:${module?`${module}.${local}`:local}`);
  return '';
 });
 source=source.replace(/^export\s+((?:async\s+)?function|class|const|let)\s+(\w+)/gm,(_,kind,name)=>{
  exports.push(`${name}:${name}`);return `${kind} ${name}`;
 });
 if(/^\s*(?:import\s+(?!\()|export\s+)/m.test(source))throw new Error(`Unsupported module syntax in ${file}`);
 if(file==='material-assets.mjs')source=source.replace('new URL(`./assets/textures/${name}`, import.meta.url).href','embeddedTextures[name]');
 if(file==='audio.mjs')source=source.replace("new URL('./assets/audio/street-market.mp3',import.meta.url).href",'embeddedAmbience');
 if(file==='character-assets.mjs')source=source.replace('embeddedModels = {}','embeddedModels = globalThis.__18BRO_EMBEDDED_MODELS__');
 compiled.add(file);
 return `// bundled: ${file}\nstandaloneModules[${JSON.stringify(file)}]=(()=>{\n${source}\nreturn {${exports.join(',')}};\n})();\n`;
}

const images=Object.fromEntries(fs.readdirSync(path.join(src,'assets/textures')).filter(file=>file.endsWith('.png')).sort().map(file=>[file,'data:image/png;base64,'+fs.readFileSync(path.join(src,'assets/textures',file)).toString('base64')]));
const modelsDirectory=path.join(src,'assets/models');
const models=Object.fromEntries((fs.existsSync(modelsDirectory)?fs.readdirSync(modelsDirectory):[]).filter(file=>file.endsWith('.glb')).sort().map(file=>[file,fs.readFileSync(path.join(modelsDirectory,file)).toString('base64')]));
const iconsDirectory=path.join(src,'assets/icons');
const powerIcons=Object.fromEntries((fs.existsSync(iconsDirectory)?fs.readdirSync(iconsDirectory):[]).filter(file=>/^powerup-.*[.]png$/.test(file)).sort().map(file=>[file.slice(8,-4),'data:image/png;base64,'+fs.readFileSync(path.join(iconsDirectory,file)).toString('base64')]));
const uiImages=Object.fromEntries((fs.existsSync(iconsDirectory)?fs.readdirSync(iconsDirectory):[]).filter(file=>/^(?!powerup-).*[.]png$/.test(file)).sort().map(file=>[path.basename(file,'.png'),'data:image/png;base64,'+fs.readFileSync(path.join(iconsDirectory,file)).toString('base64')]));
const ambience='data:audio/mpeg;base64,'+fs.readFileSync(path.join(src,'assets/audio/street-market.mp3')).toString('base64');
const modules=[
 'vendor/three.module.js',
 'vendor/addons/utils/BufferGeometryUtils.js',
 'vendor/addons/utils/SkeletonUtils.js',
 'vendor/addons/loaders/GLTFLoader.js',
 'choreography.mjs','customization.mjs','model-config.mjs','presentation-config.mjs','model-manifest.mjs','character-assets.mjs','character-animation.mjs',
 'route.mjs','net-pursuit.mjs','core.mjs','crowd.mjs','material-assets.mjs','district-scene.mjs','scene.mjs','audio.mjs','loading-screen.mjs'
];
if([...read('app.mjs').matchAll(importPattern)].some(match=>match[3].split('?')[0]==='./analytics.mjs'))modules.push('analytics.mjs');
modules.push('app.mjs');
const code=`const standaloneModules=Object.create(null);\nconst embeddedAmbience=${JSON.stringify(ambience)};\nconst embeddedTextures=${JSON.stringify(images)};\nglobalThis.__18BRO_EMBEDDED_MODELS__=${JSON.stringify(models)};\nglobalThis.__18BRO_POWER_ICONS__=${JSON.stringify(powerIcons)};\nglobalThis.__18BRO_UI_IMAGES__=${JSON.stringify(uiImages)};\n${modules.map(bundle).join('')}`;
const font=fs.readFileSync(path.join(src,'vendor/VT323.ttf')).toString('base64');
const css=read('style.css').replace('./vendor/VT323.ttf','data:font/ttf;base64,'+font);
const html=read('index.html').replace(/<link rel="icon" type="image\/png" sizes="128x128" href="assets\/icons\/favicon[.]png">/,()=>`<link rel="icon" type="image/png" sizes="128x128" href="${uiImages.favicon}">`).replace(/assets\/icons\/([a-z0-9-]+)[.]png/g,(url,key)=>uiImages[key]||url).replace(/<link rel="stylesheet" href="style[.]css[^"]*">/,()=>`<style>${css}</style>`).replace(/<script type="module" src="loading-screen\.mjs[^\"]*"><\/script>/,'').replace(/<script type="module" src="app\.mjs[^\"]*"><\/script>/,()=>`<script type="module">${code.replace(/<\/script/gi,'<\\/script')}</script>`);
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,html);
console.log(JSON.stringify({file:out,bytes:Buffer.byteLength(html)}));
