import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {FURS,HATS,normalizeCustom,equipCustom} from '../dist/customization.mjs';
import {RunnerGame,THEMES,INTRO_DURATION} from '../dist/core.mjs';
import {DEFAULT_MODEL_SET,normalizeModelSet} from '../dist/model-config.mjs';
import {DEFAULT_PICTURE_MODE,DEFAULT_FONT_STYLE,normalizePictureMode,normalizeFontStyle} from '../dist/presentation-config.mjs';

// Exercise the real app handlers and simulation without needing a GPU or audio
// device. Browser checks separately cover layout and native button activation.
function app(initialSave,{modelHook=true}={}){
 const elements=new Map(),listeners={},saved=new Map();let game,scene;
 if(initialSave!==undefined)saved.set('18bro.save.v1',JSON.stringify(initialSave));
 const classes=()=>{const values=new Set();return {add:(...names)=>names.forEach(name=>values.add(name)),remove:(...names)=>names.forEach(name=>values.delete(name)),contains:name=>values.has(name),toggle(name,force){const active=force===undefined?!values.has(name):!!force;if(active)values.add(name);else values.delete(name);return active;}}};
 const document={activeElement:null,body:{classList:classes(),dataset:{}},hidden:false,
  getElementById:id=>elements.get(id),querySelectorAll:()=>[],
  addEventListener(){},createElement:tag=>element(tag)};
 function element(tag,id=''){
  const attributes=new Map(),children=[];
  const node={id,tagName:tag.toUpperCase(),hidden:false,disabled:false,inert:false,open:false,parentNode:null,children,
   textContent:'',classList:classes(),style:{},dataset:{},clientWidth:640,clientHeight:600,srcWrites:0,
   set innerHTML(html){registerElements(html);},
   addEventListener(){},setAttribute(name,value){attributes.set(name,String(value));},getAttribute(name){return attributes.get(name);},
   append(...nodes){for(const child of nodes){child.parentNode=this;children.push(child);}},
   remove(){if(!this.parentNode)return;const index=this.parentNode.children.indexOf(this);if(index>=0)this.parentNode.children.splice(index,1);this.parentNode=null;},
   querySelectorAll:()=>[],
   focus(){document.activeElement=this;},close(){this.open=false;},showModal(){this.open=true;},
   click(){if(!this.disabled)this.onclick?.();}};
  let source='';Object.defineProperty(node,'src',{get:()=>source,set:value=>{source=value;node.srcWrites++;}});
  return node;
 } function registerElements(html){
  for(const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){
   const node=element(match[1],match[2]);node.hidden=/\bhidden\b/.test(match[0]);elements.set(node.id,node);
  }
 }
 registerElements(fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'));
 const window={addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)};
 class Game extends RunnerGame{constructor(options){super(options);game=this;}}
 class Scene{
  constructor(){scene=this;this.modelRequests=[];if(modelHook)this.setModelSetPreference=value=>this.modelRequests.push({value,state:game.state});}
  resize(){} handleEvent(){} render(){}
 }
 class Audio{unlock(){} play(){} setEnabled(){} setMode(){} setEnvironment(){} update(){}}
 const source=fs.readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'');
 const context=vm.createContext({document,window,RunnerGame:Game,GameScene:Scene,ArcadeAudio:Audio,
  FURS,HATS,normalizeCustom,equipCustom,DEFAULT_MODEL_SET,normalizeModelSet,DEFAULT_PICTURE_MODE,DEFAULT_FONT_STYLE,normalizePictureMode,normalizeFontStyle,THEMES,INTRO_DURATION,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},
  performance:{now:()=>0},requestAnimationFrame(){},console});
 vm.runInContext(source,context);
 function key(code,{repeat=false}={}){
  let prevented=false;const target=document.activeElement;
  for(const fn of listeners.keydown||[])fn({code,repeat,preventDefault(){prevented=true;}});
  if(!prevented&&['Enter','Space'].includes(code)&&target?.tagName==='BUTTON')target.click();
 }
 return {game,scene,get:id=>elements.get(id),key,document,
  openPanel:name=>vm.runInContext(`openPanel(${JSON.stringify(name)})`,context),
  updateHUD:()=>vm.runInContext('updateHUD()',context),
  showPickup:type=>vm.runInContext(`showPowerPickup(${JSON.stringify(type)})`,context),
   showReward:(bonus,tag=0)=>vm.runInContext(`showPursuitReward(${Number(bonus)},${Number(tag)})`,context),
   step:now=>vm.runInContext(`loop(${Number(now)})`,context),
  powerPill:type=>vm.runInContext(`powerPills.get(${JSON.stringify(type)})`,context),
  powerIconPreloads:()=>vm.runInContext('powerIconPreloads',context),
  finishResults:()=>vm.runInContext('updateResultSequence(999999)',context),
  saved:()=>JSON.parse(saved.get('18bro.save.v1'))};
}
function caught(a){
 a.get('start-run').click();a.game.start({skipIntro:true});
 a.game.time=5;a.game.score=120;a.game.coins=3;
 a.game._capture(a.game.spawnEntity('traffic',1,-.1));
}

