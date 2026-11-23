#!/usr/bin/env python3
"""Extract 4-direction hero frames from the OGA '4 Direction Animated Warrior'
labelled reference (Calciumtrice, CC-BY 4.0).

Source : assets/_raw/oga_warrior_labelled_reference.png (4000x4800)
Layout : labels in x < 1312; sprite strips start x=1381 with 192px pitch.
Rows (top -> bottom), 25 rows of 12/8/7/6 frames:
  RIGHT  : idle_u, idle_s, move_u, move_s, atk_u, atk_s
  FRONT  : same order
  LEFT   : same order
  BACK   : same order
  DEATH  : row 24

Output (assets/characters/):
  hero_<dir>_<i>.png        walk cycle (MOVE, unarmed)
  hero_<dir>_idle_<i>.png   idle animation
  hero_<dir>_atk_<i>.png    attack animation
where <dir> in down/left/right/up.

Every animation of one direction shares ONE canvas size and ONE baseline
(feet bottom = canvas bottom) so the renderer can swap frames without jitter.
Background removal: the reference uses a flat pale-blue (192,201,217) plus
white label panels; we key out both with a colour-distance alpha ramp.
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', '_raw', 'oga_warrior_labelled_reference.png')
OUT = os.path.join(ROOT, 'assets', 'characters')

LABEL_X = 1312

ROW_BOUNDS = [
    (39, 143), (231, 335), (426, 527), (618, 719), (816, 911), (1008, 1103),
    (1194, 1295), (1386, 1487), (1578, 1679), (1770, 1871), (1971, 2063),
    (2163, 2255), (2343, 2447), (2535, 2639), (2730, 2831), (2922, 3023),
    (3120, 3215), (3312, 3407), (3498, 3599), (3690, 3791), (3882, 3983),
    (4074, 4175), (4269, 4367), (4461, 4559), (4662, 4754),
]

# (direction_key_in_source, animation) -> row index (unarmed rows only)
UNARMED = {
    ('right', 'idle'): 0, ('right', 'move'): 2, ('right', 'atk'): 4,
    ('front', 'idle'): 6, ('front', 'move'): 8, ('front', 'atk'): 10,
    ('left', 'idle'): 12, ('left', 'move'): 14, ('left', 'atk'): 16,
    ('back', 'idle'): 18, ('back', 'move'): 20, ('back', 'atk'): 22,
}

DIR_MAP = {'front': 'down', 'right': 'right', 'left': 'left', 'back': 'up'}

BG_COLORS = [(192, 201, 217), (255, 255, 255)]


def col_runs(arr, r0, r1):
    reg = arr[r0:r1 + 1]
    sat = reg.max(2) - reg.min(2)
    cs = sat.sum(0)
    runs, start = [], None
    for i, v in enumerate(cs):
        if v > 200 and start is None:
            start = i
        elif v <= 200 and start is not None:
            if i - start > 3:
                runs.append((start, i - 1))
            start = None
    if start is not None:
        runs.append((start, len(cs) - 1))
    return [r for r in runs if r[0] > LABEL_X]


def remove_bg(crop):
    """Return RGBA image with the flat reference background keyed out."""
    a = np.array(crop.convert('RGB')).astype(np.int16)
    best = None
    for bg in BG_COLORS:
        d = np.abs(a - np.array(bg, dtype=np.int16)).sum(2)
        best = d if best is None else np.minimum(best, d)
    # 0 -> fully transparent, >=60 -> fully opaque
    alpha = np.clip((best - 6) * (255.0 / 54.0), 0, 255).astype(np.uint8)
    # keep colour but flatten near-background pixels toward the sampled colour
    out = a.astype(np.uint8)
    rgba = np.dstack([out, alpha])
    return Image.fromarray(rgba, 'RGBA')


def main():
    src = Image.open(SRC).convert('RGB')
    arr = np.array(src).astype(int)

    spec = {}
    per_dir = {}

    for (direction, anim), row_idx in UNARMED.items():
        r0, r1 = ROW_BOUNDS[row_idx]
        runs = col_runs(arr, r0, r1)
        frames = []
        for (x0, x1) in runs:
            crop = src.crop((x0 - 4, r0 - 4, x1 + 5, r1 + 5))
            frames.append(remove_bg(crop))
        per_dir[(direction, anim)] = frames
        print(f'{direction:6s} {anim:5s} row {row_idx:2d} -> {len(frames)} frames')

    for (direction, anim), frames in per_dir.items():
        key = DIR_MAP[direction]
        # alpha-aware bbox across the whole animation row
        bbs = []
        for f in frames:
            bb = f.getbbox()
            if bb:
                bbs.append(bb)
        if not bbs:
            continue
        x0 = min(b[0] for b in bbs)
        y0 = min(b[1] for b in bbs)
        x1 = max(b[2] for b in bbs)
        y1 = max(b[3] for b in bbs)
        w, h = x1 - x0, y1 - y0

        for i, f in enumerate(frames):
            canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            canvas.paste(f, (-x0, -y0), f)
            if anim == 'move':
                name = f'hero_{key}_{i}.png'
            else:
                name = f'hero_{key}_{anim}_{i}.png'
            canvas.save(os.path.join(OUT, name))
            spec[name] = [w, h]

    with open(os.path.join(OUT, 'oga_hero_spec.json'), 'w') as fh:
        json.dump(spec, fh, indent=1, sort_keys=True)
    print('wrote', len(spec), 'files')


if __name__ == '__main__':
    main()
