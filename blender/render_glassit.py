"""
GLASSIT photoreal 360° spins.

Builds the catalogue products (build_glassit.py), dresses them with physically
based glass, gold and enamel, sets them on a travertine block against a warm
plaster wall like the catalogue photography, and path-traces a turntable.

  Blender -b -P blender/render_glassit.py -- <site_root> <work_dir> <keys,comma> <frames> [--test] [--samples N]
Frames go to <site_root>/assets/spin/<key>/NN.webp (or <work_dir>/test-<key>.png with --test).
"""
import bpy, sys, os, math, time

argv = sys.argv[sys.argv.index("--") + 1:]
SITE, WORK = os.path.abspath(argv[0]), os.path.abspath(argv[1])
KEYS = argv[2].split(",")
FRAMES = int(argv[3])
TEST = "--test" in argv
SAMPLES = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else (48 if TEST else 128)

# run the model build into a scratch root (its GLB export lands there, not in the site)
os.makedirs(os.path.join(WORK, "assets"), exist_ok=True)
link = os.path.join(WORK, "assets", "catalog")
if not os.path.exists(link):
    os.symlink(os.path.join(SITE, "assets", "catalog"), link)
sys.argv = [sys.argv[0], "--", WORK]
exec(compile(open(os.path.join(SITE, "blender", "build_glassit.py")).read(), "build_glassit.py", "exec"))
scene = bpy.context.scene


# ------------------------------------------------------------------ materials
def node_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    return m, nt, nt.nodes["Principled BSDF"], nt.nodes["Material Output"]

def setin(b, k, v):
    if k in b.inputs: b.inputs[k].default_value = v

def glass(name, absorb, density, tint=(1, 1, 1), rough=0.0):
    m, nt, b, out = node_mat(name)
    setin(b, "Base Color", (*tint, 1)); setin(b, "Roughness", rough); setin(b, "IOR", 1.52)
    setin(b, "Transmission Weight", 1.0); setin(b, "Specular IOR Level", 0.5)
    if density > 0:
        v = nt.nodes.new("ShaderNodeVolumeAbsorption")
        v.inputs["Color"].default_value = (*absorb, 1); v.inputs["Density"].default_value = density
        nt.links.new(v.outputs[0], out.inputs["Volume"])
    return m

def metal(name, color, rough):
    m, nt, b, out = node_mat(name)
    setin(b, "Base Color", (*color, 1)); setin(b, "Metallic", 1.0); setin(b, "Roughness", rough)
    return m

