#!/usr/bin/env python3
"""ดึงสไปรต์มอนส์จาก DCSS (CC0) มาใส่ assets/mobs/ พร้อม trim ขอบโปร่งใส"""
import io, json, os, zipfile
from PIL import Image

ZIP = 'assets/_raw/dcss_full.zip'
ROOT = 'Dungeon Crawl Stone Soup Full/'
OUT = 'assets/mobs'
# type ใน DT.MOBS  ->  ไฟล์ใน DCSS
MAP = {
    'slime':        'monster/amorphous/jelly.png',
    'wolf':         'monster/animals/wolf.png',
    'goblin':       'monster/goblin_new.png',
    'boar':         'monster/animals/holy_swine.png',
    'wraith':       'monster/undead/wraith.png',
    'bat':          'monster/animals/bat.png',
    'imp':          'monster/demons/imp.png',
    'ghoul':        'monster/undead/ghoul.png',
    'skeleton':     'monster/undead/skeletons/skeleton_humanoid_small_new.png',
    'mage':         'monster/wizard.png',
    'knight':       'monster/death_knight.png',
    'dragon':       'monster/dragons/dragon.png',
    'pirate_leader':'monster/orc_warlord.png',
    'squidman':     'monster/undead/zombies/zombie_octopode.png',
    'pirate_zombie':'monster/undead/revenant.png',
}

def trim(im):
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im

def main():
    z = zipfile.ZipFile(ZIP)
    spec = {}
    for typ, path in MAP.items():
        data = z.read(ROOT + path)
        im = Image.open(io.BytesIO(data)).convert('RGBA')
        im = trim(im)
        dest = os.path.join(OUT, typ + '.png')
        im.save(dest, optimize=True)
        w, h = im.size
        spec['mobs/' + typ + '.png'] = {'src': [0, 0, w, h], 'sc': 1, 'dy': 0}
        print(f'{typ:14s} {w:3d}x{h:<3d} <- {path}')
    with open('assets/mobs/mapping.json', 'w') as f:
        json.dump({'source': 'Dungeon Crawl Stone Soup Full (DCSS)', 'license': 'CC0 1.0',
                   'map': MAP}, f, indent=2)
    with open('assets/mobs/_spec.json', 'w') as f:
        json.dump(spec, f, indent=2)

if __name__ == '__main__':
    main()
