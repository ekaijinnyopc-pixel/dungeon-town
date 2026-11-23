#!/usr/bin/env python3
"""Normalise the OGA '4 Direction Animated Warrior' hero frames (Calciumtrice, CC-BY 4.0).

Problem solved
--------------
Each animation row (walk / idle / attack) of one direction was cropped to its own
alpha-aware bbox, so the three animations of the same direction had *different*
canvas sizes and *different* feet baselines:

    down  walk 54x105 (feet y=102)   idle 60x105 (feet y=105)   atk 57x100 (feet y=94)

The renderer anchors every sprite on its bottom-centre, so switching animation
moved the character by up to 5 px vertically and changed its width.

Fix
---
Per direction, build ONE canvas (max width, max height over walk+idle+atk),
place every frame so that
  * its feet baseline sits exactly on the canvas bottom
  * it is horizontally centred on the canvas
and write the frames back.  A direction therefore has a single canvas size and
a single baseline -> no jitter when the animation changes.

A shared metadata file `assets/characters/oga_hero_spec.json` records the final
canvas size per file so `js/sprites.js` can be kept in sync.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'characters')

DIRS = ['down', 'left', 'right', 'up']

# on-screen height of the player sprite (px, before the world zoom)
TARGET_H = 34
ANIMS = [
    ('walk', 'hero_{d}_{i}.png'),
    ('idle', 'hero_{d}_idle_{i}.png'),
    ('atk', 'hero_{d}_atk_{i}.png'),
]


def load_group():
    """-> {dir: [(anim, index, path)]} preserving file order."""
    groups = {}
    for d in DIRS:
        items = []
        for anim, pat in ANIMS:
            i = 0
            while True:
                name = pat.format(d=d, i=i)
                path = os.path.join(OUT, name)
                if not os.path.exists(path):
                    break
                items.append((anim, i, path, name))
                i += 1
        groups[d] = items
    return groups


def normalise_direction(items):
    """Re-canvas every frame of one direction onto a shared canvas + baseline."""
    frames = []
    for anim, idx, path, name in items:
        im = Image.open(path).convert('RGBA')
        frames.append({'anim': anim, 'idx': idx, 'name': name, 'im': im, 'bb': im.getbbox()})

    boxes = [f['bb'] for f in frames if f['bb']]
    if not boxes:
        return None
    # canvas: widest frame, tallest frame (feet baseline = bottom of canvas)
    canvas_w = max(b[2] - b[0] for b in boxes)
    canvas_h = max(b[3] - b[1] for b in boxes)

    out = []
    for f in frames:
        im = f['im']
        bb = f['bb']
        if not bb:
            out.append((f['name'], Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))))
            continue
        x0, y0, x1, y1 = bb
        piece = im.crop(bb)
        canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
        # horizontal: centre the piece
        px = (canvas_w - piece.width) // 2
        # vertical: align the piece's feet (bbox bottom) with the canvas bottom
        py = canvas_h - piece.height
        canvas.alpha_composite(piece, (px, py))
        out.append((f['name'], canvas))

    # --- downscale to the in-game size -------------------------------------
    # The source art is ~105 px tall; on screen the player is ~36 px tall
    # (same order as the 32 px monsters).  Resampling here (LANCZOS + alpha
    # threshold) keeps the result far crisper than letting the canvas do a
    # non-integer nearest-neighbour downscale at draw time.
    factor = TARGET_H / float(canvas_h)
    new_w = max(1, int(round(canvas_w * factor)))
    out = [
        (name, resample(canvas, new_w, TARGET_H))
        for name, canvas in out
    ]

    return out, new_w, TARGET_H


def resample(im, w, h):
    """LANCZOS downscale + alpha threshold (keeps the silhouette clean)."""
    out = im.resize((w, h), Image.LANCZOS)
    r, g, b, a = out.split()
    a = a.point(lambda v: 255 if v >= 110 else 0)
    return Image.merge('RGBA', (r, g, b, a))


def main():
    groups = load_group()
    spec = {}
    for d in DIRS:
        res = normalise_direction(groups[d])
        if not res:
            continue
        out, w, h = res
        for name, canvas in out:
            canvas.save(os.path.join(OUT, name))
            spec[name] = [w, h]
        print('%-6s -> canvas %dx%d (%d frames)' % (d, w, h, len(out)))

    with open(os.path.join(OUT, 'oga_hero_spec.json'), 'w') as fh:
        json.dump(spec, fh, indent=1, sort_keys=True)
    print('wrote', len(spec), 'frames ->', os.path.join(OUT, 'oga_hero_spec.json'))


if __name__ == '__main__':
    main()
