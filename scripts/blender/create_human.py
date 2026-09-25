"""Create the authored 18Bro human cast in Blender, with no external assets.

blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
        --python scripts/blender/create_human.py

The .blend is an editable source scene. Exported role/hair meshes are selected by
the game; every role shares the same weighted body and locomotion skeleton.
"""
from pathlib import Path
import math
import json
import struct
import hashlib
import sys
import bpy
from mathutils import Vector, Euler

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/characters/human/human.blend'
OUTPUT = ROOT / 'dist/assets/models/human-v1.glb'
REVIEW = ROOT / 'release/human-review'
for directory in (SOURCE.parent, OUTPUT.parent, REVIEW):
    directory.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 48
scene.frame_start = 0
scene.frame_end = 48
collection = bpy.data.collections.new('EXPORT_HUMAN')
scene.collection.children.link(collection)

# White skin/clothes cells allow runtime tints without altering facial features.
# Clothing shade cells retain shirt/trouser contrast under any palette tint.
COLORS = {
    'skin': (1, .94, .88, 1), 'shirt': (1, 1, 1, 1),
    'trousers': (.22, .27, .32, 1), 'seam': (.70, .75, .76, 1),
    'hair': (.060, .074, .079, 1), 'shoe': (.08, .10, .12, 1),
    'sole': (.16, .19, .21, 1), 'eye': (.06, .07, .07, 1),
    'cream': (.96, .91, .78, 1), 'lip': (.36, .21, .16, 1),
    'navy': (.055, .13, .20, 1), 'gold': (.95, .63, .12, 1),
    'green': (.035, .37, .25, 1), 'orange': (.96, .29, .065, 1),
    'visor': (.16, .26, .30, 1), 'light': (.68, .79, .80, 1),
}
entries = list(COLORS)
palette = bpy.data.images.new('human_palette_256', width=256, height=256, alpha=False)
palette.colorspace_settings.name = 'sRGB'
pixels = []
for y in range(256):
    for x in range(256):
        pixels.extend(COLORS[entries[(y // 64) * 4 + x // 64]])
palette.pixels[:] = pixels
palette.pack()
materials = {}
for slot in ('skin', 'clothes', 'details'):
    material = bpy.data.materials.new(slot)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .87
    shader.inputs['Specular IOR Level'].default_value = .16
    tex = material.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = palette
    tex.interpolation = 'Closest'
    material.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])
    materials[slot] = material


class Shape:
    """A material-coherent mesh builder with explicit vertex weights."""
    def __init__(self, name, slot):
        self.name, self.slot = name, slot
        self.vertices, self.faces, self.uvs, self.weights = [], [], [], []

    def add(self, vertices, faces, color, weights, smooth=True):
        first = len(self.vertices)
        self.vertices.extend(tuple(v) for v in vertices)
        self.weights.extend(weights(Vector(v)) if callable(weights) else weights.copy() for v in vertices)
        index = entries.index(color)
        uv = ((index % 4 + .5) / 4, (index // 4 + .5) / 4)
        for face in faces:
            self.faces.append((tuple(first + i for i in face), smooth))
            self.uvs.append(uv)

    def rings(self, rings, color, weights, sides=12, smooth=True):
        # z, radius-x, radius-y, center-x, center-y; deliberate superellipse
        # fronts give cheeks, shirt fronts and shoes their designed silhouette.
        vertices, faces = [], []
        for ring in rings:
            z, rx, ry, cx, cy = ring[:5]
            power = ring[5] if len(ring) > 5 else 1
            for i in range(sides):
                angle = 2 * math.pi * i / sides
                c, s = math.cos(angle), math.sin(angle)
                vertices.append((cx + rx * math.copysign(abs(c) ** power, c),
                                 cy + ry * math.copysign(abs(s) ** power, s), z))
        for j in range(len(rings) - 1):
            for i in range(sides):
                a, b = j * sides + i, j * sides + (i + 1) % sides
                faces.append((a, b, b + sides, a + sides))
        faces.extend((tuple(reversed(range(sides))), tuple(range((len(rings)-1)*sides, len(rings)*sides))))
        self.add(vertices, faces, color, weights, smooth)

    def panel(self, points, color, weights, thickness=.007):
        # Small hard seams are explicit solids, not floating single-sided cards.
        vertices = list(points) + [(x, y + thickness, z) for x, y, z in points]
        count = len(points)
        faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
        for i in range(count):
            j = (i + 1) % count
            faces.append((i, j, j + count, i + count))
        self.add(vertices, faces, color, weights, False)

    def build(self):
        data = bpy.data.meshes.new(self.name + '_mesh')
        data.from_pydata(self.vertices, [], [f[0] for f in self.faces])
        data.update()
        data.materials.append(materials[self.slot])
        uv = data.uv_layers.new(name='PaletteUV')
        for polygon, xy, (_, smooth) in zip(data.polygons, self.uvs, self.faces):
            polygon.use_smooth = smooth
            for index in polygon.loop_indices:
                uv.data[index].uv = xy
        obj = bpy.data.objects.new(self.name, data)
        collection.objects.link(obj)
        groups = {}
        for i, weights in enumerate(self.weights):
            total = sum(weights.values())
            assert abs(total - 1) < 1e-6, (self.name, i, weights)
            for name, weight in weights.items():
                if weight < 1e-6:
                    continue
                if name not in groups:
                    groups[name] = obj.vertex_groups.new(name=name)
                groups[name].add([i], weight, 'REPLACE')
        return obj


skin = Shape('human_skin', 'skin')
clothes = Shape('human_clothes', 'clothes')
details = Shape('human_details', 'details')
short_hair = Shape('hair_short', 'details')
bob_hair = Shape('hair_bob', 'details')
police = Shape('role_police', 'details')
cashier = Shape('role_cashier', 'details')
rider = Shape('role_rider', 'details')

def blend(a, b, value):
    t = max(0, min(1, value))
    return {a: 1-t, b: t}

def torso_weights(co):
    return blend('hips', 'spine', (co.z - 1.01) / .27)

# A shirt cut across shoulder, chest, waist and hem. The pelvis tapers into
# continuous trouser legs rather than cylindrical joints or separate balls.
clothes.rings([
    (1.035,.250,.154,0,.009,.8), (1.08,.252,.157,0,.008,.83),
    (1.26,.285,.18,0,0,.87), (1.46,.318,.19,0,-.012,.88),
    (1.61,.332,.15,0,0,.85), (1.70,.12,.09,0,0,1),
], 'shirt', torso_weights, 12)
clothes.rings([
    (.85,.18,.105,0,.015), (.93,.254,.168,0,.012,.9),
    (1.03,.254,.158,0,.008,.8),
], 'trousers', {'hips': 1}, 10)
skin.rings([(1.65,.079,.076,0,0), (1.78,.084,.079,0,0),
            (1.84,.091,.082,0,-.002)], 'skin', lambda co: blend('spine','head',(co.z-1.73)/.09), 10)

# A cheek-and-jaw shaped head, slightly larger than anatomical proportion so
# the expression reads at street distance. No sphere primitives are used.
skin.rings([
    (1.78,.072,.065,0,-.015), (1.83,.126,.10,0,-.027,.85),
    (1.91,.178,.131,0,-.025,.88), (2.025,.194,.145,0,-.010,.87),
    (2.12,.181,.143,0,.002,.94), (2.19,.133,.111,0,.01),
    (2.22,.055,.049,0,.01),
], 'skin', {'head': 1}, 12)
for sign, side in ((-1,'L'),(1,'R')):
    skin.rings([(1.925,.028,.031,sign*.188,0), (1.967,.041,.037,sign*.19,-.002),
                (2.023,.036,.034,sign*.188,0), (2.05,.018,.025,sign*.181,.001)],
               'skin', {'head': 1}, 6)
    # Almond eyes, cream outer corners, compact brows; all details sit on the
    # actual face surface and survive camera movement without z fighting.
    x = sign*.080
    details.panel([(x-.034,-.145,2.025),(x,-.160,2.013),
                   (x+.035,-.145,2.025),(x,-.159,2.035)],'cream',{'head':1})
    details.panel([(x-.014,-.163,2.018),(x+.014,-.163,2.018),
                   (x+.014,-.163,2.036),(x-.014,-.163,2.036)],'eye',{'head':1})
    details.panel([(x-.043,-.149,2.066),(x+.039,-.149,2.075),
                   (x+.041,-.146,2.087),(x-.040,-.147,2.079)],'hair',{'brow_'+side:1})
skin.add([(-.025,-.145,2.055),(.025,-.145,2.055),(.038,-.160,1.968),
          (0,-.204,1.975),(-.038,-.160,1.968)],
         [(0,1,3),(1,2,3),(2,4,3),(4,0,3),(4,2,1,0)], 'skin', {'head':1})
details.panel([(-.036,-.167,1.921),(-.025,-.171,1.915),(.025,-.171,1.915),
               (.036,-.167,1.921),(.025,-.171,1.927),(-.025,-.171,1.927)],'eye',{'mouth':1})

for sign, side in ((-1,'L'),(1,'R')):
    x = sign*.16
    def legweights(co, side=side):
        if co.z > .79:
            return blend('leg_'+side,'hips',(co.z-.79)/.17)
        return blend('shin_'+side,'leg_'+side,(co.z-.43)/.13)
    clothes.rings([
        (.115,.073,.074,x,.018), (.22,.080,.086,x,.016),
        (.37,.105,.104,x,.009), (.48,.100,.096,x,-.006),
        (.57,.112,.108,x,-.003), (.75,.14,.139,x,.01),
        (.88,.14,.149,x,.015), (.96,.115,.135,x,.006),
    ], 'trousers', legweights, 8)
    # Toe box, instep and heel are shaped as a shoe last; sole stays level at
    # stance through an authored ankle rotation in every gait frame.
    details.rings([
        (.015,.107,.181,x,-.052,.73), (.048,.11,.187,x,-.054,.74),
        (.10,.104,.178,x,-.052,.79), (.155,.078,.105,x,.006,.9),
    ],'shoe',{'foot_'+side:1},8)
    details.rings([(.014,.107,.181,x,-.052,.73),(.037,.111,.186,x,-.054,.73)],
                  'sole',{'foot_'+side:1},8)
    details.panel([(x-.058,-.089,.139),(x+.058,-.089,.139),
                   (x+.054,-.059,.153),(x-.054,-.059,.153)],'light',{'foot_'+side:1},.002)

    ax = sign*.34
    clothes.rings([
        (1.34,.094,.092,ax,0), (1.37,.103,.103,ax,0),
        (1.52,.126,.127,ax,0), (1.63,.113,.116,sign*.332,0),
        (1.685,.057,.075,sign*.295,0),
    ], 'shirt', {'arm_'+side:1}, 8)
    clothes.rings([(1.337,.094,.093,ax,0),(1.367,.103,.104,ax,0)],
                  'seam',{'arm_'+side:1},8)
    def armweights(co, side=side):
        return blend('forearm_'+side,'arm_'+side,(co.z-1.265)/.095)
    skin.rings([
        (.978,.055,.055,ax,-.012), (1.07,.071,.073,ax,-.009),
        (1.20,.087,.085,ax,-.006), (1.31,.083,.082,ax,-.002),
        (1.39,.082,.084,ax,0),
    ], 'skin', armweights, 8)
    # Low-poly relaxed hands have a thumb web and tapered finger silhouette.
    skin.rings([
        (.831,.036,.037,ax,-.021,.82), (.861,.059,.044,ax,-.02,.75),
        (.916,.065,.049,ax,-.018,.7), (.964,.057,.055,ax,-.016,.86),
        (.997,.049,.051,ax,-.013),
    ],'skin',{'hand_'+side:1},6)
    skin.rings([(.881,.016,.025,ax-sign*.061,-.026),
                (.937,.026,.03,ax-sign*.067,-.016),
                (.966,.019,.026,ax-sign*.052,-.012)],'skin',{'hand_'+side:1},6)

# Tailored collar and placket are shared by the public, store and police cast.
for sign in (-1,1):
    details.panel([(sign*.023,-.110,1.674),(sign*.118,-.108,1.67),
                   (sign*.157,-.158,1.568),(sign*.064,-.179,1.603)],'cream',{'spine':1})
    clothes.rings([(1.005,.270,.174,0,.009,.8),(1.068,.268,.173,0,.009,.8)],
                  'trousers',{'hips':1},10) if sign == -1 else None
for z,y in ((1.51,-.202),(1.38,-.199),(1.24,-.185)):
    details.panel([(-.011,y,z-.011),(.011,y,z-.011),(.011,y,z+.011),(-.011,y,z+.011)],
                  'cream',{'spine':1})

# Hair choices share the same face and allow a distinct crowd silhouette.
short_hair.rings([(2.105,.198,.159,0,.005),(2.17,.168,.142,0,.012),
                  (2.225,.108,.091,0,.015),(2.248,.028,.025,0,.015)],'hair',{'head':1},12)
short_hair.panel([(-.165,-.076,2.115),(-.132,-.137,2.145),(.067,-.157,2.15),
                  (.124,-.11,2.19),(-.045,-.157,2.18)],'hair',{'head':1},.025)
# Bob cap and side/back curtain: the open front never hides the face.
bob_hair.rings([(2.12,.197,.157,0,.015),(2.20,.16,.135,0,.02),
                (2.25,.096,.081,0,.02),(2.27,.026,.025,0,.02)],'hair',{'head':1},12)
verts, faces = [], []
for z,rx,ry in ((1.78,.185,.14),(1.91,.216,.166),(2.115,.197,.157)):
    for j in range(11):
        angle = -.10*math.pi + j*1.20*math.pi/10
        verts.append((rx*math.cos(angle),.015+ry*math.sin(angle),z))
for row in range(2):
    for j in range(10):
        a=row*11+j
        faces.append((a,a+1,a+12,a+11))
bob_hair.add(verts,faces,'hair',{'head':1})

# Police uniform details: shaped peaked cap, belt, badge, shoulder tabs,
# pocket flaps and radio. The ordinary shirt mesh is tinted pale police blue.
police.rings([(2.145,.198,.163,0,.014),(2.185,.211,.175,0,.015),
              (2.263,.194,.163,0,.015),(2.283,.141,.122,0,.017)],'navy',{'head':1},14)
police.panel([(-.194,-.072,2.154),(-.172,-.222,2.126),(0,-.285,2.110),
              (.172,-.222,2.126),(.194,-.072,2.154)],'navy',{'head':1},.03)
police.panel([(-.032,-.166,2.210),(0,-.181,2.192),(.032,-.166,2.210),
              (.026,-.167,2.246),(-.026,-.167,2.246)],'gold',{'head':1})
police.rings([(1.001,.276,.180,0,.009,.8),(1.082,.276,.180,0,.009,.8)],'navy',{'hips':1},10)
for sign in (-1,1):
    police.panel([(sign*.115,-.188,1.43),(sign*.253,-.163,1.43),
                  (sign*.253,-.171,1.51),(sign*.115,-.203,1.51)],'navy',{'spine':1})
    police.panel([(sign*.15,-.080,1.666),(sign*.306,-.046,1.665),
                  (sign*.31,-.088,1.632),(sign*.168,-.115,1.641)],'navy',{'spine':1})
police.panel([(-.232,-.196,1.528),(-.195,-.209,1.501),(-.155,-.207,1.528),
              (-.16,-.207,1.579),(-.225,-.196,1.579)],'gold',{'spine':1})
police.panel([(.139,-.174,1.10),(.255,-.151,1.10),(.247,-.163,1.235),(.142,-.187,1.235)],
             'navy',torso_weights,.055)
police.panel([(-.034,-.182,1.028),(.034,-.182,1.028),(.034,-.182,1.064),(-.034,-.182,1.064)],
             'gold',{'hips':1})

# The apron is a curved quad grid. A single concave polygon would cut through
# the convex shirt at its chest and expose triangular white holes in motion.
verts, faces = [], []
for z,width,front in ((.843,.277,-.179),(1.08,.233,-.211),(1.34,.178,-.239),
                       (1.50,.155,-.240),(1.625,.123,-.180)):
    for column in range(5):
        u=(column-2)/2
        verts.append((width*u,front+.026*u*u,z))
for row in range(4):
    for column in range(4):
        a=row*5+column
        faces.append((a,a+1,a+6,a+5))
cashier.add(verts,faces,'green',torso_weights)
cashier.panel([(-.140,-.253,1.485),(.140,-.253,1.485),
               (.149,-.253,1.435),(-.149,-.253,1.435)],'orange',{'spine':1})
cashier.panel([(-.109,-.249,1.365),(-.006,-.255,1.365),
               (-.006,-.255,1.415),(-.103,-.249,1.415)],'cream',{'spine':1})
cashier.panel([(-.101,-.223,1.114),(.101,-.223,1.114),
               (.116,-.244,1.264),(-.116,-.244,1.264)],'light',torso_weights,.007)
cashier.rings([(2.125,.185,.150,0,.01),(2.177,.188,.154,0,.01)],'green',{'head':1},12)
cashier.panel([(-.179,-.101,2.135),(-.148,-.227,2.11),(0,-.257,2.10),
               (.148,-.227,2.11),(.179,-.101,2.135)],'green',{'head':1},.024)

# Original comic anger mark: four thick angular corners with a clear central
# gap. It is buried inside the neutral head and shares the mouth transform.
# The scream's vertical expansion reveals it above the visor; all other clips
# restore it inside the head, so other human roles and calm cashiers stay clean.
for sx,sz in ((-1,-1),(-1,1),(1,-1),(1,1)):
    corner=[(.018,.065),(.039,.065),(.039,.038),(.065,.038),(.065,.017),(.018,.017)]
    cashier.panel([(.076+sx*x,-.104,2.001+sz*z/6.0) for x,z in corner],
                  'orange',{'mouth':1},.007)

# A scooter helmet has a open face and a rear shell descending below the skull.
rider.rings([(2.13,.21,.176,0,.008),(2.19,.201,.170,0,.01),
             (2.265,.139,.12,0,.012),(2.293,.031,.029,0,.012)],'orange',{'head':1},12)
verts, faces = [], []
for z,rx,ry in ((1.99,.198,.163),(2.13,.21,.176)):
    for j in range(11):
        angle = -.07*math.pi + j*1.14*math.pi/10
        verts.append((rx*math.cos(angle),.008+ry*math.sin(angle),z))
for j in range(10):
    faces.append((j,j+1,j+12,j+11))
rider.add(verts,faces,'orange',{'head':1})
rider.panel([(-.176,-.124,2.137),(-.13,-.202,2.135),(.13,-.202,2.135),
             (.176,-.124,2.137),(.14,-.187,2.157),(-.14,-.187,2.157)],'visor',{'head':1},.012)

# Give cloth applique enough clearance for the maximum spine bend.
for shape in (police,):
    for index,(x,y,z) in enumerate(shape.vertices):
        if y < -.13 and 1.09 < z < 1.63:
            shape.vertices[index]=(x,y-.030,z)
for index,(x,y,z) in enumerate(short_hair.vertices):
    if y < -.10 and 2.11 < z < 2.2:
        short_hair.vertices[index]=(x,y-.020,z+.008)
shapes = [skin,clothes,details,short_hair,bob_hair,police,cashier,rider]
parts = [shape.build() for shape in shapes]

# Anatomical chain pivots match the existing 2.2-unit human choreography.
# Bone rest bases are preserved in export; pose rotations are deltas in each
# bone's own basis, never absolute replacement of a bind quaternion.
bones = {
    'root': ((0,0,0),(0,0,.15),None),
    'hips': ((0,0,.92),(0,0,1.12),'root'),
    'spine': ((0,0,1.12),(0,0,1.72),'hips'),
    'head': ((0,0,1.78),(0,0,2.16),'spine'),
    'mouth': ((0,-.17,1.921),(0,-.17,1.971),'head'),
    'brow_L': ((-.080,-.147,2.078),(-.080,-.147,2.128),'head'),
    'brow_R': ((.080,-.147,2.078),(.080,-.147,2.128),'head'),
}
for sign, side in ((-1,'L'),(1,'R')):
    bones.update({
        'arm_'+side: ((sign*.34,0,1.61),(sign*.34,0,1.31),'spine'),
        'forearm_'+side: ((sign*.34,0,1.31),(sign*.34,-.012,.98),'arm_'+side),
        'hand_'+side: ((sign*.34,-.012,.98),(sign*.34,-.02,.84),'forearm_'+side),
        'leg_'+side: ((sign*.16,0,.92),(sign*.16,0,.48),'hips'),
        'shin_'+side: ((sign*.16,0,.48),(sign*.16,0,.08),'leg_'+side),
        'foot_'+side: ((sign*.16,0,.08),(sign*.16,-.18,.08),'shin_'+side),
    })
bones.update({
    'socket_hat': ((0,0,2.13),(0,0,2.23),'head'),
    'socket_bag': ((-.28,.02,1.12),(-.28,.02,1.22),'hips'),
    'socket_back': ((0,.20,1.45),(0,.20,1.55),'spine'),
    'socket_carry_L': ((-.34,-.018,.90),(-.34,-.018,1.00),'hand_L'),
    'socket_carry_R': ((.34,-.018,.90),(.34,-.018,1.00),'hand_R'),
})
armdata = bpy.data.armatures.new('human_rig_data')
rig = bpy.data.objects.new('human_rig',armdata)
collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tip,parent) in bones.items():
    bone = armdata.edit_bones.new(name)
    bone.head, bone.tail = head, tip
    if parent:
        bone.parent = armdata.edit_bones[parent]
    bone.use_deform = not name.startswith('socket_')
bpy.ops.object.mode_set(mode='OBJECT')
for obj in parts:
    obj.parent = rig
    modifier = obj.modifiers.new('human_skinning','ARMATURE')
    modifier.object = rig
    obj['role'] = obj.name.removeprefix('role_') if obj.name.startswith('role_') else 'shared'

rest_bases = {name: bone.matrix_local.to_quaternion() for name,bone in armdata.bones.items()}
animated = list(bones)
for pose in rig.pose.bones:
    pose.rotation_mode = 'QUATERNION'

def reset_pose():
    for pose in rig.pose.bones:
        pose.location = (0,0,0)
        pose.rotation_quaternion = (1,0,0,0)
        pose.scale = (1,1,1)

def rotate(name,x=0,y=0,z=0):
    base = rest_bases[name]
    rig.pose.bones[name].rotation_quaternion = base.inverted() @ Euler((x,y,z),'XYZ').to_quaternion() @ base

def translate(name,x=0,y=0,z=0):
    rig.pose.bones[name].location = rest_bases[name].inverted() @ Vector((x,y,z))

def leg_ik(side, foot_y, foot_z, hip_z):
    """Two-bone sagittal solver with forward knees and planted ankle level."""
    dy, dz = foot_y, foot_z-hip_z
    distance = min(.839, max(.041, math.hypot(dy,dz)))
    knee = math.acos(max(-1,min(1,(distance*distance-.44*.44-.40*.40)/(2*.44*.40))))
    hip = math.atan2(dy,-dz)-math.atan2(.40*math.sin(knee),.44+.40*math.cos(knee))
    rotate('leg_'+side,hip)
    rotate('shin_'+side,knee)
    rotate('foot_'+side,-hip-knee)

def support_arm(side, target):
    """Reach the support hand inward/backward to the game's hip carry point."""
    sign=-1 if side=='L' else 1
    start=Vector((sign*.34,0,1.61))
    lower_rest=Vector((0,-.018,-.41))
    length_a,length_b=.30,lower_rest.length
    offset=Vector(target)-start
    distance=min(length_a+length_b-.001,max(abs(length_a-length_b)+.001,offset.length))
    direction=offset.normalized()
    pole=Vector((0,1,0))
    bend=(pole-direction*pole.dot(direction)).normalized()
    along=(length_a*length_a-length_b*length_b+distance*distance)/(2*distance)
    elbow=direction*along+bend*math.sqrt(max(0,length_a*length_a-along*along))
    upper_q=Vector((0,0,-1)).rotation_difference(elbow.normalized())
    lower_q=lower_rest.normalized().rotation_difference((upper_q.inverted()@(direction*distance-elbow)).normalized())
    for name,delta in (('arm_'+side,upper_q),('forearm_'+side,lower_q)):
        base=rest_bases[name]
        rig.pose.bones[name].rotation_quaternion=base.inverted()@delta@base
    rotate('hand_'+side)

def pose_clip(clip, phase):
    reset_pose()
    wave = math.sin(phase)
    if clip in ('walk','run','chase','carry','carry_left','carry_right'):
        running = clip in ('run','chase')
        carrying = clip == 'carry'
        hip_z = .92 + ((-.075+.020*math.cos(phase*2)) if running else (-.041+.008*math.cos(phase*2)))
        translate('hips',z=hip_z-.92)
        rotate('hips',z=.016*wave)
        rotate('spine',x=.075 if running else .02,y=.045*wave)
        rotate('head',x=-.045 if running else -.012,y=-.026*wave)
        for side,offset in (('L',0),('R',math.pi)):
            p=phase+offset
            # Ease toe-off instead of changing ankle height velocity abruptly;
            # leave enough knee bend at contact to avoid a reach-limit snap.
            swing=max(0,-math.sin(p))
            leg_ik(side,-(.275 if running else .21)*math.cos(p),
                   .08+(.17*swing**1.5 if running else .075*swing),hip_z)
            rotate('arm_'+side,x=-.98 if carrying else (.61 if running else .32)*math.cos(p),z=(-.035 if side=='L' else .035))
            rotate('forearm_'+side,x=-.60 if carrying else (-.80 if running else -.23)-.10*math.sin(p))
            rotate('hand_'+side,x=.12 if carrying else .025)
        if clip in ('carry_left','carry_right'):
            side='L' if clip=='carry_left' else 'R'
            support_arm(side,(-.652 if side=='L' else .652,.250,1.375-(hip_z-.92)))
    elif clip == 'ride':
        translate('hips',z=-.28)
        rotate('spine',x=.17)
        rotate('head',x=-.15,y=.015*wave)
        for side in ('L','R'):
            rotate('leg_'+side,x=-1.12)
            rotate('shin_'+side,x=1.47)
            rotate('foot_'+side,x=-.35)
            rotate('arm_'+side,x=-1.10,z=-.10 if side=='L' else .10)
            rotate('forearm_'+side,x=-.30)
    elif clip == 'crouch':
        translate('hips',z=-.43)
        rotate('spine',x=.22)
        rotate('head',x=-.18)
        for side in ('L','R'):
            leg_ik(side,-.09,.08,.49)
            rotate('arm_'+side,x=-1.10)
            rotate('forearm_'+side,x=-.18)
    elif clip == 'panic':
        # Hold both hands raised throughout the shout. Alarm is communicated
        # by a planted, side-to-side torso recoil and a tense head/brow/mouth
        # expression, rather than alternating arm pumps that read as dancing.
        alarm=.5-.5*math.cos(phase*2)
        hip_z=.875-.010*alarm
        translate('hips',z=hip_z-.92)
        rotate('spine',x=-.115-.025*alarm,y=.145*wave,z=.025*wave)
        rotate('head',x=-.035,y=.035*wave,z=-.035*wave)
        for side in ('L','R'):
            leg_ik(side,0,.08,hip_z)
        rotate('arm_L',x=-2.13-.025*alarm,y=.40,z=-.09)
        rotate('forearm_L',x=-.37-.025*alarm)
        rotate('hand_L',x=.12,z=-.11)
        rotate('arm_R',x=-2.04-.025*alarm,y=-.40,z=.09)
        rotate('forearm_R',x=-.42-.025*alarm)
        rotate('hand_R',x=.12,z=.11)
        for side,sign in (('L',-1),('R',1)):
            rotate('brow_'+side,y=-sign*.40)
            translate('brow_'+side,y=-.009,z=-.016)
        rig.pose.bones['mouth'].scale=(1.60,5.45+.35*alarm,1)
        translate('mouth',y=-.015,z=-.012)
    else:
        translate('hips',z=-.006+.002*wave)
        rotate('spine',x=.008*wave)
        rotate('head',y=.023*wave)
        for side in ('L','R'):
            leg_ik(side,0,.08,.914+.002*wave)
            rotate('arm_'+side,x=-.07,z=-.025 if side=='L' else .025)
            rotate('forearm_'+side,x=-.16)
        if clip == 'alert':
            rotate('spine',x=.08)
            rotate('head',x=-.09,y=.035*wave)
            rotate('arm_R',x=-1.45+.045*wave,z=.17)
            rotate('forearm_R',x=-.12)
            rotate('arm_L',x=-.30)
            rotate('forearm_L',x=-.70)
        elif clip == 'clerk':
            rotate('head',x=.035,y=.07*wave)
            rotate('arm_L',x=-.65,z=-.08)
            rotate('arm_R',x=-.72,z=.08)
            rotate('forearm_L',x=-.64+.05*wave)
            rotate('forearm_R',x=-.56-.05*wave)

CLIPS = {'idle':48,'walk':32,'run':20,'chase':20,'alert':40,'clerk':48,'ride':48,
         'carry':36,'carry_left':36,'carry_right':36,'crouch':24,'panic':32}
rig.animation_data_create()
for clip,frames in CLIPS.items():
    rig.animation_data.action = None
    previous={}
    for frame in range(frames*2+1):
        pose_clip(clip,2*math.pi*frame/(frames*2))
        for name in animated:
            bone = rig.pose.bones[name]
            if name in previous and bone.rotation_quaternion.dot(previous[name])<0:
                bone.rotation_quaternion.negate()
            previous[name]=bone.rotation_quaternion.copy()
            bone.keyframe_insert('rotation_quaternion',frame=frame,group=name)
            bone.keyframe_insert('location',frame=frame,group=name)
            bone.keyframe_insert('scale',frame=frame,group=name)
    action = rig.animation_data.action
    action.name = clip
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for curve in channelbag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
    track = rig.animation_data.nla_tracks.new()
    track.name = clip
    track.strips.new(clip,0,action)
    track.mute = True
    rig.animation_data.action = None
reset_pose()
scene.frame_set(1)
bpy.context.view_layer.update()

# Save the source with a useful studio camera. Only the explicit collection is
# exported. Role extras remain present in GLB and are hidden by runtime policy.
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 640
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.world.color = (.22,.22,.22)
scene.view_settings.view_transform = 'AgX'
def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,location,power,size in (
    ('REVIEW_key',(-3,-4,5),500,4),('REVIEW_fill',(4,-2,3),350,3),('REVIEW_rim',(1,3,4),650,3)):
    data=bpy.data.lights.new(name,'AREA')
    data.energy, data.shape, data.size = power,'DISK',size
    light=bpy.data.objects.new(name,data)
    scene.collection.objects.link(light)
    light.location=location
    aim(light,(0,0,1.2))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005))
floor=bpy.context.object
floor.name='REVIEW_floor'
mat=bpy.data.materials.new('REVIEW_ground')
mat.diffuse_color=(.36,.41,.37,1)
floor.data.materials.append(mat)
camera_data=bpy.data.cameras.new('REVIEW_camera')
camera=bpy.data.objects.new('REVIEW_camera',camera_data)
scene.collection.objects.link(camera)
scene.camera=camera
camera_data.type='ORTHO'
camera_data.ortho_scale=2.75
camera.location=(3,-6,3.2)
aim(camera,(0,0,1.15))

def show_role(role='civilian',hair='short'):
    for obj in parts:
        obj.hide_render = (obj.name.startswith('role_') and obj.name != 'role_'+role) or (obj.name.startswith('hair_') and (role in ('police','rider') or obj.name != 'hair_'+hair))
        obj.hide_viewport = obj.hide_render

bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:
    obj.hide_viewport=False
    obj.hide_render=False
    obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,
    export_force_sampling=True,export_optimize_animation_size=False,
    export_skins=True,export_all_influences=False,export_def_bones=False,
    export_yup=True,export_cameras=False,export_lights=False,export_extras=True)

