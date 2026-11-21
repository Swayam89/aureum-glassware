"""
GLASSIT carousel products: procedural Blender build from the catalogue.

Builds six catalogue products to their listed dimensions, crops their medallion
artwork from the catalogue photos, and exports one GLB per product plus a
profiles JSON (inner walls, for live liquid).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_glassit.py -- <site_root> [--render]
"""
import bpy, bmesh, math, json, os, sys, random
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = os.path.abspath(argv[0]) if argv else os.getcwd()
DO_RENDER = "--render" in argv
CAT = os.path.join(ROOT, "assets", "catalog")
OUT = os.path.join(ROOT, "assets", "glassit3d")
os.makedirs(OUT, exist_ok=True)
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ------------------------------------------------------------ medallion crops
def crop(name, src, cx, cy, rad, size=1024):
    import numpy as np
    img = bpy.data.images.load(os.path.join(CAT, src), check_existing=True)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[::-1]
    t = (np.arange(size) + 0.5) / size
    X, Y = np.meshgrid(cx - rad + t * 2 * rad, cy - rad + t * 2 * rad)
    x0 = np.clip(np.floor(X - 0.5).astype(int), 0, w - 2); y0 = np.clip(np.floor(Y - 0.5).astype(int), 0, h - 2)
    fx = np.clip(X - 0.5 - x0, 0, 1)[..., None]; fy = np.clip(Y - 0.5 - y0, 0, 1)[..., None]
    o = (px[y0, x0] * (1 - fx) + px[y0, x0 + 1] * fx) * (1 - fy) + (px[y0 + 1, x0] * (1 - fx) + px[y0 + 1, x0 + 1] * fx) * fy
    U, V = np.meshgrid(t * 2 - 1, t * 2 - 1)
    o[..., 3] = np.clip((1 - np.sqrt(U * U + V * V)) * size * 0.25, 0, 1)
    # relief normal map from luminance (embossed gold catches the light)
    lum = o[..., 0] * 0.3 + o[..., 1] * 0.59 + o[..., 2] * 0.11
    for _ in range(2):
        lum = (lum * 2 + np.roll(lum, 1, 0) + np.roll(lum, -1, 0) + np.roll(lum, 1, 1) + np.roll(lum, -1, 1)) / 6
    gx = np.roll(lum, -1, 1) - np.roll(lum, 1, 1); gy = np.roll(lum, -1, 0) - np.roll(lum, 1, 0)
    st = 9.0
    n = np.stack([-gx * st, gy * st, np.ones_like(lum)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    nm = np.concatenate([n * 0.5 + 0.5, np.ones_like(lum)[..., None]], -1)[::-1].copy()
    nim = bpy.data.images.new("nrm_" + name, size, size, alpha=False)
    nim.pixels.foreach_set(nm.ravel().astype(np.float32))
    nim.filepath_raw = os.path.join(OUT, f"medallion-{name}-normal.png"); nim.file_format = "PNG"; nim.save()
    o = o[::-1].copy()
    im = bpy.data.images.new("med_" + name, size, size, alpha=True)
    im.pixels.foreach_set(o.ravel().astype(np.float32))
    im.filepath_raw = os.path.join(OUT, f"medallion-{name}.png"); im.file_format = "PNG"; im.save()
    return im

MEDS = {
    "tiger": crop("tiger", "smoke-tiger-whisky-glass-set.jpg", 406, 452, 126),
    "peacock": crop("peacock", "peacock-medallion-tumbler-set.jpg", 405, 421, 140),
    "lion": crop("lion", "gold-lion-beer-mug-set.jpg", 372, 436, 116),
}


# ------------------------------------------------------------ helpers
def spline(ctrl, n=12):
    P = [ctrl[0]] + ctrl + [ctrl[-1]]; pts = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            pts.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in range(2)))
    pts.append(ctrl[-1])
    def R(z):
        if z <= pts[0][0]: return pts[0][1]
        for a, b in zip(pts, pts[1:]):
            if a[0] <= z <= b[0]: return a[1] + (b[1] - a[1]) * (z - a[0]) / max(b[0] - a[0], 1e-9)
        return pts[-1][1]
    return R

