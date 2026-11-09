#!/usr/bin/env python3
"""crop อาคารจาก bld2.png (พื้นหลังเข้มสีเดียว) -> PNG โปร่งใส"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', '_raw', 'bld2.png')
BG = np.array([46, 57, 63])

def remove_bg(im, tol=60):
    a = np.array(im.convert('RGB')).astype(int)
    near = (np.abs(a - BG).sum(axis=2) <= tol)
    lab, n = ndimage.label(near)
    edges = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    edges.discard(0)
    bg = np.isin(lab, list(edges))
    out = np.array(im.convert('RGBA'))
    out[:, :, 3] = np.where(bg, 0, 255)
    return Image.fromarray(out)

def trim(im, pad=1):
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 8)
    if len(xs) == 0:
        return im
    x0, x1 = max(0, xs.min() - pad), min(im.width, xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(im.height, ys.max() + 1 + pad)
    return im.crop((x0, y0, x1, y1))

def scale_h(im, h):
    w = max(1, round(im.width * h / im.height))
    return im.resize((w, h), Image.LANCZOS)

# (ชื่อ, bbox, ความสูง px)
JOBS = [
    ('wh_small_a',  (44, 262, 176, 455),  56),
    ('wh_small_b',  (42, 473, 200, 703),  60),
    ('wh_med',      (231, 338, 427, 644), 76),
    ('wh_large',    (449, 336, 748, 667), 92),
    ('bh_small_a',  (910, 262, 1044, 464), 56),
    ('bh_small_b',  (915, 472, 1071, 702), 60),
    ('bh_med',      (1115, 353, 1311, 654), 76),
    ('bh_large',    (1344, 344, 1643, 667), 92),
    ('ww_small_a',  (47, 785, 168, 960),   58),
    ('ww_small_b',  (23, 964, 181, 1183),  62),
    ('ww_med',      (202, 845, 424, 1099), 80),
    ('ww_large',    (458, 823, 774, 1154), 96),
    ('bw_small_a',  (907, 783, 1035, 962),  58),
    ('bw_small_b',  (889, 959, 1049, 1182), 62),
    ('bw_med',      (1089, 830, 1319, 1094), 80),
    ('bw_large',    (1349, 785, 1665, 1121), 96),
]

if __name__ == '__main__':
    im = Image.open(SRC).convert('RGB')
    outdir = os.path.join(ROOT, 'assets', 'objects')
    os.makedirs(outdir, exist_ok=True)
    for name, box, h in JOBS:
        c = trim(remove_bg(im.crop(box)))
        c = scale_h(c, h)
        p = os.path.join(outdir, f'mv_{name}.png')
        c.save(p)
        print(f'  objects/mv_{name}.png {c.size}')
