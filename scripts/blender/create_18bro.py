"""Build the authored 18Bro character and complete in-place animation library.

Run from any directory:
  blender --background --factory-startup --python-exit-code 1 --python create_18bro.py
Outputs are rooted in this repository. No external assets or add-ons are needed.
"""
from pathlib import Path
import math
import json
import struct
import hashlib
import sys
import bpy
from mathutils import Vector, Quaternion, Euler

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/characters/18bro/18bro.blend'
OUTPUT = ROOT / 'dist/assets/models/18bro-v1.glb'
REVIEW = ROOT / 'release/model-review'
MANIFEST = SOURCE.parent / 'manifest.json'
for directory in (SOURCE.parent, OUTPUT.parent, REVIEW):
    directory.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.render.fps = 48
bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 96
bpy.context.preferences.filepaths.save_version = 0
collection = bpy.data.collections.new('EXPORT_18BRO')
bpy.context.scene.collection.children.link(collection)

# A tiny authored palette atlas keeps all colors within three stable materials.
COLORS = {
    'fur': (0.082, 0.102, 0.110, 1),
    'brow': (0.155, 0.173, 0.175, 1),
    'cream': (0.94, 0.92, 0.83, 1),
    'pupil': (0.023, 0.031, 0.029, 1),
    'orange': (0.95, 0.28, 0.035, 1),
    'red': (0.64, 0.075, 0.085, 1),
    'green': (0.025, 0.37, 0.23, 1),
    'darkgreen': (0.025, 0.19, 0.12, 1),
    'mouth': (0.027, 0.040, 0.042, 1),
    'pad': (0.11, 0.22, 0.18, 1),
    'seam': (0.34, 0.49, 0.40, 1),
}
palette = bpy.data.images.new('18bro_palette_512', width=512, height=512, alpha=False)
palette.colorspace_settings.name = 'sRGB'
entries = list(COLORS)
pixels = []
for y in range(512):
    for x in range(512):
        index = (y // 128) * 4 + x // 128
        pixels.extend(COLORS[entries[min(index, len(entries) - 1)]])
palette.pixels[:] = pixels
palette.pack()
materials = {}
for name in ('fur', 'face', 'hat'):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = 0.88
    shader.inputs['Specular IOR Level'].default_value = 0.20
    texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = palette
    texture.interpolation = 'Closest'
    mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    materials[name] = mat

parts = []
def organize(obj):
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def paint(obj, color, slot='face'):
    obj.data.materials.clear()
    obj.data.materials.append(materials[slot])
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='PaletteUV')
    uv.name = 'PaletteUV'
    index = entries.index(color)
    xy = ((index % 4 + 0.5) / 4, (index // 4 + 0.5) / 4)
    for loop in uv.data:
        loop.uv = xy
    return obj

def finish(obj, name, color, slot='face', bone='head'):
    organize(obj)
    obj.name = name
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    paint(obj, color, slot)
    for p in obj.data.polygons:
        p.use_smooth = True
    obj['bind_bone'] = bone
    parts.append(obj)
    return obj

def ellipsoid(name, center, size, color, slot='face', bone='head', segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.scale = size
    return finish(obj, name, color, slot, bone)

def mesh(name, verts, faces, color, slot='face', bone='head'):
    data = bpy.data.meshes.new(name + '_mesh')
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    return finish(obj, name, color, slot, bone)

def volume(name, rings, color='fur', slot='fur', sides=24):
    # Each ring is z, x-radius, y-radius, y-center, superellipse exponent.
    verts, faces = [], []
    for z, rx, ry, cy, exponent in rings:
        for i in range(sides):
            a = 2 * math.pi * i / sides
            c, s = math.cos(a), math.sin(a)
            verts.append((rx * math.copysign(abs(c)**exponent, c),
                          cy + ry * math.copysign(abs(s)**exponent, s), z))
    for j in range(len(rings)-1):
        for i in range(sides):
            a = j*sides+i
            b = j*sides+(i+1)%sides
            faces.append((a, b, b+sides, a+sides))
    faces.extend((tuple(reversed(range(sides))), tuple(range((len(rings)-1)*sides, len(rings)*sides))))
    return mesh(name, verts, faces, color, slot)

def tube(name, points, radii, color='fur', slot='fur', bone='head', sides=10):
    points = [Vector(p) for p in points]
    verts, faces = [], []
    for j, point in enumerate(points):
        tangent = (points[min(j+1,len(points)-1)] - points[max(j-1,0)]).normalized()
        ref = Vector((0,1,0))
        if abs(tangent.dot(ref)) > .94:
            ref = Vector((1,0,0))
        u = tangent.cross(ref).normalized()
        v = tangent.cross(u).normalized()
        for i in range(sides):
            a = 2*math.pi*i/sides
            verts.append(point + radii[j] * (math.cos(a)*u + math.sin(a)*v))
    for j in range(len(points)-1):
        for i in range(sides):
            a=j*sides+i; b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend((tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))))
    return mesh(name, verts, faces, color, slot, bone)

# The head/torso form a continuous sculpt. Articulated limbs have their own
# concealed shoulder/hip caps: a remeshed armpit must not pull the whole flank
# when the paw swings. Their elbow/knee rings have explicit, smooth weights.
skin = []
skin.append(volume('head_form', [
    (1.26,.16,.18,-.015,1),(1.32,.46,.34,-.02,.88),
    (1.43,.68,.46,-.045,.82),(1.64,.79,.51,-.055,.78),
    (1.88,.79,.51,-.035,.85),(2.12,.69,.46,0,.9),
    (2.30,.53,.35,.02,1),(2.39,.24,.17,.02,1),(2.41,.025,.025,.02,1)]))
skin.append(volume('body_form', [
    (.24,.16,.15,.055,1),(.31,.34,.27,.045,1),(.49,.46,.34,.035,1),
    (.76,.48,.35,.025,1),(.99,.40,.31,.02,1),(1.24,.31,.26,0,1),
    (1.42,.25,.23,0,1)]))
for sign, label in ((-1,'L'),(1,'R')):
    # Rounded triangular ears; the bulky base fuses continuously with the skull.
    ear = mesh('ear_form_'+label,
        [(sign*.38,-.16,2.11),(sign*.79,-.08,2.08),(sign*.75,-.025,2.61),
         (sign*.64,-.04,2.70),(sign*.48,.13,2.14),(sign*.78,.13,2.15),
         (sign*.73,.12,2.60),(sign*.64,.11,2.67)],
        [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)], 'fur','fur')
    mod = ear.modifiers.new('Soft_ear_corners','BEVEL'); mod.width=.09; mod.segments=3
    bpy.context.view_layer.objects.active=ear; bpy.ops.object.modifier_apply(modifier=mod.name)
    skin.append(ear)

