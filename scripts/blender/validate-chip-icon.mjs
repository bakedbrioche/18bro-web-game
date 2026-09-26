import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('art/ui/chip-icon.manifest.json',root),'utf8'));
const png=await readFile(new URL(manifest.output,root));
assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG signature');
assert.equal(png.readUInt32BE(16),manifest.width);
assert.equal(png.readUInt32BE(20),manifest.height);
assert.equal(png[25],6,'RGBA color type');
assert.equal(png.length,manifest.bytes);
assert.equal(createHash('sha256').update(png).digest('hex'),manifest.sha256);
assert.ok(png.length>10000,'rendered subject is non-empty');
console.log(JSON.stringify({file:manifest.output,bytes:png.length,sha256:manifest.sha256}));
