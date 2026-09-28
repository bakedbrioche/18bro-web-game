"""Author seven 18Bro pickup props, three wearables and original studio icons.

Run with Blender 5.2:
  blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
          --python scripts/blender/create_powerups.py

No external artwork, textures, fonts or downloads are used. Each pickup has one
independently cloneable root, a shared vertex-color material and an origin at its
visual center. Wearables use a paw-grip or ankle origin at their authored size.
The saved .blend includes the review studio; GLB excludes it.
"""
from pathlib import Path
import hashlib
import json
import math
import struct

import bpy
from mathutils import Euler, Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/powerups/powerups.blend'
OUTPUT = ROOT / 'dist/assets/models/powerups-v1.glb'
ICONS = ROOT / 'dist/assets/icons'
REVIEW = ROOT / 'release/powerup-review'
for directory in (SOURCE.parent, OUTPUT.parent, ICONS, REVIEW):
    directory.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
collection = bpy.data.collections.new('EXPORT_POWERUPS')
scene.collection.children.link(collection)

COLORS = {
    'ink': '#172b31', 'teal': '#07896a', 'teal_dark': '#075443',
    'mint': '#70ead0', 'cyan': '#59d9ed', 'blue': '#2b8bb4',
    'cream': '#fff2ce', 'ivory': '#fffcf0', 'coral': '#ed593a',
    'orange': '#ff8b29', 'gold': '#f7c343', 'gold_dark': '#c78121',
    'lime': '#b3ec59', 'lime_dark': '#62972f', 'rubber': '#263c40',
    'speed_blue': '#1578dc', 'speed_dark': '#15388f', 'ice': '#b1f5ff',
}
COLORS = {name: tuple(int(value[i:i+2], 16)/255 for i in (1, 3, 5))+(1,)
          for name, value in COLORS.items()}
material = bpy.data.materials.new('powerup_palette')
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = .63
shader.inputs['Metallic'].default_value = .04
shader.inputs['Specular IOR Level'].default_value = .24
vertex_color = material.node_tree.nodes.new('ShaderNodeVertexColor')
vertex_color.layer_name = 'Color'
material.node_tree.links.new(vertex_color.outputs['Color'], shader.inputs['Base Color'])


