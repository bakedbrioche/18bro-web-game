export const HERO_CLIPS=Object.freeze([
 'idle','run','jump','slide','roll','ride','moped_mount','moped_jump','moped_slide_L','moped_slide_R','stumble','caught','carry','fall','celebrate','snack','jetpack'
]);

const clamp01=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const hasPower=(powers,name)=>!!powers?.has?.(name);

function sampled(clip,progress,blend=.08){
 return Object.freeze({clip,loop:false,sample:clamp01(progress),rate:1,blend,frozen:false});
}
function looping(clip,rate=1,blend=.12){
 return Object.freeze({clip,loop:true,sample:null,rate,blend,frozen:false});
}

// This selector is deliberately DOM- and Three-free. Gameplay owns the hero's
// world transform; the selected authored clip exclusively owns every rig bone.
export function selectHeroAnimation(game={},options={}){
 const rawState=game.state||'MAIN_MENU';
 const paused=rawState==='PAUSED';
 const state=options.menu?'MAIN_MENU':paused?(game._beforePause||options.previousState||'RUNNING'):rawState;
 const p=game.player||{};
 let selection;

 if(state==='CAUGHT'||state==='GAME_OVER'){
  const capture=state==='GAME_OVER'?1:clamp01(game.captureProgress);
  selection=capture>=.67?looping('carry',1,.1):sampled('caught',capture/.67,.06);
 }else if(state==='STARTING'){
  const seconds=clamp01(game.introProgress)*5.1;
  if(seconds<1.45)selection=sampled('snack',seconds/1.45,.08);
  else if(seconds<2.15)selection=sampled('celebrate',(seconds-1.45)/.7,.08);
  else selection=looping('run',1,.1);
 }else if((p.hit||0)>0){
  selection=sampled('stumble',(1.15-p.hit)/1.15,.05);
 }else if(hasPower(game.powers,'moped')){
  if((p.mopedMount||0)>0)selection=sampled('moped_mount',(0.625-p.mopedMount)/.625,.04);
  else if((p.slide||0)>0||p.anim==='roll')selection=sampled((p.mopedSlideSide||1)<0?'moped_slide_L':'moped_slide_R',(.72-(p.slide||0))/.72,.045);
  else if((p.y||0)>.01||p.anim==='jump'||p.anim==='fall'){
   const height=clamp01((p.y||0)/(p.jumpApex||2.65)),progress=(p.vy||0)>=0?height*.5:.5+(1-height)*.5;
   selection=sampled('moped_jump',progress,.055);
  }else selection=looping('ride',1,.1);
 }else if(hasPower(game.powers,'jetpack')){
  selection=looping('jetpack',1,.1);
 }else if((p.slide||0)>0||p.anim==='slide'||p.anim==='roll'){
  selection=sampled('roll',(.72-(p.slide||0))/.72,.04);
 }else if((p.y||0)>.01&&(p.anim==='jump'||p.anim==='fall')){
  // Play the authored jump as one full arc: anticipation/rise occupy the
  // first half and apex/descent/landing preparation occupy the second half.
  const height=clamp01((p.y||0)/(p.jumpApex||2.65)),progress=(p.vy||0)>=0?height*.5:.5+(1-height)*.5;
  selection=sampled('jump',progress,.06);
 }else if(p.anim==='jump'){
  selection=sampled('jump',0,.06);
 }else if(p.anim==='fall'){
  selection=looping('fall',1,.06);
 }else if(state==='MAIN_MENU'||state==='ARCADE'||p.anim==='idle'){
  selection=looping('idle',1,.15);
 }else{
  selection=looping('run',Math.max(.7,Math.min(1.7,(game.speed||10.4)/10.4)),.1);
 }

 return paused||options.reducedMotion&&selection.clip==='idle'
  ?Object.freeze({...selection,frozen:true})
  :selection;
}