# Validate the serialized artifact, mesh weights and every authored pose before
# rendering. Bounds are taken from the actual rest geometry in glTF axes.
blob=OUTPUT.read_bytes()
assert blob[:4]==b'glTF'
json_length=struct.unpack_from('<I',blob,12)[0]
gltf=json.loads(blob[20:20+json_length])
node_names={node.get('name') for node in gltf['nodes']}
clips=[clip['name'] for clip in gltf['animations']]
assert set(CLIPS)==set(clips),(CLIPS,clips)
assert set(bones).issubset(node_names)
assert not any('uri' in buffer for buffer in gltf.get('buffers',[]))
assert not any('uri' in image for image in gltf.get('images',[]))
mesh_triangles={obj.name:sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in parts}
triangles=sum(mesh_triangles.values())
shared_triangles=sum(mesh_triangles[name] for name in ('human_skin','human_clothes','human_details'))
visible_triangles={
    'civilian_short':shared_triangles+mesh_triangles['hair_short'],
    'civilian_bob':shared_triangles+mesh_triangles['hair_bob'],
    'police':shared_triangles+mesh_triangles['role_police'],
    'cashier':shared_triangles+mesh_triangles['hair_short']+mesh_triangles['role_cashier'],
    'rider':shared_triangles+mesh_triangles['role_rider'],
}
assert triangles<=2600,triangles
assert max(visible_triangles.values())<=2000,visible_triangles
assert len(bones)<=24,len(bones)
assert len(blob)<1024*1024,len(blob)
for obj in parts:
    assert tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1)
    for vertex in obj.data.vertices:
        assert len(vertex.groups)<=4
        assert abs(sum(group.weight for group in vertex.groups)-1)<1e-5
