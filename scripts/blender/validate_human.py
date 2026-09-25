"""Validate both saved human source and a fresh import of its actual GLB.

Run through Blender --background --factory-startup --disable-autoexec.
Writes review evidence only; never changes the source or runtime model.
"""
from pathlib import Path
import hashlib
import json
import math
import struct
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'art/characters/human/human.blend'
OUTPUT=ROOT/'dist/assets/models/human-v1.glb'
REVIEW=ROOT/'release/human-review'
manifest=json.loads((SOURCE.parent/'manifest-entry.json').read_text())
blob=OUTPUT.read_bytes()
assert hashlib.sha256(blob).hexdigest()==manifest['sha256']
length=struct.unpack_from('<I',blob,12)[0]
gltf=json.loads(blob[20:20+length])
binary_start=28+length
widths={'SCALAR':1,'VEC3':3,'VEC4':4}

def accessor_values(index):
    accessor=gltf['accessors'][index]
    assert accessor['componentType']==5126
    view=gltf['bufferViews'][accessor['bufferView']]
    width=widths[accessor['type']]
    offset=binary_start+view.get('byteOffset',0)+accessor.get('byteOffset',0)
    stride=view.get('byteStride',width*4)
    return [struct.unpack_from('<'+'f'*width,blob,offset+index*stride) for index in range(accessor['count'])]

clip_reports={}
deform_names={'hips','spine','head','mouth','arm_L','arm_R','forearm_L','forearm_R',
              'hand_L','hand_R','leg_L','leg_R','shin_L','shin_R','foot_L','foot_R'}
for animation in gltf['animations']:
    names=set()
    worst_loop_error=0
    max_angular_step=0
    for channel in animation['channels']:
        target=channel['target']
        name=gltf['nodes'][target['node']]['name']
        sampler=animation['samplers'][channel['sampler']]
        times=accessor_values(sampler['input'])
        assert abs(times[0][0])<1e-8,(animation['name'],'clip must start at zero')
        values=accessor_values(sampler['output'])
        if target['path']=='rotation':
            names.add(name)
            assert all(abs(sum(v*v for v in sample)-1)<1e-4 for sample in values)
            dot=abs(sum(a*b for a,b in zip(values[0],values[-1])))
            worst_loop_error=max(worst_loop_error,1-min(1,dot))
            for a,b in zip(values,values[1:]):
                dot=min(1,abs(sum(x*y for x,y in zip(a,b))))
                max_angular_step=max(max_angular_step,2*math.acos(dot))
        else:
            worst_loop_error=max(worst_loop_error,max(abs(a-b) for a,b in zip(values[0],values[-1])))
        if name in ('root','human_rig'):
            assert all(all(abs(a-b)<1e-6 for a,b in zip(values[0],sample)) for sample in values)
    assert deform_names.issubset(names),(animation['name'],deform_names-names)
    assert worst_loop_error<1e-5,(animation['name'],worst_loop_error)
    assert max_angular_step<.40,(animation['name'],max_angular_step)
    clip_reports[animation['name']]={'keyedDeformBones':len(deform_names),
        'loopError':worst_loop_error,'maxAngularStepRadians':max_angular_step}

bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False,use_scripts=False)
source_rig=bpy.data.objects['human_rig']
assert len(source_rig.data.bones)==22
assert tuple(source_rig.location)==(0,0,0)
assert tuple(source_rig.scale)==(1,1,1)
for obj in source_rig.children:
    if obj.type=='MESH':
        for vertex in obj.data.vertices:
            assert len(vertex.groups)<=2
            assert abs(sum(group.weight for group in vertex.groups)-1)<1e-5

source_root_matrices=[]
support_points={}
for clip in manifest['clips']:
    action=bpy.data.actions[clip]
    source_rig.animation_data.action=action
    first,last=map(round,action.frame_range)
    for frame in range(first,last+1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        source_root_matrices.append(source_rig.pose.bones['root'].matrix.copy())
        assert all(math.isfinite(value) for bone in source_rig.pose.bones for row in bone.matrix for value in row)
    if clip in ('carry_left','carry_right'):
        side='L' if clip=='carry_left' else 'R'
        point=source_rig.pose.bones['socket_carry_'+side].head
        target=Vector((-.652 if side=='L' else .652,.25,1.375))
        error=(point-target).length
        assert error<.06,(clip,tuple(point),error)
        support_points[clip]={'socketBlenderZUp':list(point),'targetError':error}
reference=source_root_matrices[0]
assert all(max(abs(a-b) for row_a,row_b in zip(reference,matrix) for a,b in zip(row_a,row_b))<1e-6 for matrix in source_root_matrices)

# Import serialized GLB into an empty scene, proving ordinary Blender glTF
# re-import sees the same rig, role parts and animation track names.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUTPUT))
rigs=[obj for obj in bpy.data.objects if obj.type=='ARMATURE']
assert len(rigs)==1
rig=rigs[0]
assert len(rig.data.bones)==22
expected_meshes={'human_skin','human_clothes','human_details','hair_short','hair_bob',
                 'role_police','role_cashier','role_rider'}
assert expected_meshes.issubset({obj.name for obj in bpy.data.objects if obj.type=='MESH'})
tracks={track.name:track for track in rig.animation_data.nla_tracks}
assert set(manifest['clips']).issubset(tracks),(manifest['clips'],list(tracks))
for track in tracks.values():
    track.mute=True
roundtrip_frames=0
for name in manifest['clips']:
    action=tracks[name].strips[0].action
    rig.animation_data.action=action
    start,end=map(round,action.frame_range)
    for frame in (start,(start+end)//2,end):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        assert all(math.isfinite(value) for bone in rig.pose.bones for row in bone.matrix for value in row)
        roundtrip_frames+=1

result={'source':str(SOURCE.relative_to(ROOT)),'output':str(OUTPUT.relative_to(ROOT)),
        'sha256':manifest['sha256'],'clips':clip_reports,'supportSockets':support_points,
        'sourcePoseSamples':len(source_root_matrices),'roundtripPoseSamples':roundtrip_frames,
        'roundtripBones':len(rig.data.bones),'roundtripMeshes':sorted(expected_meshes)}
(REVIEW/'roundtrip-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print('HUMAN_ROUNDTRIP_VALID',json.dumps(result))
