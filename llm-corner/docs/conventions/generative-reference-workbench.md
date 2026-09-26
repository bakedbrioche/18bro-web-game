# Generative reference workbench

Use the ignored repository-root `tmp/imagegen/` tree for short-lived GPT Image inputs, prompts, outputs and review notes. These files support concept exploration and pose analysis; they are not runtime assets or durable project truth.

Create one dated topic directory per task:

```text
tmp/imagegen/YYYY-MM-DD/topic-name/
  input/    reference images supplied to the generation or analysis pass
  prompts/  exact prompts, including constraints and intended use
  output/   generated sheets and selected variants
  notes/    optional local visual-review notes
```

Use lowercase descriptive topic names such as `shield-aura`, `hero-turnaround`, or `jump-and-scooter-animation`. Keep original inputs unchanged and give copied files descriptive names. Record the source or owner in the prompt or notes when provenance is not obvious.

The entire `tmp/` tree is ignored. Anyone may recreate this structure locally. Do not reference ignored files from runtime code, manifests, committed documentation, tests, or the standalone exporter. When a generated concept changes the shipped design, implement the result in the editable Blender/code source and record the resulting design decision in `llm-corner/`; do not ship the generated reference itself unless its provenance and license have been reviewed and it is deliberately promoted into a tracked asset directory.

Prompts should state the intended downstream use, identify every reference image by role, lock 18Bro's recognizable silhouette and palette, request clean views without text or watermarks, and separate normal jump, scooter jump and scooter dodge requirements. Prefer contact sheets with consistent camera, lighting and scale so poses can be compared and translated into rig keyframes.
For character-dependent effects, a defect screenshot is never sufficient by itself. Include current authored front, rear, side and three-quarter renders, the relevant official identity references, the current prop render, and the defect screenshot. Add `notes/input-manifest.md` that names every input and its role. The reusable ChatGPT Image package may contain all of those references. The internal image-generation call currently accepts at most five paths, so select a high-information subset only for that call and keep the full package for the website workflow; record the subset used in review notes.