class Shape:
    def __init__(self, key):
        self.key = key
        self.vertices, self.faces, self.colors, self.smoothing = [], [], [], []

    def add(self, vertices, faces, color, smooth=False, transform=None):
        first = len(self.vertices)
        self.vertices.extend(tuple(transform @ Vector(v)) if transform else tuple(v) for v in vertices)
        self.faces.extend(tuple(first+i for i in face) for face in faces)
        self.colors.extend([COLORS[color] if isinstance(color, str) else color]*len(faces))
        self.smoothing.extend([smooth]*len(faces))

    def loft(self, rings, color, sides=12, smooth=True, transform=None):
        # z, radius-x, radius-y, center-x, center-y, superellipse exponent
        vertices, faces = [], []
        for z, rx, ry, cx, cy, power in rings:
            for i in range(sides):
                a = 2*math.pi*i/sides
                c, s = math.cos(a), math.sin(a)
                vertices.append((cx+rx*math.copysign(abs(c)**power, c),
                                 cy+ry*math.copysign(abs(s)**power, s), z))
        for j in range(len(rings)-1):
            for i in range(sides):
                a, b = j*sides+i, j*sides+(i+1)%sides
                faces.append((a, b, b+sides, a+sides))
        faces.extend([tuple(reversed(range(sides))),
                      tuple((len(rings)-1)*sides+i for i in range(sides))])
        self.add(vertices, faces, color, smooth, transform)

    def ellipsoid(self, center, radii, color, sides=12, latitudes=6, transform=None):
        cx, cy, cz = center
        rx, ry, rz = radii
        rings = []
        for j in range(latitudes+1):
            a = -math.pi/2+math.pi*j/latitudes
            r = max(.005, math.cos(a))
            rings.append((cz+rz*math.sin(a), rx*r, ry*r, cx, cy, 1))
        self.loft(rings, color, sides, True, transform)

    def rounded_box(self, center, size, color, bevel=.06, transform=None):
        x, y, z = center
        rx, ry, rz = (v/2 for v in size)
        b = min(bevel, rx*.65, ry*.65, rz*.65)
        self.loft([(z-rz, rx-b, ry-b, x, y, .36),
                   (z-rz+b, rx, ry, x, y, .36),
                   (z+rz-b, rx, ry, x, y, .36),
                   (z+rz, rx-b, ry-b, x, y, .36)], color, 8, False, transform)

    def prism(self, polygon, depth, color, y=0, bevel=0, transform=None):
        # Polygon is counter-clockwise in X/Z when seen from the front (-Y).
        cx = sum(p[0] for p in polygon)/len(polygon)
        cz = sum(p[1] for p in polygon)/len(polygon)
        span = max(max(abs(x-cx), abs(z-cz)) for x,z in polygon)
        inset = max(.05, 1-bevel/max(span, .01))
        n = len(polygon)
        rings = [(y-depth/2, inset), (y-depth/2+bevel, 1),
                 (y+depth/2-bevel, 1), (y+depth/2, inset)] if bevel else [(y-depth/2, 1), (y+depth/2, 1)]
        vertices = [(cx+(x-cx)*scale, yy, cz+(z-cz)*scale)
                    for yy,scale in rings for x,z in polygon]
        faces = []
        for j in range(len(rings)-1):
            for i in range(n):
                a, b = j*n+i, j*n+(i+1)%n
                faces.append((a, a+n, b+n, b))
        faces.extend([tuple(range(n)), tuple(reversed([(len(rings)-1)*n+i for i in range(n)]))])
        self.add(vertices, faces, color, False, transform)

    def tube(self, points, radius, color, sides=8, transform=None):
        vertices, faces = [], []
        points = [Vector(p) for p in points]
        for i, p in enumerate(points):
            tangent = (points[min(i+1, len(points)-1)]-points[max(i-1, 0)]).normalized()
            ref = Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((0,1,0))
            u = tangent.cross(ref).normalized()
            v = tangent.cross(u).normalized()
            for j in range(sides):
                a = 2*math.pi*j/sides
                vertices.append(p+radius*(math.cos(a)*u+math.sin(a)*v))
        for i in range(len(points)-1):
            for j in range(sides):
                a,b = i*sides+j,i*sides+(j+1)%sides
                faces.append((a,b,b+sides,a+sides))
        faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+i for i in range(sides))])
        self.add(vertices, faces, color, True, transform)

    def torus(self, center, major, minor, color, rotation=(0,0,0), segments=16, sides=6, transform=None):
        mat = Matrix.Translation(Vector(center)) @ Euler(rotation).to_matrix().to_4x4()
        if transform:
            mat = transform @ mat
        vertices,faces = [],[]
        for i in range(segments):
            a = 2*math.pi*i/segments
            for j in range(sides):
                b = 2*math.pi*j/sides
                vertices.append(((major+minor*math.cos(b))*math.cos(a),
                                 (major+minor*math.cos(b))*math.sin(a),minor*math.sin(b)))
        for i in range(segments):
            for j in range(sides):
                faces.append((i*sides+j,((i+1)%segments)*sides+j,
                              ((i+1)%segments)*sides+(j+1)%sides,i*sides+(j+1)%sides))
        self.add(vertices,faces,color,True,mat)

    def finish(self, name=None, normalize=True, origin_contract=None):
        mesh = bpy.data.meshes.new('mesh_'+self.key)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        colors = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
        for polygon,color,smooth in zip(mesh.polygons,self.colors,self.smoothing):
            polygon.use_smooth = smooth
            for loop in polygon.loop_indices:
                colors.data[loop].color_srgb = color
        mesh.materials.append(material)
        obj = bpy.data.objects.new(name or 'powerup_'+self.key,mesh)
        collection.objects.link(obj)
        if normalize:
            # Pickup roots have identical sizing/centering independent of shape.
            minimum = Vector(tuple(min(v[i] for v in self.vertices) for i in range(3)))
            maximum = Vector(tuple(max(v[i] for v in self.vertices) for i in range(3)))
            center = (minimum+maximum)/2
            factor = 1.4/max(maximum-minimum)
            for vertex in mesh.vertices:
                vertex.co = (vertex.co-center)*factor
            obj['booster_type'] = self.key
        else:
            obj['wearable_type'] = self.key
        obj['origin_contract'] = origin_contract or 'visual_center; glTF_Y_up; max_dimension_1_4'
        obj['provenance'] = 'Original procedural Blender art for 18Bro community game'
        mesh.calc_loop_triangles()
        return obj


