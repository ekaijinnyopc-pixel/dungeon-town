#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""สร้างสไปรต์พิกเซลสี "Tiny Town" (Kenney CC0 palette) สำหรับธีม DQ

ทำไมต้องสร้างเอง?
  - พื้นเดิมใช้ Kenney Roguelike (เขียวอมเหลือง) แต่ต้นไม้/ร้านใช้ Tiny Town
    (เขียวอมฟ้า) -> สองชุดสีปนกันในภาพเดียว
  - Tiny Town / Tiny City / Tiny Dungeon ใช้ palette ชุดเดียวกัน
    (เขียว 132,198,105 / ทราย 234,165,108 / หิน 139,155,180 / น้ำเงินเทา 90,105,136)
  - สิ่งที่ชุด Tiny ไม่มี (น้ำ, ทุ่งพืช, ก้อนหินเดี่ยว, มลน้ำร้าน, ดอกไม้)
    จึงวาดเองด้วยสีจาก palette ชุดนั้น -> เข้ากันหมด

ไฟล์ที่สร้าง (trim ขอบแล้ว + พิมพ์ bbox ไว้ใส่ SPEC)
  assets/tiles/town/tiny_water.png     น้ำ
  assets/tiles/town/tiny_field.png     ทุ่งพืช
  assets/objects/tiny_rock.png         ก้อนหิน
  assets/objects/tiny_rock_small.png   ก้อนหินเล็ก
  assets/objects/tiny_flowers.png      ดอกไม้ (decor)
  assets/objects/tiny_awning.png       มลน้ำร้าน
