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
  addEventListener(){},createElement:()=>element('div')};
 function element(tag,id=''){
  return {id,tagName:tag.toUpperCase(),hidden:false,disabled:false,inert:false,open:false,
   textContent:'',classList:classes(),style:{},dataset:{},clientWidth:640,clientHeight:600,
   set innerHTML(html){registerElements(html);},
   addEventListener(){},setAttribute(){},append(){},querySelectorAll:()=>[],
   focus(){document.activeElement=this;},close(){this.open=false;},showModal(){this.open=true;},
   click(){if(!this.disabled)this.onclick?.();}};
 }
 function registerElements(html){
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
 return {game,scene,get:id=>elements.get(id),key,document,openPanel:name=>vm.runInContext(`openPanel(${JSON.stringify(name)})`,context),saved:()=>JSON.parse(saved.get('18bro.save.v1'))};
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
 assert.equal(a.get('result-score').textContent,'120');
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