def matrix(translation=(0,0,0), rotation=(0,0,0), scale=(1,1,1)):
    return Matrix.Translation(Vector(translation)) @ Euler(rotation).to_matrix().to_4x4() @ Matrix.Diagonal((*scale,1))


def star(shape, center, radius, color, points=4, depth=.055, transform=None):
    x,y,z=center
    poly=[]
    for i in range(points*2):
        a=math.pi/2+2*math.pi*i/(points*2)
        r=radius*(1 if i%2==0 else .32)
        poly.append((x+r*math.cos(a),z+r*math.sin(a)))
    shape.prism(poly,depth,color,y=y,transform=transform)


def paw(shape, center, scale, color, transform=None):
    x,y,z=center
    shape.ellipsoid((x,y,z),(.16*scale,.05*scale,.12*scale),color,sides=10,latitudes=4,transform=transform)
    # One central pad plus four distinct toe beans. This silhouette is shared
    # by the shield crest and smaller power-up details so every paw reads alike.
    for xx,zz,rr in ((-.19,.145,.068),(-.065,.225,.076),(.065,.225,.076),(.19,.145,.068)):
        shape.ellipsoid((x+xx*scale,y,z+zz*scale),(rr*scale,.045*scale,rr*1.1*scale),color,sides=8,latitudes=4,transform=transform)


def build_moped():
    s=Shape('moped')
    for y in (-.51,.45):
        s.torus((0,y,-.24),.19,.065,'rubber',(0,math.pi/2,0),segments=16,sides=8)
        for side in (-1,1):
            s.ellipsoid((side*.067,y,-.24),(.012,.143,.143),'cream',12,4)
            s.ellipsoid((side*.083,y,-.24),(.019,.066,.066),'gold',10,4)
    s.rounded_box((0,.035,-.10),(.40,.82,.12),'teal',.035)
    s.rounded_box((0,-.08,-.032),(.31,.51,.05),'cream',.020)
    s.loft([(-.14,.22,.26,0,.35,.65),(-.04,.29,.31,0,.32,.65),
            (.20,.27,.28,0,.33,.70),(.35,.20,.24,0,.34,.75)],'mint',12,True)
    s.rounded_box((0,.27,.365),(.44,.48,.13),'coral',.045)
    s.rounded_box((0,.30,.438),(.38,.41,.028),'ink',.015)
    s.loft([(-.12,.19,.16,0,-.43,.70),(.04,.25,.20,0,-.38,.65),
            (.38,.255,.14,0,-.35,.65),(.59,.20,.105,0,-.39,.70)],'teal',12,True)
    s.loft([(.02,.19,.09,0,-.525,.70),(.28,.21,.055,0,-.493,.70),
            (.49,.145,.040,0,-.485,.70)],'cream',10,True)
    s.tube([(0,-.40,.43),(0,-.44,.73)],.045,'ink')
    s.tube([(-.39,-.44,.71),(-.25,-.44,.75),(.25,-.44,.75),(.39,-.44,.71)],.035,'cream')
    for side in (-1,1):
        s.tube([(side*.28,-.44,.735),(side*.41,-.44,.70)],.052,'coral')
        s.ellipsoid((side*.145,-.514,.55),(.044,.025,.035),'gold',8,4)
    s.rounded_box((0,-.455,.64),(.24,.17,.20),'mint',.036)
    s.ellipsoid((0,-.555,.646),(.088,.022,.071),'ivory',12,4)
    s.rounded_box((0,.51,.20),(.34,.18,.20),'orange',.030)
    s.rounded_box((0,.612,.21),(.19,.035,.09),'cream',.015)
    return s.finish()


