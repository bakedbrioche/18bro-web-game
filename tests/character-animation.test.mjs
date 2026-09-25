import test from 'node:test';
import assert from 'node:assert/strict';
import {HERO_CLIPS,selectHeroAnimation} from '../dist/character-animation.mjs';

const game=(state='RUNNING',player={anim:'run'})=>({state,player,powers:new Set(),speed:10.4});

test('authored hero contract covers every gameplay pose',()=>{
 assert.deepEqual(HERO_CLIPS,[
  'idle','run','jump','slide','roll','ride','moped_mount','moped_jump','moped_slide_L','moped_slide_R','stumble','caught','carry','fall','celebrate','snack','jetpack'
 ]);
 const cases=[
  [game('MAIN_MENU'),'idle'],
  [{...game('STARTING'),introProgress:.1},'snack'],
  [{...game('STARTING'),introProgress:.35},'celebrate'],
  [{...game('STARTING'),introProgress:.8},'run'],
  [game('RUNNING',{anim:'jump',y:1,vy:2}),'jump'],
  [game('RUNNING',{anim:'fall',y:1,vy:-2}),'fall'],
  [game('RUNNING',{anim:'roll',slide:.4}),'roll'],
  [game('RUNNING',{anim:'hit',hit:.8}),'stumble'],
  [{...game('CAUGHT'),captureProgress:.4},'caught'],
  [{...game('CAUGHT'),captureProgress:.8},'carry'],
  [game('GAME_OVER'),'carry']
 ];
 for(const [input,expected] of cases)assert.equal(selectHeroAnimation(input).clip,expected);
});

test('vehicles have priority over locomotion and pause freezes the current family',()=>{
 const moped=game();moped.powers.add('moped');assert.equal(selectHeroAnimation(moped).clip,'ride');
 const mount=game('RUNNING',{anim:'run',mopedMount:.4});mount.powers.add('moped');assert.equal(selectHeroAnimation(mount).clip,'moped_mount');
 const jump=game('RUNNING',{anim:'jump',y:1.2,vy:2,mopedMount:0});jump.powers.add('moped');assert.equal(selectHeroAnimation(jump).clip,'moped_jump');
 const left=game('RUNNING',{anim:'roll',slide:.4,mopedSlideSide:-1,mopedMount:0});left.powers.add('moped');assert.equal(selectHeroAnimation(left).clip,'moped_slide_L');
 const right=game('RUNNING',{anim:'roll',slide:.4,mopedSlideSide:1,mopedMount:0});right.powers.add('moped');assert.equal(selectHeroAnimation(right).clip,'moped_slide_R');
 const jetpack=game();jetpack.powers.add('jetpack');assert.equal(selectHeroAnimation(jetpack).clip,'jetpack');
 const paused={...game('PAUSED'),_beforePause:'RUNNING'};
 const pose=selectHeroAnimation(paused,{previousState:'RUNNING'});
 assert.equal(pose.clip,'run');assert.equal(pose.frozen,true);
});

test('timeline samples are bounded under stale or extreme simulation values',()=>{
 for(const input of [
  {...game('STARTING'),introProgress:-10},
  {...game('STARTING'),introProgress:10},
  {...game('CAUGHT'),captureProgress:-2},
  game('RUNNING',{anim:'roll',slide:99}),
  game('RUNNING',{anim:'hit',hit:-5})
 ]){
  const pose=selectHeroAnimation(input);
  if(pose.sample!==null)assert.ok(pose.sample>=0&&pose.sample<=1,`${pose.clip}: ${pose.sample}`);
 }
});
