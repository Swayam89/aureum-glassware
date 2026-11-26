# GLASSIT Ocean: the five current glasses, modelled at real size (metres) by spinning their cross-sections.
# Run: Blender -b --python blender/ocean_glasses.py -- <project root>
# Writes assets/ocean3d/glasses.glb (Draco) and assets/ocean3d/cavities.json (inner radius by height, for drink fills).
import bpy, bmesh, math, json, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = os.path.abspath(argv[0]) if argv else os.getcwd()
OUT = os.path.join(ROOT, "assets", "ocean3d")
os.makedirs(OUT, exist_ok=True)
SEG = 96

bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color=(1, 1, 1, 1), rough=0.02):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.5
    return m

GLASS = material("glass")
GREEN = material("glass_green", (0.36, 0.78, 0.52, 1))

def lathe(name, loop, mat, rib=None, parent=None):
    """loop: closed list of (r, z). rib(r, z, theta, is_outer) -> new r (optional)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    n = len(loop)
    for s in range(SEG):
        th = 2 * math.pi * s / SEG
        ring = []
        for i, (r, z) in enumerate(loop):
            rr = r
            if rib and r > 1e-6:
                rr = rib(r, z, th, i)
            ring.append(bm.verts.new((rr * math.cos(th), rr * math.sin(th), z)))
        rings.append(ring)
    for s in range(SEG):
        a, b = rings[s], rings[(s + 1) % SEG]
        for i in range(n):
            j = (i + 1) % n
            try:
                bm.faces.new((a[i], b[i], b[j], a[j]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob

def root(name):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    return e

def sphere_arc(c, R, a0, a1, steps, reverse=False):
    pts = []
    for k in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * k / steps)
        pts.append((R * math.cos(a), c + R * math.sin(a)))
    return pts[::-1] if reverse else pts

cav = {}

# ---------- 1. Lumen long-stem champagne flute: 21 cm tall, 5.5 cm rim ----------
g = root("lumen")
outer = [(0.0, 0.0), (0.031, 0.0), (0.0322, 0.0015), (0.0300, 0.0038), (0.0080, 0.0075), (0.0034, 0.014),
         (0.0029, 0.094), (0.0042, 0.100), (0.0120, 0.105), (0.0205, 0.112), (0.0258, 0.128), (0.0275, 0.21)]
inner = [(0.0262, 0.21), (0.0246, 0.13), (0.0192, 0.115), (0.0100, 0.1085), (0.0, 0.1065)]
lathe("lumen_glass", outer + inner, GLASS, parent=g)
cav["lumen"] = {"bottom": 0.1065, "top": 0.21, "pts": [(0.0, 0.1065), (0.0100, 0.1085), (0.0192, 0.115), (0.0246, 0.13), (0.0262, 0.21)]}

# ---------- 2. Arc Ombre: conical bowl 11 cm, S-curved stem, 21 cm ----------
g = root("arc")
lathe("arc_foot", [(0.0, 0.0), (0.040, 0.0), (0.0412, 0.0016), (0.0385, 0.0045), (0.0090, 0.0075), (0.0, 0.0085)], GLASS, parent=g)
lathe("arc_bowl", [(0.0, 0.127), (0.0045, 0.1295), (0.0085, 0.1355), (0.0550, 0.210), (0.0534, 0.210), (0.0062, 0.1395), (0.0, 0.1375)], GLASS, parent=g)
cu = bpy.data.curves.new("arc_stem", "CURVE")
cu.dimensions = "3D"
cu.bevel_depth = 0.0034
cu.bevel_resolution = 4
sp = cu.splines.new("BEZIER")
path = [(0.0, 0.006), (0.006, 0.030), (0.014, 0.058), (0.002, 0.088), (-0.009, 0.108), (0.0, 0.130)]
sp.bezier_points.add(len(path) - 1)
for bp, (x, z) in zip(sp.bezier_points, path):
    bp.co = (x, 0.0, z)
    bp.handle_left_type = bp.handle_right_type = "AUTO"
stem = bpy.data.objects.new("arc_stem", cu)
bpy.context.scene.collection.objects.link(stem)
stem.data.materials.append(GLASS)
stem.parent = g
cav["arc"] = {"bottom": 0.1375, "top": 0.21, "pts": [(0.0, 0.1375), (0.0062, 0.1395), (0.0534, 0.210)]}

# ---------- 3. Ripple fluted sipping glass: round 10 cm bowl with spiral ribs, 22 cm, 150 mL ----------
g = root("ripple")
C, R, T = 0.168, 0.050, 0.0016
bowl_out = sphere_arc(C, R, -78, 52, 40)          # from stem join up to the cut rim
bowl_in = sphere_arc(C, R - T, 52, -88, 40)       # back down inside
foot_stem = [(0.0, 0.0), (0.034, 0.0), (0.0352, 0.0015), (0.0325, 0.0042), (0.0075, 0.0078), (0.0030, 0.014), (0.0026, 0.112), (0.0060, 0.1185)]
loop = foot_stem + bowl_out + bowl_in + [(0.0, C - (R - T))]
n_fs, n_bo = len(foot_stem), len(bowl_out)
def ripple_rib(r, z, th, i):
    if n_fs <= i < n_fs + n_bo and z > C - R * 0.92:
        return r * (1 + 0.030 * math.cos(14 * th + 7.5 * (z - C) / R))
    return r
lathe("ripple_glass", loop, GLASS, rib=ripple_rib, parent=g)
cav["ripple"] = {"bottom": C - (R - T), "top": C + (R - T) * math.sin(math.radians(52)),
                 "pts": [(r, z) for r, z in sphere_arc(C, R - T, -90, 52, 30)]}

# ---------- 4. Verdant ribbed highball: 7 cm x 14 cm, green base ----------
g = root("verdant")
lathe("verdant_base", [(0.0, 0.0), (0.0352, 0.0), (0.0362, 0.0015), (0.0362, 0.0255), (0.0345, 0.0275), (0.0, 0.0275)], GREEN, parent=g)
body = [(0.0, 0.0270), (0.0340, 0.0270), (0.0340, 0.140), (0.0326, 0.140), (0.0326, 0.0305), (0.0, 0.0305)]
def verdant_rib(r, z, th, i):
    if i in (1, 2) and z >= 0.028:
        return r + 0.0011 * (0.5 + 0.5 * math.cos(40 * th))
    return r
lathe("verdant_glass", body, GLASS, rib=verdant_rib, parent=g)
cav["verdant"] = {"bottom": 0.0305, "top": 0.140, "pts": [(0.0326, 0.0305), (0.0326, 0.140)]}

# ---------- 5. Halo glass tealight holder: squashed-sphere top on a flared base (size estimated) ----------
g = root("halo")
Cz, RX, RZ, T = 0.084, 0.060, 0.036, 0.0024
def squash(a0, a1, steps, rx, rz):
    return [(rx * math.cos(math.radians(a0 + (a1 - a0) * k / steps)), Cz + rz * math.sin(math.radians(a0 + (a1 - a0) * k / steps))) for k in range(steps + 1)]
base_out = [(0.0385, 0.0), (0.0392, 0.0012), (0.0265, 0.0545)]
top_out = squash(-62, 58, 36, RX, RZ)
top_in = squash(58, -50, 30, RX - T, RZ - T)
floor = [(0.022, 0.0625), (0.0, 0.0625)]
under = [(0.0, 0.0545), (0.0235, 0.0525), (0.0362, 0.0008)]
lathe("halo_glass", base_out + top_out + top_in + floor + under, GLASS, parent=g)
cav["halo"] = {"bottom": 0.0625, "top": Cz + (RZ - T) * math.sin(math.radians(58)), "seat": 0.0625}

# layout for preview/export: side by side, 18 cm apart
for k, name in enumerate(["lumen", "arc", "ripple", "verdant", "halo"]):
    bpy.data.objects[name].location = ((k - 2) * 0.18, 0, 0)

# the stem curve must be a mesh for export
bpy.ops.object.select_all(action="DESELECT")
stem.select_set(True)
bpy.context.view_layer.objects.active = stem
bpy.ops.object.convert(target="MESH")

# preview render (Eevee) so the shapes can be checked
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 1600, 700
sc.render.film_transparent = False
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.04, 0.12, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 0.98
cam.location = (0, -1.2, 0.11); cam.rotation_euler = (math.radians(90), 0, 0)
for loc, e in [((-0.6, -0.8, 0.6), 600), ((0.7, -0.4, 0.3), 300), ((0, 0.8, 0.5), 400)]:
    L = bpy.data.objects.new("l", bpy.data.lights.new("l", "AREA")); L.data.energy = e; L.data.size = 0.6
    L.location = loc; sc.collection.objects.link(L)
    L.rotation_euler = (Vector((0, 0, 0.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
# preview uses an opaque-ish frost so silhouettes read
for m in (GLASS, GREEN):
    m.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 0.0
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.25
sc.render.filepath = os.path.join(OUT, "preview.png")
bpy.ops.render.render(write_still=True)
for m in (GLASS, GREEN):
    m.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 1.0
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.02

# reset positions to origin for export (the web scene places them)
for name in ["lumen", "arc", "ripple", "verdant", "halo"]:
    bpy.data.objects[name].location = (0, 0, 0)
for o in list(sc.objects):
    if o.type in ("CAMERA", "LIGHT"):
        bpy.data.objects.remove(o)

bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "glasses.glb"), export_format="GLB", export_yup=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
    export_apply=True,
)
json.dump(cav, open(os.path.join(OUT, "cavities.json"), "w"), indent=1)
print("wrote", os.path.getsize(os.path.join(OUT, "glasses.glb")), "bytes")
