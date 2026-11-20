"""
AUREUM glassware: procedural Blender build.

Models every piece of the collection to real-world dimensions (metres),
exports GLB files for the website's real-time 3D, an AR-ready GLB, a JSON
file with the inner glass profiles (for the live liquid fill), cropped
medallion textures, and optional Cycles hero renders.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_glassware.py -- <site_root> [--render]
"""
import bpy, bmesh, math, json, os, sys, random
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = os.path.abspath(argv[0]) if argv else os.getcwd()
DO_RENDER = "--render" in argv
SRC_IMG = os.path.join(ROOT, "assets", "img")
OUT_MODELS = os.path.join(ROOT, "assets", "models")
OUT_TEX = os.path.join(ROOT, "assets", "tex")
os.makedirs(OUT_MODELS, exist_ok=True)
os.makedirs(OUT_TEX, exist_ok=True)
random.seed(7)

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- medallion textures
# (source photo, centre x, centre y, radius) in source-image pixels, top-left origin
MEDALLIONS = {
    "tiger":   ("rocks-collection.webp", 179, 184, 42),
    "lion":    ("pairing-collection.webp", 858, 563, 35),
    "tree":    ("heritage-collection.webp", 191, 234, 45),
    "peacock": ("heritage-collection.webp", 634, 237, 43),
    "queen":   ("heritage-collection.webp", 192, 475, 39),
    "king":    ("heritage-collection.webp", 640, 470, 39),
}


def crop_medallion(name, src, cx, cy, rad, size=512):
    import numpy as np
    img = bpy.data.images.load(os.path.join(SRC_IMG, src), check_existing=True)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[::-1]  # flip so row 0 = top
    # bilinear sample a square of side 2*rad around (cx, cy)
    t = (np.arange(size) + 0.5) / size
    xs = cx - rad + t * 2 * rad
    ys = cy - rad + t * 2 * rad
    X, Y = np.meshgrid(xs, ys)
    x0 = np.clip(np.floor(X - 0.5).astype(int), 0, w - 2)
    y0 = np.clip(np.floor(Y - 0.5).astype(int), 0, h - 2)
    fx = np.clip(X - 0.5 - x0, 0, 1)[..., None]
    fy = np.clip(Y - 0.5 - y0, 0, 1)[..., None]
    a = px[y0, x0]; b = px[y0, x0 + 1]; c = px[y0 + 1, x0]; d = px[y0 + 1, x0 + 1]
    out = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    # circular mask with a soft edge
    U, V = np.meshgrid(t * 2 - 1, t * 2 - 1)
    dist = np.sqrt(U * U + V * V)
    out[..., 3] = np.clip((1.0 - dist) * size * 0.25, 0, 1)
    out = out[::-1].copy()  # back to Blender bottom-up rows
    new = bpy.data.images.new("med_" + name, size, size, alpha=True)
    new.pixels.foreach_set(out.ravel().astype(np.float32))
    new.filepath_raw = os.path.join(OUT_TEX, f"medallion-{name}.png")
    new.file_format = "PNG"
    new.save()
    return new


med_images = {k: crop_medallion(k, *v) for k, v in MEDALLIONS.items()}

