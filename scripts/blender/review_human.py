"""Render cast and gait contact sheets from the saved human source scene."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
REVIEW=ROOT/'release/human-review'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/characters/human/human.blend'),load_ui=False,use_scripts=False)
rig=bpy.data.objects['human_rig']
parts=[obj for obj in rig.children if obj.type=='MESH']
scene=bpy.context.scene
scene.render.resolution_x=1600
scene.render.resolution_y=650
scene.render.resolution_percentage=100
scene.cycles.samples=24
camera=scene.camera
camera.data.ortho_scale=7.25
camera.location=(2,-10,3.2)
camera.rotation_euler=(Vector((0,0,1.10))-camera.location).to_track_quat('-Z','Y').to_euler()

def tint(slot,color):
    bpy.data.materials[slot].node_tree.nodes['REVIEW_tint'].inputs[2].default_value=(*color,1)

def freeze_actor(label,x,role,hair,clip,frame,shirt,skin):
    for obj in parts:
        visible=not ((obj.name.startswith('role_') and obj.name!='role_'+role) or
                     (obj.name.startswith('hair_') and (role in ('police','rider') or obj.name!='hair_'+hair)))
        obj.hide_viewport=not visible
        obj.hide_render=not visible
    tint('clothes',shirt)
    tint('skin',skin)
    rig.animation_data.action=bpy.data.actions[clip]
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    copies=[]
    for obj in parts:
        if obj.hide_render:
            continue
        mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(graph),preserve_all_data_layers=True,depsgraph=graph)
        for index,material in enumerate(mesh.materials):
            mesh.materials[index]=material.copy()
        copy=bpy.data.objects.new('REVIEW_'+label+'_'+obj.name,mesh)
        scene.collection.objects.link(copy)
        copy.location.x=x
        copies.append(copy)
    return copies

families=[
    ('police',-2.25,'police','short','idle',1,(.45,.70,.85),(.61,.40,.27)),
    ('cashier',-.75,'cashier','short','clerk',12,(.87,.84,.67),(.73,.50,.34)),
    ('pedestrian',.75,'civilian','bob','walk',9,(.81,.28,.19),(.43,.26,.16)),
    ('rider',2.25,'rider','short','ride',1,(.35,.64,.42),(.63,.40,.24)),
]
copies=[]
for spec in families:
    copies.extend(freeze_actor(*spec))
for obj in parts:
    obj.hide_render=True
scene.render.filepath=str(REVIEW/'human-cast.png')
bpy.ops.render.render(write_still=True)
for obj in copies:
    bpy.data.objects.remove(obj,do_unlink=True)

for index,frame in enumerate((1,6,11,16)):
    freeze_actor('run_'+str(frame),(index-1.5)*1.5,'police','short','run',frame,(.45,.70,.85),(.61,.40,.27))
for obj in parts:
    obj.hide_render=True
scene.render.filepath=str(REVIEW/'run-cycle.png')
bpy.ops.render.render(write_still=True)
print('HUMAN_REVIEW_COMPLETE',REVIEW/'human-cast.png',REVIEW/'run-cycle.png')
