"""Render authored roll, scooter contacts and cashier panic from saved sources.

Review props never enter the source .blend or exported GLBs. The scooter is an
exact-size blocking replica of the game's existing vehicle, so hand/seat contact
can be judged before the chief's in-game review.
"""
from pathlib import Path
import math
import json
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
REVIEW=ROOT/'release/power-animation-review'
REVIEW.mkdir(parents=True,exist_ok=True)
WIDTH,HEIGHT=336,392


def aim(camera,target):
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()


def sheet(paths,name,columns=4):
    rows=math.ceil(len(paths)/columns)
    out=bpy.data.images.new(name,width=WIDTH*columns,height=HEIGHT*rows,alpha=False)
    pixels=[.10,.13,.13,1]*(WIDTH*columns*HEIGHT*rows)
    for index,path in enumerate(paths):
        source=bpy.data.images.load(str(path),check_existing=False)
        values=list(source.pixels)
        left=(index%columns)*WIDTH
        bottom=(rows-1-index//columns)*HEIGHT
        for row in range(HEIGHT):
            start=((bottom+row)*WIDTH*columns+left)*4
            pixels[start:start+WIDTH*4]=values[row*WIDTH*4:(row+1)*WIDTH*4]
        bpy.data.images.remove(source)
    out.pixels[:]=pixels
    out.filepath_raw=str(REVIEW/(name+'.png'))
    out.file_format='PNG'
    out.save()
    bpy.data.images.remove(out)


def settings(scene):
    scene.render.resolution_x=WIDTH
    scene.render.resolution_y=HEIGHT
    scene.render.resolution_percentage=100
    scene.cycles.samples=10


bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/characters/18bro/18bro.blend'),load_ui=False,use_scripts=False)
scene=bpy.context.scene
rig=bpy.data.objects['18bro_rig']
camera=scene.camera
settings(scene)
camera.data.ortho_scale=3.75


def render_cat(clip,t,label,rear=False):
    action=bpy.data.actions[clip]
    rig.animation_data.action=action
    scene.frame_set(round(action.frame_range[1]*t))
    camera.location=(3,6,2.8) if rear else (3,-6,2.8)
    aim(camera,(0,0,1.35))
    path=REVIEW/(label+'.png')
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    return path


rolls=[render_cat('roll',t,'roll-'+str(index)) for index,t in enumerate((0,.16,.32,.5,.68,.84,1))]
sheet(rolls,'roll-contact-sheet')

# Match runtime vehicle dimensions in the cat's normalized authoring space.
scale=.82/(2.4/(2.736-.003))
floor_offset=-.08/(2.4/(2.736-.003))
materials={}
for name,color in (('red',(.66,.032,.033,1)),('black',(.025,.032,.038,1)),
                   ('metal',(.42,.49,.48,1)),('light',(.92,.88,.60,1))):
    material=bpy.data.materials.new('REVIEW_scooter_'+name)
    material.diffuse_color=color
    materials[name]=material


def vehicle_box(name,color,center,size,bevel=.025):
    x,y,z=center
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x*scale,-z*scale,y*scale+floor_offset))
    obj=bpy.context.object
    obj.name='REVIEW_scooter_'+name
    obj.dimensions=(size[0]*scale,size[2]*scale,size[1]*scale)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(materials[color])
    modifier=obj.modifiers.new('Rounded silhouette','BEVEL')
    modifier.width=bevel
    modifier.segments=2


for index,z in enumerate((-.65,.69)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.27*scale,depth=.13*scale,
        location=(0,-z*scale,.27*scale+floor_offset),rotation=(0,math.pi/2,0))
    bpy.context.object.name='REVIEW_scooter_wheel_'+str(index)
    bpy.context.object.data.materials.append(materials['black'])
vehicle_box('rear','red',(0,.47,-.26),(.55,.42,.92),.07)
vehicle_box('seat','black',(0,.76,-.25),(.53,.12,.69),.04)
vehicle_box('legshield','red',(0,.72,.57),(.54,.95,.3),.07)
vehicle_box('floor','black',(0,.36,.25),(.58,.1,.67))
vehicle_box('headlamp','red',(0,1.26,.55),(.68,.32,.3),.12)
vehicle_box('lamp','light',(0,1.28,.72),(.31,.17,.025),.04)
vehicle_box('handlebar','metal',(0,1.31,.44),(.9,.05,.06))
for side in (-1,1):
    vehicle_box('grip','black',(side*.4,1.31,.45),(.15,.08,.08))

states=[('ride',.25),('moped_mount',.42),('moped_jump',.5),('moped_slide_L',.5),('moped_slide_R',.5)]
vehicle_frames=[]
for rear in (False,True):
    for clip,t in states:
        vehicle_frames.append(render_cat(clip,t,clip+('-rear' if rear else '-front'),rear))
sheet(vehicle_frames,'scooter-contact-sheet',5)

bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/characters/human/human.blend'),load_ui=False,use_scripts=False)
scene=bpy.context.scene
settings(scene)
rig=bpy.data.objects['human_rig']
camera=scene.camera
camera.data.ortho_scale=2.65
for obj in rig.children:
    if obj.type=='MESH':
        hidden=(obj.name.startswith('role_') and obj.name!='role_cashier') or obj.name=='hair_bob'
        obj.hide_render=hidden
        obj.hide_viewport=hidden
bpy.data.materials['clothes'].node_tree.nodes['REVIEW_tint'].inputs[2].default_value=(.87,.84,.67,1)
rig.animation_data.action=bpy.data.actions['panic']
panic_frames=[]
for index,fraction in enumerate((0,.25,.5,.75)):
    scene.frame_set(round(rig.animation_data.action.frame_range[1]*fraction))
    camera.location=(1.4,-6,2.5)
    aim(camera,(0,0,1.18))
    path=REVIEW/('cashier-panic-'+str(index)+'.png')
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    panic_frames.append(path)
sheet(panic_frames,'cashier-panic-contact-sheet')
(REVIEW/'order.json').write_text(json.dumps({
    'roll-contact-sheet':[0,.16,.32,.5,.68,.84,1],
    'scooter-contact-sheet':{'columns':[name for name,t in states],'rows':['front','rear']},
    'cashier-panic-contact-sheet':[0,.25,.5,.75]},indent=2)+'\n')
print('POWER_ANIMATION_REVIEW',REVIEW)
