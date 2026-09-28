// Validate seven pickups and the three independent wearable attachment meshes.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../../dist/vendor/three.module.js';
import {GLTFLoader} from '../../dist/vendor/addons/loaders/GLTFLoader.js';
import {validateGlb} from '../validate-assets.mjs';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('art/powerups/manifest.json', root), 'utf8'));
assert.equal(manifest.revision, 6, 'power-up asset revision');

const bytes = await readFile(new URL(manifest.output, root));
const types = ['magnet', 'moon', 'moped', 'shield', 'doublechips', 'jetpack', 'speedburst'];
const wearables = ['magnet', 'moon_L', 'moon_R'];
const requiredNodes = [...types.map(type => `powerup_${type}`), ...wearables.map(type => `wearable_${type}`)];
const structure = validateGlb(bytes, {manifest, maxTriangles: 15000, maxMaterials: 1, maxBones: 0,
  maxBytes: 900000, requiredNodes});
const loader = new GLTFLoader();
const parsed = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
assert.equal(parsed.scene.children.length, requiredNodes.length);
assert.deepEqual(new Set(parsed.scene.children.map(node => node.name)), new Set(requiredNodes));
assert.equal(parsed.animations.length, 0);
assert.equal(structure.images.length, 0);
const report = {sha256: structure.sha256, bytes: structure.bytes, triangles: structure.triangles, assets: {}, wearables: {}};
for (const type of types) {
  const entry = manifest.assets[type];
  const mesh = parsed.scene.getObjectByName(entry.root);
  assert.ok(mesh?.isMesh, `${type}: directly cloneable named mesh`);
  assert.ok(mesh.material.vertexColors && mesh.geometry.attributes.color, `${type}: preserved vertex colors`);
  assert.ok(!mesh.material.map, `${type}: texture-free`);
  if (type === 'magnet') {
    assert.equal(mesh.userData.design_revision, 6);
    assert.equal(mesh.userData.magnet_halves, 'left_blue_right_red');
    assert.equal(mesh.userData.pole_ends, 'symmetric_aligned_gray');
    assert.equal(mesh.userData.gold_zap_count, 1);
    assert.equal(mesh.userData.side_zap_count, 0);
    assert.equal(mesh.userData.curve_profile, 'analytic_tangent_horseshoe');
    assert.equal(mesh.userData.cross_section, 'rounded_elliptic');
    assert.ok(mesh.userData.curve_samples >= 30);
  }
  if (type === 'moon') {
    assert.equal(mesh.userData.design_revision, 6);
    assert.equal(mesh.userData.silhouette, 'original_mid_top_court_sneakers');
    assert.equal(mesh.userData.rear_wing_count, 0);
    assert.equal(mesh.userData.heel_arrows, 'left_green_right_red');
  }
  assert.deepEqual(mesh.position.toArray(), [0, 0, 0]);
  assert.deepEqual(mesh.quaternion.toArray(), [0, 0, 0, 1]);
  assert.deepEqual(mesh.scale.toArray(), [1, 1, 1]);
  const bounds = new THREE.Box3().setFromObject(mesh);
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  assert.ok(center.length() < 1e-5 && Math.abs(Math.max(...size.toArray()) - 1.4) < 1e-5);
  for (const key of ['min', 'max']) bounds[key].toArray().forEach((n, axis) => {
    assert.ok(Math.abs(n - entry.bounds[key][axis]) < 1e-5, `${type}: actual ${key} bounds`);
  });
  const clone = mesh.clone();
  clone.position.x = 5;
  assert.equal(mesh.position.x, 0);
  assert.equal(clone.geometry, mesh.geometry);
  const triangles = mesh.geometry.index.count / 3;
  assert.equal(triangles, entry.triangles);
  const png = await readFile(new URL(entry.icon.path, root));
  assert.equal(png.length, entry.icon.bytes);
  assert.equal(createHash('sha256').update(png).digest('hex'), entry.icon.sha256);
  assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  assert.equal(png.readUInt32BE(16), 256);
  assert.equal(png.readUInt32BE(20), 256);
  assert.equal(png[25], 6, `${type}: RGBA transparency`);
  assert.ok(png.length > 10000, `${type}: non-empty rendered subject`);
  report.assets[type] = {root: mesh.name, triangles, size: size.toArray(), iconBytes: png.length};
}
for (const type of wearables) {
  const entry = manifest.wearables[type];
  const mesh = parsed.scene.getObjectByName(entry.root);
  assert.ok(mesh?.isMesh, `${type}: directly cloneable wearable mesh`);
  assert.equal(mesh.parent, parsed.scene, `${type}: wearable is not nested in a pickup`);
  assert.ok(mesh.material.vertexColors && mesh.geometry.attributes.color, `${type}: preserved vertex colors`);
  assert.ok(!mesh.material.map, `${type}: texture-free`);
  if (type === 'magnet') {
    assert.equal(mesh.userData.design_revision, 6);
    assert.equal(mesh.userData.magnet_halves, 'left_blue_right_red');
    assert.equal(mesh.userData.pole_ends, 'symmetric_aligned_gray');
    assert.equal(mesh.userData.gold_zap_count, 0);
    assert.equal(mesh.userData.curve_profile, 'analytic_tangent_horseshoe');
    assert.equal(mesh.userData.cross_section, 'rounded_elliptic');
    assert.ok(mesh.userData.curve_samples >= 30);
    assert.equal(mesh.userData.side_zap_count, 0);
  }
  assert.equal(mesh.userData.booster_type, undefined, `${type}: wearable cannot be mistaken for pickup`);
  assert.equal(mesh.userData.wearable_type, `wearable_${type}`);
  assert.equal(mesh.userData.design_revision, 6);
  if (type === 'magnet') {
    assert.equal(mesh.userData.magnet_halves, 'left_blue_right_red');
    assert.equal(mesh.userData.pole_ends, 'symmetric_aligned_gray');
    assert.equal(mesh.userData.gold_zap_count, 0);
    assert.equal(mesh.userData.side_zap_count, 0);
  } else {
    assert.equal(mesh.userData.shoe_style, 'original_mid_top_court_sneaker');
    assert.equal(mesh.userData.rear_wing_count, 0);
    assert.equal(mesh.userData.heel_arrow, type === 'moon_L' ? 'green' : 'red');
  }
  assert.deepEqual(mesh.position.toArray(), [0, 0, 0]);
  assert.deepEqual(mesh.quaternion.toArray(), [0, 0, 0, 1]);
  assert.deepEqual(mesh.scale.toArray(), [1, 1, 1]);
  const bounds = new THREE.Box3().setFromObject(mesh);
  const size = bounds.getSize(new THREE.Vector3());
  for (const key of ['min', 'max']) bounds[key].toArray().forEach((n, axis) => {
    assert.ok(Math.abs(n - entry.bounds[key][axis]) < 1e-5, `${type}: actual ${key} bounds`);
  });
  size.toArray().forEach((n, axis) => assert.ok(Math.abs(n - entry.dimensions[axis]) < 1e-5));
  if (type === 'magnet') {
    assert.ok(size.x > .60 && size.x < .68 && size.y > .68 && size.y < .76 && size.z > .12 && size.z < .16,
      `${type}: clean horseshoe attachment remains at authored character scale`);
  } else {
    assert.ok(size.x > .35 && size.x < .60 && size.y > .30 && size.y < .50 && size.z > .50 && size.z < .65,
      `${type}: sneaker attachment remains at authored character scale`);
  }
  if (type.startsWith('moon_')) {
    assert.equal(entry.attachTo, `foot_${type.slice(-1)}`);
    assert.ok(Math.abs(bounds.min.y + .12) < .012, `${type}: ankle-relative sole placement`);
    assert.ok(bounds.max.z > .25 && bounds.min.z < -.10, `${type}: toe faces +Z`);
  } else {
    assert.equal(entry.attachTo, 'socket_carry_L');
    assert.ok(bounds.min.y >= -.001 && bounds.min.y < .02 && bounds.max.y > .68, `${type}: lower-bridge grip pivot`);
  }
  const clone = mesh.clone();
  clone.position.y = 4;
  assert.equal(mesh.position.y, 0);
  assert.equal(clone.geometry, mesh.geometry);
  const triangles = mesh.geometry.index.count / 3;
  assert.equal(triangles, entry.triangles);
  assert.ok(triangles >= (type === 'magnet' ? 300 : 750), `${type}: purposeful volumetric detail`);
  report.wearables[type] = {root: mesh.name, attachTo: entry.attachTo, triangles, size: size.toArray()};
}
assert.equal(Object.values(report.assets).reduce((sum, entry) => sum + entry.triangles, 0), manifest.pickupTriangles);
assert.equal(Object.values(report.wearables).reduce((sum, entry) => sum + entry.triangles, 0), manifest.wearableTriangles);
assert.equal(manifest.pickupTriangles + manifest.wearableTriangles, report.triangles);
await mkdir(new URL('release/powerup-review/', root), {recursive: true});
await writeFile(new URL('release/powerup-review/runtime-validation.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