"""
from PIL import Image, ImageDraw
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- palette กลางของชุด Tiny (Kenney) ----
OUT   = (63, 38, 49)      # เส้นขอบเข้ม
GRASS = (132, 198, 105)
GRASS_D = (71, 159, 74)
SAND  = (234, 165, 108)
SAND_D = (207, 130, 84)
WOOD  = (189, 108, 74)
WOOD_D = (118, 59, 54)
STONE = (139, 155, 180)
STONE_L = (192, 203, 220)
STONE_D = (82, 96, 124)
WATER = (90, 105, 136)
WATER_L = (139, 155, 180)
NAVY = (38, 43, 68)
RED  = (195, 75, 53)
CREAM = (233, 212, 208)
YELL = (253, 190, 83)
ORNG = (227, 134, 40)
WHITE = (255, 255, 255)
GREEN = (71, 159, 74)


def new():
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def save(im, rel, name):
    bbox = im.getbbox()
    out = im.crop(bbox) if bbox else im
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    out.save(p)
    print('%-34s %s  bbox=%s' % (rel, out.size, bbox))
    return out.size, bbox


def water():
    im, d = new()
    d.rectangle([0, 0, 15, 15], fill=WATER)
    # wave สลับแนวนอน
    for y in (2, 7, 12):
        d.line([(1, y), (4, y)], fill=WATER_L)
        d.line([(8, y), (11, y)], fill=WATER_L)
        d.line([(13, y + 1), (15, y + 1)], fill=NAVY)
    # ไฮไลต์
    d.point([(3, 4), (10, 9), (6, 13)], fill=STONE_L)
    d.point([(5, 4), (12, 9)], fill=STONE_L)
    return save(im, 'assets/tiles/town/tiny_water.png', 'water')


def field():
    """ทุ่งพืช: ดินแถบ + ต้นกล้วยสีเขียวออก"""
    im, d = new()
    d.rectangle([0, 0, 15, 15], fill=WOOD_D)
    for y in range(0, 16, 4):
        d.rectangle([0, y, 15, y + 1], fill=WOOD)
        # ต้นพืชสีเขียว
        for x in (2, 6, 10, 14):
            d.point([(x, y - 1), (x + 1, y - 2)], fill=GREEN)
    for y in range(2, 16, 4):
        d.point([(4, y), (12, y)], fill=OUT)
    return save(im, 'assets/tiles/town/tiny_field.png', 'field')


def sand():
    """ทรายสีออกน้ำตาลอ่อน (สี 234,165,108 ของชุด Tiny)"""
    im, d = new()
    d.rectangle([0, 0, 15, 15], fill=SAND)
    for (x, y) in [(2, 3), (7, 1), (12, 5), (4, 9), (10, 11), (14, 13), (1, 13)]:
        d.point([(x, y)], fill=SAND_D)
    for (x, y) in [(5, 6), (11, 8), (3, 12)]:
        d.point([(x, y)], fill=STONE_L)
    return save(im, 'assets/tiles/town/tiny_sand.png', 'sand')


def dirt():
    """ดินเข้ม (โคมหิน) สีเดียวกับ Tiny Dungeon floor"""
    im, d = new()
    d.rectangle([0, 0, 15, 15], fill=WOOD_D)
    for (x, y) in [(3, 4), (9, 2), (6, 10), (12, 8), (1, 13)]:
        d.point([(x, y)], fill=WOOD)
    for (x, y) in [(5, 6), (13, 12), (2, 8)]:
        d.point([(x, y)], fill=OUT)
    return save(im, 'assets/tiles/town/tiny_dirt.png', 'dirt')


def rock_big():
    im, d = new()
    # ก้อนหินมุมมองจากบน: ทรงก้อนหิน
    body = [(2, 9), (3, 5), (6, 2), (10, 3), (13, 6), (14, 10),
            (12, 13), (8, 14), (4, 13)]
    d.polygon(body, fill=STONE)
    # ด้านสว่าง
    d.polygon([(6, 2), (10, 3), (12, 6), (9, 7), (5, 6)], fill=STONE_L)
    # ด้านมืด
    d.polygon([(12, 7), (14, 10), (12, 13), (9, 13), (10, 10)], fill=STONE_D)
    # เส้นขอบ
    d.line(body + [body[0]], fill=OUT, width=1)
    # จุดตะไบ
    d.point([(7, 8), (8, 11), (5, 9)], fill=STONE_D)
    return save(im, 'assets/objects/tiny_rock.png', 'rock')


def rock_small():
    im, d = new()
    body = [(4, 10), (5, 6), (8, 4), (11, 6), (12, 10), (8, 12)]
    d.polygon(body, fill=STONE)
    d.polygon([(8, 4), (11, 6), (10, 8), (7, 7)], fill=STONE_L)
    d.polygon([(9, 9), (12, 10), (8, 12), (7, 10)], fill=STONE_D)
    d.line(body + [body[0]], fill=OUT, width=1)
    return save(im, 'assets/objects/tiny_rock_small.png', 'rock_small')


def flowers():
    """ช่อดอกไม้เล็ก (decor บนพื้นหญ้า)"""
    im, d = new()
    spots = [(4, 9, YELL), (9, 11, RED), (6, 5, WHITE)]
    for (x, y, col) in spots:
        d.point([(x, y + 2)], fill=GREEN)          # ก้าน
        d.point([(x, y + 1)], fill=GREEN)
        d.point([(x - 1, y), (x + 1, y)], fill=col)  # กลีบ
        d.point([(x, y - 1), (x, y + 1)], fill=col)
        d.point([(x, y)], fill=ORNG if col is not RED else YELL)  # เกสร
    return save(im, 'assets/objects/tiny_flowers.png', 'flowers')


def awning():
    """มลน้ำร้าน (แถบแดง-ครีม) แบบ DQ"""
    im, d = new()
    d.rectangle([0, 0, 15, 15], fill=CREAM)
    for x in range(0, 16, 4):
        d.rectangle([x, 0, x + 1, 15], fill=RED)
    # ขอบล่าง (ปีกมลน้ำ)
    d.rectangle([0, 12, 15, 15], fill=OUT)
    for x in range(0, 16, 4):
        d.rectangle([x, 12, x + 1, 14], fill=RED)
    # ขอบบน
    d.rectangle([0, 0, 15, 0], fill=OUT)
    return save(im, 'assets/objects/tiny_awning.png', 'awning')


if __name__ == '__main__':
    specs = {
        'tiny_water.png': water(),
        'tiny_sand.png': sand(),
        'tiny_dirt.png': dirt(),
        'tiny_field.png': field(),
        'tiny_rock.png': rock_big(),
        'tiny_rock_small.png': rock_small(),
        'tiny_flowers.png': flowers(),
        'tiny_awning.png': awning(),
    }
    print(json.dumps(specs, default=str))
