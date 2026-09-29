import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LOADING_EXIT_MS,LOADING_MESSAGES,loadingLetters,renderLoadingMessage,createLoadingScreen} from '../dist/loading-screen.mjs';

function classes(){const values=new Set();return {add:(...names)=>names.forEach(name=>values.add(name)),remove:(...names)=>names.forEach(name=>values.delete(name)),contains:name=>values.has(name)};}
function loadingDocument(){
 const body={classList:classes()},documentRef={body,createElement(){return {className:'',style:{setProperty(name,value){this[name]=value;}},setAttribute(){},textContent:''};}};
 const copy={ownerDocument:documentRef,classList:classes(),offsetWidth:1,label:'',children:[],setAttribute(name,value){if(name==='aria-label')this.label=value;},replaceChildren(...children){this.children=children;}};
 const image={src:'assets/icons/loading-icon.png'};
 const root={hidden:true,classList:classes(),querySelector(selector){return selector==='.boot-loading-copy'?copy:image;}};
 documentRef.getElementById=id=>id==='boot-loading'?root:null;
 return {documentRef,body,root,copy,image};
}

test('loading copy is split into the same smooth per-letter wave vocabulary as BUSTED',()=>{
 assert.ok(LOADING_MESSAGES.includes('Getting chips ready…'));
 assert.ok(LOADING_MESSAGES.includes('Cleaning the hat…'));
 assert.ok(LOADING_MESSAGES.includes('Polishing claws…'));
 assert.deepEqual(loadingLetters('A B'),[{character:'A',index:0},{character:' ',index:1},{character:'B',index:2}]);
 const {copy}=loadingDocument();renderLoadingMessage(copy,'Tiny paws');
 assert.equal(copy.label,'Tiny paws');assert.equal(copy.children.length,9);
 assert.equal(copy.children[4].className,'boot-loading-space');assert.equal(copy.children[8].style['--letter-index'],8);
});

test('loading overlay waits for readiness, rotates copy, then cleans up',async()=>{
 assert.equal(LOADING_EXIT_MS,1050,'exit fade has time to read as a soft transition');
 const fixture=loadingDocument();let rotate,resolveReady,cleared=false;
 const globalRef={__18BRO_UI_IMAGES__:{'loading-icon':'data:image/png;base64,exact'},setInterval(fn){rotate=fn;return 7;},clearInterval(id){cleared=id===7;},setTimeout(fn){fn();}};
 const screen=createLoadingScreen({documentRef:fixture.documentRef,globalRef,minimumVisibleMs:0,now:()=>100});
 assert.equal(fixture.root.hidden,false);assert.equal(fixture.body.classList.contains('boot-loading-active'),true);assert.equal(fixture.image.src,'data:image/png;base64,exact');
 rotate();assert.equal(fixture.copy.label,'Cleaning the hat…');
 const readiness=new Promise(resolve=>{resolveReady=resolve;});const finished=screen.finish(readiness);
 await Promise.resolve();assert.equal(fixture.root.hidden,false);
 resolveReady();await finished;
 assert.equal(cleared,true);assert.equal(fixture.root.hidden,true);assert.equal(fixture.body.classList.contains('boot-loading-active'),false);
});

test('loading screen is embedded and tied to textures, models, and a rendered frame',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
 const exporter=fs.readFileSync(new URL('../scripts/export-game.mjs',import.meta.url),'utf8');
 assert.match(html,/id="boot-loading"[^>]+role="status"[^>]+aria-live="polite"/);
 assert.match(html,/class="boot-loading-icon" src="assets\/icons\/loading-icon[.]png"/);
 assert.match(css,/[.]boot-loading-icon\{[^}]*border-radius:25%[^}]*clip-path:inset\(0 round 25%\)/);
 assert.match(css,/[.]boot-loading-copy\{[^}]*color:#3fa764[^}]*-webkit-text-stroke:1[.]5px #fff/);
 assert.match(css,/@keyframes boot-loading-letter-wave/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(app,/Promise[.]all\(\[scene[.]assetsReady,activeModelsReady\]\)[.]then\(\(\)=>new Promise\(resolve=>requestAnimationFrame\(resolve\)\)\)/);
 assert.match(app,/__18BRO_BOOT_FAILED__/);assert.match(exporter,/'loading-screen[.]mjs'/);
});
