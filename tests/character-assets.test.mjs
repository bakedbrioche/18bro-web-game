import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {validateGlb} from '../scripts/validate-assets.mjs';
import {createCharacterAssetStore} from '../dist/character-assets.mjs';

function fixture(edit = () => {}) {
  const binary = Buffer.alloc(60);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, i) => binary.writeFloatLE(value, i * 4));
  binary.writeFloatLE(0, 36); binary.writeFloatLE(1, 40);
  const gltf = {asset: {version: '2.0'}, scene: 0, scenes: [{nodes: [0]}],
    nodes: [{name: 'root', children: [1]}, {name: 'socket_hat', mesh: 0}],
    buffers: [{byteLength: 60}], bufferViews: [{buffer: 0, byteOffset: 0, byteLength: 36}, {buffer: 0, byteOffset: 36, byteLength: 8}],
    accessors: [{bufferView: 0, componentType: 5126, type: 'VEC3', count: 3, min: [0, 0, 0], max: [1, 1, 0]}],
    meshes: [{primitives: [{attributes: {POSITION: 0}, material: 0}]}], materials: [{name: 'fur'}]};
  edit(gltf, binary);
  const text = Buffer.from(JSON.stringify(gltf)), json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(json);
  const result = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
  result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(json.length, 12); result.writeUInt32LE(0x4e4f534a, 16); json.copy(result, 20);
  result.writeUInt32LE(binary.length, 20 + json.length); result.writeUInt32LE(0x004e4942, 24 + json.length); binary.copy(result, 28 + json.length);
  return result;
}
const definition = {assetId: 'cat', output: 'dist/assets/models/cat-v1.glb', sockets: ['socket_hat'], clips: []};
const createStore = (bytes, extra = {}) => createCharacterAssetStore({manifest: [definition], embeddedModels: {'cat-v1.glb': bytes}, ...extra});

test('GLB validator accepts self-contained geometry and checks manifest hash and budgets', () => {
  const bytes = fixture(), report = validateGlb(bytes);
  assert.equal(report.triangles, 1); assert.equal(report.bones, 0);
  assert.deepEqual(report.bounds, {min: [0, 0, 0], max: [1, 1, 0]});
  assert.deepEqual(report.nodes, ['root', 'socket_hat']);
  assert.equal(validateGlb(bytes, {manifest: {...definition, ...report}}).sha256, report.sha256);
  assert.throws(() => validateGlb(bytes, {manifest: {...definition, sha256: 'bad'}}), /SHA-256/);
  assert.throws(() => validateGlb(bytes, {maxTriangles: 0}), /triangle budget/);
  assert.throws(() => validateGlb(bytes, {requiredClips: ['run']}), /missing clip/);
  assert.throws(() => validateGlb(bytes, {bounds: {min: [0, 0, 0], max: [2, 1, 0]}}), /bounds mismatch/);
});

test('GLB validator rejects corrupt chunk lengths and truncated accessors', () => {
  const bad = fixture(); bad.writeUInt32LE(0xffffffff, 12);
  assert.throws(() => validateGlb(bad), /chunk length/);
  assert.throws(() => validateGlb(fixture(gltf => gltf.accessors[0].count = 30)), /out of bounds/);
});

test('GLB validator rejects external dependencies, compression and non-finite vertex data', () => {
  assert.throws(() => validateGlb(fixture(gltf => gltf.buffers[0].uri = 'https://example.test/body.bin')), /external buffer/);
  assert.throws(() => validateGlb(fixture(gltf => gltf.images = [{uri: 'face.png'}])), /external image/);
  assert.throws(() => validateGlb(fixture(gltf => gltf.extensionsRequired = ['KHR_draco_mesh_compression'])), /unsupported required/);
  assert.throws(() => validateGlb(fixture((gltf, binary) => binary.writeFloatLE(NaN, 0))), /non-finite/);
});

test('GLB validator rejects cyclic hierarchy and missing sockets', () => {
  assert.throws(() => validateGlb(fixture(gltf => gltf.nodes[1].children = [0])), /cyclic/);
  assert.throws(() => validateGlb(fixture(), {manifest: {sockets: ['socket_bag']}}), /missing node/);
});

test('GLB validator checks skin influence sums and joint index limits', () => {
  const skinned = edit => fixture((gltf, binary) => {
    binary.fill(0);
    for (let i = 0; i < 3; i++) binary.writeFloatLE(1, i * 16);
    gltf.bufferViews.push({buffer: 0, byteOffset: 0, byteLength: 48}, {buffer: 0, byteOffset: 48, byteLength: 12});
    gltf.accessors.push({bufferView: 2, componentType: 5126, type: 'VEC4', count: 3}, {bufferView: 3, componentType: 5121, type: 'VEC4', count: 3});
    Object.assign(gltf.meshes[0].primitives[0].attributes, {WEIGHTS_0: 1, JOINTS_0: 2});
    gltf.nodes[1].skin = 0; gltf.skins = [{joints: [0]}];
    edit(gltf, binary);
  });
  assert.equal(validateGlb(skinned(() => {})).bones, 1);
  assert.throws(() => validateGlb(skinned((gltf, binary) => binary.writeFloatLE(.5, 0))), /weights must sum/);
  assert.throws(() => validateGlb(skinned((gltf, binary) => binary[48] = 3)), /joint index out of range/);
});

