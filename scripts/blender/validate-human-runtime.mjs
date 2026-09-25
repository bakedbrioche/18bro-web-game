// Exercise the actual exported human skeleton with the vendored game loader.
// Image decoding is excluded from this CPU geometry check; Blender review
// renders and the chief's browser flow cover the embedded palette appearance.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import * as THREE from '../../dist/vendor/three.module.js';
import {GLTFLoader} from '../../dist/vendor/addons/loaders/GLTFLoader.js';
import {clone} from '../../dist/vendor/addons/utils/SkeletonUtils.js';
import {validateGlb} from '../validate-assets.mjs';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('art/characters/human/manifest-entry.json', root), 'utf8'));
const bytes = await readFile(new URL(manifest.output, root));
const structure = validateGlb(bytes, {manifest, maxTriangles: 2600, maxMaterials: 3, maxBones: 24});
const loader = new GLTFLoader();
loader.register(parser => {
  parser.loadTexture = async () => new THREE.Texture();
  return {name: 'human_cpu_pose_validation'};
});
const asset = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const scene = asset.scene;
const mixer = new THREE.AnimationMixer(scene);
const actions = new Map(asset.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
const meshes = [], bones = [];
scene.traverse(object => {
  if (object.isSkinnedMesh) meshes.push(object);
  if (object.isBone) bones.push(object);
});
assert.equal(meshes.length, 8);
assert.equal(bones.length, manifest.bones);

function sample(name, fraction) {
  mixer.stopAllAction();
  const action = actions.get(name);
  action.reset().setLoop(THREE.LoopOnce, 1).play();
  action.clampWhenFinished = true;
  action.time = action.getClip().duration * fraction;
  mixer.update(0);
  scene.updateMatrixWorld(true);
  for (const mesh of meshes) mesh.skeleton.update();
  for (const bone of bones) assert.ok(bone.matrixWorld.elements.every(Number.isFinite), `${name}: finite ${bone.name}`);
  return bones.flatMap(bone => bone.matrixWorld.elements);
}

const point = new THREE.Vector3();
const report = {};
for (const clip of asset.animations) {
  const first = sample(clip.name, 0);
  let minimumY = Infinity, maximumY = -Infinity, maximumRadius = 0;
  for (let step = 0; step <= 12; step++) {
    sample(clip.name, step / 12);
    for (const mesh of meshes) {
      for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
        mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
        assert.ok(point.toArray().every(Number.isFinite), `${clip.name}: finite deformed vertex`);
        minimumY = Math.min(minimumY, point.y);
        maximumY = Math.max(maximumY, point.y);
        maximumRadius = Math.max(maximumRadius, point.length());
      }
    }
  }
  const last = sample(clip.name, 1);
  const loopError = Math.max(...first.map((value, index) => Math.abs(value - last[index])));
  assert.ok(loopError < 1e-5, `${clip.name}: clean loop seam`);
  assert.ok(minimumY > -.02 && maximumY < 2.5 && maximumRadius < 3, `${clip.name}: safe deformed bounds`);
  report[clip.name] = {duration: clip.duration, minimumY, maximumY, maximumRadius, loopError};
}

// An arbitrary previous clip must not contaminate a subsequent full pose.
const reference = sample('idle', .37);
for (const name of actions.keys()) {
  sample(name, .68);
  const restored = sample('idle', .37);
  assert.ok(reference.every((value, index) => Math.abs(value - restored[index]) < 1e-7), `${name} -> idle restores pose`);
}
const independent = clone(scene);
const clonedArm = independent.getObjectByName('arm_L');
const originalArm = scene.getObjectByName('arm_L');
assert.notEqual(clonedArm, originalArm);
const originalRotation = originalArm.quaternion.toArray();
clonedArm.rotation.x += .8;
assert.deepEqual(originalArm.quaternion.toArray(), originalRotation);

const evidence = {sha256: structure.sha256, bytes: structure.bytes, clips: report,
  sampledPoses: asset.animations.length * 13, transitionsRestored: actions.size, independentSkeletonClone: true};
await mkdir(new URL('release/human-review/', root), {recursive: true});
await writeFile(new URL('release/human-review/runtime-validation.json', root), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
