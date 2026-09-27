import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('art/ui/chip-icon.manifest.json',root),'utf8'));
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
function pngInfo(buffer){
 assert.ok(buffer.subarray(0,8).equals(signature),'PNG signature');
 assert.equal(buffer.subarray(12,16).toString('ascii'),'IHDR');
 const chunks=[];let offset=8;
 while(offset+12<=buffer.length){
  const length=buffer.readUInt32BE(offset),type=buffer.subarray(offset+4,offset+8).toString('ascii'),dataOffset=offset+8;
  assert.ok(dataOffset+length+4<=buffer.length,`truncated PNG chunk ${type}`);
  chunks.push({type,length,dataOffset});offset=dataOffset+length+4;
  if(type==='IEND')break;
 }
 return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20),colorType:buffer[25],chunks};
}
const still=await readFile(new URL(manifest.output,root)),stillInfo=pngInfo(still);
assert.equal(stillInfo.width,manifest.width);assert.equal(stillInfo.height,manifest.height);
assert.equal(stillInfo.colorType,6,'static render uses RGBA');
assert.equal(still.length,manifest.bytes);assert.equal(digest(still),manifest.sha256);
assert.ok(still.length>10000,'rendered static subject is non-empty');

assert.equal(manifest.animation.format,'APNG');
const animated=await readFile(new URL(manifest.animation.output,root)),animatedInfo=pngInfo(animated);
assert.equal(animatedInfo.width,manifest.animation.width);assert.equal(animatedInfo.height,manifest.animation.height);
assert.equal(animatedInfo.colorType,6,'turntable uses RGBA');
assert.equal(animated.length,manifest.animation.bytes);assert.equal(digest(animated),manifest.animation.sha256);
const animationControl=animatedInfo.chunks.find(chunk=>chunk.type==='acTL');
assert.ok(animationControl,'turntable contains APNG animation control');
assert.equal(animated.readUInt32BE(animationControl.dataOffset),manifest.animation.frames);
assert.equal(animated.readUInt32BE(animationControl.dataOffset+4),manifest.animation.loops);
assert.equal(animatedInfo.chunks.filter(chunk=>chunk.type==='fcTL').length,manifest.animation.frames);
assert.ok(animatedInfo.chunks.some(chunk=>chunk.type==='fdAT'),'turntable contains animated frame data');
assert.equal(manifest.animation.fps,60);assert.equal(manifest.animation.frames,60);assert.ok(animated.length>still.length,'turntable contains multiple rendered frames');
console.log(JSON.stringify({
 static:{file:manifest.output,bytes:still.length,sha256:manifest.sha256},
 animation:{file:manifest.animation.output,bytes:animated.length,sha256:manifest.animation.sha256,frames:manifest.animation.frames,fps:manifest.animation.fps},
}));