test('GLB bounds include parent transforms instead of trusting accessor min/max', () => {
  const report = validateGlb(fixture(gltf => { gltf.nodes[0].translation = [2, 3, 4]; gltf.nodes[1].scale = [2, 2, 2]; }));
  assert.deepEqual(report.bounds, {min: [2, 3, 4], max: [4, 5, 4]});
});

test('GLB validator rejects invalid animation time and root movement', () => {
  const animated = edit => fixture((gltf, binary) => {
    gltf.accessors.push({bufferView: 1, componentType: 5126, type: 'SCALAR', count: 2});
    gltf.accessors[0].count = 3;
    gltf.accessors.push({bufferView: 0, componentType: 5126, type: 'VEC3', count: 2});
    gltf.animations = [{name: 'run', samplers: [{input: 1, output: 2}], channels: [{sampler: 0, target: {node: 1, path: 'translation'}}]}];
    edit(gltf, binary);
  });
  assert.deepEqual(validateGlb(animated(() => {})).clips, ['run']);
  assert.throws(() => validateGlb(animated((gltf, binary) => binary.writeFloatLE(0, 40))), /time must increase/);
  assert.throws(() => validateGlb(animated(gltf => gltf.animations[0].channels[0].target.node = 0)), /simulation root/);
  assert.deepEqual(validateGlb(animated((gltf, binary) => {
    gltf.animations[0].channels[0].target.node = 0;
    binary.writeFloatLE(0, 12);
  })).clips, ['run']);
});

test('real vendored GLTF loader parses embedded bytes without fetching and isolates materials', async () => {
  const store = createStore(fixture().toString('base64'), {fetchImpl: () => assert.fail('unexpected network request')});
  const [a, b] = await Promise.all([store.instantiate('cat'), store.instantiate('cat')]);
  const ma = a.scene.getObjectByName('socket_hat'), mb = b.scene.getObjectByName('socket_hat');
  assert.ok(ma.isMesh && mb.isMesh); assert.equal(ma.geometry, mb.geometry);
  assert.notEqual(ma.material, mb.material);
  ma.material.color.setHex(0xff0000); assert.notEqual(ma.material.color.getHex(), mb.material.color.getHex());
  a.dispose(); a.dispose(); b.dispose(); store.dispose();
});

test('instances keep shared geometry alive after store disposal until the final release', async () => {
  const store = createStore(fixture()), a = await store.instantiate('cat'), b = await store.instantiate('cat');
  const mesh = a.scene.getObjectByName('socket_hat'); let disposed = 0;
  mesh.geometry.addEventListener('dispose', () => disposed++);
  store.dispose(); a.dispose(); assert.equal(disposed, 0);
  b.dispose(); assert.equal(disposed, 1);
  store.dispose(); b.dispose(); assert.equal(disposed, 1);
  await assert.rejects(store.load('cat'), /disposed/);
});

test('skeleton clones animate independently without sharing mutable bones', async () => {
  const root = new THREE.Group(), bone = new THREE.Bone(), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  root.add(bone, mesh); mesh.bind(new THREE.Skeleton([bone]));
  const store = createStore(fixture(), {parse: async () => ({scene: root, animations: []})});
  const a = await store.instantiate('cat'), b = await store.instantiate('cat');
  a.scene.children[0].rotation.x = .7;
  assert.ok(Math.abs(b.scene.children[0].rotation.x) < 1e-12);
  assert.equal(a.scene.children[1].skeleton.bones[0], a.scene.children[0]);
  assert.notEqual(a.scene.children[1].skeleton, b.scene.children[1].skeleton);
  a.dispose(); b.dispose(); store.dispose();
});

test('corrupt or externally linked assets use the procedural fallback before parsing', async () => {
  for (const bytes of [new Uint8Array(2), fixture(gltf => gltf.images = [{uri: 'remote.png'}]), fixture(gltf => gltf.nodes[1].name = 'missing')]) {
    const store = createStore(bytes, {parse: () => assert.fail('parser should not run')});
    const original = {root: 'legacy'};
    const result = await store.loadOrFallback('cat', () => original);
    assert.equal(result.source, 'original'); assert.equal(result.asset, original); assert.ok(result.error instanceof Error);
    store.dispose();
  }
});

test('failed requests are retryable and concurrent successful requests share one parse', async () => {
  let requests = 0, parses = 0;
  const store = createCharacterAssetStore({manifest: [definition], fetchImpl: async url => {
    assert.ok(url.endsWith('/dist/assets/models/cat-v1.glb'));
    requests++; return {ok: requests > 1, status: 404, arrayBuffer: async () => fixture()};
  }, parse: async () => { parses++; return {scene: new THREE.Group(), animations: []}; }});
  assert.equal((await store.loadOrFallback('cat', () => ({}))).source, 'original');
  const [a, b] = await Promise.all([store.load('cat'), store.load('cat')]);
  assert.equal(a, b); assert.equal(requests, 2); assert.equal(parses, 1); store.dispose();
});

test('disposing during an asynchronous load releases the late result', async () => {
  let finish;
  const template = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  template.add(new THREE.Mesh(geometry, material)); let released = 0;
  geometry.addEventListener('dispose', () => released++);
  const store = createStore(fixture(), {parse: () => new Promise(resolve => { finish = resolve; })});
  const pending = store.instantiate('cat');
  await new Promise(resolve => setImmediate(resolve));
  store.dispose(); finish({scene: template});
  await assert.rejects(pending, /disposed/); assert.equal(released, 1);
});