def medallion_mat(name, img, metallic):
    m, nt, b, out = node_mat(name)
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = img; tx.interpolation = "Cubic"
    nt.links.new(tx.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(tx.outputs["Alpha"], b.inputs["Alpha"])
    setin(b, "Metallic", metallic); setin(b, "Roughness", 0.22 if metallic > 0.5 else 0.3)
    if metallic < 0.5:
        setin(b, "Coat Weight", 0.6); setin(b, "Coat Roughness", 0.05)
    bw = nt.nodes.new("ShaderNodeRGBToBW"); nt.links.new(tx.outputs["Color"], bw.inputs[0])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.55 if metallic > 0.5 else 0.15
    bump.inputs["Distance"].default_value = 0.0015
    nt.links.new(bw.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    return m

SPEC = {   # absorption colour, density (per metre), and medallion metal
    "tiger":     dict(glass=((0.55, 0.56, 0.58), 28, (0.70, 0.71, 0.73))),
    "peacock":   dict(glass=((1.0, 0.66, 0.30), 30, (1.0, 0.86, 0.62))),
    "coupe":     dict(glass=((0.55, 0.56, 0.58), 60, (0.66, 0.67, 0.69)), stem=((1.0, 0.66, 0.28), 45, (1.0, 0.74, 0.38))),
    "flute":     dict(glass=((0.93, 0.98, 0.96), 4)),
    "lion":      dict(glass=((1.0, 0.82, 0.55), 22, (1.0, 0.92, 0.76))),
    "dispenser": dict(glass=((1.0, 0.64, 0.28), 26, (1.0, 0.80, 0.52))),
}
MED_METAL = {"tiger": 1.0, "lion": 1.0, "peacock": 0.0}


GOLD = metal("R_Gold", (1.0, 0.76, 0.36), 0.2)
COPPER = metal("R_Copper", (0.96, 0.6, 0.45), 0.24)

for key, parts in products.items():
    sp = SPEC[key]
    g = glass(f"R_Glass_{key}", *sp["glass"])
    for ob in parts:
        part = ob.name.split("_", 1)[1]
        ob.data.materials.clear()
        if part in ("Glass", "Handle"): ob.data.materials.append(g)
        elif part == "Stem": ob.data.materials.append(glass(f"R_Stem_{key}", *sp["stem"]) if "stem" in sp else g)
        elif part == "Medallion":
            ob.data.materials.append(medallion_mat(f"R_Med_{key}", MEDS[key], MED_METAL[key]))
            sol = ob.modifiers.new("thick", "SOLIDIFY"); sol.thickness = 0.0009; sol.offset = -1
        elif part in ("Lid", "Lid2", "Tap"): ob.data.materials.append(COPPER)
        else: ob.data.materials.append(GOLD)
        ob.hide_render = True

# ------------------------------------------------------------------ studio set
def plaster(name, color, scale=60):
    m, nt, b, out = node_mat(name)
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale; n.inputs["Detail"].default_value = 8
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*[c * 0.94 for c in color], 1); ramp.color_ramp.elements[1].color = (*color, 1)
    nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08
    nt.links.new(n.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    setin(b, "Roughness", 0.92)
    return m

def travertine(name):
    m, nt, b, out = node_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1, 1, 4.5)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 18; n.inputs["Detail"].default_value = 10; n.inputs["Distortion"].default_value = 1.2
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.3; ramp.color_ramp.elements[0].color = (0.50, 0.42, 0.31, 1)
    ramp.color_ramp.elements[1].position = 0.72; ramp.color_ramp.elements[1].color = (0.72, 0.64, 0.52, 1)
    nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 140
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    pits = nt.nodes.new("ShaderNodeMath"); pits.operation = "GREATER_THAN"; pits.inputs[1].default_value = 0.16
    nt.links.new(vor.outputs["Distance"], pits.inputs[0])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6; bump.inputs["Distance"].default_value = 0.0012
    nt.links.new(pits.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    setin(b, "Roughness", 0.75)
    return m

WALL = (0.80, 0.70, 0.58)
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0.8, 0)); floor = bpy.context.active_object
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0.75, 3), rotation=(math.pi / 2, 0, 0)); wall = bpy.context.active_object
floor.data.materials.append(plaster("R_Floor", (0.74, 0.65, 0.53), 40))
wall.data.materials.append(plaster("R_Wall", WALL))

bpy.ops.mesh.primitive_cube_add(size=1); block = bpy.context.active_object
block.data.materials.append(travertine("R_Travertine"))
bev = block.modifiers.new("bevel", "BEVEL"); bev.width = 0.0025; bev.segments = 3