bpy.ops.object.select_all(action='DESELECT')
for obj in skin: obj.select_set(True)
bpy.context.view_layer.objects.active=skin[0]
bpy.ops.object.join()
body=bpy.context.object; body.name='18bro_skin'
for obj in skin:
    if obj in parts: parts.remove(obj)
parts.append(body)
body.data.remesh_voxel_size=.055
bpy.ops.object.voxel_remesh()
smooth=body.modifiers.new('Sculpt_volume_smoothing','SMOOTH'); smooth.factor=.68; smooth.iterations=4
bpy.ops.object.modifier_apply(modifier=smooth.name)
tri=body.modifiers.new('Triangulated_cage','TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=tri.name)
dec=body.modifiers.new('PS1_silhouette_budget','DECIMATE'); dec.ratio=min(1,1410/len(body.data.polygons))
bpy.ops.object.modifier_apply(modifier=dec.name)
paint(body,'fur','fur')
for polygon in body.data.polygons: polygon.use_smooth=True

limb_bindings = {}
for sign, label in ((-1, 'L'), (1, 'R')):
    arm = tube('arm_form_' + label,
        [(sign*.29,0,1.22),(sign*.37,-.006,1.17),(sign*.46,-.02,1.06),
         (sign*.515,-.032,.96),(sign*.55,-.052,.85),(sign*.565,-.069,.74),
         (sign*.56,-.075,.675),(sign*.553,-.075,.647)],
        [.07,.15,.143,.137,.128,.129,.09,.02], sides=8)
    limb_bindings[arm.name] = ('arm', label)
    leg = tube('leg_form_' + label,
        [(sign*.235,.025,.55),(sign*.235,.024,.49),(sign*.235,.02,.41),
         (sign*.235,.014,.32),(sign*.235,.006,.26),(sign*.235,-.007,.19),
         (sign*.235,-.025,.11),(sign*.235,-.045,.075)],
        [.09,.155,.149,.128,.122,.12,.125,.085], sides=10)
    limb_bindings[leg.name] = ('leg', label)
    paw = ellipsoid('paw_form_' + label, (sign*.235,-.098,.108),
        (.171,.228,.105), 'fur', 'fur', bone='foot_' + label,
        segments=12, rings=6)

# Tail is a deliberately authored tapered curl, attached behind the left hip.
tailpoints=[(-.12,.30,.45),(-.28,.38,.35),(-.49,.37,.24),(-.70,.34,.25),
            (-.84,.28,.39),(-.84,.24,.57),(-.76,.21,.68),(-.64,.20,.68),
            (-.58,.20,.60),(-.62,.20,.54)]
tailradii=[.13,.13,.125,.12,.115,.11,.105,.095,.075,.045]
smoothpoints=[];smoothradii=[]
for j in range(len(tailpoints)-1):
    p0,p1,p2,p3=[Vector(tailpoints[max(0,min(len(tailpoints)-1,k))]) for k in (j-1,j,j+1,j+2)]
    for step in range(3):
        t=step/3
        smoothpoints.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
        smoothradii.append(tailradii[j]*(1-t)+tailradii[j+1]*t)
smoothpoints.append(tailpoints[-1]);smoothradii.append(.025)
tail=tube('18bro_tail',smoothpoints,smoothradii,bone='tail',sides=6)

# Ear inserts are inset panels, with asymmetric red/green coloring.
for sign,label,color in ((-1,'L','red'),(1,'R','green')):
    panel=mesh('inner_ear_'+label,[(sign*.46,-.185,2.22),(sign*.69,-.14,2.20),
        (sign*.69,-.10,2.55),(sign*.635,-.10,2.59)],[(0,1,2,3)],color)
    bevel=panel.modifiers.new('Panel_thickness','SOLIDIFY');bevel.thickness=.018
    bpy.context.view_layer.objects.active=panel;bpy.ops.object.modifier_apply(modifier=bevel.name)

# Cream eyes are slightly domed panels; lids hide their upper half for sleepy expression.
for sign,label in ((-1,'L'),(1,'R')):
    eye=ellipsoid('eye_'+label,(sign*.295,-.504,1.84),(.20,.063,.205),'cream',segments=12,rings=6)
    pupil=ellipsoid('pupil_'+label,(sign*.29,-.564,1.87),(.067,.021,.104),'pupil',segments=10,rings=6)
    lid=ellipsoid('eyelid_'+label,(sign*.295,-.541,1.985),(.212,.055,.13),'fur','fur',segments=12,rings=6)
    # Brows rise at the middle, producing the mascot's worried/sleepy expression.
    tube('brow_'+label,[(sign*.10,-.55,2.135),(sign*.18,-.573,2.11),
        (sign*.30,-.565,2.07),(sign*.43,-.525,2.065),(sign*.50,-.49,2.09)],
        [.055,.077,.077,.061,.025],'brow','face',sides=8)

nose=mesh('orange_nose',[(-.095,-.579,1.68),(.095,-.579,1.68),(.052,-.624,1.623),
    (0,-.63,1.585),(-.052,-.624,1.623),(0,-.65,1.65)],
    [(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5),(4,3,2,1,0)],'orange')
tube('mouth_stem',[(0,-.585,1.59),(0,-.574,1.545)], [.018,.015],'mouth','face',sides=6)
for sign,label in ((-1,'L'),(1,'R')):
    tube('mouth_'+label,[(0,-.574,1.545),(sign*.075,-.56,1.535),(sign*.13,-.543,1.565)],
        [.016,.016,.008],'mouth','face',sides=6)

# Cap panels follow an actual dome; lower rim and swept bill read well from behind.
caprings=[(2.265,.435,.365,.025,1),(2.37,.445,.365,.025,1),
    (2.52,.385,.32,.035,1),(2.65,.265,.23,.045,1),(2.70,.04,.04,.045,1)]
cap=volume('cap_crown',caprings,'green','hat',sides=20)
cap['bind_bone']='head'
# Cream front crown panel, fitted to the dome (front = -Y).
verts=[]
for z,rx,ry,cy,unused in caprings[:4]:
    for i in range(7):
        # Same angular vertices as the crown, radially offset: no z-fighting.
        angle=-math.pi/2+(i-3)*math.pi/10
        verts.append(((rx+.008)*math.cos(angle),cy+(ry+.012)*math.sin(angle),z+.002))
faces=[]
for j in range(3):
    for i in range(6):
        a=j*7+i; faces.append((a,a+1,a+8,a+7))
mesh('cap_cream_panel',verts,faces,'cream','hat')
# Deliberately no official logo: a small original orange chip diamond.
def cap_front_y(x,z):
    for j in range(len(caprings)-1):
        a,b=caprings[j:j+2]
        if a[0]<=z<=b[0]:
            t=(z-a[0])/(b[0]-a[0])
            rx=a[1]*(1-t)+b[1]*t;ry=a[2]*(1-t)+b[2]*t;cy=a[3]*(1-t)+b[3]*t
            return cy-ry*math.sqrt(1-(x/rx)**2)-.020
badge=[(0,2.51),(.056,2.455),(0,2.40),(-.056,2.455)]
mesh('cap_chip_badge',[(x,cap_front_y(x,z),z) for x,z in badge],[(0,1,2,3)],'orange','hat')
billverts=[]
for layer in (0,1):
    for row in (0,1,2):
        for i in range(13):
            u=-1+2*i/12
            x=u*(.40+row*.014)
            y=-.19-row*.20*(1-.28*u*u)
            z=2.295-.10*(1-u*u)*(row/2)-layer*.035
            billverts.append((x,y,z))
billfaces=[]
for layer in (0,1):
    for row in (0,1):
        for i in range(12):
            a=layer*39+row*13+i
            billfaces.append((a,a+1,a+14,a+13) if layer==0 else (a+13,a+14,a+1,a))
for i in range(12): billfaces.append((26+i,65+i,66+i,27+i))
for row in (0,1):
    a=row*13; billfaces.append((a,a+13,a+52,a+39))
    a=row*13+12;billfaces.append((a+39,a+52,a+13,a))
mesh('cap_bill',billverts,billfaces,'green','hat')
ellipsoid('cap_button',(0,.045,2.706),(.063,.062,.03),'darkgreen','hat',segments=12,rings=6)

# Rig. Mesh root and armature root remain identity; clips never translate root.
armdata=bpy.data.armatures.new('18bro_rig_data')
rig=bpy.data.objects.new('18bro_rig',armdata);collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bones={
 'root':((0,0,0),(0,0,.2),None),
 'hips':((0,0,.50),(0,0,.86),'root'),
 'spine':((0,0,.86),(0,0,1.30),'hips'),
 'head':((0,0,1.30),(0,0,2.13),'spine'),
 'arm_L':((-.30,0,1.20),(-.515,-.032,.96),'spine'),
 'arm_R':((.30,0,1.20),(.515,-.032,.96),'spine'),
 'forearm_L':((-.515,-.032,.96),(-.56,-.075,.68),'arm_L'),
 'forearm_R':((.515,-.032,.96),(.56,-.075,.68),'arm_R'),
 'leg_L':((-.235,.025,.54),(-.235,.014,.30),'hips'),
 'leg_R':((.235,.025,.54),(.235,.014,.30),'hips'),
 'shin_L':((-.235,.014,.30),(-.235,-.025,.11),'leg_L'),
 'shin_R':((.235,.014,.30),(.235,-.025,.11),'leg_R'),
 'foot_L':((-.235,-.025,.11),(-.235,-.18,.08),'shin_L'),
 'foot_R':((.235,-.025,.11),(.235,-.18,.08),'shin_R'),
 'tail':((-.12,.30,.45),(-.48,.34,.28),'hips'),
 'socket_hat':((0,0,2.30),(0,0,2.40),'head'),
 'socket_bag':((.39,.05,.95),(.39,.05,1.05),'spine'),
 'socket_back':((0,.34,.95),(0,.34,1.05),'spine'),
 'socket_carry_L':((-.56,-.075,.68),(-.56,-.075,.78),'forearm_L'),
 'socket_carry_R':((.56,-.075,.68),(.56,-.075,.78),'forearm_R'),
}
for name,(head,tip,parent) in bones.items():
    bone=armdata.edit_bones.new(name);bone.head=head;bone.tail=tip
    if parent: bone.parent=armdata.edit_bones[parent]
    bone.use_deform=not name.startswith('socket_')
bpy.ops.object.mode_set(mode='OBJECT')

def bind(obj, weights):
    obj.parent=rig
    mod=obj.modifiers.new('18bro_skinning','ARMATURE');mod.object=rig
    groups={name:obj.vertex_groups.new(name=name) for name in bones if not name.startswith('socket_')}
    for v in obj.data.vertices:
        for name,value in weights(v.co).items():
            if value>0.0001:groups[name].add([v.index],value,'REPLACE')

def skinweights(co):
    x,y,z=co
    if z>1.36:return {'head':1}
    if z>1.22:
        t=(z-1.22)/.14;return {'head':t,'spine':1-t}
    t=min(1,max(0,(z-.55)/.4))
    return {'spine':t,'hips':1-t}

def smoothstep(a, b, value):
    t = min(1, max(0, (value-a)/(b-a)))
    return t*t*(3-2*t)

def limbweights(co, kind, label):
    z = co.z
    if kind == 'arm':
        upper = smoothstep(.89, 1.025, z)
        return {'arm_'+label: upper, 'forearm_'+label: 1-upper}
    upper = smoothstep(.255, .365, z)
    foot = 1-smoothstep(.105, .205, z)
    return {'leg_'+label: upper, 'shin_'+label: (1-upper)*(1-foot),
            'foot_'+label: (1-upper)*foot}

for obj in parts:
    if obj==body:bind(obj,skinweights)
    elif obj.name in limb_bindings:
        kind,label = limb_bindings[obj.name]
        bind(obj,lambda co,k=kind,l=label:limbweights(co,k,l))
    else:
        bone=obj.get('bind_bone','head')
        bind(obj,lambda co,b=bone:{b:1})

# Consolidate skinned pieces by material: three runtime draws, retained weight groups.
merged=[]
buckets={slot:[o for o in parts if o.data.materials[0]==materials[slot]] for slot in ('fur','face','hat')}
for slot in ('fur','face','hat'):
    objects=buckets[slot]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    obj=bpy.context.object;obj.name='18bro_'+slot;obj.data.name=obj.name+'_mesh'
    if 'bind_bone' in obj:del obj['bind_bone']
    merged.append(obj)
parts=merged

# One complete pose per clip/frame. Rotations are authored in model space and
# converted through each bone's rest basis, avoiding the angled-limb local-axis
# error of the prototype. The runtime mixer is the sole owner of these bones.
for pose in rig.pose.bones:
    pose.rotation_mode = 'QUATERNION'
rest_basis = {name:rig.data.bones[name].matrix_local.to_quaternion() for name in bones}
animated_bones = [name for name in bones if name != 'root' and not name.startswith('socket_')]
CLIPS = {
    'idle': (48, True), 'run': (16, True), 'walk': (24, True),
    'jump': (20, False), 'slide': (18, False), 'ride': (24, True),
    'stumble': (14, False), 'caught': (16, False), 'carry': (32, True),
    'fall': (18, False), 'celebrate': (32, True), 'snack': (36, True),
    'jetpack': (24, True), 'roll': (18, False),
    'moped_mount': (15, False), 'moped_jump': (20, False),
    'moped_slide_L': (18, False), 'moped_slide_R': (18, False),
}

def reset_pose():
    for pose in rig.pose.bones:
        pose.location = (0,0,0)
        pose.rotation_quaternion = (1,0,0,0)
        pose.scale = (1,1,1)

def rotate(name, x=0, y=0, z=0):
    basis = rest_basis[name]
    rig.pose.bones[name].rotation_quaternion = basis.inverted() @ Euler((x,y,z), 'XYZ').to_quaternion() @ basis

def locate(name, x=0, y=0, z=0):
    rig.pose.bones[name].location = rest_basis[name].inverted() @ Vector((x,y,z))

def lerp(a, b, t):
    return a+(b-a)*t

def hermite(a, b, tangent_a, tangent_b, t):
    return (2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*tangent_a+(-2*t**3+3*t*t)*b+(t**3-t*t)*tangent_b

def leg_ik(label, ankle_y, ankle_z, hip_offset=0, foot_pitch=0):
    # Baked two-joint sagittal IK: contact paws stay on the floor while the
    # pelvis passes over them. No constraints or IK solver ship in the GLB.
    hip = Vector(bones['leg_'+label][0])
    knee = Vector(bones['shin_'+label][0])
    ankle = Vector(bones['foot_'+label][0])
    upper = knee-hip; lower = ankle-knee
    length_a, length_b = upper.length, lower.length
    target_y, target_z = ankle_y-hip.y, ankle_z-hip.z-hip_offset
    distance = min(math.hypot(target_y, target_z), (length_a+length_b)*.997)
    bend = math.acos(max(-1,min(1,(distance*distance-length_a*length_a-length_b*length_b)/(2*length_a*length_b))))
    thigh = math.atan2(target_y, -target_z)-math.atan2(length_b*math.sin(bend),length_a+length_b*math.cos(bend))
    rest_upper = math.atan2(upper.y,-upper.z)
    rest_lower = math.atan2(lower.y,-lower.z)
    upper_delta = thigh-rest_upper
    lower_delta = bend-(rest_lower-rest_upper)
    rotate('leg_'+label, upper_delta)
    rotate('shin_'+label, lower_delta)
    rotate('foot_'+label, foot_pitch-upper_delta-lower_delta)

def limb_pose(label, arm=0, elbow=0, thigh=0, knee=0, foot=0, spread=0):
    side = -1 if label == 'L' else 1
    rotate('arm_'+label, arm, -side*spread)
    rotate('forearm_'+label, elbow)
    rotate('leg_'+label, thigh)
    rotate('shin_'+label, knee)
    rotate('foot_'+label, foot)


# Fixed contact points match the actual game scooter after the 0.82 vehicle
# scale, 2.4-unit cat height normalization and 0.08 riding root lift. The solver
# is baked into the clips: there is no live IK or procedural bone mutation.
HANDLEBAR = {'L':Vector((-.373,-.420,1.14)), 'R':Vector((.373,-.420,1.14))}


def arm_ik(label, target, reach=1):
    bpy.context.view_layer.update()
    parent = rig.pose.bones['spine']
    parent_deform = parent.matrix @ parent.bone.matrix_local.inverted()
    shoulder = Vector(bones['arm_'+label][0])
    elbow_rest = Vector(bones['forearm_'+label][0])
    hand_rest = Vector(bones['socket_carry_'+label][0])
    current_hand = rig.pose.bones['socket_carry_'+label].matrix.translation
    target = current_hand.lerp(Vector(target),reach)
    target = parent_deform.inverted() @ target
    upper, lower = elbow_rest-shoulder, hand_rest-elbow_rest
    offset = target-shoulder
    distance = min(upper.length+lower.length-.0005,
                   max(abs(upper.length-lower.length)+.0005,offset.length))
    direction = offset.normalized()
    sign = -1 if label=='L' else 1
    pole = parent_deform.to_quaternion().inverted() @ Vector((sign*.55,.1,-1))
    bend = (pole-direction*pole.dot(direction)).normalized()
    along = (upper.length_squared-lower.length_squared+distance*distance)/(2*distance)
    elbow = direction*along+bend*math.sqrt(max(0,upper.length_squared-along*along))
    first = upper.normalized().rotation_difference(elbow.normalized())
    second = lower.normalized().rotation_difference((first.inverted()@(direction*distance-elbow)).normalized())
    for name,delta in (('arm_'+label,first),('forearm_'+label,second)):
        basis=rest_basis[name]
        rig.pose.bones[name].rotation_quaternion=basis.inverted()@delta@basis


def ride_pose(t=0, hip_x=0, hip_y=0, hip_z=.18, lean=.14, bank=0):
    locate('hips',x=hip_x,y=hip_y,z=hip_z)
    rotate('spine',lean,z=bank)
    rotate('head',-.8*lean,z=-.35*bank)
    for label in ('L','R'):
        limb_pose(label,thigh=-1.30,knee=1.78,foot=-.48)
    rotate('tail',.06,y=.16,z=.045*math.sin(2*math.pi*t))


def seat_arms(reach=1):
    for label in ('L','R'):
        arm_ik(label,HANDLEBAR[label],reach)


def ground_roll_clearance(tuck):
    # The large head changes the contact radius over a roll. Bake that radius
    # from the real deformed skin, including the cap and tail, so no frame can
    # put ears through the ground or leave the curled body visibly hovering.
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    points=[vertex.co.copy() for obj in parts for vertex in obj.evaluated_get(graph).data.vertices]
    lowest=min(point.z for point in points)
    center_y=(min(point.y for point in points)+max(point.y for point in points))*.5
    offset=max(-.60,.018-lowest)
    pose=rig.pose.bones['hips']
    pose.location += rest_basis['hips'].inverted() @ Vector((0,-center_y*tuck,offset))


def lift_from_floor(clearance=.006):
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    lowest=min(vertex.co.z for obj in parts for vertex in obj.evaluated_get(graph).data.vertices)
    if lowest<clearance:
        rig.pose.bones['hips'].location += rest_basis['hips'].inverted() @ Vector((0,0,clearance-lowest))


side_dodge_arms = {}

def side_dodge_pose(side, amount, t=0):
    # Swing the whole silhouette OUTSIDE the scooter, rather than bowing the
    # oversized head directly through its steering cowl. The near hand keeps
    # the bar, while the other hugs the body in this side-saddle trick.
    ride_pose(t,hip_x=side*.60*amount,hip_y=.05*amount,
              hip_z=.18-.40*amount,lean=.14+1.08*amount)
    rotate('spine',.14+1.08*amount,y=side*.60*amount)
    rotate('head',-.112+.092*amount,y=side*.40*amount)
    for label in ('L','R'):
        rotate('leg_'+label,-1.30-.50*amount,y=-side*.26*amount)
        rotate('shin_'+label,1.78+.22*amount)
        rotate('foot_'+label,-.48-.12*amount)
    rotate('tail',.06-.10*amount,y=.16+side*.14*amount)
    lift_from_floor(.008)


def side_dodge_grips(side, amount, t=0):
    # The arm's fixed-grip IK pole passes through a singularity as the shoulder
    # moves below the bars. Bake stable endpoint solutions, then interpolate
    # their rotations: the paws hold exact grips in both sustained poses and
    # never flip their elbows during the short mount/dismount transition.
    if side not in side_dodge_arms:
        endpoints=[]
        for endpoint in (0,1):
            reset_pose()
            side_dodge_pose(side,endpoint)
            seat_arms()
            if endpoint:
                far='L' if side>0 else 'R'
                rotate('arm_'+far,-.80,y=-side*.25)
                rotate('forearm_'+far,-1.30)
            endpoints.append({name:rig.pose.bones[name].rotation_quaternion.copy()
                              for name in ('arm_L','forearm_L','arm_R','forearm_R')})
        side_dodge_arms[side]=endpoints
    side_dodge_pose(side,amount,t)
    first,last=side_dodge_arms[side]
    for name in first:
        rig.pose.bones[name].rotation_quaternion=first[name].slerp(last[name],amount)


def pose_at(clip, t):
    reset_pose()
    phase = 2*math.pi*t
    if clip in ('run', 'walk'):
        running = clip == 'run'
        hip = (-.09 if running else -.038)+( .045 if running else .017)*(1-math.cos(phase*2))*.5
        locate('hips', z=hip)
        rotate('spine', .11 if running else .025, z=.028*math.sin(phase))
        rotate('head', -.095 if running else -.018, z=-.020*math.sin(phase))
        for label, offset in (('L',0),('R',.5)):
            cycle = (t+offset)%1
            stance = .46 if running else .62
            stride = .18 if running else .105
            if cycle < stance:
                ankle_y = lerp(-stride,stride,cycle/stance)
                ankle_z = .112
                foot_pitch = 0
            else:
                u = (cycle-stance)/(1-stance)
                tangent = 2*stride/stance*(1-stance)
                ankle_y = hermite(stride,-stride,tangent,tangent,u)
                ankle_z = .112+(.19 if running else .09)*math.sin(math.pi*u)**2
                foot_pitch = -.22*math.sin(math.pi*u)
            leg_ik(label, ankle_y, ankle_z, hip, foot_pitch)
            swing = math.cos(2*math.pi*cycle)
            rotate('arm_'+label, (.52 if running else .24)*swing)
            rotate('forearm_'+label, -.32-.13*swing if running else -.12-.06*swing)
        rotate('tail', .04*math.sin(phase), z=.10*math.sin(phase-.3))
    elif clip == 'idle':
        locate('spine', z=.0045*math.sin(phase))
        rotate('spine', .009*math.sin(phase))
        rotate('head', -.006*math.sin(phase), z=.014*math.sin(phase))
        rotate('tail', z=.065*math.sin(phase))
        for label in ('L','R'): rotate('forearm_'+label, -.06)
    elif clip == 'jump':
        anticipation = math.sin(math.pi*min(t/.18,1))**2 if t < .18 else 0
        airborne = smoothstep(.12,.38,t)*(1-smoothstep(.61,.85,t))
        landing = math.sin(math.pi*(t-.82)/.18)**2 if t > .82 else 0
        hip = -.14*anticipation-.14*landing+.04*airborne
        locate('hips', z=hip)
        rotate('spine', .26*anticipation+.28*airborne+.28*landing,z=.08*airborne)
        rotate('head', -.18*anticipation-.20*airborne-.18*landing,z=-.10*airborne)
        for label, side in (('L',-1),('R',1)):
            leg_ik(label,-.045+side*.15*airborne,.112+(.22-side*.08)*airborne,hip,-.30*airborne)
            basis=rest_basis['leg_'+label]
            spread=Euler((0,-side*.32*airborne,0),'XYZ').to_quaternion()
            rig.pose.bones['leg_'+label].rotation_quaternion=basis.inverted()@spread@basis@rig.pose.bones['leg_'+label].rotation_quaternion
            rotate('arm_'+label,(-1.10+side*.35)*airborne+.38*anticipation,-side*.80*airborne)
            rotate('forearm_'+label,-.10-.55*airborne)
        rotate('tail', -.32*airborne,y=.30*airborne,z=-.10*airborne)
        lift_from_floor()
    elif clip == 'slide':
        duck = smoothstep(0,.16,t)*(1-smoothstep(.82,1,t))
        hip = -.235*duck
        locate('hips', z=hip)
        rotate('spine', .92*duck)
        rotate('head', -.14*duck)
        for label in ('L','R'):
            leg_ik(label,-.12*duck,.112,hip)
            rotate('arm_'+label,.65*duck)
            rotate('forearm_'+label,-.15-.50*duck)
        rotate('tail', -.08*duck,y=.40*duck)
    elif clip == 'roll':
        tuck=smoothstep(0,.15,t)*(1-smoothstep(.84,1,t))
        turn=smoothstep(.12,.88,t)
        locate('hips',z=-.14*tuck)
        rotate('hips',2*math.pi*turn)
        rotate('spine',1.03*tuck)
        rotate('head',.43*tuck)
        for label in ('L','R'):
            limb_pose(label,arm=-.52*tuck,elbow=-1.38*tuck,
                      thigh=-1.64*tuck,knee=2.02*tuck,foot=-.30*tuck,spread=.07*tuck)
        rotate('tail',-.48*tuck,y=.48*tuck)
        ground_roll_clearance(tuck)
    elif clip == 'ride':
        ride_pose(t,hip_z=.18+.006*math.sin(phase))
        seat_arms()
    elif clip == 'moped_mount':
        gather=smoothstep(0,.18,t)*(1-smoothstep(.18,.45,t))
        landing=smoothstep(.62,1,t)
        hop=math.sin(math.pi*smoothstep(.12,.90,t))**2
        settle=math.sin(math.pi*smoothstep(.72,1,t))**2
        hip_z=lerp(-.13*gather,.18,landing)+.22*hop-.055*settle
        locate('hips',y=.05*hop,z=hip_z)
        rotate('spine',.15+.16*hop)
        rotate('head',-.11-.11*hop)
        for label in ('L','R'):
            limb_pose(label,arm=-.55*hop,elbow=-.65*hop,
                      thigh=lerp(-.75*hop,-1.30,landing),
                      knee=lerp(1.16*hop,1.78,landing),foot=-.48*landing)
        rotate('tail',.06,y=.16,z=.09*hop)
        lift_from_floor()
        seat_arms(smoothstep(.20,.62,t))
    elif clip == 'moped_jump':
        stunt=smoothstep(.05,.34,t)*(1-smoothstep(.66,.95,t))
        ride_pose(t,hip_y=.34*stunt,hip_z=.18+.32*stunt,lean=.14-.04*stunt)
        rotate('hips',1.03*stunt)
        rotate('head',-.112-.60*stunt)
        for label,sign in (('L',-1),('R',1)):
            # Both rear paws kick behind the seat, keeping the front paws on
            # their fixed grips. The slight split reads clearly from the rear.
            limb_pose(label,thigh=lerp(-1.30,1.15+sign*.10,stunt),
                      knee=lerp(1.78,.42,stunt),foot=lerp(-.48,-.38,stunt))
            rotate('leg_'+label,lerp(-1.30,1.15+sign*.10,stunt),y=-sign*.28*stunt)
        seat_arms()
    elif clip in ('moped_slide_L','moped_slide_R'):
        side=-1 if clip.endswith('_L') else 1
        dodge=smoothstep(0,.20,t)*(1-smoothstep(.80,1,t))
        # Drop off the seat into a compact side saddle. The head follows the
        # folded torso instead of counter-rotating upright: even the ear tips
        # now pass below the 1.6-unit low rail during the held dodge. Keep the
        # lateral offset inside the lane and bake the near-paw grip while the far paw tucks against the body.
        side_dodge_grips(side,dodge,t)
    elif clip == 'stumble':
        recoil = smoothstep(0,.18,t)*(1-smoothstep(.28,1,t))
        locate('hips', z=-.055*recoil)
        rotate('spine', -.24*recoil, z=.085*recoil)
        rotate('head', .12*recoil, z=-.055*recoil)
        for label in ('L','R'):
            limb_pose(label, arm=-.35*recoil, elbow=-.55*recoil,
                thigh=-.22*recoil, knee=.45*recoil, foot=-.23*recoil, spread=.22*recoil)
            leg_ik(label,-.025,.112,-.055*recoil)
        rotate('tail', .18*recoil)
    elif clip in ('caught','carry'):
        amount = smoothstep(0,.50,t) if clip == 'caught' else 1
        sway = math.sin(phase)*.025 if clip == 'carry' else 0
        rotate('spine', -.08*amount, z=sway)
        rotate('head', .055*amount, z=-sway*.7)
        for label in ('L','R'):
            limb_pose(label, arm=-.10*amount, elbow=-.18*amount,
                thigh=-.05*amount, knee=.25*amount, foot=-.16*amount, spread=.36*amount)
        rotate('tail', .05*amount, z=.035*math.sin(phase)*amount)
    elif clip == 'fall':
        curl = smoothstep(0,.55,t)
        rotate('spine', .25*curl)
        rotate('head', .13*curl)
        for label in ('L','R'):
            limb_pose(label, arm=-.75*curl, elbow=-.65*curl,
                thigh=-.58*curl, knee=.95*curl, foot=-.25*curl, spread=.10*curl)
        rotate('tail', .12*curl)
    elif clip == 'celebrate':
        bounce = .5-.5*math.cos(phase*2)
        hip = -.04*bounce
        locate('hips', x=.025*math.sin(phase),z=hip)
        rotate('spine', z=.08*math.sin(phase))
        rotate('head', z=-.07*math.sin(phase))
        for label,side in (('L',-1),('R',1)):
            leg_ik(label,-.025,.112,hip)
            rotate('arm_'+label,-.4,-side*(.86+.20*math.cos(phase)))
            rotate('forearm_'+label,-.65-.16*math.sin(phase))
        rotate('tail', z=.12*math.sin(phase))
    elif clip == 'snack':
        bite = .5-.5*math.cos(phase*2)
        rotate('head', .05+.018*bite)
        rotate('arm_R',-1.54-.05*bite,y=.10)
        rotate('forearm_R',-1.13-.04*bite)
        rotate('arm_L',-.22)
        rotate('forearm_L',-.48)
        rotate('tail', z=.06*math.sin(phase))
    elif clip == 'jetpack':
        locate('hips', z=.01*math.sin(phase))
        rotate('spine', .10)
        rotate('head', -.085)
        for label in ('L','R'):
            limb_pose(label, arm=.23, elbow=-.65, thigh=.20, knee=.42, foot=-.35, spread=.09)
        rotate('tail', .10,z=.05*math.sin(phase))

clip_metrics = {}
for clip, (intervals, looping) in CLIPS.items():
    rig.animation_data_create()
    rig.animation_data.action = None
    first_pose = None
    previous = {}
    max_angular_step = 0
    for frame in range(intervals*2+1):
        pose_at(clip, frame/(intervals*2))
        current = {}
        for name in animated_bones:
            pose = rig.pose.bones[name]
            quat = pose.rotation_quaternion.copy()
            if name in previous:
                if quat.dot(previous[name]) < 0:
                    quat.negate(); pose.rotation_quaternion = quat
                max_angular_step = max(max_angular_step,quat.rotation_difference(previous[name]).angle)
            previous[name] = quat
            current[name] = list(pose.location)+list(quat)+list(pose.scale)
            pose.keyframe_insert('rotation_quaternion',frame=frame,group=name)
            pose.keyframe_insert('location',frame=frame,group=name)
            pose.keyframe_insert('scale',frame=frame,group=name)
        if first_pose is None: first_pose=current
    loop_error = max(abs(a-b) for name in animated_bones for a,b in zip(first_pose[name],current[name]))
    if looping: assert loop_error < 1e-5, (clip, loop_error)
    if clip in ('moped_slide_L','moped_slide_R'):
        assert loop_error < 1e-5, (clip,'dodge does not return to its riding pose')
        assert max_angular_step < .50, (clip,'elbow/limb discontinuity',max_angular_step)
    action = rig.animation_data.action; action.name = clip
    # Blender 5 Actions use channelbags; linear keys avoid Bezier overshoot at
    # contact, clip boundaries, and the large yet deliberate slide transition.
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for curve in channelbag.fcurves:
                    for key in curve.keyframe_points: key.interpolation = 'LINEAR'
    track = rig.animation_data.nla_tracks.new(); track.name = clip
    track.strips.new(clip,0,action); track.mute = True
    action.use_fake_user = True
    clip_metrics[clip] = {'duration':intervals/24,'loop':looping,
        'frames':intervals*2+1,'sample_rate':48,'loop_seam_max_error':loop_error if looping else None,
        'max_bone_step_radians':max_angular_step}
    rig.animation_data.action = None
reset_pose()

# A clean presentation scene is saved with the source but excluded from GLB.
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=720;scene.render.resolution_y=840;scene.render.resolution_percentage=100
scene.world.color=(.25,.25,.25)
scene.view_settings.view_transform='AgX'
def aim(obj,at):obj.rotation_euler=(Vector(at)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,location,power,size in (
    ('key',(-3,-4,6),650,4),('fill',(4,-2,3),500,3),('rim',(1,3,4),850,3)):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=location;aim(obj,(0,0,1.3))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015))
floor=bpy.context.object;floor.name='REVIEW_floor'
fm=bpy.data.materials.new('REVIEW_warm_backdrop');fm.diffuse_color=(.55,.49,.38,1);floor.data.materials.append(fm)
camdata=bpy.data.cameras.new('REVIEW_camera');cam=bpy.data.objects.new('REVIEW_camera',camdata)
scene.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=3.55
cam.location=(3,-6,3);aim(cam,(0,0,1.35))
scene.frame_set(0)
reset_pose()
bpy.context.view_layer.update()
# Store source in rest pose, with all authored clips in muted NLA tracks.
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
scene.render.filepath=str(REVIEW/'three-quarter.png')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,
    export_force_sampling=True,export_optimize_animation_size=False,
    export_skins=True,export_all_influences=False,export_def_bones=False,
    export_yup=True,export_cameras=False,export_lights=False,export_extras=True)

