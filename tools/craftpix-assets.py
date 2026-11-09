#!/usr/bin/env python3
"""crop สไปรต์จากภาพ preview ของ CraftPix free packs -> PNG โปร่งใส

ใช้: python3 tools/craftpix-assets.py
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', '_raw')

def remove_bg(im, tol=42):
    """ลบพื้นหลังด้วย flood fill จากขอบภาพ (สีพื้นต่อเนื่องกับขอบ)"""
    a = np.array(im.convert('RGB')).astype(int)
    h, w, _ = a.shape
    bgmask = np.zeros((h, w), bool)
    # เริ่มจากพิกเซลขอบทุกด้าน -> สีที่พบบ่อยที่สุดคือสีพื้น
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    cols, counts = np.unique(border.reshape(-1, 3), axis=0, return_counts=True)
    bgcol = cols[int(np.argmax(counts))]
    # flood fill: พิกเซลที่ "ใกล้" bgcol และเชื่อมถึงขอบ
    near = (np.abs(a - bgcol).sum(axis=2) <= tol)
    lab, n = ndimage.label(near)
    edge_labels = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    edge_labels.discard(0)
    bgmask = np.isin(lab, list(edge_labels))
    out = im.convert('RGBA')
    arr = np.array(out)
    arr[:, :, 3] = np.where(bgmask, 0, 255)
    return Image.fromarray(arr)

def trim(im):
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 8)
    if len(xs) == 0:
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

def downscale(im, target_w):
    w, h = im.size
    if w <= target_w:
        return im
    return im.resize((target_w, max(1, round(h * target_w / w))), Image.LANCZOS)

def crop_save(src, box, out, target_w=None):
    im = Image.open(os.path.join(RAW, src)).convert('RGB')
    im = im.crop(box)
    im = remove_bg(im)
    im = trim(im)
    if target_w:
        im = downscale(im, target_w)
    p = os.path.join(ROOT, 'assets', out)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)
    print(f'  {out}: {im.size}')
    return im

if __name__ == '__main__':
    print('cropping buildings...')
    BLD = [
        ('bld1.png', (50, 0, 240, 273), 'objects/med_wood_small.png', 64),
        ('bld1.png', (255, 75, 495, 478), 'objects/med_wood_house.png', 96),
        ('bld1.png', (505, 70, 665, 405), 'objects/med_wood_cottage.png', 72),
        ('bld1.png', (1150, 125, 1410, 465), 'objects/med_barn.png', 96),
        ('bld1.png', (1455, 95, 1740, 490), 'objects/med_barn_big.png', 110),
        ('bld1.png', (25, 640, 205, 915), 'objects/med_stone_small.png', 64),
        ('bld1.png', (225, 640, 465, 995), 'objects/med_stone_house.png', 96),
        ('bld1.png', (500, 620, 765, 995), 'objects/med_stone_big.png', 100),
    ]
    for src, box, out, w in BLD:
        crop_save(src, box, out, w)
    print('done')