export_triangles=sum(gltf['accessors'][primitive['indices']]['count']//3 for mesh in gltf['meshes'] for primitive in mesh['primitives'])
assert export_triangles==triangles,(export_triangles,triangles)
coords=[v.co for obj in parts for v in obj.data.vertices]
minimum=[min(co[i] for co in coords) for i in range(3)]
maximum=[max(co[i] for co in coords) for i in range(3)]
rest_joints={name:{'headBlender':list(bone.head_local),'tailBlender':list(bone.tail_local),
    'worldRestQuaternionBlenderWXYZ':list(bone.matrix_local.to_quaternion()),'parent':bone.parent.name if bone.parent else None}
    for name,bone in armdata.bones.items()}
sample_bounds={}
depsgraph=bpy.context.evaluated_depsgraph_get()
for clip,frames in CLIPS.items():
    rig.animation_data.action=bpy.data.actions[clip]
    maxima=[]
    raised_hands=[]
    for frame in range(frames*2+1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        points=[]
        for obj in parts[:3]:
            evaluated=obj.evaluated_get(depsgraph)
            temporary=evaluated.to_mesh()
            points.extend(vertex.co.copy() for vertex in temporary.vertices)
            evaluated.to_mesh_clear()
        assert all(math.isfinite(c) for p in points for c in p)
        assert max(p.length for p in points)<3.2,(clip,frame)
        maxima.append((min(p.z for p in points),max(p.z for p in points)))
        if clip=='panic':
            raised_hands.extend(rig.pose.bones['hand_'+side].matrix.translation.z for side in ('L','R'))
    sample_bounds[clip]={'minZ':min(p[0] for p in maxima),'maxZ':max(p[1] for p in maxima),'sampledFrames':frames*2+1}
    if clip=='panic':
        assert min(raised_hands)>1.82,('panic arms fall below alarm pose',min(raised_hands))
        sample_bounds[clip]['minimumRaisedHandZ']=min(raised_hands)
rig.animation_data.action=None
reset_pose()
scene.frame_set(1)

manifest={
    'assetId':'human-v1','rigVersion':3,'source':str(SOURCE.relative_to(ROOT)).replace('\\','/'),
    'output':str(OUTPUT.relative_to(ROOT)).replace('\\','/'),
    'sha256':hashlib.sha256(blob).hexdigest(),'blenderVersion':bpy.app.version_string,
    'exportPreset':'18bro-blender-5.2-human-v3','bytes':len(blob),
    'bounds':{'min':[minimum[0],minimum[2],-maximum[1]],'max':[maximum[0],maximum[2],-minimum[1]]},
    'boundsBlenderZUp':{'min':minimum,'max':maximum},'triangles':triangles,'materials':3,
    'bones':len(bones),'clips':clips,'sockets':[name for name in bones if name.startswith('socket_')],
    'clipMetadata':{name:{'duration':frames/24,'loop':True} for name,frames in CLIPS.items()},
    'provenance':'Original authored Blender human family generated for the 18Bro community game; no imported models, textures, logos or animations.',
}
(SOURCE.parent/'manifest-entry.json').write_text(json.dumps(manifest,indent=2)+'\n')
report={**manifest,'meshTriangles':mesh_triangles,'sampledPoseBounds':sample_bounds,
    'visibleTriangles':visible_triangles,'clipDurationSeconds':{name:frames/24 for name,frames in CLIPS.items()},
    'restJoints':rest_joints,'maxWeights':max(len(v.groups) for o in parts for v in o.data.vertices)}
(REVIEW/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('HUMAN_VALIDATION',json.dumps({key:value for key,value in report.items() if key!='restJoints'}))

# Add tint multipliers to preview the same skin/clothes palette values that
# runtime Material.color will apply; these are only saved into source after
# GLB export, keeping the exported atlas independently tintable.
def review_tint(slot,color):
    mat=materials[slot]
    shader=mat.node_tree.nodes.get('Principled BSDF')
    tex=next(node for node in mat.node_tree.nodes if node.type=='TEX_IMAGE')
    node=mat.node_tree.nodes.get('REVIEW_tint')
    if node is None:
        node=mat.node_tree.nodes.new('ShaderNodeMixRGB')
        node.name='REVIEW_tint'
        node.blend_type='MULTIPLY'
        node.inputs[0].default_value=1
        mat.node_tree.links.new(tex.outputs['Color'],node.inputs[1])
        mat.node_tree.links.new(node.outputs[0],shader.inputs['Base Color'])
    node.inputs[2].default_value=(*color,1)

review_tint('skin',(.61,.40,.27))
review_tint('clothes',(.45,.70,.85))
show_role('police')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))

if '--skip-render' in sys.argv:
    print('HUMAN_COMPLETE',SOURCE,OUTPUT,REVIEW)
    raise SystemExit(0)

views=[
    ('police-front','police','short','idle',1,(0,-6,2.6),(.45,.70,.85)),
    ('police-three-quarter','police','short','idle',1,(3,-6,3.2),(.45,.70,.85)),
    ('police-run','police','short','run',5,(3,-6,3),(.45,.70,.85)),
    ('police-carry','police','short','carry',10,(3,-6,3),(.45,.70,.85)),
    ('police-carry-left','police','short','carry_left',10,(3,-6,3),(.45,.70,.85)),
    ('police-crouch','police','short','crouch',1,(3,-6,3),(.45,.70,.85)),
    ('cashier','cashier','short','alert',8,(3,-6,3.0),(.87,.84,.67)),
    ('cashier-panic','cashier','short','panic',16,(3,-6,3.0),(.87,.84,.67)),
    ('pedestrian','civilian','bob','walk',9,(3,-6,3.1),(.81,.28,.19)),
    ('rider','rider','short','ride',1,(3,-6,3.2),(.35,.64,.42)),
    ('rear','civilian','short','walk',17,(0,6,2.6),(.72,.54,.27)),
]
for name,role,hair,clip,frame,location,tint in views:
    show_role(role,hair)
    review_tint('clothes',tint)
    rig.animation_data.action=bpy.data.actions[clip]
    scene.frame_set(frame)
    camera.location=location
    aim(camera,(0,0,1.12))
    scene.render.filepath=str(REVIEW/(name+'.png'))
    bpy.ops.render.render(write_still=True)
print('HUMAN_COMPLETE',SOURCE,OUTPUT,REVIEW)