# Read the actual GLB rather than relying on exporter success alone.
blob=OUTPUT.read_bytes()
assert blob[:4]==b'glTF'
length,kind=struct.unpack_from('<II',blob,12)
gltf=json.loads(blob[20:20+length])
clipnames=[a.get('name') for a in gltf.get('animations',[])]
assert set(CLIPS)==set(clipnames),clipnames
assert not any('uri' in b for b in gltf.get('buffers',[]))
assert not any('uri' in i for i in gltf.get('images',[]))
tris=sum(len(p.vertices)-2 for o in parts for p in o.data.polygons)
assert tris<=4000,tris
assert len(blob)<1024*1024,len(blob)
node_names={node.get('name') for node in gltf['nodes']}
assert set(bones).issubset(node_names),set(bones)-node_names
export_tris=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
assert export_tris==tris,(export_tris,tris)
for obj in parts:
    assert tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1)
    for vertex in obj.data.vertices:
        assert len(vertex.groups)<=4
        assert abs(sum(g.weight for g in vertex.groups)-1)<1e-5
binary_start=20+length+8
def float_accessor(index):
    accessor=gltf['accessors'][index]
    view=gltf['bufferViews'][accessor['bufferView']]
    components={'SCALAR':1,'VEC3':3,'VEC4':4}[accessor['type']]
    assert accessor['componentType']==5126
    offset=binary_start+view.get('byteOffset',0)+accessor.get('byteOffset',0)
    stride=view.get('byteStride',components*4)
    return [struct.unpack_from('<'+'f'*components,blob,offset+i*stride) for i in range(accessor['count'])]

