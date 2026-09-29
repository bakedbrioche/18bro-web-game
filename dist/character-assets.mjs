import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from './vendor/addons/utils/SkeletonUtils.js';

// Manifest injection keeps source URLs and standalone embedded bytes separate
// from the asset lifecycle. No asset is downloaded until load() is called.
export function createCharacterAssetStore({manifest = [], embeddedModels = {}, fetchImpl = globalThis.fetch?.bind(globalThis), parse, clone = cloneSkeleton} = {}) {
  const entries = Array.isArray(manifest) ? manifest : manifest.assets || Object.values(manifest);
  const definitions = new Map(entries.map(entry => [entry.assetId, entry]));
  const cache = new Map();
  let disposed = false;
  const parser = parse || ((bytes) => new GLTFLoader().parseAsync(bytes, ''));

  function bytesOf(value) {
    if (typeof value === 'string') {
      const raw = atob(value.replace(/^data:[^,]*;base64,/, ''));
      return Uint8Array.from(raw, char => char.charCodeAt(0)).buffer;
    }
    if (value instanceof ArrayBuffer) return value;
    if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    throw new Error('Character asset bytes are unavailable');
  }

  // The release validator performs deep mesh checks. This runtime preflight
  // guarantees that even a substituted GLB cannot request external resources.
  function preflight(bytes, definition) {
    const view = new DataView(bytes);
    if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== view.byteLength) throw new Error('Invalid character GLB header');
    const jsonLength = view.getUint32(12, true);
    if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength % 4 || 20 + jsonLength > bytes.byteLength) throw new Error('Invalid character GLB JSON chunk');
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)));
    if (json.asset?.version !== '2.0') throw new Error('Unsupported character glTF version');
    if ([...(json.buffers || []), ...(json.images || [])].some(item => item.uri !== undefined)) throw new Error('Character GLB must embed all buffers and images');
    const allowed = new Set(['KHR_materials_unlit']);
    if ((json.extensionsRequired || []).some(name => !allowed.has(name))) throw new Error('Unsupported character GLB extension');
    const nodeNames = new Set((json.nodes || []).map(node => node.name));
    const clipNames = new Set((json.animations || []).map(clip => clip.name));
    for (const socket of definition.sockets || []) if (!nodeNames.has(socket)) throw new Error(`Missing character socket: ${socket}`);
    for (const clip of definition.clips || []) if (!clipNames.has(clip)) throw new Error(`Missing character clip: ${clip}`);
  }

  function releaseTemplate(record) {
    if (!disposed || record.references || !record.asset || record.released) return;
    record.released = true;
    const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
    record.asset.scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton) skeletons.add(object.skeleton);
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) materials.add(material);
    });
    for (const material of materials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
    skeletons.forEach(value => value.dispose());
  }

  function load(id) {
    if (disposed) return Promise.reject(new Error('Character asset store is disposed'));
    if (cache.has(id)) return cache.get(id).promise;
    const definition = definitions.get(id);
    if (!definition) return Promise.reject(new Error(`Unknown character asset: ${id}`));
    const record = {references: 0, asset: null, released: false};
    record.promise = Promise.resolve().then(async () => {
      const file = definition.output?.split(/[\\/]/).pop();
      const embedded = embeddedModels[id] ?? embeddedModels[definition.output] ?? embeddedModels[file];
      let bytes;
      if (embedded !== undefined) bytes = bytesOf(embedded);
      else {
        if (!fetchImpl || !definition.output) throw new Error(`Character asset cannot be fetched: ${id}`);
        // Manifest output is repository relative; modules are served from dist/.
        const source = definition.url || definition.output.replace(/^dist[\\/]/, '').replaceAll('\\', '/');
        const requestUrl = new URL(source, import.meta.url);
        if (definition.sha256) requestUrl.searchParams.set('v', definition.sha256.slice(0, 12));
        const response = await fetchImpl(requestUrl.href);
        if (!response.ok) throw new Error(`Character asset request failed: ${response.status}`);
        bytes = bytesOf(await response.arrayBuffer());
      }
      preflight(bytes, definition);
      const asset = await parser(bytes, definition);
      if (!asset?.scene?.isObject3D) throw new Error('Character parser did not return a scene');
      record.asset = asset;
      if (disposed) { releaseTemplate(record); throw new Error('Character asset store is disposed'); }
      return asset;
    }).catch(error => { cache.delete(id); throw error; });
    cache.set(id, record);
    return record.promise;
  }

  async function instantiate(id) {
    const asset = await load(id);
    if (disposed) throw new Error('Character asset store is disposed');
    const record = cache.get(id), scene = clone(asset.scene), ownedMaterials = new Map(), skeletons = new Set();
    scene.traverse(object => {
      if (object.skeleton) skeletons.add(object.skeleton);
      const copy = material => {
        if (!ownedMaterials.has(material)) ownedMaterials.set(material, material.clone());
        return ownedMaterials.get(material);
      };
      if (object.material) object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
    });
    record.references++;
    let released = false;
    return {scene, animations: asset.animations || [], definition: definitions.get(id), dispose() {
      if (released) return;
      released = true;
      scene.removeFromParent();
      ownedMaterials.forEach(material => material.dispose());
      skeletons.forEach(skeleton => skeleton.dispose());
      record.references--;
      releaseTemplate(record);
    }};
  }

  async function loadOrFallback(id, createFallback) {
    try { return {source: 'refreshed', asset: await instantiate(id), error: null}; }
    catch (error) { return {source: 'original', asset: await createFallback(error), error}; }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const record of cache.values()) releaseTemplate(record);
  }
  return {load, instantiate, loadOrFallback, dispose};
}
