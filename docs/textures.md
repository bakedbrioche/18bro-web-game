# Texture provenance

These project-local images load without third-party requests:

- `drink-fridges.png`: user-supplied refrigerator reference, applied to the store's back wall.
- `store-floor.png`: user-supplied tiled floor, repeated across the larger interior.
- `store-plaster.png`: user-supplied plaster for the interior walls.
- `sidewalk.png`: user-supplied pavement for the promenades.
- `hong-kong-atlas.png`: generated with the built-in image generation tool for this update; nine regions for road, brick, shutter, awning, bamboo, ice, groceries, market tile and residential facades. The mapping code crops each region using texture UVs, without altering the original image.

The original reference images of the storefront and 3D snack packaging guided construction and detail; they are not pasted into the game as photographs.

## Generation prompt

Use case: stylized-concept. Asset type: production texture atlas for a polygonal retro Hong Kong street endless-runner, 18Bro. Generate ONE square texture sheet arranged as EXACTLY 3 columns by 3 rows of equal square cells, edge-to-edge with no gutters, frames, labels, text or perspective. Every cell is a flat orthographic diffuse material texture, softly weathered pixel-art texture aesthetic with painted PS2 era details, no cast shadows, suitable for mapping directly onto 3D surfaces. Row 1 left: dark gray speckled asphalt with small cracks, no road markings. Row 1 center: reddish aged Hong Kong masonry brick wall with pale grout. Row 1 right: gray corrugated rolling metal shop shutter with scuffed lower edge. Row 2 left: red and cream striped canvas market awning fabric, vertical stripes. Row 2 center: bamboo wicker steamer lid and woven basket pattern viewed straight down, filling tile. Row 2 right: wet stainless steel fish market countertop dotted with crushed ice, no fish (3D fish will be placed on it). Row 3 left: colorful dense front-facing grocery shelf with red and green chip packets and cup noodles, each package has a simple colorful food illustration without lettering. Row 3 center: dark teal small square ceramic wall tiles with grout and fine wear. Row 3 right: muted old Hong Kong residential facade, rows of small rectangular dark windows with metal frames and air conditioners, straight-on flat texture. Consistent material scale within each cell, restrained subtle pixel blocks comparable to 256px textures upscaled, warm cream highlights, saturated but weathered reds and jade green. EXACT equal 3x3 layout, entire canvas filled. No symbols crossing cell boundaries, no lettering or logos, no watermark.