for animation in gltf['animations']:
    clip=animation['name']
    duration=CLIPS[clip][0]/24
    channels=set()
    exported_seam_error=0
    for channel in animation['channels']:
        name=gltf['nodes'][channel['target']['node']].get('name')
        path=channel['target']['path']
        channels.add((name,path))
        sampler=animation['samplers'][channel['sampler']]
        times=[row[0] for row in float_accessor(sampler['input'])]
        samples=float_accessor(sampler['output'])
        # Blender exports frame 1 as 1/fps, which adds a visible hold on every
        # loop. Check the actual GLB rather than trusting authored durations.
        assert abs(times[0])<1e-8, (clip,name,path,'first key is not at time zero',times[0])
        assert abs(times[-1]-duration)<1e-6, (clip,name,path,'wrong exported duration',times[-1],duration)
        assert len(times)==len(samples)==CLIPS[clip][0]*2+1, (clip,name,path,'incomplete sample coverage')
        if path=='rotation':
            assert all(abs(sum(v*v for v in sample)-1)<1e-5 for sample in samples), (clip,name,'non-unit quaternion')
        if CLIPS[clip][1]:
            exported_seam_error=max(exported_seam_error,max(abs(a-b) for a,b in zip(samples[0],samples[-1])))
        if name in ('root','18bro_rig'):
            assert all(all(abs(a-b)<1e-6 for a,b in zip(samples[0],sample)) for sample in samples), 'Root motion is forbidden'
    assert all((name,path) in channels for name in bones for path in ('translation','rotation','scale')), (clip,'incomplete pose tracks')
    if CLIPS[clip][1]: assert exported_seam_error<1e-5, (clip,'exported loop seam',exported_seam_error)
    clip_metrics[clip].update({'exported_first_key':0.0,'exported_last_key':times[-1],
        'exported_channels':len(channels),
        'exported_loop_seam_max_error':exported_seam_error if CLIPS[clip][1] else None})
