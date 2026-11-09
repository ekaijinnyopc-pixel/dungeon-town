#!/usr/bin/env python3
"""ตัดสไปรต์มอนส์จาก FF '10 Basic RPG Enemies' (rpgcritters2.png) ให้สะอาด

ทุกเซลล์ถูก crop จาก tight bounding box ของ component ที่ตรวจจับได้
เพื่อไม่ให้มีเศษภาพจากเซลล์ข้างเคียงปนมาด้วย (ขั้นตอน "inspect crop zoomed")

usage: extract-ff-mobs.py <sheet.png> <out_dir>
"""
import os
import sys

from PIL import Image

BG = (128, 128, 128)
BG_TOL = 20

# (ชื่อไฟล์, x, y, w, h) — bbox จาก connected-component detection บน sheet
# แถว/คอลัมน์ของ FF pack: col0/col1 x row0..row4
CELLS = [
    ("ghoul",    17,  16, 30, 24),
    ("goblin",   56,   9, 26, 31),
    ("dragon",    9,  52, 37, 34),
    ("skeleton", 55,  51, 28, 45),
    ("imp",      18, 106, 33, 32),
    ("mage",     61, 105, 19, 27),
    ("wraith",   17, 153, 32, 33),
    ("knight",   56, 151, 29, 35),
    ("bat",      15, 197, 41, 22),
    ("slime",    64, 201, 24, 19),
]


def is_bg(p):
    return abs(p[0] - BG[0]) + abs(p[1] - BG[1]) + abs(p[2] - BG[2]) <= BG_TOL


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    sheet_path, out_dir = sys.argv[1], sys.argv[2]
    sheet = Image.open(sheet_path).convert("RGBA")
    os.makedirs(out_dir, exist_ok=True)
    for name, x, y, w, h in CELLS:
        cell = sheet.crop((x, y, x + w, y + h)).convert("RGBA")
        data = []
        for p in cell.getdata():
            data.append((0, 0, 0, 0) if is_bg(p) else p)
        cell.putdata(data)
        bb = cell.getbbox()
        if not bb:
            print(f"❌ {name}: เซลล์ว่าง")
            return 1
        trimmed = cell.crop(bb)
        path = os.path.join(out_dir, f"{name}.png")
        trimmed.save(path)
        print(f"✅ {name:9} raw {w}x{h} -> trim {trimmed.size[0]}x{trimmed.size[1]}  {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