def arc(cx, cz, r, a0, a1, n):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

def lathe(name, prof, segs=128, rib=None, close=True):
    """prof: list of (r, z[, outer_flag]). rib(theta, z) -> radial multiplier for outer points."""
    verts, faces = [], []
    n = len(prof)
    for s in range(segs):
        a = 2 * math.pi * s / segs
        for p in prof:
            r, z = p[0], p[1]
            if rib and len(p) > 2 and p[2]: r *= rib(a, z)
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for s in range(segs):
        s2 = (s + 1) % segs
        for i in range(n - 1):
            faces.append((s * n + i, s2 * n + i, s2 * n + i + 1, s * n + i + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-12], context="FACES")
    if close: bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    R = max(p[0] for p in prof) or 1
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops: l[uv].uv = (l.vert.co.x / (2 * R) + 0.5, l.vert.co.y / (2 * R) + 0.5)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return ob

def from_bm(name, bm, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return ob

def vessel(R, H, wall, base, floor=None, lip_round=True, rib=None, steps=60):
    """Closed glass solid from an outer-radius function. floor: list of (r, z) inner floor points from axis outward."""
    fo = 0.003; lip = wall / 2
    prof = [(0.0, 0.0, 1)] + [(*p, 1) for p in arc(R(0) - fo, fo, fo, -90, 0, 6)]
    for i in range(1, steps):
        z = fo + (H - lip - fo) * i / steps
        prof.append((R(z), z, 1))
    prof += [(*p, 0) for p in arc(R(H) - lip, H - lip, lip, 0, 180, 10)]
    inner = []
    zi_end = base + 0.004
    for i in range(1, steps):
        z = (H - lip) - (H - lip - zi_end) * i / steps
        inner.append((R(z) - wall, z))
    rI = R(zi_end) - wall
    inner += arc(rI - 0.004, zi_end, 0.004, 0, -90, 6)
    if floor:
        inner += sorted(floor, key=lambda p: -p[0])
    inner.append((0.0, floor[0][1] if floor else base))
    prof += [(r, z, 0) for r, z in inner]
    liquid = [(0.0, floor[0][1] if floor else base)] + list(reversed(inner[:-1]))
    return prof, liquid

def medallion(name, R, zc, rm, lift=0.0007, front=-math.pi / 2):
    rings, segs = 14, 64
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
    def surf(u, v, l):
        z = zc + v; rr = R(z) + l; th = front + u / rr
        return Vector((rr * math.cos(th), rr * math.sin(th), z))
    c = bm.verts.new(surf(0, 0, lift))
    rv = [[bm.verts.new(surf(rm * k / rings * math.cos(2 * math.pi * s / segs), rm * k / rings * math.sin(2 * math.pi * s / segs), lift)) for s in range(segs)] for k in range(1, rings + 1)]
    def uvof(v):
        th = math.atan2(v.co.y, v.co.x) - front; rr = math.hypot(v.co.x, v.co.y)
        th = (th + math.pi) % (2 * math.pi) - math.pi
        return (th * rr / (2 * rm) + 0.5, (v.co.z - zc) / (2 * rm) + 0.5)
    for s in range(segs):
        s2 = (s + 1) % segs
        f = bm.faces.new((c, rv[0][s], rv[0][s2]))
        for l in f.loops: l[uvl].uv = uvof(l.vert)
        for k in range(rings - 1):
            f = bm.faces.new((rv[k][s], rv[k + 1][s], rv[k + 1][s2], rv[k][s2]))
            for l in f.loops: l[uvl].uv = uvof(l.vert)
    med = from_bm(name + "_Medallion", bm)
    bm = bmesh.new()
    pb = [(rm * 0.98, lift * 0.8), (rm * 1.01, lift * 1.9), (rm * 1.05, lift * 2.0), (rm * 1.08, lift * 0.8)]
    rows = [[bm.verts.new(surf(rho * math.cos(2 * math.pi * s / segs), rho * math.sin(2 * math.pi * s / segs), l)) for s in range(segs)] for rho, l in pb]
    for k in range(len(rows) - 1):
        for s in range(segs):
            s2 = (s + 1) % segs
            bm.faces.new((rows[k][s], rows[k][s2], rows[k + 1][s2], rows[k + 1][s]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return [med, from_bm(name + "_Bezel", bm)]

def handle(name, R, z_top, z_bot, reach, rx=0.0085, ry=0.006):
    ctrl = [(R - 0.003, z_top), (R + reach * 0.5, z_top + 0.003), (R + reach * 0.95, z_top - 0.016),
            (R + reach, (z_top + z_bot) / 2), (R + reach * 0.85, z_bot + 0.012), (R + reach * 0.4, z_bot - 0.002), (R - 0.003, z_bot)]
    P = [ctrl[0]] + ctrl + [ctrl[-1]]; path = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = [Vector((p[0], 0, p[1])) for p in P[i - 1:i + 3]]
        for k in range(10):
            t = k / 10
            path.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    path.append(Vector((ctrl[-1][0], 0, ctrl[-1][1])))
    bm = bmesh.new(); rings = []
    for i, p in enumerate(path):
        tg = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        nm = tg.cross(Vector((0, 1, 0))).normalized()
        rings.append([bm.verts.new(p + nm * rx * math.cos(2 * math.pi * s / 20) + Vector((0, 1, 0)) * ry * math.sin(2 * math.pi * s / 20)) for s in range(20)])
    for k in range(len(rings) - 1):
        for s in range(20):
            s2 = (s + 1) % 20
            bm.faces.new((rings[k][s], rings[k][s2], rings[k + 1][s2], rings[k + 1][s]))
    bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(name + "_Handle", bm)

def stemware(name, foot_r, stem_top, bowl_ctrl, H, wall, stem_r=0.0032):
    """Foot + stem (one part) and a bowl (glass shell). bowl_ctrl: (z, r) of the bowl outer, from stem_top to H."""
    foot = [(0, 0), (foot_r - 0.002, 0), *arc(foot_r - 0.002, 0.002, 0.002, -90, 90, 6), (foot_r * 0.55, 0.0045),
            (stem_r * 1.8, 0.012), (stem_r, 0.02), (stem_r * 0.9, stem_top * 0.6), (stem_r * 1.1, stem_top - 0.004), (stem_r * 2.2, stem_top + 0.004), (0, stem_top + 0.006)]
    stem = lathe(name + "_Stem", foot, 64)
    R = spline(bowl_ctrl, 10)
    prof = [(0.0, stem_top + 0.004)]
    n = 60
    for i in range(1, n):
        z = stem_top + 0.004 + (H - wall / 2 - stem_top - 0.004) * i / n
        prof.append((R(z), z))
    prof += arc(R(H) - wall / 2, H - wall / 2, wall / 2, 0, 180, 8)
    inner = []
    zb = stem_top + 0.004 + wall * 2.2
    for i in range(1, n):
        z = (H - wall / 2) - (H - wall / 2 - zb) * i / n
        inner.append((max(R(z) - wall, 0.0005), z))
    inner.append((0.0, zb))
    bowl = lathe(name + "_Glass", prof + inner, 128)
    return [bowl, stem], list(reversed(inner))


# ------------------------------------------------------------ products
products, profiles = {}, {}

# 1. Smoke Tiger Whisky Glass (SWG0312A-B): heavy base with a raised cone inside
R1 = spline([(0, 0.0395), (0.05, 0.0402), (0.092, 0.0408)])
p, liq = vessel(R1, 0.092, 0.004, 0.024, floor=[(0.0, 0.034), (0.012, 0.029), (0.024, 0.0255), (0.032, 0.0245)])
g = lathe("tiger_Glass", p)
products["tiger"] = [g] + medallion("tiger", R1, 0.053, 0.0232)
profiles["tiger"] = dict(height=0.092, inner=liq)

# 2. Peacock Medallion Tumbler (SWG0377D-G): stemless, wide low belly
R2 = spline([(0, 0.031), (0.01, 0.041), (0.03, 0.0455), (0.06, 0.042), (0.098, 0.0365)])
p, liq = vessel(R2, 0.098, 0.003, 0.013)
products["peacock"] = [lathe("peacock_Glass", p)] + medallion("peacock", R2, 0.056, 0.0205)
profiles["peacock"] = dict(height=0.098, inner=liq)

# 3. Two-Tone Round coupe (Serial 14): smoke bowl, amber stem (catalogue cover)
parts, liq = stemware("coupe", 0.04, 0.088, [(0.088, 0.004), (0.095, 0.03), (0.108, 0.047), (0.124, 0.0525), (0.14, 0.0515), (0.15, 0.0495)], 0.15, 0.0018)
products["coupe"] = parts; profiles["coupe"] = dict(height=0.15, inner=liq)

# 4. Angular Flute (EJ8125A): angular shoulder, straight taper
parts, liq = stemware("flute", 0.034, 0.098, [(0.098, 0.004), (0.112, 0.022), (0.128, 0.0305), (0.15, 0.0302), (0.2, 0.0285), (0.245, 0.0268)], 0.245, 0.0016)
products["flute"] = parts; profiles["flute"] = dict(height=0.245, inner=liq)

# 5. Gold Lion Beer Mug (SMJ0415B-G): faceted foot, gold lion medallion
R5 = spline([(0, 0.0365), (0.06, 0.0372), (0.17, 0.0385)])
facet = lambda a, z: 1.0 + (0.035 * abs(math.cos(6 * a)) - 0.02) * max(0.0, 1 - z / 0.055)
p, liq = vessel(R5, 0.17, 0.0042, 0.026, rib=facet)
g5 = lathe("lion_Glass", p, 144, rib=facet)
products["lion"] = [g5, handle("lion", R5(0.1), 0.15, 0.045, 0.04)] + medallion("lion", R5, 0.092, 0.027)
profiles["lion"] = dict(height=0.17, inner=liq)

# 6. Amber Ribbed Cylinder Dispenser (MS-630-G): ribbed body, copper lid & tap, gold stand
R6 = spline([(0, 0.078), (0.03, 0.085), (0.25, 0.085), (0.285, 0.079), (0.30, 0.074)])
ribs = lambda a, z: 1.0 + 0.022 * abs(math.cos(18 * a))
p, liq = vessel(R6, 0.30, 0.004, 0.012, rib=ribs, steps=80)
body = lathe("dispenser_Glass", p, 216, rib=ribs)
lid = lathe("dispenser_Lid", [(0, 0.322), (0.03, 0.320), (0.06, 0.314), (0.077, 0.306), (0.08, 0.298), (0.0765, 0.295), (0.07, 0.30), (0, 0.305)], 96)
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.006, radius2=0.006, depth=0.012, matrix=Matrix.Translation((0, 0, 0.326)))
for i in range(40):  # ring handle on top
    a = i / 40 * 2 * math.pi
    M = Matrix.Translation((0, 0.0, 0.352)) @ Matrix.Translation((0.02 * math.cos(a), 0, 0.02 * math.sin(a))) @ Matrix.Rotation(-a, 4, "Y") @ Matrix.Diagonal((0.0045, 0.0045, 0.0035, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=M)
lid_ring = from_bm("dispenser_Lid2", bm)
bm = bmesh.new()  # tap at the front (-Y)
bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.008, radius2=0.007, depth=0.03, matrix=Matrix.Translation((0, -0.098, 0.04)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.004, radius2=0.004, depth=0.018, matrix=Matrix.Translation((0, -0.11, 0.03)))
bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0, -0.112, 0.052)) @ Matrix.Diagonal((0.006, 0.004, 0.022, 1)))
tap = from_bm("dispenser_Tap", bm)
bm = bmesh.new()  # stand: ring + three legs
for i in range(72):
    a = i / 72 * 2 * math.pi
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0.083 * math.cos(a), 0.083 * math.sin(a), -0.002)) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Diagonal((0.004, 0.0075, 0.004, 1)))
for k in range(3):
    a = k / 3 * 2 * math.pi + math.pi / 2
    top = Vector((0.083 * math.cos(a), 0.083 * math.sin(a), -0.002)); bot = Vector((0.105 * math.cos(a), 0.105 * math.sin(a), -0.11))
    d = bot - top; L = d.length
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.0028, radius2=0.0028, depth=L, matrix=Matrix.Translation((top + bot) / 2) @ rot)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.006, radius2=0.004, depth=0.004, matrix=Matrix.Translation(bot + Vector((0, 0, -0.002))))
stand = from_bm("dispenser_Stand", bm)
for ob in (body, lid, lid_ring, tap): ob.location.z += 0.0
products["dispenser"] = [body, lid, lid_ring, tap, stand]
profiles["dispenser"] = dict(height=0.30, inner=liq)