coords=[v.co for obj in parts for v in obj.data.vertices]
minimum=[min(co[i] for co in coords) for i in range(3)]
maximum=[max(co[i] for co in coords) for i in range(3)]
report={'blender':bpy.app.version_string,'source':str(SOURCE.relative_to(ROOT)),
 'output':str(OUTPUT.relative_to(ROOT)),'triangles':tris,'bones':len(bones),'materials':3,
 'clips':clipnames,'sockets':[n for n in bones if n.startswith('socket_')],
 'draw_calls':sum(len(m['primitives']) for m in gltf['meshes']),
 'bounds_blender_z_up':{'min':minimum,'max':maximum},
 'export_triangles':export_tris,'max_vertex_weights':max(len(v.groups) for o in parts for v in o.data.vertices),
 'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),
 'animation_metrics':clip_metrics,
 'rig_version':5,
 'socket_rest_orientation':'socket_hat +Y bone axis = model +Z in Blender; no twist. Parent props using the socket world transform, never the Original head.',
 'notes':['Complete in-place quaternion clips; the animation mixer exclusively owns every imported bone.',
          'Run/walk use baked two-joint IK for planted contacts; arms and legs have independent concealed skin caps.',
          'fall is a protective limb pose only: the gameplay root supplies the fall direction.',
          'Original palette atlas and geometry; no imported logos.']}

