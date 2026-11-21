"""
GLASSIT studio bake for the live 3D carousel.

1. Builds and exports the six product GLBs (build_glassit.py) with 1024px medallions + relief normal maps.
2. Path-traces a 360° HDR light map of a warm plaster studio with window softboxes (studio.hdr),
   used by the website for realistic reflections and the blurred backdrop.
3. Bakes a soft contact-shadow decal for each product (shadow-<key>.png + shadows.json).
4. Bakes a travertine albedo texture for the plinths (travertine.jpg).

  Blender -b -P blender/bake_glassit_studio.py -- <site_root>
"""
import bpy, sys, os, math, json
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
SITE = os.path.abspath(argv[0])
SHADOWS_ONLY = "--shadows-only" in argv
sys.argv = [sys.argv[0], "--", SITE]
exec(compile(open(os.path.join(SITE, "blender", "build_glassit.py")).read(), "build_glassit.py", "exec"))
OUT = os.path.join(SITE, "assets", "glassit3d")
scene = bpy.context.scene

def node_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"], m.node_tree.nodes["Material Output"]

def emissive(name, color, strength):
    m, nt, b, out = node_mat(name)
    nt.nodes.remove(b); e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1); e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs[0], out.inputs[0])
    return m

def plaster(name, color):
    m, nt, b, out = node_mat(name)
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 30; n.inputs["Detail"].default_value = 6
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.elements[0].color = (*[c * 0.93 for c in color], 1); r.color_ramp.elements[1].color = (*color, 1)
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.95
    return m

def travertine(name):
    m, nt, b, out = node_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1, 4.5, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 9; n.inputs["Detail"].default_value = 12; n.inputs["Distortion"].default_value = 1.3
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.elements[0].position = 0.3; r.color_ramp.elements[0].color = (0.62, 0.53, 0.41, 1)
    r.color_ramp.elements[1].position = 0.72; r.color_ramp.elements[1].color = (0.86, 0.79, 0.68, 1)
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    v = nt.nodes.new("ShaderNodeTexVoronoi"); v.inputs["Scale"].default_value = 70
    nt.links.new(mp.outputs["Vector"], v.inputs["Vector"])
    pits = nt.nodes.new("ShaderNodeMapRange"); pits.inputs["From Min"].default_value = 0.0; pits.inputs["From Max"].default_value = 0.14
    pits.inputs["To Min"].default_value = 0.55; pits.inputs["To Max"].default_value = 1.0
    nt.links.new(v.outputs["Distance"], pits.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMixRGB"); mix.blend_type = "MULTIPLY"; mix.inputs["Fac"].default_value = 1
    nt.links.new(r.outputs["Color"], mix.inputs["Color1"]); nt.links.new(pits.outputs["Result"], mix.inputs["Color2"])
    nt.links.new(mix.outputs["Color"], b.inputs["Base Color"])
    return m

def cycles(samples, res, transparent=False):
    scene.render.engine = "CYCLES"
    try:
        pr = bpy.context.preferences.addons["cycles"].preferences; pr.compute_device_type = "METAL"; pr.get_devices()
        for d in pr.devices: d.use = True
        scene.cycles.device = "GPU"
    except Exception as e:
        print("GPU unavailable", e)
    scene.cycles.samples = samples; scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 12; scene.cycles.transmission_bounces = 12
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = transparent
    scene.view_settings.view_transform = "Standard"; scene.view_settings.look = "None"

# hide products while baking the room
for parts in products.values():
    for ob in parts: ob.hide_render = True

# ------------------------------------------------------------------ 2. studio HDR
WALL = (0.40, 0.355, 0.30)
bpy.ops.mesh.primitive_cube_add(size=1); room = bpy.context.active_object
room.scale = (4.0, 4.0, 2.6); room.location = (0, 0.6, 1.25)
room.data.materials.append(plaster("Plaster", WALL))
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.flip_normals(); bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.mesh.primitive_plane_add(size=1); fl = bpy.context.active_object
fl.scale = (4, 4, 1); fl.location = (0, 0.6, -0.02)
fl.data.materials.append(plaster("Floor", (0.30, 0.26, 0.21)))

def panel(name, loc, size, color, strength):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc); p = bpy.context.active_object; p.name = name
    p.scale = (size[0], size[1], 1)
    d = mathutils.Vector((0, 0, 0.15)) - p.location
    p.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    p.data.materials.append(emissive(name, color, strength))
    return p

