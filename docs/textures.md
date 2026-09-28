# Materials and image provenance

The roadway image is `dist/assets/textures/asphalt.png`, copied unchanged from the user's `1645c40b-5145-4307-815b-97cb383e333f.png`. It tiles over the roadway without white or yellow lane markings.

`dist/assets/textures/sidewalk.png` is copied unchanged from the user’s `codex-clipboard-4cfd75b5-aec8-49d9-835b-f7a781c592bb.png`. Its six slabs map to individual 1 × 1 metre planes, with UV edges on grout centers. Three columns and thirty rows fill each street section, maintaining square, aligned tiles across recycled sections.

The convenience store, interior tiles, walls, shelves, packets, bottles, cans, noodle cups, checkout, cooler cabinets and signage are built from editable Three.js geometry and solid-color materials. The clerk is an articulated procedural character. No store photographs, shelf images, refrigerator images or generated atlas are used.

Residential facades use solid materials with modeled windows, frames, ledges and air conditioners. Street signs, banners and taxi labels use small code-generated text graphics. The character cap uses the user-supplied logo reference documented in `art/references/README.md`; the normalized runtime decal is `dist/assets/textures/cap-logo.png` and the Refreshed hero embeds the same pixels in its palette atlas.

The clerk uses four varied subtitles with no voice audio. Shelf stock and fittings are 3D geometry, including cans, noodle cups, sandwich packs and rice balls.

Expansion buildings use code-generated 64/128-pixel facade, shop-sign and pavement graphics. Repeated road and pavement surfaces share world-aligned UVs across streamed chunks. Textures use stable perspective mapping, nearest-neighbor magnification and mipmapped distance filtering; sign color and emission sample the same coordinates. Facade overlays receive a depth bias to prevent flicker.