test('visible arrest buttons respond immediately and a retry resets the run',()=>{
 const a=app();caught(a);
 assert.equal(a.game.state,'CAUGHT');assert.equal(a.get('gameover-panel').hidden,false);
 assert.equal(a.get('retry-run').disabled,false);assert.equal(a.get('over-menu').disabled,false);
 assert.equal(a.get('result-score').textContent,'0');assert.equal(a.document.activeElement,a.get('gameover-card'));a.finishResults();
 assert.equal(a.get('result-score').textContent,'120');assert.equal(a.saved().runs,1);
 a.get('retry-run').click();
 assert.equal(a.game.state,'STARTING');assert.equal(a.game.captureRemaining,0);
 assert.equal(a.get('gameover-panel').hidden,true);assert.equal(a.game.distance,0);
});

test('arrest menu remains usable after pausing and banks a result only once',()=>{
 const a=app();caught(a);a.key('Escape');
 assert.equal(a.get('pause-panel').hidden,false);assert.equal(a.get('gameover-panel').hidden,true);
 a.get('resume-run').click();assert.equal(a.game.state,'CAUGHT');
 for(let n=0;n<20;n++)a.game.update(1);
 assert.equal(a.game.state,'GAME_OVER');assert.equal(a.saved().runs,1);
 a.finishResults();assert.equal(a.get('result-score').textContent,'120');
 a.get('over-menu').click();assert.equal(a.game.state,'MAIN_MENU');
 assert.equal(a.get('main-menu').hidden,false);assert.equal(a.get('gameover-panel').hidden,true);
 assert.equal(a.saved().runs,1);
});

test('pause resume and main-menu controls work during the opening, chase and arrest',()=>{
 for(const state of ['STARTING','RUNNING','CAUGHT']){
  const a=app();a.get('start-run').click();
  if(state==='RUNNING')a.game.start({skipIntro:true});
  if(state==='CAUGHT')caught(a);
  a.game.pause();assert.equal(a.get('pause-panel').hidden,false);
  a.get('resume-run').click();assert.equal(a.game.state,state);assert.equal(a.get('pause-panel').hidden,true);
  a.game.pause();a.get('pause-menu').click();
  assert.equal(a.game.state,'MAIN_MENU');assert.equal(a.get('pause-panel').hidden,true);
  a.get('start-run').click();assert.equal(a.game.state,'STARTING');
 }
});