def build_shield():
    s=Shape('shield')
    poly=[(-.54,.24),(-.51,.59),(-.25,.45),(0,.48),(.25,.45),(.51,.59),
          (.54,.24),(.44,-.30),(0,-.66),(-.44,-.30)]
    s.prism(poly,.23,'teal_dark',bevel=.04)
    inner=[(x*.92,z*.92+.005) for x,z in poly]
    s.prism(inner,.10,'cream',y=-.141,bevel=.026)
    inner2=[(x*.80,z*.80+.010) for x,z in poly]
    s.prism(inner2,.10,'cyan',y=-.198,bevel=.024)
    inner3=[(x*.66,z*.67+.015) for x,z in poly]
    s.prism(inner3,.060,'teal',y=-.245,bevel=.016)
    paw(s,(0,-.295,-.07),1.15,'cream')
    s.prism([(-.13,-.42),(0,-.51),(.13,-.42),(0,-.30)],.07,'gold',y=-.267,bevel=.01)
    for side in (-1,1):
        s.ellipsoid((side*.36,-.206,.30),(.026,.02,.026),'gold',8,4)
    return s.finish()


def chip(s, tf, radius=.31):
    # Deliberately corrugated potato chip with a cupped center and warm edge.
    sides,rings=24,5
    vertices,faces=[],[]
    for depth in (-.016,.016):
        for j in range(rings):
            r=(j+.05)/(rings-.95)
            for i in range(sides):
                a=2*math.pi*i/sides
                x=radius*r*math.cos(a)
                z=radius*1.20*r*math.sin(a)
                y=.10*r*r+.015*math.sin(x*85)*(.45+.55*r)+depth
                vertices.append((x,y,z))
    n=sides*rings
    for layer in range(2):
        for j in range(rings-1):
            for i in range(sides):
                a=layer*n+j*sides+i;b=layer*n+j*sides+(i+1)%sides
                faces.append((a,b,b+sides,a+sides) if layer else (a+sides,b+sides,b,a))
    for i in range(sides):
        a=(rings-1)*sides+i;b=(rings-1)*sides+(i+1)%sides
        faces.append((a,b,b+n,a+n))
    s.add(vertices,faces,'gold',False,tf)


def build_doublechips():
    s=Shape('doublechips')
    # Two oversized chips fan out of a folded, pillow-shaped snack packet.
    for side in (-1,1):
        chip(s,matrix((side*.235,.04,.45),(side*.16,side*.23,side*-.15)))
    s.loft([(-.49,.40,.12,0,0,.50),(-.41,.47,.17,0,0,.57),
            (-.22,.49,.23,0,0,.70),(.06,.44,.21,0,0,.65),
            (.26,.37,.15,0,0,.55)],'orange',12,True)
    s.rounded_box((0,0,-.48),(.86,.23,.09),'cream',.020)
    for i in range(9):
        s.rounded_box((-.36+i*.09,-.121,-.49),(.018,.016,.065),'gold_dark',.004)
    s.rounded_box((0,0,.225),(.81,.20,.075),'teal',.018)
    # An inset cream badge carries a compact custom 2× relief. The object itself
    # remains a recognizable two-chip snack rather than relying on text alone.
    badge=[(-.32,-.31),(.31,-.27),(.29,.105),(-.31,.07)]
    s.prism(badge,.035,'cream',y=-.242,bevel=.006)
    numeral=[(-.255,-.20),(-.255,-.14),(-.125,-.03),(-.12,.012),(-.20,.018),
             (-.21,-.025),(-.27,-.017),(-.258,.059),(-.112,.074),(-.048,.025),
             (-.056,-.055),(-.184,-.160),(-.042,-.148),(-.046,-.216)]
    s.prism(numeral,.040,'teal_dark',y=-.278)
    for angle in (-.72,.72):
        tf=matrix((.135,-.281,-.074),(0,angle,0))
        s.rounded_box((0,0,0),(.056,.04,.218),'coral',.009,tf)
    star(s,(.48,-.09,.43),.12,'cream',4)
    return s.finish()