# Inspect deformed geometry at every authored frame. A successful export alone
# cannot detect an exploding skin, a non-closing loop, or a floor penetration.
depsgraph = bpy.context.evaluated_depsgraph_get()
for clip,(intervals,looping) in CLIPS.items():
    rig.animation_data.action = bpy.data.actions[clip]
    low = [float('inf')]*3; high = [-float('inf')]*3
    min_foot = float('inf')
    max_contact_error = 0
    held_dodge_top = -float('inf')
    held_dodge_floor = float('inf')
    for frame in range(intervals*2+1):
        scene.frame_set(frame)
        held_dodge = clip in ('moped_slide_L','moped_slide_R') and .20 <= frame/(intervals*2) <= .80
        for obj in parts:
            evaluated = obj.evaluated_get(depsgraph)
            for vertex in evaluated.data.vertices:
                co = evaluated.matrix_world @ vertex.co
                assert all(math.isfinite(value) for value in co), (clip,frame,'non-finite skin')
                for axis in range(3):
                    low[axis] = min(low[axis],co[axis]); high[axis] = max(high[axis],co[axis])
                if held_dodge:
                    held_dodge_top=max(held_dodge_top,co.z)
                    held_dodge_floor=min(held_dodge_floor,co.z)
        for label in ('L','R'):
            foot = rig.pose.bones['foot_'+label].matrix.translation
            min_foot = min(min_foot,foot.z)
            if clip in ('run','walk'):
                t = frame/(intervals*2)
                cycle = (t+(0 if label == 'L' else .5))%1
                stance = .46 if clip == 'run' else .62
                stride = .18 if clip == 'run' else .105
                if cycle < stance:
                    max_contact_error = max(max_contact_error,abs(foot.z-.112),
                        abs(foot.y-lerp(-stride,stride,cycle/stance)))
    assert max(high[axis]-low[axis] for axis in range(3)) < 4, (clip,low,high)
    if clip in ('idle','run','walk','jump','slide','roll','moped_mount','stumble','celebrate','snack'):
        assert low[2] >= -.002, (clip,'ground penetration',low[2])
    if clip in ('run','walk'):
        assert max_contact_error < .001, (clip,'foot contact drift',max_contact_error)
        report['animation_metrics'][clip]['maximum_stance_contact_error'] = max_contact_error
    if clip in ('moped_slide_L','moped_slide_R'):
        # The renderer normalizes this rig to 2.4 units and lifts the riding
        # root by .08. Test the real silhouette against its 1.6-unit low rail.
        runtime_scale=2.4/(maximum[2]-minimum[2])
        top=held_dodge_top*runtime_scale+.08
        bottom=held_dodge_floor*runtime_scale+.08
        assert top < 1.58, (clip,'ear/head collision with low rail',top)
        assert bottom > .015, (clip,'side-saddle ground penetration',bottom)
        report['animation_metrics'][clip]['held_runtime_bounds_y']={'min':bottom,'max':top}
    report['animation_metrics'][clip]['deformed_bounds_blender_z_up'] = {'min':low,'max':high}
    report['animation_metrics'][clip]['minimum_ankle_height'] = min_foot
