#!/usr/bin/env python3
"""crop เฟรมตัวละครชายจาก male2.jpg -> PNG โปร่งใส

โครงสร้างที่ตรวจได้ (male2.jpg 1800x1200):
  - label bar แบ่ง sheet เป็น 2 ส่วน: แถวบน (IDLE) และแถวล่าง (WALK)
  - แต่ละส่วนแบ่งซ้าย/ขวา: "WITH SWORD" | "UNARMED"
  - ในส่วน WALK: 4 แถว = 4 ทิศ (down, left, right, up), 6 เฟรม/ทิศ

ใช้: python3 tools/craftpix-hero-male.py [--montage]
"""
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', '_raw')
SRC = os.path.join(RAW, 'male2.jpg')
OUT = os.path.join(ROOT, 'assets', 'characters')
BG = np.array([200, 222, 222])
# เก็บความละเอียดต้นฉบับ (~52-58 px) แล้วค่อยย่อตอนวาด
# การย่อทั้งชุดมาตั้งแต่ตอน crop ทำให้รายละเอียดหายและหัวดูใหญ่เกินจริง
NATIVE_H = 62         # ความสูง canvas ต้นฉบับ (กันเฟรมสูงสุด)
CANVAS_W = 44         # ความกว้าง canvas ต้นฉบับ (กันเฟรมกว้างสุด)
CROP_HALF = 21        # ครึ่งความกว้างที่ crop รอบศูนย์กลาง


def remove_bg(im, tol=70):
    a = np.array(im.convert('RGB')).astype(int)
    near = (np.abs(a - BG).sum(axis=2) <= tol)
    lab, n = ndimage.label(near)
    edges = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    edges.discard(0)
    bgm = np.isin(lab, list(edges))
    out = np.array(im.convert('RGBA'))
    out[:, :, 3] = np.where(bgm, 0, 255)
    return Image.fromarray(out)


def scale_h(im, h):
    w = max(1, round(im.width * h / im.height))
    return im.resize((w, h), Image.LANCZOS)


def find_boxes(im):
    a = np.array(im.convert('RGB')).astype(int)
    m = (np.abs(a - BG).sum(axis=2) > 70)
    m &= ~(a.max(axis=2) < 95)
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
        if cnt < 200 or h < 25 or w < 12 or w > 60:
            continue
        items.append(dict(x0=int(xs.start), y0=int(ys.start), x1=int(xs.stop), y1=int(ys.stop),
                          cx=(xs.start + xs.stop) / 2, cy=(ys.start + ys.stop) / 2))
    items.sort(key=lambda d: d['cy'])
    rows = []
    for it in items:
        for r in rows:
            if abs(r['cy'] - it['cy']) <= 14:
                r['items'].append(it)
                r['cy'] = sum(d['cy'] for d in r['items']) / len(r['items'])
                break
        else:
            rows.append(dict(cy=it['cy'], items=[it]))
    rows.sort(key=lambda r: r['cy'])
    return rows


def main():
    im = Image.open(SRC).convert('RGB')
    rows = find_boxes(im)
    # แถว WALK = 4 แถวที่มี 12 ชิ้นหน้ากันห่าง ~144px (indices 6..9 ใน male2)
    # แถว WALK = 4 แถวที่มี ~12 ชิ้น (6 คอลัมน์ x 2 ชุด: WITH SWORD | UNARMED)
    walk_rows = [r for r in rows if 11 <= len(r['items']) <= 13]
    print('candidate walk rows:', [(int(r['cy']), len(r['items'])) for r in walk_rows])
    if len(walk_rows) < 4:
        print('ERR: ไม่พบ 4 แถว walk')
        return 1
    walk_rows = walk_rows[-4:]
    # แยกซ้าย (WITH SWORD, x<900) / ขวา (UNARMED, x>=900) ด้วยเกณฑ์พิกเซลจริง
    DIRS = ['down', 'left', 'right', 'up']
    os.makedirs(OUT, exist_ok=True)
    montage = Image.new('RGBA', (6 * 50 * 2, 4 * 68), (40, 40, 55, 255))
    md = ImageDraw.Draw(montage)
    for ri, r in enumerate(walk_rows):
        for side, (lo, hi) in enumerate([(0, 900), (900, 99999)]):
            items = sorted([d for d in r['items'] if lo <= d['cx'] < hi], key=lambda d: d['cx'])
            print('  %-5s side%d n=%d x=%s' % (DIRS[ri], side, len(items), [int(d['cx']) for d in items]))
            # baseline ล่างของเท้า: ใช้ค่าเดียวกันทั้งแถว เพื่อให้เท้าตรงกันทุกเฟรม
            good = [d for d in items if d['y1'] - d['y0'] >= 48]
            if not good:
                continue
            base = max(d['y1'] for d in good)
            for fi, it in enumerate(items):
                # crop ด้วย baseline คงที่ -> ขนาดเฟรมสม่ำเสมอในแถวเดียวกัน
                c = remove_bg(im.crop((it['cx'] - CROP_HALF, base - NATIVE_H + 4,
                                       it['cx'] + CROP_HALF, base + 2)))
                arr = np.array(c)
                ys, xs = np.where(arr[:, :, 3] > 8)
                if len(xs) == 0:
                    continue
                c = c.crop((max(0, xs.min() - 1), max(0, ys.min() - 1),
                            min(c.width, xs.max() + 2), min(c.height, ys.max() + 2)))
                # ใส่กลับลง canvas ต้นฉบับ ก้นล่างตรงกัน
                nc = Image.new('RGBA', (CANVAS_W, NATIVE_H), (0, 0, 0, 0))
                nc.alpha_composite(c, ((CANVAS_W - c.width) // 2, NATIVE_H - c.height))
                c = nc
                if side == 1:   # UNARMED -> ใช้เป็นตัวผู้หลัก
                    name = 'hero_m_%s_%d.png' % (DIRS[ri], fi)
                else:
                    name = 'hero_ms_%s_%d.png' % (DIRS[ri], fi)
                c.save(os.path.join(OUT, name))
                mx = (side * 6 + fi) * 50
                my = ri * 68
                montage.alpha_composite(c, (mx + (50 - c.width) // 2, my + (68 - c.height) // 2))
                md.text((mx + 2, my + 52), '%s%d' % (DIRS[ri][:2], fi), fill=(255, 255, 0, 255))
    montage.convert('RGB').resize((montage.width * 2, montage.height * 2), Image.NEAREST).save(
        os.path.join(ROOT, 'dist', 'male-hero-check.png'))
    print('saved dist/male-hero-check.png')
    print('files:', len([f for f in os.listdir(OUT) if f.startswith('hero_m')]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
