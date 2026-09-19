import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {RunnerGame,THEMES,INTRO_DURATION} from '../dist/core.mjs';

// Exercise the real app handlers and simulation without needing a GPU or audio
// device. Browser checks separately cover layout and native button activation.
function app(){
 const elements=new Map(),listeners={},saved=new Map();let game;
 const classes=()=>({add(){},remove(){},toggle(){}});
 const document={activeElement:null,body:{classList:classes()},hidden:false,
  getElementById:id=>elements.get(id),querySelectorAll:()=>[],
  addEventListener(){},createElement:()=>element('div')};
 function element(tag,id=''){
  return {id,tagName:tag.toUpperCase(),hidden:false,disabled:false,inert:false,open:false,
   textContent:'',classList:classes(),style:{},dataset:{},clientWidth:640,clientHeight:600,
   addEventListener(){},setAttribute(){},append(){},querySelectorAll:()=>[],
   focus(){document.activeElement=this;},close(){this.open=false;},showModal(){this.open=true;},
   click(){if(!this.disabled)this.onclick?.();}};
 }
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 for(const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){
  const node=element(match[1],match[2]);node.hidden=/\bhidden\b/.test(match[0]);elements.set(node.id,node);
 }
 const window={addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)};
 class Game extends RunnerGame{constructor(options){super(options);game=this;}}
 class Scene{resize(){} handleEvent(){} render(){}}
 class Audio{unlock(){} play(){} setEnabled(){} setMode(){} setEnvironment(){} update(){}}
 const source=fs.readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'');
 vm.runInNewContext(source,{document,window,RunnerGame:Game,GameScene:Scene,ArcadeAudio:Audio,
  THEMES,INTRO_DURATION,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},
  performance:{now:()=>0},requestAnimationFrame(){},console});
 function key(code,{repeat=false}={}){
  let prevented=false;const target=document.activeElement;
  for(const fn of listeners.keydown||[])fn({code,repeat,preventDefault(){prevented=true;}});
  if(!prevented&&['Enter','Space'].includes(code)&&target?.tagName==='BUTTON')target.click();
 }
 return {game,get:id=>elements.get(id),key,document,saved:()=>JSON.parse(saved.get('18bro.save.v1'))};
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
