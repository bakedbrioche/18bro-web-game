# Three.js r169 addons

Vendored from https://github.com/mrdoob/three.js/tree/r169/examples/jsm.
`GLTFLoader.js`, `BufferGeometryUtils.js`, and `SkeletonUtils.js` match the
project's Three.js revision 169. The only source change is replacing each bare
`three` import with `../../three.module.js` for offline browser module loading.
The upstream MIT license is included in `LICENSE`.

These modules are not yet automatically bundled by the standalone exporter.
Any runtime integration must include their dependency graph in that exporter.