test('Enter skips only the first 1.5 seconds of the opening',()=>{
 const early=app();early.get('start-run').click();early.key('Enter');assert.equal(early.game.state,'RUNNING');
 const locked=app();locked.get('start-run').click();locked.game.update(1);locked.game.update(.51);assert.equal(locked.game.state,'STARTING');
 locked.key('Enter');assert.equal(locked.game.state,'STARTING');for(let time=0;time<INTRO_DURATION&&locked.game.state==='STARTING';time+=.1)locked.game.update(.1);assert.equal(locked.game.state,'RUNNING');
});

test('held pause keys do not toggle repeatedly and Enter resumes from canvas focus',()=>{
 const a=app();a.get('start-run').click();a.game.start({skipIntro:true});
 a.key('KeyP');assert.equal(a.game.state,'PAUSED');assert.equal(a.get('hud').inert,true);
 a.key('KeyP',{repeat:true});assert.equal(a.game.state,'PAUSED');
 a.get('game-canvas').focus();a.key('Enter');assert.equal(a.game.state,'RUNNING');
 assert.equal(a.get('hud').inert,false);
});

test('missing or invalid model preferences normalize to Original without losing save progress',()=>{
 for(const modelSet of [undefined,null,'unknown',{},'original','refreshed']){
  const record={score:432,distance:123,coins:5};
  const a=app({psxRouteRevision:1,highScore:432,totalCoins:700,runs:7,records:[record],
   ownedFurs:['black','gold'],ownedHats:['none','cap','crown'],fur:'gold',hat:'crown',
   settings:{quality:'low',modelSet}});
  a.get('start-run').click();
  const save=a.saved();
  assert.equal(save.settings.modelSet,modelSet==='refreshed'?'refreshed':'original');
  assert.equal(save.settings.quality,'low');assert.equal(save.highScore,432);
  assert.equal(save.totalCoins,700);assert.equal(save.runs,7);assert.deepEqual(save.records,[record]);
  assert.equal(save.fur,'gold');assert.equal(save.hat,'crown');
  assert.deepEqual(save.ownedFurs,['black','gold']);assert.deepEqual(save.ownedHats,['cap','none','crown']);
 }
});

test('model preference persists independently of clear picture quality',()=>{
 const a=app(undefined,{modelHook:false});a.openPanel('settings');
 assert.equal(a.get('setting-models').value,'original');
 a.get('setting-models').onchange({target:{value:'refreshed'}});
 assert.equal(a.saved().settings.modelSet,'refreshed');assert.equal(a.saved().settings.quality,'clear');
 assert.equal(a.scene.modelPreference,'refreshed');
 assert.match(a.get('model-preference-note').textContent,/complete run and cast/);
 a.get('setting-quality').onchange({target:{value:'low'}});
 assert.equal(a.saved().settings.modelSet,'refreshed');assert.equal(a.saved().settings.quality,'low');
 a.get('start-run').click();
 const reloaded=app(a.saved(),{modelHook:false});reloaded.openPanel('settings');
 assert.equal(reloaded.get('setting-models').value,'refreshed');
 assert.equal(reloaded.get('setting-quality').value,'low');
});

test('clear picture and 18Bro sticker font are saved and applied globally',()=>{
 const a=app();a.openPanel('settings');
 assert.equal(a.get('setting-quality').value,'clear');assert.equal(a.get('setting-font').value,'arcade');
 a.get('setting-quality').onchange({target:{value:'retro'}});a.get('setting-font').onchange({target:{value:'sticker'}});
 assert.equal(a.saved().settings.quality,'retro');assert.equal(a.saved().settings.fontStyle,'sticker');
 assert.equal(a.document.body.dataset.picture,'retro');assert.equal(a.document.body.classList.contains('font-sticker'),true);
 const reloaded=app(a.saved());reloaded.openPanel('settings');
 assert.equal(reloaded.get('setting-font').value,'sticker');assert.equal(reloaded.document.body.classList.contains('font-sticker'),true);
});

