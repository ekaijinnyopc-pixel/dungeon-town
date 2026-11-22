#!/usr/bin/env python3
"""crop เฟรมตัวละครหญิงจาก fem2.jpg (WALK UNARMED) -> PNG โปร่งใส เก็บความละเอียด native

โครงสร้างที่ตรวจได้ด้วย connected components (fem2.jpg 1800x1200):
  - แถวล่าง 4 แถว = WALK 4 ทิศ (down, left, right, up)
  - แต่ละแถว 12 ชิ้น = คอลัมน์ซ้าย "WITH SWORD" (x<900) + ขวา "UNARMED" (x>=900) ชุดละ 6 เฟรม
  - เก็บ native (44x62 canvas) แล้วค่อยย่อตอนวาดผ่าน S.SPEC (sc 0.5484)
    เหตุผล: การย่อตอน crop ทำให้รายละเอียดหายและหัวดูใหญ่เกินจริง

ใช้: python3 tools/craftpix-hero-female.py
"""
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', '_raw')
SRC = os.path.join(RAW, 'fem2.jpg')
OUT = os.path.join(ROOT, 'assets', 'characters')
BG = np.array([188, 199, 193])

NATIVE_H = 62      # ความสูง canvas ต้นฉบับ
CANVAS_W = 44      # ความกว้าง canvas ต้นฉบับ
CROP_HALF = 24     # ครึ่งความกว้างที่ crop รอบศูนย์กลาง
DIRS = ['down', 'left', 'right', 'up']


def remove_bg(im, tol=55):
    a = np.array(im.convert('RGB')).astype(int)
    near = (np.abs(a - BG).sum(axis=2) <= tol)
    lab, n = ndimage.label(near)
    edges = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    edges.discard(0)
    bgm = np.isin(lab, list(edges))
    out = np.array(im.convert('RGBA'))
    out[:, :, 3] = np.where(bgm, 0, 255)
    return Image.fromarray(out)


def find_rows(im):
    """หาแถวของเฟรมที่วาดเป็นชุด (แถวล่างของ sheet = WALK)"""
    a = np.array(im.convert('RGB')).astype(int)
    m = (np.abs(a - BG).sum(axis=2) > 60)
    m &= ~(a.max(axis=2) < 60)          # ตัดข้อความสีดำออก
    lab, n = ndimage.label(m)
    objs = ndimage.find_objects(lab)
    items = []
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        ys, xs = sl
        h = ys.stop - ys.start
        w = xs.stop - xs.start
        cnt = int((lab[sl] == (i + 1)).sum())
        if cnt < 200 or h < 30 or w < 12 or w > 60:
            continue
        items.append(dict(x0=int(xs.start), y0=int(ys.start), x1=int(xs.stop), y1=int(ys.stop),
                          cx=(xs.start + xs.stop) / 2, cy=(ys.start + ys.stop) / 2))
    items.sort(key=lambda d: d['cy'])
    rows = []
    for it in items:
        for r in rows:
            if abs(r['cy'] - it['cy']) <= 12:
                r['items'].append(it)
                r['cy'] = sum(x['cy'] for x in r['items']) / len(r['items'])
                break
        else:
            rows.append(dict(cy=it['cy'], items=[it]))
    rows.sort(key=lambda r: r['cy'])
    # แถว walk = แถวที่มี 12 ชิ้น (6 ชุดละ 2 ฝั่ง)
    walk = [r for r in rows if len(r['items']) == 12]
    if len(walk) < 4:
        print('ERR: ไม่พบ 4 แถว walk (พบ %d)' % len(walk))
        return []
    return walk[-4:]


def main():
    im = Image.open(SRC).convert('RGB')
    walk_rows = find_rows(im)
    if len(walk_rows) < 4:
        return 1
    os.makedirs(OUT, exist_ok=True)
    montage = Image.new('RGBA', (6 * 52, 4 * 70), (40, 40, 55, 255))
    md = ImageDraw.Draw(montage)
    for ri, r in enumerate(walk_rows):
        items = sorted([d for d in r['items'] if d['cx'] >= 900], key=lambda d: d['cx'])
        print('  %-5s n=%d x=%s' % (DIRS[ri], len(items), [int(d['cx']) for d in items]))
        if len(items) != 6:
            print('    skip (ไม่ครบ 6 เฟรม)')
            continue
        # baseline เดียวกันทั้งแถว เพื่อให้เท้าตรงกันทุกเฟรม
        base = max(d['y1'] for d in items)
        for fi, it in enumerate(items):
            c = remove_bg(im.crop((it['cx'] - CROP_HALF, base - NATIVE_H + 4,
                                   it['cx'] + CROP_HALF, base + 2)))
            arr = np.array(c)
            ys, xs = np.where(arr[:, :, 3] > 8)
            if len(xs) == 0:
                print('    skip frame', fi)
                continue
            c = c.crop((max(0, xs.min() - 1), max(0, ys.min() - 1),
                        min(c.width, xs.max() + 2), min(c.height, ys.max() + 2)))
            nc = Image.new('RGBA', (CANVAS_W, NATIVE_H), (0, 0, 0, 0))
            nc.alpha_composite(c, ((CANVAS_W - c.width) // 2, NATIVE_H - c.height))
            name = 'hero_%s_%d.png' % (DIRS[ri], fi)
            nc.save(os.path.join(OUT, name))
            mx = fi * 52
            my = ri * 70
            montage.alpha_composite(nc, (mx + (52 - nc.width) // 2, my + (70 - nc.height) // 2))
            md.text((mx + 2, my + 56), '%s%d' % (DIRS[ri][:2], fi), fill=(255, 255, 0, 255))
    montage.convert('RGB').resize((montage.width * 2, montage.height * 2), Image.NEAREST).save(
        os.path.join(ROOT, 'dist', 'female-hero-check.png'))
    print('saved dist/female-hero-check.png')
    return 0


if __name__ == '__main__':
    sys.exit(main())
