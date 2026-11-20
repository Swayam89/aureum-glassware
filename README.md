# AUREUM — Gold, held in glass

Immersive 3D website for a gold-medallion glassware brand (B2C + B2B).

- **3D models**: built procedurally in Blender to real dimensions (`blender/build_glassware.py`), exported as GLB, rendered live with three.js.
- **Scroll story**: pour → macro zoom into the medallion → six medallion flips → exploded anatomy → the three forms.
- **Atelier**: real-time configurator (shape, medallion, initials, logo upload, rim, pour, lighting, toast, save image, AR).
- **Shop / trade**: collections gallery with zoom lightbox, gift-box builder, bag, trade price calculator and quote form.

Static site, no build step. Edit `js/config.js` for the contact email, prices and trade tiers.

Rebuild the models and renders:

```
/Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_glassware.py -- . --render
```