test('model requests wait for the main menu without altering a paused run',()=>{
 const a=app();a.get('start-run').click();a.game.start({skipIntro:true});
 a.game.distance=321;a.game.score=432;a.game.coins=6;a.game.pause();a.openPanel('settings');
 a.get('setting-models').onchange({target:{value:'refreshed'}});
 assert.equal(a.saved().settings.modelSet,'refreshed');assert.equal(a.game.state,'PAUSED');
 assert.equal(a.game.distance,321);assert.equal(a.game.score,432);assert.equal(a.game.coins,6);
 assert.deepEqual(a.scene.modelRequests,[{value:'original',state:'MAIN_MENU'}]);
 a.get('resume-run').click();assert.equal(a.game.state,'RUNNING');
 assert.equal(a.scene.modelRequests.length,1);
 a.game.pause();a.get('pause-menu').click();
 assert.deepEqual(a.scene.modelRequests,[{value:'original',state:'MAIN_MENU'},{value:'refreshed',state:'MAIN_MENU'}]);
});

test('Speed Burst uses a motion-aware screen-edge surge instead of a cat particle trail',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const appSource=fs.readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
 const sceneSource=fs.readFileSync(new URL('../dist/scene.mjs',import.meta.url),'utf8');
 assert.match(html,/class="speed-surge"/);
 assert.match(appSource,/classList\.toggle\('speedburst',game\.state==='RUNNING'&&game\.powers\.has\('speedburst'\)\)/);
 assert.match(css,/\.game-shell\.speedburst \.speed-surge/);
 assert.match(css,/body\.reduced-motion \.game-shell\.speedburst \.speed-surge::before/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(sceneSource,/\(moon\|\|riding\|\|speedburst\).*this\.burst/);
});
test('power art keeps the same decoded image nodes through pause and resume',()=>{
 const a=app();a.get('start-run').click();a.game.start({skipIntro:true});a.game.activatePower('magnet');a.updateHUD();
 const preloads=a.powerIconPreloads();assert.equal(preloads.length,7);assert.deepEqual(Array.from(preloads,icon=>icon.src).sort(),['doublechips','jetpack','magnet','moon','moped','shield','speedburst'].map(type=>'assets/icons/powerup-'+type+'.png?v=6').sort());
 const first=a.powerPill('magnet');assert.ok(first);first.icon.onload?.();assert.equal(first.icon.src,'assets/icons/powerup-magnet.png?v=6');assert.equal(first.icon.srcWrites,1);
 a.game.pause();a.updateHUD();a.game.resume();a.updateHUD();
 const resumed=a.powerPill('magnet');assert.equal(resumed.card,first.card);assert.equal(resumed.icon,first.icon);assert.equal(resumed.icon.srcWrites,1);
 a.showPickup('magnet');const pickup=a.get('power-pickup-icon');pickup.onload?.();const writes=pickup.srcWrites;
 a.game.pause();a.showPickup('magnet');assert.equal(a.get('power-pickup-icon'),pickup);assert.equal(pickup.srcWrites,writes);
 a.game.resume();a.game.activatePower('shield');a.updateHUD();const shield=a.powerPill('shield');assert.equal(shield.time.textContent,'15s · ×3');assert.match(shield.card.getAttribute('aria-label'),/3 shields remaining/);
 const css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');assert.match(css,/[.]power-pill[.]icon-loading [.]power-icon-fallback\{opacity:0\}/);assert.match(css,/[.]power-pickup:not\([.]icon-missing\)>[.]power-icon-fallback\{display:none\}/);
});