def build_jetpack():
    s=Shape('jetpack')
    s.rounded_box((0,.08,.04),(.62,.30,.74),'teal_dark',.05)
    for side in (-1,1):
        x=side*.29
        s.loft([(-.35,.12,.15,x,0,1),(-.27,.18,.19,x,0,1),
                (.28,.18,.19,x,0,1),(.40,.135,.148,x,0,1),
                (.45,.03,.055,x,0,1)],'cream',12,True)
        s.loft([(-.19,.184,.196,x,0,1),(-.10,.188,.20,x,0,1),
                (.16,.188,.20,x,0,1),(.22,.184,.196,x,0,1)],'teal',12,True)
        s.rounded_box((x,-.206,.02),(.06,.026,.22),'mint',.010)
        s.loft([(-.40,.108,.13,x,0,1),(-.31,.15,.17,x,0,1)],'gold',10,False)
        s.loft([(-.445,.145,.15,x,0,1),(-.40,.11,.13,x,0,1)],'ink',10,False)
        s.loft([(-.70,.009,.015,x,0,1),(-.58,.075,.07,x,0,1),
                (-.435,.108,.11,x,0,1)],'cyan',8,False)
        s.loft([(-.61,.008,.014,x,-.025,1),(-.54,.04,.04,x,-.025,1),
                (-.445,.06,.055,x,-.025,1)],'ivory',8,False)
        wing=[(side*.42,.23),(side*.69,-.02),(side*.68,-.28),(side*.44,-.11)]
        s.prism(wing,.12,'coral',y=.055,bevel=.018)
    s.rounded_box((0,-.196,.065),(.20,.11,.32),'orange',.036)
    paw(s,(0,-.267,.035),.36,'cream')
    s.tube([(-.24,.0,.31),(-.19,.06,.53),(.19,.06,.53),(.24,0,.31)],.037,'ink',8)
    return s.finish()


def build_speedburst():
    s=Shape('speedburst')
    # A cut-glass comet with a bold inset lightning stroke. The asymmetric
    # three-stream silhouette stays legible at HUD size and from the rear.
    diamond=[(-.28,.10),(-.20,.43),(.15,.70),(.50,.50),(.59,.17),(.32,-.12),(-.02,-.19)]
    s.prism(diamond,.26,'speed_dark',y=.015,bevel=.030)
    ring=[(x*.91+.015,z*.91+.018) for x,z in diamond]
    s.prism(ring,.075,'cyan',y=-.15,bevel=.014)
    # Seven front facets meet on a raised ridge; their deliberate color changes
    # give a diamond impression without textures, transparency or extra draws.
    center=(.18,-.259,.255)
    rim=[(x*.81+.028,-.194,z*.81+.037) for x,z in diamond]
    facet_colors=['blue','ice','cyan','speed_blue','blue','cyan','speed_blue']
    for i,color in enumerate(facet_colors):
        s.add([rim[i],rim[(i+1)%len(rim)],center],[(0,1,2)],color)
    bolt=[(.15,.55),(-.055,.205),(.125,.205),(.02,-.015),(.395,.34),(.215,.305),(.33,.55)]
    s.prism(bolt,.034,'ivory',y=-.286,bevel=.006)
    # Tails emerge behind the jewel as tapered broken rays, not a circular badge.
    rays=[([(-.21,.16),(-.87,-.25),(-.65,-.28),(-1.00,-.57),(-.42,-.35),(.035,-.13)],'speed_blue'),
          ([(-.07,-.09),(-.59,-.57),(-.38,-.51),(-.51,-.81),(.22,-.22),(.24,-.03)],'cyan'),
          ([(-.15,.34),(-.69,.18),(-.54,.08),(-.78,-.05),(-.30,.03)],'ice')]
    for polygon,color in rays:
        s.prism(polygon,.095,color,y=.050,bevel=.013)
    s.prism([(-.38,-.33),(-.76,-.57),(-.43,-.48),(-.21,-.28)],.034,'ice',y=-.016)
    star(s,(.65,-.03,.64),.12,'ice',4,depth=.04)
    star(s,(-.48,.04,.48),.065,'cyan',4,depth=.04)
    return s.finish()