rig.animation_data.action = None
scene.frame_set(0); reset_pose(); bpy.context.view_layer.update()

manifest = {
 'assetId':'18bro-v1','rigVersion':5,
 'source':str(SOURCE.relative_to(ROOT)).replace('\\','/'),
 'output':str(OUTPUT.relative_to(ROOT)).replace('\\','/'),
 'sha256':report['sha256'],'blenderVersion':bpy.app.version_string,
 'exportPreset':'18bro-blender-5.2-v5','bytes':len(blob),
 'bounds':{'min':[minimum[0],minimum[2],-maximum[1]],
           'max':[maximum[0],maximum[2],-minimum[1]]},
 'boundsBlenderZUp':{'min':minimum,'max':maximum},
 'triangles':tris,'materials':3,'bones':len(bones),'clips':clipnames,
 'clipMetadata':{name:{'duration':data['duration'],'loop':data['loop']} for name,data in clip_metrics.items()},
 'sockets':report['sockets'],
 'provenance':'Original procedural Blender asset and authored animation for the 18Bro community game; no imported model, texture, logo, or animation.',
}
MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n')
(REVIEW/'validation.json').write_text(json.dumps(report,indent=2))
print('18BRO_VALIDATION',json.dumps(report))
if '--skip-render' in sys.argv:
    print('18BRO_COMPLETE',SOURCE,OUTPUT,REVIEW)
    raise SystemExit(0)