world = bpy.data.worlds.new("W"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.86, 0.78, 0.68, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.12

def area(name, loc, size, energy, color, target=(0, 0, 0.08)):
    bpy.ops.object.light_add(type="AREA", location=loc); L = bpy.context.active_object; L.name = name
    L.data.shape = "RECTANGLE"; L.data.size, L.data.size_y = size; L.data.energy = energy; L.data.color = color
    d = (__import__("mathutils").Vector(target) - L.location)
    L.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return L

KEY = area("Key", (-0.9, -0.55, 0.75), (0.9, 1.4), 26, (1.0, 0.93, 0.84))
FILL = area("Fill", (0.95, -0.7, 0.35), (1.2, 1.0), 6, (1.0, 0.96, 0.92))
RIM = area("Rim", (0.45, 0.55, 0.7), (0.5, 0.9), 14, (1.0, 0.92, 0.82))
bpy.ops.object.light_add(type="SUN", location=(0, 0, 2)); SUN = bpy.context.active_object
SUN.data.energy = 0.9; SUN.data.angle = math.radians(2.5); SUN.data.color = (1.0, 0.9, 0.78)
SUN.rotation_euler = (math.radians(55), 0, math.radians(-38))

bpy.ops.object.camera_add(); cam = bpy.context.active_object; scene.camera = cam
cam.data.lens = 70; cam.data.sensor_fit = "VERTICAL"; cam.data.sensor_height = 24
cam.data.dof.use_dof = True

# ------------------------------------------------------------------ render settings
scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = "GPU"
except Exception as e:
    print("GPU unavailable", e)
c = scene.cycles
c.samples = SAMPLES; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.015
c.use_denoising = True
c.max_bounces = 24; c.transmission_bounces = 24; c.glossy_bounces = 8; c.diffuse_bounces = 3; c.volume_bounces = 2
c.transparent_max_bounces = 16
c.caustics_reflective = False; c.caustics_refractive = True; c.blur_glossy = 0.6
scene.render.resolution_x, scene.render.resolution_y = 720, 800
scene.view_settings.view_transform = "AgX"
try: scene.view_settings.look = "AgX - Medium High Contrast"
except Exception: pass
scene.view_settings.exposure = 0.0

# ------------------------------------------------------------------ per product
import mathutils
for key in KEYS:
    parts = products[key]
    for k2, p2 in products.items():
        for ob in p2: ob.hide_render = (k2 != key)
    # bounds in world space
    pts = [ob.matrix_world @ mathutils.Vector(v) for ob in parts for v in ob.bound_box]
    zmin = min(p.z for p in pts); zmax = max(p.z for p in pts)
    rad = max(math.hypot(p.x, p.y) for p in pts)
    h = zmax - zmin
    side = max(0.15, rad * 2 + 0.05); bh = 0.04
    block.scale = (side, side, bh); block.location = (0, 0, bh / 2)
    block.rotation_euler = (0, 0, math.radians(8))
    pivot = bpy.data.objects.new(f"pivot_{key}", None); scene.collection.objects.link(pivot)
    for ob in parts:
        ob.parent = pivot; ob.location.z += 0  # keep local placement
    pivot.location = (0, 0, bh - zmin)
    # camera framing: product fills ~66% of the frame height
    vfov = 2 * math.atan(12 / 70)
    d = (h + 0.035) / 0.66 / (2 * math.tan(vfov / 2))
    tgt = mathutils.Vector((0, 0, bh + h * 0.47))
    el = math.radians(9)
    cam.location = tgt + mathutils.Vector((0, -math.cos(el) * d, math.sin(el) * d))
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.dof.focus_distance = d; cam.data.dof.aperture_fstop = 5.6
    # light scale with product size
    s = max(1.0, h / 0.1)
    for L, base, e in ((KEY, (-0.9, -0.55, 0.75), 26), (FILL, (0.95, -0.7, 0.35), 6), (RIM, (0.45, 0.55, 0.7), 14)):
        L.location = mathutils.Vector(base) * s
        L.data.energy = e * s * s
        L.rotation_euler = (tgt - L.location).to_track_quat("-Z", "Y").to_euler()
    outdir = os.path.join(SITE, "assets", "spin", key)
    os.makedirs(outdir, exist_ok=True)
    frames = [0] if TEST else range(FRAMES)
    t0 = time.time()
    for f in frames:
        pivot.rotation_euler = (0, 0, 2 * math.pi * f / FRAMES)
        if TEST:
            scene.render.image_settings.file_format = "PNG"
            scene.render.filepath = os.path.join(WORK, f"test-{key}.png")
        else:
            scene.render.image_settings.file_format = "WEBP"; scene.render.image_settings.quality = 82
            scene.render.filepath = os.path.join(outdir, f"{f:02d}.webp")
        bpy.ops.render.render(write_still=True)
        print(f"GLASSIT {key} frame {f} done {time.time() - t0:.1f}s", flush=True)
    for ob in parts: ob.parent = None
print("GLASSIT: all done")