import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from powerup_models_v6 import make_builders
build_magnet,build_moon,build_wearable_magnet,build_wearable_moon=make_builders(Shape,matrix,Matrix,math,COLORS)

objects = {key: builder() for key,builder in (
    ('magnet',build_magnet),('moon',build_moon),('moped',build_moped),
    ('shield',build_shield),('doublechips',build_doublechips),('jetpack',build_jetpack),
    ('speedburst',build_speedburst))}
wearables={'magnet':build_wearable_magnet(),
           'moon_L':build_wearable_moon('L'),'moon_R':build_wearable_moon('R')}
all_objects=[*objects.values(),*wearables.values()]

# Fix polygon winding consistently, then keep purposeful smooth/flat boundaries.
for obj in all_objects:
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)

bpy.ops.object.select_all(action='DESELECT')
for obj in all_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active=objects['magnet']
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',use_selection=True,
                         export_yup=True,export_cameras=False,export_lights=False,
                         export_animations=False,export_extras=True,
                         export_vertex_color='MATERIAL',export_all_vertex_colors=False)

blob=OUTPUT.read_bytes()
assert blob[:4]==b'glTF' and struct.unpack_from('<I',blob,8)[0]==len(blob)
json_length=struct.unpack_from('<I',blob,12)[0]
gltf=json.loads(blob[20:20+json_length])
assert len(gltf['nodes'])==10
assert {n['name'] for n in gltf['nodes']}=={'powerup_'+key for key in objects}|{'wearable_'+key for key in wearables}
assert not gltf.get('skins') and not gltf.get('animations') and not gltf.get('images')
assert not any('uri' in buffer for buffer in gltf.get('buffers',[]))
assert len(gltf['materials'])==1
assert len(blob)<900000

# Consistent original product photography: three soft studio lights, transparent
# backdrop, orthographic lens, no gameplay bloom baked into the icon alpha.
scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.resolution_x=256
scene.render.resolution_y=256
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.image_settings.color_depth='8'
scene.render.image_settings.compression=75
scene.view_settings.view_transform='Standard'
scene.view_settings.look='Medium High Contrast'
scene.view_settings.exposure=-.25
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.5,.62,.62,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45

def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

for name,location,power,size,color in (
    ('STUDIO_key',(-3,-4,5),330,4,(1,.92,.78)),
    ('STUDIO_fill',(4,-2,2),150,3,(.72,.93,1)),
    ('STUDIO_rim',(1,3,4),420,3,(1,1,.90))):
    light_data=bpy.data.lights.new(name,'AREA')
    light_data.energy,light_data.shape,light_data.size=power,'DISK',size
    light_data.color=color
    light=bpy.data.objects.new(name,light_data)
    scene.collection.objects.link(light)
    light.location=location
    aim(light,(0,0,0))
camera_data=bpy.data.cameras.new('STUDIO_camera')
camera=bpy.data.objects.new('STUDIO_camera',camera_data)
scene.collection.objects.link(camera)
scene.camera=camera
camera_data.type='ORTHO'
camera_data.ortho_scale=1.87
camera.location=(3.2,-6.0,3.0)
aim(camera,(0,0,0))