# ------------------------------------------------------------ materials (for renders / AR)
def mat(name, color, metallic=0.0, rough=0.05, transmission=0.0, image=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    for k, v in (("Base Color", (*color, 1)), ("Metallic", metallic), ("Roughness", rough), ("IOR", 1.5), ("Transmission Weight", transmission)):
        if k in b.inputs: b.inputs[k].default_value = v
    if image:
        tx = m.node_tree.nodes.new("ShaderNodeTexImage"); tx.image = image
        m.node_tree.links.new(tx.outputs["Color"], b.inputs["Base Color"]); m.node_tree.links.new(tx.outputs["Alpha"], b.inputs["Alpha"])
    return m

TINT = {"tiger": (0.55, 0.56, 0.58), "peacock": (1.0, 0.78, 0.45), "coupe": (0.55, 0.55, 0.56), "flute": (1, 1, 1), "lion": (1.0, 0.86, 0.6), "dispenser": (1.0, 0.7, 0.35)}
GOLD = mat("Gold", (1.0, 0.76, 0.34), 1.0, 0.18)
COPPER = mat("Copper", (0.95, 0.55, 0.38), 1.0, 0.2)
AMBER = mat("Amber", (1.0, 0.6, 0.2), 0.0, 0.02, 1.0)
for key, parts in products.items():
    glass = mat(f"Glass_{key}", TINT[key], 0, 0.01, 1.0)
    for ob in parts:
        part = ob.name.split("_", 1)[1]
        if part in ("Glass", "Handle"): ob.data.materials.append(glass)
        elif part == "Stem": ob.data.materials.append(AMBER if key == "coupe" else glass)
        elif part == "Medallion": ob.data.materials.append(mat(f"Med_{key}", (1, 1, 1), 0.8, 0.25, image=MEDS[key]))
        elif part in ("Lid", "Lid2", "Tap"): ob.data.materials.append(COPPER)
        else: ob.data.materials.append(GOLD)

# ------------------------------------------------------------ export
for key, parts in products.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{key}.glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
json.dump({k: dict(height=v["height"], inner=[[round(r, 5), round(z, 5)] for r, z in v["inner"]]) for k, v in profiles.items()}, open(os.path.join(OUT, "profiles.json"), "w"))
print("GLASSIT: exported", list(products))