# window softbox (key) on the left, big and warm; fill on the right; overhead strip; small back accents
panel("Window", (-1.9, -0.2, 1.0), (1.4, 1.9), (1.0, 0.94, 0.84), 16.0)
panel("Fill", (1.9, -0.6, 0.8), (1.2, 1.4), (1.0, 0.97, 0.93), 5.0)
panel("Top", (0.0, 0.0, 2.4), (2.2, 0.5), (1.0, 0.96, 0.9), 8.0)
panel("BackL", (-1.2, 2.5, 0.9), (0.25, 1.6), (1.0, 0.9, 0.78), 4.5)
panel("BackR", (1.3, 2.5, 0.9), (0.25, 1.6), (1.0, 0.9, 0.78), 4.5)

world = bpy.data.worlds.new("W"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[1].default_value = 0.0

if not SHADOWS_ONLY:
  bpy.ops.object.camera_add(location=(0, 0, 0.15)); pano = bpy.context.active_object; scene.camera = pano
  pano.data.type = "PANO"
  try: pano.data.panorama_type = "EQUIRECTANGULAR"
  except Exception: pano.data.cycles.panorama_type = "EQUIRECTANGULAR"
  pano.rotation_euler = (math.pi / 2, 0, 0)   # look along +Y with Z up
  cycles(256, (2048, 1024))
  scene.render.image_settings.file_format = "HDR"
  scene.render.filepath = os.path.join(OUT, "studio.hdr")
  bpy.ops.render.render(write_still=True)
  print("GLASSIT: studio.hdr")

# ------------------------------------------------------------------ 4. travertine albedo
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 5)); slab = bpy.context.active_object
slab.data.materials.append(travertine("Trav"))
for o in (room, fl): o.hide_render = True
for o in bpy.data.objects:
    if o.name in ("Window", "Fill", "Top", "BackL", "BackR"): o.hide_render = True
world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
bpy.ops.object.camera_add(location=(0, 0, 6)); top = bpy.context.active_object; scene.camera = top
top.data.type = "ORTHO"; top.data.ortho_scale = 1.0
cycles(32, (1024, 1024))
scene.render.image_settings.file_format = "JPEG"; scene.render.image_settings.quality = 88
scene.render.filepath = os.path.join(OUT, "travertine.jpg")
if not SHADOWS_ONLY: bpy.ops.render.render(write_still=True)
slab.hide_render = True
print("GLASSIT: travertine.jpg")

# ------------------------------------------------------------------ 3. contact shadows
world.node_tree.nodes["Background"].inputs[0].default_value = (1, 0.97, 0.92, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.35
bpy.ops.object.light_add(type="AREA", location=(-0.35, -0.25, 0.9)); key = bpy.context.active_object
key.data.size = 0.6; key.data.energy = 60
key.rotation_euler = (mathutils.Vector((0, 0, 0)) - key.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); catcher = bpy.context.active_object
catcher.is_shadow_catcher = True
shadows = {}
# glass lets most light through: bake with a pale transparent stand-in so only gold and rims shadow strongly
clear = bpy.data.materials.new("ShadowGlass"); clear.use_nodes = True
cnt = clear.node_tree; cnt.nodes.remove(cnt.nodes["Principled BSDF"])
tb = cnt.nodes.new("ShaderNodeBsdfTransparent"); tb.inputs["Color"].default_value = (0.82, 0.82, 0.82, 1)
cnt.links.new(tb.outputs[0], cnt.nodes["Material Output"].inputs[0])
for parts in products.values():
    for ob in parts:
        if ob.name.split("_", 1)[1] in ("Glass", "Handle", "Stem"):
            ob.data.materials.clear(); ob.data.materials.append(clear)
cycles(96, (512, 512), transparent=True)
scene.cycles.caustics_refractive = False
scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
for key_name, parts in products.items():
    pts = [ob.matrix_world @ mathutils.Vector(v) for ob in parts for v in ob.bound_box]
    zmin = min(p.z for p in pts); rad = max(math.hypot(p.x, p.y) for p in pts)
    size = max(0.16, rad * 3.2)
    for k2, p2 in products.items():
        for ob in p2:
            ob.hide_render = k2 != key_name
            ob.location.z = -zmin if k2 == key_name else ob.location.z
            ob.visible_camera = False
    catcher.scale = (size, size, 1)
    top.data.ortho_scale = size; top.location = (0, 0, 2)
    scene.render.filepath = os.path.join(OUT, f"shadow-{key_name}.png")
    bpy.ops.render.render(write_still=True)
    for ob in parts: ob.location.z = 0
    shadows[key_name] = dict(size=size, zmin=zmin)
    print("GLASSIT: shadow", key_name)
json.dump(shadows, open(os.path.join(OUT, "shadows.json"), "w"))
print("GLASSIT: bake done")