effects={
    'magnet':dict(label='Chip Magnet',color='#ed593a',secondary='#1578dc',aura='one centred magnetic signal above a gold zap',bobAmplitude=.075,bobHz=1.1,spinHz=.16),
    'moon':dict(label='Moon Paws',color='#b3ec59',secondary='#126148',aura='contained green/red heel arrows and rising star motes',bobAmplitude=.12,bobHz=1.25,spinHz=.12),
    'moped':dict(label='Snack Scooter',color='#70ead0',secondary='#ff8b29',aura='tilted speed hoop with two trailing dashes',bobAmplitude=.065,bobHz=.9,spinHz=.10),
    'shield':dict(label='Snack Guard',color='#59d9ed',secondary='#fff2ce',aura='three slow curved shell arcs and breathing paw glints',bobAmplitude=.07,bobHz=.85,spinHz=.13),
    'doublechips':dict(label='Double Crunch',color='#f7c343',secondary='#ed593a',aura='twin golden orbits and tiny four-point sparkles',bobAmplitude=.09,bobHz=1.0,spinHz=.14),
    'jetpack':dict(label='Chip Jet',color='#59d9ed',secondary='#ff8b29',aura='two soft downward exhaust ribbons and rising cyan flecks',bobAmplitude=.10,bobHz=1.2,spinHz=.12),
    'speedburst':dict(label='Energy Burst',color='#59d9ed',secondary='#1578dc',aura='three swept cyan energy tails and pulsing diamond flashes',bobAmplitude=.10,bobHz=1.4,spinHz=.16),
}

