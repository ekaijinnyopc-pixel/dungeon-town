#!/usr/bin/env python3
"""ค้นหาตำแหน่งเฟรม walk ของตัวละครชาย (CraftPix) จาก male2.jpg โดยอัตโนมัติ

วิธี: ลบพื้นหลังสีฟ้าอ่อน + แถบหัวข้อดำ แล้ว project พิกเซลเนื้อหาลงแกน x/y
เพื่อหาตำแหน่ง grid ของแต่ละ section
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', '_raw', 'male2.jpg')


def content_mask(im):
    a = np.array(im.convert('RGB')).astype(int)
    bg = np.array([200, 222, 222])
    d = np.abs(a - bg).sum(axis=2)
    m = d > 70
    dark = (a.max(axis=2) < 95)          # แถบหัวข้อดำ + ข้อความ
    return m & ~dark


def runs(v):
    """คืนรายการ (start, end) ของช่วงที่ True ต่อเนื่อง"""
    out = []
    s = None
    for i, x in enumerate(v):
        if x and s is None:
            s = i
        elif not x and s is not None:
            out.append((s, i))
            s = None
    if s is not None:
        out.append((s, len(v)))
    return out


def analyze(path):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    m = content_mask(im)
    lab, n = ndimage.label(m)
    objs = ndimage.find_objects(lab)
    keep = []
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        ys, xs = sl
        h = ys.stop - ys.start
        w = xs.stop - xs.start
        cnt = int((lab[sl] == (i + 1)).sum())
        if cnt < 150 or h < 20 or w < 10 or w > 60 or h > 90:
            continue
        keep.append((xs.start, ys.start, xs.stop, ys.stop, cnt))
    return im, keep


if __name__ == '__main__':
    im, boxes = analyze(SRC)
    print('image', im.size, 'sprite-like components:', len(boxes))
    # จัดกลุ่มตามแถว (y ที่ใกล้กัน)
    boxes.sort(key=lambda b: (b[1], b[0]))
    rows = []
    for b in boxes:
        placed = False
        for r in rows:
            if abs(r['y'] - b[1]) <= 12:
                r['items'].append(b)
                r['y'] = (r['y'] * (len(r['items']) - 1) + b[1]) / len(r['items'])
                placed = True
                break
        if not placed:
            rows.append(dict(y=b[1], items=[b]))
    for ri, r in enumerate(rows):
        items = sorted(r['items'], key=lambda b: b[0])
        print('\n== ROWGROUP %d  y~%d  n=%d' % (ri, r['y'], len(items)))
        for b in items:
            print('    x=%4d..%4d (w=%2d)  y=%4d..%4d (h=%2d)  n=%4d'
                  % (b[0], b[2], b[2] - b[0], b[1], b[3], b[3] - b[1], b[4]))
