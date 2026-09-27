# DEC-014 - Render result motion from real 3D frames

**Date:** 2026-09-26
**Status:** ACCEPTED

## Context

The first BUSTED refinement flipped one flat chip PNG with a CSS Y rotation. It exposed that the source was a still image and looked especially weak edge-on. The letter wave also crossed the word over roughly 1.6 seconds with large timing gaps, which read as low frame rate even though the browser compositor remained active.

## Decision

- Generate the result chip from the existing original Blender saddle-chip scene as a 60-frame, 60 fps transparent turntable.
- Encode the sequence as APNG. It preserves full alpha and product lighting at 703 KB, whereas palette GIF would introduce color banding and hard transparency edges.
- Retain the 256 x 256 still as the Reduced Motion and decode-failure fallback.
- Validate the APNG signature, dimensions, RGBA mode, animation-control chunk, frame controls, infinite loop count, size and hash. The standalone exporter embeds it as another UI PNG.
- Run the BUSTED wave entirely on compositor transforms. A 1.05-second loop uses 55 ms letter offsets and a 48 percent active window, producing an approximately 0.84-second traversal with several neighboring glyphs in motion.

## Consequences

The result screen shows real changing perspective, rim thickness, ridges and lighting from the 3D model. The APNG adds about 703 KB before standalone base64 encoding and requires FFmpeg to rebuild. Browsers with Reduced Motion receive the static render and no letter wave. The generated release HTML remains offline.