test('pause freezes popup lifetimes and CSS animations until play resumes',()=>{
 const a=app();a.get('start-run').click();a.game.start({skipIntro:true});a.showPickup('magnet');a.showReward(12500,1);
 a.game.pause();assert.equal(a.get('game-shell').classList.contains('paused'),true);
 for(let frame=1;frame<=80;frame++)a.step(frame*50);
 assert.equal(a.get('power-pickup').hidden,false);assert.equal(a.get('power-pickup').classList.contains('show'),true);
 assert.equal(a.get('pursuit-reward').hidden,false);assert.equal(a.get('pursuit-reward').classList.contains('show'),true);
 assert.equal(a.get('hud-score-bonus').classList.contains('show'),true);
 a.game.resume();assert.equal(a.get('game-shell').classList.contains('paused'),false);
 for(let frame=81;frame<=145;frame++)a.step(frame*50);
 assert.equal(a.get('power-pickup').hidden,true);assert.equal(a.get('pursuit-reward').hidden,true);
 const css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
 assert.match(css,/[.]game-shell[.]paused [.]power-pickup[\s\S]*animation-play-state:paused!important/);
  const pauseLayer=Number(css.match(/#pause-panel\{z-index:(\d+)\}/)?.[1]);
  assert.ok(pauseLayer>25,'pause panel must cover transient run feedback');
  assert.ok(pauseLayer>35,'pause panel must cover developer and gameplay overlays');
});

test('net capture remains visible before the Busted results sequence',()=>{
 const a=app();a.get('start-run').click();a.game.start({skipIntro:true});a.game.entities.forEach(entity=>entity.active=false);a.game._spawnCursor=Infinity;a.game._coinSectionCursor=Infinity;a.game._nextNetPursuitDistance=Infinity;a.game.debug.speedOverride=10;a.game._startNetPursuit();
 for(let elapsed=0;elapsed<8&&a.game.state==='RUNNING';elapsed+=1/120)a.game.update(1/120);
 assert.equal(a.game.state,'CAUGHT');assert.equal(a.game.crash.kind,'net');assert.equal(a.get('gameover-panel').hidden,true);assert.equal(a.get('hud').hidden,true);
 for(let elapsed=0;elapsed<5&&a.game.state!=='GAME_OVER';elapsed+=1/120)a.game.update(1/120);
 assert.equal(a.game.state,'GAME_OVER');assert.equal(a.get('gameover-panel').hidden,false);assert.equal(a.document.activeElement,a.get('gameover-card'));
});
test('net-pursuit reward rotates themed copy and uses an accessible chase card with a bouncy score addition',()=>{
 const a=app();a.get('start-run').click();a.game.start({skipIntro:true});a.game.emit('netpursuitsuccess',{bonus:14250,tagIndex:2});
 const reward=a.get('pursuit-reward');
 assert.equal(reward.hidden,false);assert.equal(reward.classList.contains('show'),true);
 assert.equal(reward.dataset.message,'NET DODGED! SNACKS SECURED!');
 assert.match(reward.getAttribute('aria-label'),/NET DODGED! SNACKS SECURED! Plus 14,250 score/);
 assert.equal(a.get('pursuit-reward-score').textContent,'+14,250 SCORE');assert.equal(a.get('hud-score-bonus').textContent,'+14,250');
 assert.equal(a.get('hud-score-bonus').classList.contains('show'),true);
 a.game.emit('netpursuitsuccess',{bonus:16000,tagIndex:2});
 assert.equal(reward.dataset.message,'TOO SLOW! 18BRO GOES!','repeated event tag advances to fresh copy');
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const source=fs.readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
 assert.match(html,/id="pursuit-reward"[^>]+role="status"/);
 for(const tag of ['NET MISS! BRO LIVES!','COPS WHIFF! CHIPS SAFE!','NET DODGED! SNACKS SECURED!','TOO SLOW! 18BRO GOES!'])assert.match(source,new RegExp(tag.replace(/[!?]/g,'\\$&')));
 assert.equal(a.get('pursuit-reward-message').textContent,'TOO SLOW! 18BRO GOES!');
 assert.match(a.get('pursuit-reward-guard').src,/pursuit-guard[.]png/);assert.match(a.get('pursuit-reward-cat').src,/pursuit-cat[.]png/);
 assert.match(html,/pursuit-panel-guard[\s\S]*pursuit-panel-cat/);
 assert.match(css,/[.]pursuit-reward[.]show [.]pursuit-panel-guard\{animation:pursuit-panel-left/);
 assert.match(css,/[.]pursuit-reward[.]show::before\{animation:pursuit-reward-aura/);
 assert.match(css,/[.]pursuit-reward[.]show\{animation:pursuit-reward-card/);
 assert.match(css,/[.]score-bonus[.]show\{animation:score-bonus-pop/);
 assert.match(css,/@keyframes score-bonus-pop\{[^}]*scale\([.]18\)[\s\S]*scale\(1[.]22\)[\s\S]*scale\([.]91\)[\s\S]*scale\(1[.]07\)/);
 assert.match(css,/body[.]reduced-motion [.]score-bonus[.]show\{animation:none/);
});
test('Busted results count up in stages and reduced motion resolves immediately',()=>{
 const animated=app();caught(animated);
 assert.equal(animated.get('result-score').textContent,'0');assert.equal(animated.document.activeElement,animated.get('gameover-card'));
 animated.key('Enter');assert.equal(animated.game.state,'CAUGHT');assert.equal(animated.get('result-score').textContent,'120');assert.equal(animated.document.activeElement,animated.get('retry-run'));
 animated.finishResults();assert.equal(animated.get('result-score').textContent,'120');assert.equal(animated.get('result-distance').textContent,'0 m');assert.equal(animated.document.activeElement,animated.get('retry-run'));
 const reduced=app({settings:{reducedMotion:true}});caught(reduced);
 assert.equal(reduced.get('result-score').textContent,'120');assert.equal(reduced.document.activeElement,reduced.get('retry-run'));
});

test('Busted markup and styles keep the centered staged sequence configurable',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const appSource=fs.readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
 assert.match(html,/id="gameover-card"[^>]+aria-labelledby="result-title"/);
 assert.match(html,/id="result-chip-icon"[^>]+assets\/icons\/chip[.]png/);
 assert.match(appSource,/globalThis[.]__18BRO_UI_IMAGES__[|][|]\{[^}]*'pursuit-guard':'assets\/icons\/pursuit-guard[.]png'[^}]*'pursuit-cat':'assets\/icons\/pursuit-cat[.]png'/);
 assert.match(appSource,/const RESULT_WAVE_ENABLED=true/);
 assert.match(appSource,/const RESULT_COUNT_MS=3000/);assert.match(appSource,/THREE-PAW GUARD/);assert.match(appSource,/three hits for 15 seconds/);
 assert.match(css,/[.]gameover\{justify-content:center/);
 assert.match(css,/@keyframes result-stamp/);assert.match(css,/@keyframes busted-letter-wave/);
 const wave=css.match(/[.]result-wave-enabled [.]result-title>span\{animation:busted-letter-wave ([0-9.]+)s linear calc\([.]6s \+ var\(--letter-index\)\*([0-9.]+)s\) infinite/);
 assert.ok(wave,'result wave timing is explicit');const sweep=Number(wave[1])*.48+Number(wave[2])*6;assert.ok(sweep>=.8&&sweep<=.9,'BUSTED sweep is '+sweep+'s');
 assert.match(html,/style="--letter-index:6">!<\/span>/);assert.match(css,/@keyframes busted-letter-wave\{0%,48%,100%\{transform:translate3d\(0,0,0\) scale\(1\)\}/);assert.match(css,/26%\{transform:translate3d\(0,-[.]17em,0\) scale\(1[.]18,[.]92\)\}32%/);
 assert.match(appSource,/const animatedChip=uiImages\['chip-turntable'\]\|\|uiImages[.]chip/);assert.match(appSource,/chipIcon[.]src=reduced\?uiImages[.]chip:animatedChip/);
 assert.doesNotMatch(css,/@keyframes result-chip-spin/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(appSource,/[$]\('active-powers'\)[.]innerHTML/);
});
