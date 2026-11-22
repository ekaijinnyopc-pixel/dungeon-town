#!/usr/bin/env python3
"""crop ตัวละคร chibi จากภาพ preview CraftPix (Forest Ranger / Forest Guardian) -> PNG โปร่งใส

หมายเหตุสำคัญเรื่อง license:
  ภาพ preview ของ CraftPix เป็น artwork โปรโมต ไม่ใช่ไฟล์ pack ต้นฉบับ
  เราใช้เป็น "ตัวอย่างอ้างอิง" เท่านั้น และครอปเฉพาะตัวละครออกมา
  attribution ระบุใน assets/CREDITS.md

ตัวละครชุดนี้เป็นภาพ vector-style chibi (เส้นขอบดำหนา) ไม่ใช่ pixel art
-> ใช้เป็น NPC ในเมือง (ยืนนิ่ง + bob เบา) ไม่ใช้แทนตัวผู้เล่นที่เดิน 4 ทิศ

ใช้: python3 tools/craftpix-chibi-npc.py
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', '_raw')
OUT = os.path.join(ROOT, 'assets', 'characters')

# (ไฟล์, สีพื้นหลัง, [(ชื่อ, bbox คร่าวๆ)])
JOBS = [
    ('ranger.jpg', (72, 148, 99), [
        ('npc_ranger_hood', (140, 300, 600, 1000)),
        ('npc_ranger_leaf', (610, 300, 1140, 1000)),
        ('npc_ranger_antler', (1185, 300, 1670, 1000)),
    ]),
    ('forestguardian.jpg', (53, 125, 103), [
        ('npc_guard_tree', (110, 290, 560, 1000)),
        ('npc_guard_stone', (640, 290, 1090, 1000)),
        ('npc_guard_hood', (1155, 290, 1660, 1000)),
    ]),
]


def remove_bg(im, bg, tol=95):
    a = np.array(im.convert('RGB')).astype(int)
    near = (np.abs(a - np.array(bg)).sum(axis=2) <= tol)
    lab, n = ndimage.label(near)
    edges = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    edges.discard(0)
    bgm = np.isin(lab, list(edges))
    out = np.array(im.convert('RGBA'))
    out[:, :, 3] = np.where(bgm, 0, 255)
    return Image.fromarray(out)


def largest_component(im):
    """เก็บเฉพาะก้อนที่ใหญ่ที่สุด (ตัวละคร) ตัดข้อความ/เส้นออก"""
    a = np.array(im.convert('RGBA'))
    mask = a[:, :, 3] > 20
    lab, n = ndimage.label(mask)
    if n == 0:
        return None
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    best = int(np.argmax(sizes)) + 1
    keep = lab == best
    out = a.copy()
    out[:, :, 3] = np.where(keep, a[:, :, 3], 0)
    return Image.fromarray(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    made = []
    for fname, bg, items in JOBS:
        src = os.path.join(RAW, fname)
        if not os.path.exists(src):
            print('SKIP (ไม่มีไฟล์):', fname)
            continue
        im = Image.open(src).convert('RGB')
        for name, box in items:
            crop = im.crop(box)
            fg = remove_bg(crop, bg)
            fg = largest_component(fg)
            if fg is None:
                print('  skip', name)
                continue
            a = np.array(fg)
            ys, xs = np.where(a[:, :, 3] > 20)
            fg = fg.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
            # ย่อให้ความสูงไม่เกิน ~72 px (พอดีกับสเกลตัวผู้เล่น 62px)
            h = fg.height
            if h > 72:
                w = max(1, round(fg.width * 72 / h))
                fg = fg.resize((w, 72), Image.LANCZOS)
            path = os.path.join(OUT, name + '.png')
            fg.save(path)
            made.append((name, fg.size))
            print('  %-22s %s' % (name, fg.size))
    print('total:', len(made))
    # montage ตรวจด้วยตา
    if made:
        tiles = [Image.open(os.path.join(OUT, n + '.png')).convert('RGBA') for n, _ in made]
        W = max(t.width for t in tiles) + 20
        H = sum(t.height + 14 for t in tiles)
        m = Image.new('RGBA', (W * len(tiles), H), (58, 74, 58, 255))
        # เรียงแนวนอน
        m = Image.new('RGBA', (sum(t.width + 20 for t in tiles), max(t.height for t in tiles) + 20),
                      (58, 74, 58, 255))
        x = 10
        for t in tiles:
            m.alpha_composite(t, (x, 10))
            x += t.width + 20
        m.convert('RGB').save(os.path.join(ROOT, 'dist', 'chibi-npc-check.png'))
        print('saved dist/chibi-npc-check.png')
    return 0


if __name__ == '__main__':
    sys.exit(main())
