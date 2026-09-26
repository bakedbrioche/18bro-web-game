"""Build and render the result-screen chip icon from reproducible 3D geometry.

Run with Blender 5.2:
  blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
          --python scripts/blender/create_chip_icon.py
"""
from pathlib import Path
import hashlib
import json
import math

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/ui/chip-icon.blend'
MANIFEST = ROOT / 'art/ui/chip-icon.manifest.json'
OUTPUT = ROOT / 'dist/assets/icons/chip.png'
REVIEW = ROOT / 'release/ui-review/chip-icon.png'
for directory in (SOURCE.parent, OUTPUT.parent, REVIEW.parent):
    directory.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def material(name, color, roughness=.58, metallic=.02):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1)
    value.use_nodes = True
    shader = value.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return value


gold = material('chip_gold', (0.78, .49, .10), .67)
highlight = material('chip_ridge', (1.0, .75, .24), .48)

# The gameplay chip is a thin saddle-shaped potato slice. A deformed UV sphere
# gives the icon real thickness and a continuous rounded rim without a texture.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=(0, 0, 0))
chip = bpy.context.object
chip.name = 'ui_chip_token'
for vertex in chip.data.vertices:
    x, depth, z = vertex.co
    vertex.co = (x * .62,
                 depth * .055 + .17 * (x * x - z * z),
                 z * .82)
chip.data.materials.append(gold)
for polygon in chip.data.polygons:
    polygon.use_smooth = True
chip['provenance'] = 'Original procedural 3D chip for the 18Bro community game'
chip['render_use'] = 'game-over chips-banked icon'

# Seven raised baked ridges follow the same saddle surface as the chip. Curves
# are geometry, so the result remains legible at 20-28 CSS pixels.
for index, z in enumerate([-.49, -.33, -.165, 0, .165, .33, .49]):
    width = .52 * math.sqrt(max(.08, 1 - (z / .82) ** 2))
    curve_data = bpy.data.curves.new('chip_ridge_curve', 'CURVE')
    curve_data.dimensions = '3D'
    curve_data.bevel_depth = .014 if index in (1, 3, 5) else .011
    curve_data.bevel_resolution = 1
    spline = curve_data.splines.new('POLY')
    samples = 13
    spline.points.add(samples - 1)
    for sample, point in enumerate(spline.points):
        x = -width + sample * (2 * width / (samples - 1))
        unit_x = x / .62
        unit_z = z / .82
        depth = -.062 + .17 * (unit_x * unit_x - unit_z * unit_z)
        point.co = (x, depth, z, 1)
    ridge = bpy.data.objects.new('chip_ridge', curve_data)
    scene.collection.objects.link(ridge)
    curve_data.materials.append(highlight)

# Transparent three-light product studio, shared visually with the booster icons.
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 256
scene.render.resolution_y = 256
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.image_settings.compression = 75
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.view_settings.exposure = -.18
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.36, .42, .40, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .38


def aim(obj, target=(0, 0, 0)):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


for name, location, power, size, color in (
        ('key', (-3, -4, 5), 360, 4, (1, .90, .72)),
        ('fill', (4, -2, 2), 135, 3, (.68, .91, 1)),
        ('rim', (1, 3, 4), 430, 3, (1, .96, .78))):
    light_data = bpy.data.lights.new(name, 'AREA')
    light_data.energy, light_data.shape, light_data.size = power, 'DISK', size
    light_data.color = color
    light = bpy.data.objects.new(name, light_data)
    scene.collection.objects.link(light)
    light.location = location
    aim(light)

camera_data = bpy.data.cameras.new('camera')
camera = bpy.data.objects.new('camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2.05
camera.location = (2.45, -5.8, 2.65)
aim(camera)

scene.render.filepath = str(OUTPUT)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
REVIEW.write_bytes(OUTPUT.read_bytes())

png = OUTPUT.read_bytes()
assert png[:8] == b'\x89PNG\r\n\x1a\n'
manifest = {
    'schemaVersion': 1,
    'assetId': 'ui-chip-icon',
    'revision': 1,
    'blenderVersion': bpy.app.version_string,
    'source': 'art/ui/chip-icon.blend',
    'output': 'dist/assets/icons/chip.png',
    'width': 256,
    'height': 256,
    'bytes': len(png),
    'sha256': hashlib.sha256(png).hexdigest(),
    'geometry': 'one deformed rounded chip shell plus seven raised curve ridges',
    'provenance': 'Original geometry and render authored in repository Python with Blender; no external art.',
}
MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, indent=2))
