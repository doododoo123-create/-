Source: user upload troops-all (2).zip, 2026-11-08.
The 42 original body/shade PNGs, frame metadata and original README are preserved.
Generation prompts and attached executable code were not imported as game rules.
Runtime sheets are derived with scripts/prepare-troops.py (Pillow): 5×2 frames,
384×320 each, body height224, pivot (174,292).
Original mask/colored sheets, preview GIF and duplicate base64 bundle are unnecessary at runtime.
The supplied file tier1 is farmer, tier2 spearman, tier3 heavy infantry.
These are display-only appearances: no new combat bonuses or troop types in the engine.

v0.51: Runtime WebP sheets retain the original1920×640 resolution, with384×320
cells,224 body height and pivot174,292. No96px downsampling remains.
Tinted current-frame cache is48MiB; white silhouette masks keep24frames.
Shared source image cache keeps6action pairs; active drawing references and
asynchronous decoding add to these budgets, which are not total process limits.