for name,location in (
 ('three-quarter',(3,-6,3)),('front',(0,-6,2.5)),('side',(6,0,2.5)),('rear',(0,6,2.5))):
    cam.location=location;aim(cam,(0,0,1.35))
    scene.render.filepath=str(REVIEW/(name+'.png'))
    bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['run']
scene.frame_set(5)
cam.location=(3,-6,3);aim(cam,(0,0,1.35))
scene.render.filepath=str(REVIEW/'run-frame-05.png')
bpy.ops.render.render(write_still=True)

# Consistent-size posed review frames and contact sheets include the states
# that failed in gameplay. The saved blend and exported collection stay clean.
scene.render.resolution_x=336;scene.render.resolution_y=392;scene.cycles.samples=12
camdata.ortho_scale=3.5
def review_frame(clip,t,suffix='',rear=False):
    rig.animation_data.action=bpy.data.actions[clip]
    scene.frame_set(round(CLIPS[clip][0]*2*t))
    cam.location=(3,6,2.8) if rear else (3,-6,2.8)
    aim(cam,(0,0,1.30))
    path=REVIEW/(clip+'-'+suffix+'.png')
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    return path

def contact_sheet(paths,columns,name):
    width,height=336,392
    rows=math.ceil(len(paths)/columns)
    output=bpy.data.images.new(name,width=width*columns,height=height*rows,alpha=False)
    pixels=[.12,.14,.14,1]*(width*columns*height*rows)
    for index,path in enumerate(paths):
        source=bpy.data.images.load(str(path),check_existing=False)
        source_pixels=list(source.pixels)
        left=(index%columns)*width;bottom=(rows-1-index//columns)*height
        for row in range(height):
            start=((bottom+row)*width*columns+left)*4
            pixels[start:start+width*4]=source_pixels[row*width*4:(row+1)*width*4]
        bpy.data.images.remove(source)
    output.pixels[:]=pixels
    output.filepath_raw=str(REVIEW/(name+'.png'));output.file_format='PNG';output.save()
    bpy.data.images.remove(output)

run_frames=[]
for rear in (False,True):
    for index in range(4):
        run_frames.append(review_frame('run',index/4,('rear-' if rear else 'front-')+str(index),rear))
contact_sheet(run_frames,4,'run-contact-sheet')
review_states=[('idle',0),('jump',.45),('roll',.5),('ride',.25),
               ('stumble',.25),('caught',1),('carry',.25),('fall',1),
               ('moped_mount',.43),('moped_jump',.5),('moped_slide_L',.5),('moped_slide_R',.5)]
state_frames=[review_frame(clip,t,'pose') for clip,t in review_states]
contact_sheet(state_frames,4,'action-contact-sheet')
(REVIEW/'contact-sheet-order.json').write_text(json.dumps({
    'run-contact-sheet':'Run phases 0%,25%,50%,75% from front (row 1) and rear (row 2).',
    'action-contact-sheet':[clip for clip,t in review_states]},indent=2))
print('18BRO_COMPLETE',SOURCE,OUTPUT,REVIEW)
