#!/usr/bin/env python3
"""crop เฟรมเดิน 4 ทิศของตัวละครหญิง จาก fem2.jpg (WALK UNARMED) -> PNG โปร่งใส"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', '_raw', 'fem2.jpg')
BG = np.array([188, 199, 193])

def remove_bg(im, tol=55):
    a = np.array(im.convert('RGB')).astype(int)
    near = (np.abs(a - BG).sum(axis=2) <= tol)
    lab, n = ndimage.label(near)
    edges = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    edges.discard(0)
    bg = np.isin(lab, list(edges))
    out = np.array(im.convert('RGBA'))
    out[:, :, 3] = np.where(bg, 0, 255)
    return Image.fromarray(out)

def scale_h(im, h):
    w = max(1, round(im.width * h / im.height))
    return im.resize((w, h), Image.LANCZOS)

# แถว WALK UNARMED (คอลัมน์ขวาล่าง) — ทิศตามแถว: down, left, right, up
COLS = [963, 1110, 1259, 1406, 1544, 1691]
ROWS = {'down': 720, 'left': 837, 'right': 954, 'up': 1072}
OUT = {'down': 'hero_down_%d.png', 'left': 'hero_left_%d.png',
       'right': 'hero_right_%d.png', 'up': 'hero_up_%d.png'}

if __name__ == '__main__':
    im = Image.open(SRC).convert('RGB')
    od = os.path.join(ROOT, 'assets', 'characters')
    os.makedirs(od, exist_ok=True)
    for direction, y0 in ROWS.items():
        for i, cx in enumerate(COLS):
            box = (cx - 26, y0 - 6, cx + 26, y0 + 60)
            c = remove_bg(im.crop(box))
            a = np.array(c)
            ys, xs = np.where(a[:, :, 3] > 8)
            if len(xs) == 0:
                print('  skip', direction, i); continue
            c = c.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
            c = scale_h(c, 34)
            name = OUT[direction] % i
            c.save(os.path.join(od, name))
            print(f'  characters/{name} {c.size}')