report={
    'schemaVersion':2,'assetId':'powerups-v1','revision':6,'blenderVersion':bpy.app.version_string,
    'source':'art/powerups/powerups.blend','output':'dist/assets/models/powerups-v1.glb',
    'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob),'materials':1,'materialNames':['powerup_palette'],
    'coordinates':'glTF Y-up; forward +Z; pickup roots: centered, max dimension 1.4; wearable roots: paw/ankle pivot, authored meter scale',
    'meshPolicy':'one mesh per named root; static geometry; one shared vertex-color material; no external resources',
    'provenance':'Original geometry authored in repository Python with Blender. No external media, fonts or source artwork.',
    'assets':{},'wearables':{},
}
for key,obj in objects.items():
    for other in all_objects:
        other.hide_render=other!=obj
    scene.render.filepath=str(ICONS/('powerup-'+key+'.png'))
    bpy.ops.render.render(write_still=True)
    png=Path(scene.render.filepath).read_bytes()
    assert png[:8]==b'\x89PNG\r\n\x1a\n'
    assert struct.unpack_from('>II',png,16)==(256,256) and png[25]==6
    review_image=bpy.data.images.load(scene.render.filepath,check_existing=False)
    alpha=list(review_image.pixels)[3::4]
    visible=[i for i,a in enumerate(alpha) if a>.05]
    opaque=sum(a>.95 for a in alpha)
    alpha_bounds=[min(i%256 for i in visible),min(i//256 for i in visible),
                  max(i%256 for i in visible),max(i//256 for i in visible)]
    assert opaque>3500 and len(visible)<54000,(key,'missing subject or transparency')
    assert min(alpha_bounds[:2])>=5 and max(alpha_bounds[2:])<=250,(key,'icon clipped')
    bpy.data.images.remove(review_image)
    obj.data.calc_loop_triangles()
    # Export conversion: Blender X/Y/Z -> glTF X/Z/-Y.
    positions=[(v.co.x,v.co.z,-v.co.y) for v in obj.data.vertices]
    report['assets'][key]={
        'root':'powerup_'+key,'mesh':'mesh_'+key,
        'triangles':len(obj.data.loop_triangles),'vertices':len(obj.data.vertices),
        'bounds':{'min':[min(v[i] for v in positions) for i in range(3)],
                  'max':[max(v[i] for v in positions) for i in range(3)]},
        'icon':{'path':'dist/assets/icons/powerup-'+key+'.png','width':256,'height':256,
                'bytes':len(png),'sha256':hashlib.sha256(png).hexdigest(),
                'alphaBoundsBottomOrigin':alpha_bounds,'opaquePixels':opaque},
        'effects':effects[key],
    }
wearable_contracts={
    'magnet':{'attachTo':'socket_carry_L','origin':'center of paw grip on lower bridge',
              'orientation':'neutral glTF Y-up, pole tips +Y, front +Z',
              'recommendedScale':1,'restOffset':[0,0,0],'recommendedEulerXYZ':[0,0,0]},
    'moon_L':{'attachTo':'foot_L','origin':'ankle pivot; sole is Y=-0.12',
              'orientation':'neutral glTF Y-up, toe +Z; apply inverse bone REST rotation when attaching',
              'recommendedScale':1,'restOffset':[0,0,0]},
    'moon_R':{'attachTo':'foot_R','origin':'ankle pivot; sole is Y=-0.12',
              'orientation':'neutral glTF Y-up, toe +Z; apply inverse bone REST rotation when attaching',
              'recommendedScale':1,'restOffset':[0,0,0]},
}
for key,obj in wearables.items():
    obj.data.calc_loop_triangles()
    positions=[(v.co.x,v.co.z,-v.co.y) for v in obj.data.vertices]
    minimum=[min(v[i] for v in positions) for i in range(3)]
    maximum=[max(v[i] for v in positions) for i in range(3)]
    report['wearables'][key]={
        'root':obj.name,'mesh':obj.data.name,
        'triangles':len(obj.data.loop_triangles),'vertices':len(obj.data.vertices),
        'bounds':{'min':minimum,'max':maximum},
        'dimensions':[maximum[i]-minimum[i] for i in range(3)],
        **wearable_contracts[key],
    }
report['pickupTriangles']=sum(asset['triangles'] for asset in report['assets'].values())
report['wearableTriangles']=sum(asset['triangles'] for asset in report['wearables'].values())
report['triangles']=report['pickupTriangles']+report['wearableTriangles']
assert report['triangles']<15000
(SOURCE.parent/'manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')

# Render a clean 4-by-2 asset board plus an attachment board, then restore the
# source's identity transforms. Wearables never enter a pickup icon or root.
for obj in wearables.values():
    obj.hide_render=True
for i,obj in enumerate(objects.values()):
    obj.hide_render=False
    obj.location=((i%4-1.5)*1.85,0,(.5-i//4)*2.0)
camera.location=(3.2,-12,5.7)
aim(camera,(0,0,0))
camera_data.ortho_scale=8.4
scene.render.resolution_x=1200
scene.render.resolution_y=650
scene.render.filepath=str(REVIEW/'contact-sheet.png')
bpy.ops.render.render(write_still=True)
for obj in objects.values():
    obj.hide_render=True
for i,obj in enumerate(wearables.values()):
    obj.hide_render=False
    obj.location=((-1+i)*.95,0,-.10)
camera.location=(2.0,-8,3.8)
aim(camera,(0,0,.08))
camera_data.ortho_scale=3.4
scene.render.resolution_x=1100
scene.render.resolution_y=440
scene.render.filepath=str(REVIEW/'wearables-front.png')
bpy.ops.render.render(write_still=True)
camera.location=(-2.0,8,3.8)
aim(camera,(0,0,.08))
scene.render.filepath=str(REVIEW/'wearables-rear.png')
bpy.ops.render.render(write_still=True)
for obj in wearables.values():
    obj.location=(0,0,0)
    obj.hide_render=True
    obj.hide_set(True)
for key,obj in objects.items():
    obj.location=(0,0,0)
    obj.hide_render=key!='magnet'
    obj.hide_set(key!='magnet')
camera.location=(3.2,-6.0,3.0)
aim(camera,(0,0,0))
camera_data.ortho_scale=1.87
scene.render.resolution_x=256
scene.render.resolution_y=256
scene.render.filepath=str(ICONS/'powerup-magnet.png')
bpy.ops.object.select_all(action='DESELECT')
objects['magnet'].select_set(True)
bpy.context.view_layer.objects.active=objects['magnet']
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
print(json.dumps({'powerupAssets':report,'review':str(REVIEW/'contact-sheet.png')},indent=2))