# ---------------------------------------------------------------- helpers
def catmull(ctrl, n):
    """Sample a Catmull-Rom spline through (z, r) control points; returns f(z)."""
    pts = []
    P = [ctrl[0]] + ctrl + [ctrl[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            pts.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t +
                                    (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
                                    (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in range(2)))
    pts.append(ctrl[-1])

    def R(z):
        if z <= pts[0][0]:
            return pts[0][1]
        for a, b in zip(pts, pts[1:]):
            if a[0] <= z <= b[0]:
                f = (z - a[0]) / max(b[0] - a[0], 1e-9)
                return a[1] + (b[1] - a[1]) * f
        return pts[-1][1]
    return R


def arc(cx, cz, rad, a0, a1, n):
    return [(cx + rad * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cz + rad * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def lathe(name, prof, segs=128, uv_radius=None, close=True):
    verts, faces, uvs = [], [], []
    n = len(prof)
    for s in range(segs):
        a = 2 * math.pi * s / segs
        ca, sa = math.cos(a), math.sin(a)
        for (r, z) in prof:
            verts.append((r * ca, r * sa, z))
    for s in range(segs):
        s2 = (s + 1) % segs
        for i in range(n - 1):
            faces.append((s * n + i, s2 * n + i, s2 * n + i + 1, s * n + i + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    # drop faces collapsed onto the axis
    bad = [f for f in bm.faces if f.calc_area() < 1e-12]
    bmesh.ops.delete(bm, geom=bad, context="FACES")
    if close:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    R = uv_radius or max(p[0] for p in prof) or 1
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            co = l.vert.co
            l[uvl].uv = (co.x / (2 * R) + 0.5, co.y / (2 * R) + 0.5)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def mesh_from_bm(name, bm, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def offset_polyline(pts, d):
    out = []
    for i, p in enumerate(pts):
        a = pts[max(i - 1, 0)]; b = pts[min(i + 1, len(pts) - 1)]
        tr, tz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tr, tz) or 1
        out.append((p[0] + d * tz / L, p[1] - d * tr / L))
    return out


# ---------------------------------------------------------------- glass spec
GLASSES = {
    # height, wall, base, outer radius control points (z, r), medallion (centre z, radius), flakes, handle
    "rocks":   dict(H=0.092, wall=0.0035, base=0.019,
                    ctrl=[(0.0, 0.0415), (0.03, 0.0422), (0.06, 0.0428), (0.092, 0.0432)],
                    med=(0.050, 0.0185), flakes=420, handle=False, band=False),
    "mug":     dict(H=0.168, wall=0.0042, base=0.024,
                    ctrl=[(0.0, 0.0395), (0.05, 0.0400), (0.12, 0.0403), (0.168, 0.0406)],
                    med=(0.095, 0.0215), flakes=520, handle=True, band=True),
    "tumbler": dict(H=0.112, wall=0.0030, base=0.013,
                    ctrl=[(0.0, 0.0300), (0.012, 0.0345), (0.036, 0.0388), (0.062, 0.0385),
                          (0.090, 0.0360), (0.112, 0.0340)],
                    med=(0.060, 0.0185), flakes=0, handle=False, band=False),
}

profiles_json = {}


def build_glass(key, spec):
    H, wall, base = spec["H"], spec["wall"], spec["base"]
    R = catmull([(z, r) for z, r in spec["ctrl"]], 12)
    fo, fi, lip = 0.003, 0.004, wall / 2
    prof = [(0.0, 0.0)]
    prof += arc(R(0) - fo, fo, fo, -90, 0, 6)
    steps = 48
    for i in range(1, steps):
        z = fo + (H - lip - fo) * i / steps
        prof.append((R(z), z))
    prof += arc(R(H) - lip, H - lip, lip, 0, 180, 10)
    inner = []
    for i in range(1, steps):
        z = (H - lip) - (H - lip - base - fi) * i / steps
        inner.append((R(z) - wall, z))
    rI = R(base + fi) - wall
    inner += arc(rI - fi, base + fi, fi, 0, -90, 6)
    inner.append((0.0, base))
    prof += inner
    glass = lathe(f"{key}_Glass", prof)

    # gold rim: offset copy of the lip region
    band = 0.0055
    rim_src = [p for p in prof[1:] if p[1] >= H - band]
    rim_pts = offset_polyline(rim_src, 0.00035)
    rim_pts = [p for p in rim_pts if not (p[0] < R(H) - wall - 0.0003 and p[1] < H - 0.0028)]
    rim = lathe(f"{key}_Rim", rim_pts, close=False)

    # liquid profile (inner wall, bottom -> rim) for the live fill on the website
    liq = list(reversed(inner))
    profiles_json[key] = dict(
        height=H, base=base, wall=wall,
        inner=[[round(r, 6), round(z, 6)] for r, z in liq],
        outer=[[round(R(z), 6), round(z, 6)] for z in [H * i / 40 for i in range(41)]],
        medallion=dict(z=spec["med"][0], r=spec["med"][1]),
    )

    # medallion disc wrapped onto the outer wall, facing -Y (front)
    zc, rm = spec["med"]
    rings, segs = 14, 64
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")

    def surf(u, v, lift):
        z = zc + v
        rr = R(z) + lift
        th = -math.pi / 2 + u / rr
        return Vector((rr * math.cos(th), rr * math.sin(th), z))

    centre = bm.verts.new(surf(0, 0, 0.0007))
    ring_verts = []
    for k in range(1, rings + 1):
        rho = rm * k / rings
        ring_verts.append([bm.verts.new(surf(rho * math.cos(2 * math.pi * s / segs),
                                             rho * math.sin(2 * math.pi * s / segs), 0.0007))
                           for s in range(segs)])

    def uv_of(v):
        # invert wrap approximately: use local angle * radius
        th = math.atan2(v.co.y, v.co.x) + math.pi / 2
        rr = math.hypot(v.co.x, v.co.y)
        return (th * rr / (2 * rm) + 0.5, (v.co.z - zc) / (2 * rm) + 0.5)

    for s in range(segs):
        s2 = (s + 1) % segs
        f = bm.faces.new((centre, ring_verts[0][s], ring_verts[0][s2]))
        for l in f.loops: l[uvl].uv = uv_of(l.vert)
        for k in range(rings - 1):
            f = bm.faces.new((ring_verts[k][s], ring_verts[k + 1][s], ring_verts[k + 1][s2], ring_verts[k][s2]))
            for l in f.loops: l[uvl].uv = uv_of(l.vert)
    medallion = mesh_from_bm(f"{key}_Medallion", bm)

    # raised bezel ring around the medallion
    bm = bmesh.new()
    prof_b = [(rm * 0.985, 0.0006), (rm * 1.01, 0.0012), (rm * 1.045, 0.0013), (rm * 1.075, 0.0006)]
    rows = [[bm.verts.new(surf(rho * math.cos(2 * math.pi * s / segs), rho * math.sin(2 * math.pi * s / segs), lift))
             for s in range(segs)] for rho, lift in prof_b]
    for k in range(len(rows) - 1):
        for s in range(segs):
            s2 = (s + 1) % segs
            bm.faces.new((rows[k][s], rows[k][s2], rows[k + 1][s2], rows[k + 1][s]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bezel = mesh_from_bm(f"{key}_Bezel", bm)

    parts = [glass, rim, medallion, bezel]

    # gold flakes suspended in the heavy base
    if spec["flakes"]:
        bm = bmesh.new()
        rB = R(base) - wall
        for i in range(spec["flakes"]):
            rr = rB * 0.92 * math.sqrt(random.random())
            a = random.random() * 2 * math.pi
            z = 0.002 + random.random() * (base - 0.004)
            sz = 0.0006 + random.random() * 0.0016
            M = (Matrix.Translation((rr * math.cos(a), rr * math.sin(a), z)) @
                 Matrix.Rotation(random.random() * 6.28, 4, "X") @
                 Matrix.Rotation(random.random() * 6.28, 4, "Y") @
                 Matrix.Diagonal((sz, sz * (0.5 + random.random()), sz * 0.08, 1)))
            bmesh.ops.create_cube(bm, size=1.0, matrix=M)
        parts.append(mesh_from_bm(f"{key}_Flakes", bm, smooth=False))

    # decorative gold bands (mug)
    if spec["band"]:
        for j, zb in enumerate((0.040, 0.150)):
            pts = [(R(zb - 0.0012) + 0.0003, zb - 0.0012), (R(zb) + 0.0006, zb), (R(zb + 0.0012) + 0.0003, zb + 0.0012)]
            parts.append(lathe(f"{key}_Band{j}", pts, close=False))

    # handle: swept ellipse along a smooth path on the +X side
    if spec["handle"]:
        Rh = R(0.1)
        path_ctrl = [(Rh - 0.003, 0.138), (Rh + 0.020, 0.140), (Rh + 0.040, 0.122),
                     (Rh + 0.043, 0.085), (Rh + 0.036, 0.055), (Rh + 0.016, 0.040), (Rh - 0.003, 0.042)]
        P = [path_ctrl[0]] + path_ctrl + [path_ctrl[-1]]
        path = []
        for i in range(1, len(P) - 2):
            p0, p1, p2, p3 = [Vector((p[0], 0, p[1])) for p in P[i - 1:i + 3]]
            for k in range(10):
                t = k / 10
                path.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
                                   (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
        path.append(Vector((path_ctrl[-1][0], 0, path_ctrl[-1][1])))
        bm = bmesh.new(); ringsv = []
        for i, p in enumerate(path):
            tng = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
            nrm = tng.cross(Vector((0, 1, 0))).normalized()
            ringsv.append([bm.verts.new(p + nrm * 0.0085 * math.cos(2 * math.pi * s / 20) +
                                        Vector((0, 1, 0)) * 0.0060 * math.sin(2 * math.pi * s / 20))
                           for s in range(20)])
        for k in range(len(ringsv) - 1):
            for s in range(20):
                s2 = (s + 1) % 20
                bm.faces.new((ringsv[k][s], ringsv[k][s2], ringsv[k + 1][s2], ringsv[k + 1][s]))
        bm.faces.new(ringsv[0]); bm.faces.new(list(reversed(ringsv[-1])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        parts.append(mesh_from_bm(f"{key}_Handle", bm))

    return parts


all_parts = {k: build_glass(k, v) for k, v in GLASSES.items()}

# ---------------------------------------------------------------- props
coaster = lathe("prop_Coaster", [(0, 0), (0.051, 0), *arc(0.051, 0.004, 0.004, -90, 90, 8), (0, 0.008)])

bm = bmesh.new()
bmesh.ops.create_cube(bm, size=0.027)
try:
    bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=0.0045, segments=4,
                    profile=0.5, affect="EDGES")
except TypeError:
    pass
ice = mesh_from_bm("prop_Ice", bm)

# cinnamon stick: spiral-rolled bark extruded along its length
def cinnamon(name, length=0.095):
    bm = bmesh.new()
    spiral = []
    for i in range(40):
        t = i / 39
        a = t * 2 * math.pi * 1.55
        r = 0.0046 - 0.0024 * t
        spiral.append((r * math.cos(a), r * math.sin(a)))
    inner = [(x * (1 - 0.00075 / math.hypot(x, y)), y * (1 - 0.00075 / math.hypot(x, y))) for x, y in spiral]
    poly = spiral + list(reversed(inner))
    bot = [bm.verts.new((x, y, 0)) for x, y in poly]
    top = [bm.verts.new((x, y, length)) for x, y in poly]
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bm.faces.new(list(reversed(bot))); bm.faces.new(top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm)

cin = cinnamon("prop_Cinnamon")

bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.0011, radius2=0.0007, depth=0.115,
                      matrix=Matrix.Translation((0, 0, 0.0575)))
golden = math.radians(137.5)
for i in range(84):
    z = 0.012 + 0.10 * i / 84
    a = golden * i
    L = 0.013 * (1 - 0.45 * (i / 84))
    M = (Matrix.Translation((0, 0, z)) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Rotation(math.radians(55), 4, "Y") @
         Matrix.Translation((0, 0, L / 2)) @ Matrix.Diagonal((0.0016, 0.0007, L, 1)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=M)
rosemary = mesh_from_bm("prop_Rosemary", bm)

# ---------------------------------------------------------------- materials
def principled(name, color, metallic=0.0, rough=0.5, transmission=0.0, ior=1.5, alpha=1.0, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    def setin(k, v):
        if k in b.inputs: b.inputs[k].default_value = v
    setin("Base Color", (*color, 1))
    setin("Metallic", metallic)
    setin("Roughness", rough)
    setin("IOR", ior)
    setin("Transmission Weight", transmission)
    setin("Transmission", transmission)
    setin("Alpha", alpha)
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = image
        nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
        nt.links.new(tex.outputs["Alpha"], b.inputs["Alpha"])
        try: m.blend_method = "BLEND"
        except Exception: pass
    return m

M_GLASS = principled("Glass", (1, 1, 1), rough=0.0, transmission=1.0, ior=1.52)
M_GOLD = principled("Gold", (1.0, 0.74, 0.32), metallic=1.0, rough=0.16)
M_WOOD = principled("Walnut", (0.075, 0.035, 0.018), rough=0.38)
M_ICE = principled("Ice", (0.95, 0.98, 1.0), rough=0.08, transmission=1.0, ior=1.31)
M_CIN = principled("Cinnamon", (0.11, 0.04, 0.015), rough=0.85)
M_ROSE = principled("Rosemary", (0.12, 0.22, 0.10), rough=0.6)
M_WHISKY = principled("Whisky", (0.85, 0.42, 0.10), rough=0.0, transmission=1.0, ior=1.36)
M_MED = {k: principled(f"Medallion_{k}", (1, 1, 1), metallic=1.0, rough=0.22, image=img) for k, img in med_images.items()}

DEFAULT_MOTIF = {"rocks": "tiger", "mug": "lion", "tumbler": "peacock"}
for key, parts in all_parts.items():
    for ob in parts:
        nm = ob.name.split("_", 1)[1]
        if nm == "Glass" or nm == "Handle": ob.data.materials.append(M_GLASS)
        elif nm == "Medallion": ob.data.materials.append(M_MED[DEFAULT_MOTIF[key]])
        else: ob.data.materials.append(M_GOLD)
coaster.data.materials.append(M_WOOD); ice.data.materials.append(M_ICE)
cin.data.materials.append(M_CIN); rosemary.data.materials.append(M_ROSE)

# ---------------------------------------------------------------- export
def export(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)

for key, parts in all_parts.items():
    export(parts, os.path.join(OUT_MODELS, f"{key}.glb"))
export([coaster, ice, cin, rosemary], os.path.join(OUT_MODELS, "props.glb"))

with open(os.path.join(OUT_MODELS, "profiles.json"), "w") as f:
    json.dump(profiles_json, f)

# ---------------------------------------------------------------- AR composition (rocks + whisky)
def liquid_mesh(name, key, level, gap=0.00025):
    pj = profiles_json[key]
    pts = [(0.0, pj["base"] + gap)]
    for r, z in pj["inner"]:
        if z >= level: break
        if z > pj["base"] + gap: pts.append((max(r - gap, 0), z))
    rl = None
    for (r0, z0), (r1, z1) in zip(pj["inner"], pj["inner"][1:]):
        if z0 <= level <= z1:
            rl = r0 + (r1 - r0) * (level - z0) / max(z1 - z0, 1e-9); break
    pts += [(rl - gap, level), (0.0, level)]
    return lathe(name, pts)

whisky = liquid_mesh("rocks_Liquid", "rocks", 0.062)
whisky.data.materials.append(M_WHISKY)

for ob in all_parts["rocks"] + [whisky]:
    ob.location.z = 0.008
ice.location = (0.004, -0.004, 0.008 + 0.058); ice.rotation_euler = (0.4, 0.25, 0.6)
cin.location = (0.018, 0.012, 0.008 + 0.022); cin.rotation_euler = (math.radians(-18), math.radians(22), 0)
rosemary.location = (-0.016, 0.014, 0.008 + 0.024); rosemary.rotation_euler = (math.radians(-12), math.radians(-24), 0)
export(all_parts["rocks"] + [whisky, coaster, ice, cin, rosemary], os.path.join(OUT_MODELS, "rocks-ar.glb"))

# hide the other glasses for renders
for key in ("mug", "tumbler"):
    for ob in all_parts[key]:
        ob.hide_render = True; ob.hide_viewport = True

print("AUREUM: export complete ->", OUT_MODELS)

# ---------------------------------------------------------------- Cycles hero render
if DO_RENDER:
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices: d.use = True
        scene.cycles.device = "GPU"
    except Exception as e:
        print("GPU unavailable:", e)
    scene.cycles.samples = 160
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 16
    scene.cycles.transmission_bounces = 16
    scene.cycles.glossy_bounces = 8
    scene.view_settings.view_transform = "AgX"
    try: scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception: pass

    world = bpy.data.worlds.new("World"); scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.008, 0.005, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

    # marble counter
    bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, 0))
    counter = bpy.context.active_object
    mm = bpy.data.materials.new("Marble"); mm.use_nodes = True
    nt = mm.node_tree; bsdf = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 6
    noise.inputs["Detail"].default_value = 12; noise.inputs["Distortion"].default_value = 3.5
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45; ramp.color_ramp.elements[0].color = (0.012, 0.012, 0.013, 1)
    ramp.color_ramp.elements[1].position = 0.66; ramp.color_ramp.elements[1].color = (0.09, 0.085, 0.08, 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.12
    counter.data.materials.append(mm)

    # bokeh bar lights far behind
    em = bpy.data.materials.new("Bokeh"); em.use_nodes = True
    ent = em.node_tree; ent.nodes.remove(ent.nodes["Principled BSDF"])
    emi = ent.nodes.new("ShaderNodeEmission"); emi.inputs["Color"].default_value = (1.0, 0.62, 0.25, 1)
    emi.inputs["Strength"].default_value = 18
    ent.links.new(emi.outputs[0], ent.nodes["Material Output"].inputs[0])
    for i in range(26):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012 + random.random() * 0.02,
                                             location=(-1.4 + random.random() * 2.8, 1.6 + random.random() * 0.8,
                                                       0.12 + random.random() * 0.9))
        bpy.context.active_object.data.materials.append(em)

    def area(name, loc, rot, size, power, color):
        bpy.ops.object.light_add(type="AREA", location=loc, rotation=rot)
        L = bpy.context.active_object; L.name = name
        L.data.size = size; L.data.energy = power; L.data.color = color
        return L

    area("Key", (-0.35, 0.25, 0.32), (math.radians(60), 0, math.radians(-125)), 0.25, 22, (1.0, 0.82, 0.6))
    area("Rim", (0.25, 0.35, 0.22), (math.radians(70), 0, math.radians(145)), 0.12, 26, (1.0, 0.7, 0.4))
    area("Top", (0, -0.05, 0.6), (0, 0, 0), 0.3, 6, (1.0, 0.9, 0.8))
    area("Front", (0.05, -0.6, 0.12), (math.radians(88), 0, 0), 0.6, 2.5, (1.0, 0.85, 0.7))

    bpy.ops.object.camera_add(location=(0, -0.42, 0.115))
    cam = bpy.context.active_object; scene.camera = cam
    cam.data.lens = 85
    target = bpy.data.objects.new("Target", None); scene.collection.objects.link(target)
    target.location = (0, 0, 0.060)
    c = cam.constraints.new("TRACK_TO"); c.target = target
    cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 4.0

    scene.view_settings.exposure = -0.4
    vol = M_WHISKY.node_tree.nodes.new("ShaderNodeVolumeAbsorption")
    vol.inputs["Color"].default_value = (0.85, 0.38, 0.06, 1); vol.inputs["Density"].default_value = 28
    M_WHISKY.node_tree.links.new(vol.outputs[0], M_WHISKY.node_tree.nodes["Material Output"].inputs["Volume"])
    M_WHISKY.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 1, 1, 1)
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 88
    for fname, (w, h, dist, lens) in {"hero-render.jpg": (1600, 1000, 0.78, 85),
                                      "hero-render-portrait.jpg": (900, 1300, 0.95, 85)}.items():
        scene.render.resolution_x, scene.render.resolution_y = w, h
        cam.location.y = -dist; cam.data.lens = lens; cam.data.dof.focus_distance = dist - 0.04
        scene.render.filepath = os.path.join(SRC_IMG, fname)
        bpy.ops.render.render(write_still=True)
        print("AUREUM: rendered", fname)
