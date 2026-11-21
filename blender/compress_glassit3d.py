# Make web-light copies of the Glassit 3D assets: Draco-compressed GLBs with WebP textures,
# and a 1024x512 studio HDR. Originals are left untouched.
# Run: Blender -b --python blender/compress_glassit3d.py -- <project root>
import bpy, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = os.path.abspath(argv[0]) if argv else os.getcwd()
D = os.path.join(ROOT, "assets", "glassit3d")

for key in ["tiger", "peacock", "coupe", "flute", "lion", "dispenser"]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(D, f"{key}.glb"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(D, f"{key}-c.glb"), export_format="GLB", export_yup=True,
        export_image_format="WEBP", export_image_quality=88,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    )
    print("wrote", key, os.path.getsize(os.path.join(D, f"{key}-c.glb")))

bpy.ops.wm.read_factory_settings(use_empty=True)
im = bpy.data.images.load(os.path.join(D, "studio.hdr"))
im.scale(1024, 512)
im.filepath_raw = os.path.join(D, "studio-1k.hdr"); im.file_format = "HDR"; im.save()
print("wrote hdr", os.path.getsize(os.path.join(D, "studio-1k.hdr")))
