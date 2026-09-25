import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Matrix4, Quaternion, Vector3} from '../dist/vendor/three.module.js';

const COMPONENTS = {5120: ['getInt8', 1], 5121: ['getUint8', 1], 5122: ['getInt16', 2], 5123: ['getUint16', 2], 5125: ['getUint32', 4], 5126: ['getFloat32', 4]};
const WIDTHS = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16};
const fail = message => { throw new Error(`Invalid character asset: ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };
const natural = n => Number.isSafeInteger(n) && n >= 0;

// Deliberately validates the small, uncompressed GLB profile used by this game.
// Unsupported encodings fail explicitly instead of being partially validated.
export function validateGlb(input, options = {}) {
  const bytes = Buffer.isBuffer(input) ? input : input instanceof ArrayBuffer ? Buffer.from(input) : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const {manifest, maxBytes = 1024 * 1024, maxTriangles = 4000, maxMaterials = 6, maxBones = 24, maxTextureSize = 512} = options;
  check(bytes.length <= maxBytes, `file exceeds ${maxBytes} bytes`);
  check(bytes.length >= 20 && bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2, 'GLB header/version');
  check(bytes.readUInt32LE(8) === bytes.length, 'GLB length mismatch');
  const chunks = [];
  for (let cursor = 12; cursor < bytes.length;) {
    check(cursor + 8 <= bytes.length, 'truncated chunk header');
    const length = bytes.readUInt32LE(cursor), type = bytes.readUInt32LE(cursor + 4);
    check(length % 4 === 0 && cursor + 8 + length <= bytes.length, 'invalid chunk length');
    chunks.push({type, bytes: bytes.subarray(cursor + 8, cursor + 8 + length)});
    cursor += 8 + length;
  }
  check(chunks[0]?.type === 0x4e4f534a && chunks.length <= 2 && (!chunks[1] || chunks[1].type === 0x004e4942), 'expected JSON then optional BIN');
  let gltf;
  try { gltf = JSON.parse(chunks[0].bytes.toString('utf8')); } catch { fail('malformed JSON'); }
  check(gltf.asset?.version === '2.0', 'glTF version must be 2.0');
  const bin = chunks[1]?.bytes || Buffer.alloc(0);
  const buffers = gltf.buffers || [], views = gltf.bufferViews || [], accessors = gltf.accessors || [];
  check(buffers.length <= 1, 'exactly one embedded buffer is supported');
  for (const buffer of buffers) {
    check(buffer.uri === undefined, 'external buffer URI');
    check(natural(buffer.byteLength) && buffer.byteLength <= bin.length && bin.length - buffer.byteLength <= 3, 'buffer byteLength');
  }
  if (bin.length) check(buffers.length === 1, 'BIN has no buffer definition');
  const allowedExtensions = new Set(['KHR_materials_unlit']);
  check((gltf.extensionsRequired || []).every(name => allowedExtensions.has(name)), 'unsupported required extension');
  // ExtensionsUsed catches optional compression with fallback data too: the
  // first-day profile is intentionally decoder-free and reproducible.
  check(!(gltf.extensionsUsed || []).some(name => /draco|meshopt|basisu/i.test(name)), 'compressed asset is outside the supported profile');
  for (const view of views) {
    check(view.buffer === 0 && buffers.length === 1, 'bufferView buffer');
    check(natural(view.byteOffset || 0) && natural(view.byteLength) && (view.byteOffset || 0) + view.byteLength <= buffers[0].byteLength, 'bufferView bounds');
    if (view.byteStride !== undefined) check(natural(view.byteStride) && view.byteStride >= 4 && view.byteStride <= 252 && view.byteStride % 4 === 0, 'bufferView stride');
  }
  const decoded = accessors.map((accessor, index) => {
    const spec = COMPONENTS[accessor.componentType], width = WIDTHS[accessor.type];
    check(spec && width && natural(accessor.count) && accessor.count > 0, `accessor ${index} type/count`);
    check(!accessor.sparse, `accessor ${index}: sparse encoding is unsupported`);
    check(!accessor.type.startsWith('MAT') || accessor.componentType === 5126, 'integer matrix accessor unsupported');
    check(natural(accessor.bufferView) && views[accessor.bufferView], `accessor ${index} bufferView`);
    const view = views[accessor.bufferView], offset = accessor.byteOffset || 0, stride = view.byteStride || width * spec[1];
    check(natural(offset) && offset % spec[1] === 0 && ((view.byteOffset || 0) + offset) % spec[1] === 0 && stride >= width * spec[1], `accessor ${index} alignment`);
    check(offset + (accessor.count - 1) * stride + width * spec[1] <= view.byteLength, `accessor ${index} out of bounds`);
    const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength), values = [];
    for (let row = 0; row < accessor.count; row++) {
      const result = [];
      for (let column = 0; column < width; column++) {
        let value = data[spec[0]]((view.byteOffset || 0) + offset + row * stride + column * spec[1], true);
        if (accessor.normalized) {
          check(accessor.componentType !== 5126 && accessor.componentType !== 5125, 'invalid normalized component type');
          value = accessor.componentType === 5120 ? Math.max(value / 127, -1) : accessor.componentType === 5122 ? Math.max(value / 32767, -1) : value / (accessor.componentType === 5121 ? 255 : 65535);
        }
        check(Number.isFinite(value), `accessor ${index} contains non-finite data`);
        result.push(value);
      }
      values.push(result);
    }
    return values;
  });
  const getAccessor = (index, type, component) => {
    check(natural(index) && accessors[index] && (!type || accessors[index].type === type) && (!component || accessors[index].componentType === component), `invalid ${type || ''} accessor reference`);
    return decoded[index];
  };
  const nodes = gltf.nodes || [], meshes = gltf.meshes || [], skins = gltf.skins || [], materials = gltf.materials || [];
  const nodeNames = nodes.map(node => node.name).filter(name => name !== undefined);
  check(nodeNames.every(name => typeof name === 'string' && /^[A-Za-z0-9_-]+$/.test(name)) && new Set(nodeNames).size === nodeNames.length, 'node names must be unique ASCII identifiers');
  const visiting = new Set(), visited = new Set(), parents = new Map();
  function visit(index) {
    check(natural(index) && nodes[index], 'invalid node reference');
    check(!visiting.has(index), 'cyclic node hierarchy');
    if (visited.has(index)) return;
    visiting.add(index);
    const node = nodes[index];
    for (const [name, count] of [['translation', 3], ['rotation', 4], ['scale', 3], ['matrix', 16]]) if (node[name] !== undefined) check(Array.isArray(node[name]) && node[name].length === count && node[name].every(Number.isFinite), `non-finite or invalid node ${name}`);
    if (node.mesh !== undefined) check(natural(node.mesh) && meshes[node.mesh], 'invalid mesh reference');
    if (node.skin !== undefined) check(natural(node.skin) && skins[node.skin] && node.mesh !== undefined, 'invalid skin reference');
    for (const child of node.children || []) { check(!parents.has(child), 'node has multiple parents'); parents.set(child, index); visit(child); }
    visiting.delete(index); visited.add(index);
  }
  nodes.forEach((_, i) => visit(i));
  for (const scene of gltf.scenes || []) for (const index of scene.nodes || []) check(natural(index) && nodes[index] && !parents.has(index), 'invalid scene root');
  const bones = new Set();
  for (const skin of skins) {
    check(Array.isArray(skin.joints) && skin.joints.length > 0 && new Set(skin.joints).size === skin.joints.length, 'invalid skin joints');
    for (const joint of skin.joints) { check(natural(joint) && nodes[joint], 'invalid joint node'); bones.add(joint); }
    if (skin.inverseBindMatrices !== undefined) check(getAccessor(skin.inverseBindMatrices, 'MAT4', 5126).length === skin.joints.length, 'inverse bind matrix count');
  }
  let triangles = 0;
  for (const mesh of meshes) for (const primitive of mesh.primitives || []) {
    check((primitive.mode ?? 4) === 4, 'only triangle primitives are supported');
    const positions = getAccessor(primitive.attributes?.POSITION, 'VEC3', 5126);
    const indices = primitive.indices === undefined ? null : getAccessor(primitive.indices, 'SCALAR');
    if (indices) {
      check([5121, 5123, 5125].includes(accessors[primitive.indices].componentType), 'indices must be unsigned integers');
      check(indices.every(([i]) => natural(i) && i < positions.length), 'mesh index out of range');
    }
    const count = indices ? indices.length : positions.length;
    check(count % 3 === 0, 'incomplete triangle'); triangles += count / 3;
    if (primitive.material !== undefined) check(natural(primitive.material) && materials[primitive.material], 'invalid material reference');
    for (const [name, accessor] of Object.entries(primitive.attributes || {})) check(getAccessor(accessor).length === positions.length, `attribute ${name} count mismatch`);
    check(primitive.attributes.JOINTS_1 === undefined && primitive.attributes.WEIGHTS_1 === undefined, 'more than four bone weights');
    const weights = primitive.attributes.WEIGHTS_0, joints = primitive.attributes.JOINTS_0;
    check((weights === undefined) === (joints === undefined), 'weights/joints pair missing');
    if (weights !== undefined) {
      const values = getAccessor(weights, 'VEC4'), jointValues = getAccessor(joints, 'VEC4');
      check([5121, 5123].includes(accessors[joints].componentType) && !accessors[joints].normalized, 'joint indices encoding');
      check(values.every(row => row.every(w => w >= 0 && w <= 1) && Math.abs(row.reduce((a, b) => a + b, 0) - 1) < .002), 'bone weights must sum to one');
      for (const node of nodes.filter(node => meshes[node.mesh] === mesh && node.skin !== undefined)) check(jointValues.every(row => row.every(joint => joint < skins[node.skin].joints.length)), 'joint index out of range');
    }
  }
  const clips = (gltf.animations || []).map(animation => animation.name);
  check(clips.every(name => typeof name === 'string' && /^[A-Za-z0-9_-]+$/.test(name)) && new Set(clips).size === clips.length, 'animation names must be unique ASCII identifiers');
  for (const animation of gltf.animations || []) {
    for (const sampler of animation.samplers || []) {
      const times = getAccessor(sampler.input, 'SCALAR', 5126), values = getAccessor(sampler.output);
      check(times.every(([time], i) => time >= 0 && (!i || time > times[i - 1][0])), 'animation time must increase');
      check(['LINEAR', 'STEP', 'CUBICSPLINE'].includes(sampler.interpolation || 'LINEAR'), 'animation interpolation');
      check(values.length === times.length * (sampler.interpolation === 'CUBICSPLINE' ? 3 : 1), 'animation output count');
    }
    for (const channel of animation.channels || []) {
      check(natural(channel.sampler) && animation.samplers?.[channel.sampler] && natural(channel.target?.node) && nodes[channel.target.node], 'invalid animation channel');
      check(['translation', 'rotation', 'scale'].includes(channel.target.path), 'unsupported animation channel');
      const sampler = animation.samplers[channel.sampler];
      const values = getAccessor(sampler.output, channel.target.path === 'rotation' ? 'VEC4' : 'VEC3', 5126);
      // Exporters may emit constant rest-pose root channels. Those are valid;
      // moving the game-owned root or a top-level armature wrapper is not.
      if (nodes[channel.target.node].name === 'root' || !parents.has(channel.target.node)) {
        const cubic = sampler.interpolation === 'CUBICSPLINE', first = values[cubic ? 1 : 0];
        check(values.every((row, i) => row.every((value, j) => Math.abs(value - (cubic && i % 3 !== 1 ? 0 : first[j])) < 1e-6)), 'animation moves the simulation root');
      }
    }
  }
  const imageSizes = [];
  for (const image of gltf.images || []) {
    check(image.uri === undefined, 'external image URI');
    check(natural(image.bufferView) && views[image.bufferView], 'image bufferView');
    const view = views[image.bufferView], data = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    let width, height;
    if (image.mimeType === 'image/png') {
      check(data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.toString('ascii', 12, 16) === 'IHDR', 'invalid PNG header');
      width = data.readUInt32BE(16); height = data.readUInt32BE(20);
    } else if (image.mimeType === 'image/jpeg') {
      check(data.length > 4 && data.readUInt16BE(0) === 0xffd8, 'invalid JPEG header');
      for (let i = 2; i + 4 <= data.length;) {
        check(data[i] === 255, 'invalid JPEG marker');
        const marker = data[i + 1], length = data.readUInt16BE(i + 2);
        check(length >= 2 && i + 2 + length <= data.length, 'invalid JPEG segment');
        if ([0xc0, 0xc1, 0xc2].includes(marker)) { check(length >= 8, 'invalid JPEG dimensions'); height = data.readUInt16BE(i + 5); width = data.readUInt16BE(i + 7); break; }
        i += 2 + length;
      }
    } else fail('only embedded PNG/JPEG images are supported');
    check(width > 0 && height > 0 && width <= maxTextureSize && height <= maxTextureSize, 'texture dimensions exceed budget or are unavailable');
    imageSizes.push({width, height});
  }
  for (const texture of gltf.textures || []) check(natural(texture.source) && gltf.images?.[texture.source], 'invalid texture image');
  check(triangles > 0 && triangles <= maxTriangles, `triangle budget exceeded or mesh empty (${triangles}/${maxTriangles})`);
  check(materials.length <= maxMaterials, `material budget exceeded (${materials.length}/${maxMaterials})`);
  check(bones.size <= maxBones, `bone budget exceeded (${bones.size}/${maxBones})`);
  const matrices = new Map(), minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
  function worldMatrix(index) {
    if (matrices.has(index)) return matrices.get(index);
    const node = nodes[index], matrix = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3().fromArray(node.translation || [0, 0, 0]), new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]), new Vector3().fromArray(node.scale || [1, 1, 1]));
    if (parents.has(index)) matrix.premultiply(worldMatrix(parents.get(index)));
    matrices.set(index, matrix); return matrix;
  }
  for (let i = 0; i < nodes.length; i++) if (nodes[i].mesh !== undefined) {
    for (const primitive of meshes[nodes[i].mesh].primitives || []) for (const position of decoded[primitive.attributes.POSITION]) {
      const transformed = new Vector3().fromArray(position).applyMatrix4(worldMatrix(i)).toArray();
      transformed.forEach((value, axis) => { check(Number.isFinite(value), 'non-finite world bounds'); minimum[axis] = Math.min(minimum[axis], value); maximum[axis] = Math.max(maximum[axis], value); });
    }
  }
  check(minimum.every(Number.isFinite) && maximum.every(Number.isFinite), 'no mesh instances in node hierarchy');
  const bounds = {min: minimum, max: maximum};
  const expectedBounds = options.bounds || manifest?.bounds;
  if (expectedBounds) for (const key of ['min', 'max']) check(Array.isArray(expectedBounds[key]) && expectedBounds[key].length === 3 && expectedBounds[key].every((value, axis) => Number.isFinite(value) && Math.abs(value - bounds[key][axis]) <= (options.boundsTolerance ?? .02)), `manifest ${key} bounds mismatch`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  for (const name of [...(options.requiredNodes || []), ...(manifest?.sockets || [])]) check(nodeNames.includes(name), `missing node/socket ${name}`);
  for (const name of [...(options.requiredClips || []), ...(manifest?.clips || [])]) check(clips.includes(name), `missing clip ${name}`);
  if (manifest) {
    if (manifest.sha256) check(manifest.sha256 === sha256, 'manifest SHA-256 mismatch');
    for (const [name, actual] of Object.entries({triangles, materials: materials.length, bones: bones.size})) if (manifest[name] !== undefined) check(manifest[name] === actual, `manifest ${name} mismatch`);
  }
  return {sha256, bytes: bytes.length, triangles, materials: materials.length, bones: bones.size, bounds, clips: [...clips].sort(), nodes: [...nodeNames].sort(), images: imageSizes};
}

async function main(args) {
  if (!args.length) throw new Error('Usage: node scripts/validate-assets.mjs model.glb [...] [--manifest art/manifest.json]');
  const marker = args.indexOf('--manifest');
  let manifest;
  if (marker !== -1) {
    if (!args[marker + 1]) throw new Error('--manifest needs a JSON path');
    manifest = JSON.parse(await readFile(args[marker + 1], 'utf8'));
    args.splice(marker, 2);
  }
  const entries = manifest ? Array.isArray(manifest) ? manifest : manifest.assets || [manifest] : [];
  if (!args.length) args = entries.map(entry => entry.output);
  for (const file of args) {
    const entry = entries.find(entry => resolve(entry.output) === resolve(file));
    if (manifest && !entry) throw new Error(`No manifest entry for ${file}`);
    console.log(JSON.stringify({file, ...validateGlb(await readFile(file), {manifest: entry})}));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
