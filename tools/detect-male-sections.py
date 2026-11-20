#!/usr/bin/env python3
"""ค้นหา section (WALK UNARMED ฯลฯ) + ตำแหน่งเฟรมของตัวละครชายจาก male2.jpg

วิธี:
1. หาแถบหัวข้อสีดำ (แถวที่มีพิกเซลเข้มกระจายกว้าง) -> ตำแหน่ง label
2. ตัดพื้นหลังสีฟ้าอ่อนออก -> หา connected components ของสไปรต์
3. จัดกลุ่มเป็นแถว/คอลัมน์ -> ชี้เฟรม
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def find_bands(path):
    im = Image.open(path).convert('RGB')
    a = np.array(im).astype(int)
    H, W, _ = a.shape
    dark = (a.max(axis=2) < 95)
    frac = dark.sum(axis=1) / W
    bands = []
    inb = False
    for y in range(H):
        if frac[y] > 0.25 and not inb:
            inb = True
            s = y
        elif frac[y] <= 0.25 and inb:
            inb = False
            bands.append((s, y))
    if inb:
        bands.append((s, H))
    # หา x-extent ของแต่ละแถบ
    out = []
    for (y0, y1) in bands:
        if y1 - y0 < 12:
            continue
        cols = dark[y0:y1].sum(axis=0)
        xs = np.where(cols > 0)[0]
        if len(xs) == 0:
            continue
        out.append(dict(y0=y0, y1=y1, x0=int(xs.min()), x1=int(xs.max())))
    return im, out


def sprites(path, band):
    im = Image.open(path).convert('RGB')
    a = np.array(im).astype(int)
    bg = np.array([200, 222, 222])
    m = (np.abs(a - bg).sum(axis=2) > 70)
    m &= ~(a.max(axis=2) < 95)
    # จำกัดพิกเซลให้อยู่ใต้แถบ
    m[:band['y1'], :] = False
    lab, n = ndimage.label(m)
    objs = ndimage.find_objects(lab)
    res = []
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        ys, xs = sl
        h = ys.stop - ys.start
        w = xs.stop - xs.start
        cnt = int((lab[sl] == (i + 1)).sum())
        if cnt < 200 or h < 25 or w < 12 or w > 60:
            continue
        res.append(dict(x0=int(xs.start), y0=int(ys.start), x1=int(xs.stop), y1=int(ys.stop),
                        w=int(w), h=int(h), n=cnt,
                        cx=(xs.start + xs.stop) / 2, cy=(ys.start + ys.stop) / 2))
    return res


def group_rows(items, tol=14):
    items = sorted(items, key=lambda d: d['cy'])
    rows = []
    for it in items:
        for r in rows:
            if abs(r['cy'] - it['cy']) <= tol:
                r['items'].append(it)
                r['cy'] = sum(d['cy'] for d in r['items']) / len(r['items'])
                break
        else:
            rows.append(dict(cy=it['cy'], items=[it]))
    return sorted(rows, key=lambda r: r['cy'])


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', '_raw', 'male2.jpg')
    im, bands = find_bands(path)
    print('bands:')
    for b in bands:
        print('   y=%4d..%4d  x=%4d..%4d' % (b['y0'], b['y1'], b['x0'], b['x1']))
    for bi, b in enumerate(bands):
        items = sprites(path, b)
        rows = group_rows(items)
        print('\n### SECTION %d (band y=%d..%d)  sprites=%d rows=%d'
              % (bi, b['y0'], b['y1'], len(items), len(rows)))
        for ri, r in enumerate(rows):
            cols = sorted(r['items'], key=lambda d: d['cx'])
            xs = [int(d['cx']) for d in cols]
            print('   row%d n=%2d  cx=%s' % (ri, len(cols), xs))
