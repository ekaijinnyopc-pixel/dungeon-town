#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""สร้างพื้น + วัตถุชุดใหม่ ใน palette Tiny Town (Kenney CC0) ให้เข้ากันทั้งภาพ

ปัญหาที่แก้: ในเกมมี 3 ชุดสีปนกัน
  - พื้น        = Kenney Roguelike (เขียวอมเหลือง + ดอกจุดส้มขาว)  -> ดอกไม้ตาลาย
  - ต้นไม้/ร้าน  = Tiny Town (เขียวอมฟ้า)
  - หิน/มลน้ำ     = Roguelike Modern City (ฟ้า/เทา)
แก้โดยวาดพื้น + หิน + พุ่ม + ป้ายร้าน + มลน้ำ ใหม่ทั้งหมดด้วย palette ของ Tiny Town

palette Tiny Town (ตรงกับ assets/tiles/town/tile_*.png)
  เขียว 132,198,105 · เขียวเข้ม 71,159,74 · เขียวอ่อน 139,216,125
  ทราย 234,165,108 · ทรายเข้ม 207,130,84
  ไม้ 189,108,74 · ไม้เข้ม 118,59,54
  หิน 139,155,180 · หินอ่อน 192,203,220 · หินเข้ม 82,96,124
  น้ำ 90,105,136 · น้ำอ่อน 139,155,180 · เนวี 38,43,68
  แดง 195,75,53 · เหลือง 253,190,83 · ส้ม 227,134,40
  เส้นขอบ 63,38,49 · ครีม 233,212,208
"""
from PIL import Image, ImageDraw
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OUT   = (63, 38, 49)
GRASS = (132, 198, 105)
GRASS_D = (71, 159, 74)
GRASS_L = (139, 216, 125)
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
YELL = (253, 190, 83)
ORNG = (227, 134, 40)
WHITE = (255, 255, 255)
CREAM = (233, 212, 208)


def new():
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def save(im, rel):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)
    print('%-42s %s' % (rel, im.size))
    return im.size


# ---------------------------------------------------------------- พื้น
def grass(flowers=False):
    im, d = new()
    d.rectangle([0, 0, 15, 15], fill=GRASS)
    # ต้นหญ้าเข้มแบบกระจาย (ไม่เรียงแถว ไม่เป็นลายซ้ำตายตัว)
    tufts = [(2, 3), (9, 1), (5, 7), (13, 5), (1, 11), (7, 12), (12, 10), (3, 14), (14, 13)]
    for (x, y) in tufts:
        d.point([(x, y)], fill=GRASS_D)
        d.point([(x + 1, y - 1)], fill=GRASS_D)
    for (x, y) in [(6, 2), (11, 8), (4, 9)]:
        d.point([(x, y)], fill=GRASS_L)
    if flowers:
        # ดอกไม้เล็ก โทนเข้ากับชุด (สีชุดเดียวกับต้นไม้) ไม่ใช้ส้มขาวแบบ Kenney
        for (x, y, c) in [(4, 5, YELL), (10, 11, WHITE), (13, 3, RED)]:
            d.point([(x, y)], fill=c)
            d.point([(x - 1, y), (x + 1, y)], fill=c)
            d.point([(x, y - 1), (x, y + 1)], fill=c)
            d.point([(x, y)], fill=ORNG if c is not RED else YELL)
    return save(im, 'assets/tiles/ground/tiny_grass%s.png' % ('_flowers' if flowers else ''))


def path():
    """ทางเดินดินทราย (สี 234,165,108 ของ Tiny) + รอยกรวด"""
    im, d = new()
    d.rectangle([0, 0, 15, 15], fill=SAND)
    for (x, y) in [(2, 3), (8, 1), (13, 6), (5, 9), (11, 12), (1, 13), (7, 6), (14, 10)]:
        d.point([(x, y)], fill=SAND_D)
    for (x, y) in [(4, 5), (10, 8), (3, 12)]:
        d.point([(x, y)], fill=STONE_L)
    return save(im, 'assets/tiles/ground/tiny_path.png')


def stone():
    """พื้นหินแผ่นเรียบ (plaza) — เส้นตะแกรง 4x4 พิกเซล"""
    im, d = new()
    d.rectangle([0, 0, 15, 15], fill=STONE)
    # แผ่นสลักสี
    for (x, y) in [(1, 1), (9, 1), (5, 5), (13, 5), (1, 9), (9, 9), (5, 13), (13, 13)]:
        d.rectangle([x, y, x + 1, y + 1], fill=STONE_L)
    for (x, y) in [(3, 3), (11, 3), (7, 7), (15, 7), (3, 11), (11, 11), (7, 15)]:
        d.rectangle([x, y, x + 1, y + 1], fill=STONE_D)
    # เส้นแบ่งแผ่น
    for v in (4, 8, 12):
        d.line([(0, v), (15, v)], fill=STONE_D)
        d.line([(v, 0), (v, 15)], fill=STONE_D)
    return save(im, 'assets/tiles/ground/tiny_stone.png')


def floor_planks():
    """พื้นไม้ในตึก"""
    im, d = new()
    d.rectangle([0, 0, 15, 15], fill=WOOD)
    for y in (0, 5, 10, 15):
        d.line([(0, y), (15, y)], fill=WOOD_D)
    # ปลายแผ่นไม้สลับ
    for y in (0, 5, 10):
        x = 3 if (y // 5) % 2 == 0 else 11
        d.line([(x, y), (x, y + 4)], fill=WOOD_D)
    for (x, y) in [(1, 2), (6, 3), (13, 7), (8, 12)]:
        d.point([(x, y)], fill=SAND)
    return save(im, 'assets/tiles/ground/tiny_floor.png')


# ---------------------------------------------------------------- วัตถุ
def tall_grass():
    """พุ่มสูง (แทน urban_bush สีฟ้าเขียว)"""
    im, d = new()
    for x in (2, 5, 8, 11, 14):
        h = 8 if x % 3 else 10
        d.line([(x, 15), (x, 15 - h)], fill=GRASS_D)
        d.point([(x, 15 - h)], fill=GRASS)
        if x % 2:
            d.point([(x + 1, 15 - h + 1)], fill=GRASS)
    return save(im, 'assets/objects/tiny_tallgrass.png')


def shop_sign():
    """ป้ายร้านบนไม้เสาตั้ง (แทน urban_shop_sign สีส้ม)"""
    im, d = new()
    # เสา
    d.rectangle([7, 9, 8, 15], fill=WOOD)
    d.line([(7, 9), (7, 15)], fill=WOOD_D)
    # แผ่นป้าย
    d.rectangle([2, 2, 13, 9], fill=WOOD)
    d.rectangle([3, 3, 12, 8], fill=SAND)
    d.line([(2, 2), (13, 2)], fill=WOOD_D)
    # ขอบเส้น
    d.rectangle([2, 2, 13, 9], outline=OUT)
    # เข็มแดงตรงกลาง (ให้เห็นว่าเป็นป้ายร้าน)
    d.rectangle([7, 4, 8, 7], fill=RED)
    return save(im, 'assets/objects/tiny_shop_sign.png')


if __name__ == '__main__':
    out = {}
    out['grass'] = grass(False)
    out['grass_flowers'] = grass(True)
    out['path'] = path()
    out['stone'] = stone()
    out['floor'] = floor_planks()
    out['tallgrass'] = tall_grass()
    out['shop_sign'] = shop_sign()
    print(json.dumps(out))
