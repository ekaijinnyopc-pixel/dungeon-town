#!/usr/bin/env python3
"""เพิ่มเส้นขอบ (outline) สีเข้มให้สไปรต์ตัวละคร เพื่อให้เด่นจากพื้น

วิธี: ขยาย alpha mask (dilate) แล้ววาดสีเข้มไว้ข้างหลังตัวละคร
ใช้: python3 tools/add-outline.py [radius]
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHARS = os.path.join(ROOT, 'assets', 'characters')
OUTLINE = (26, 18, 32, 255)   # เข้มมากแต่ไม่ดำสนิท (อมม่วงเข้ม)


def add_outline(im, radius=1):
    a = np.array(im.convert('RGBA'))
    alpha = a[:, :, 3]
    if alpha.max() == 0:
        return im
    mask = alpha > 8
    # ใช้ 4-neighbour เท่านั้น -> เส้นขอบต่อเนื่อง ไม่เกิดจุดหลุด/คราบรอบมุม
    st4 = ndimage.generate_binary_structure(2, 1)
    ring = ndimage.binary_dilation(mask, structure=st4) & ~mask
    out = a.copy()
    out[ring] = OUTLINE
    out[mask] = a[mask]
    return Image.fromarray(out)


def main():
    radius = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    fem_names = set()
    for d in ('down', 'left', 'right', 'up'):
        for i in range(6):
            fem_names.add('hero_%s_%d.png' % (d, i))
    # สไปรต์ชายชุดใหม่เป็น native 44x62 -> outline ต้องหนากว่าเดิม 1 px
    targets = []
    for t in sorted(glob.glob(os.path.join(CHARS, '*.png'))):
        b = os.path.basename(t)
        if b.startswith('hero_m_') or b in fem_names:
            targets.append(t)
    n = 0
    for t in targets:
        im = Image.open(t)
        # สไปรต์ native 44x62 ใช้ outline หนากว่า 1 พิกเซลเพื่อให้ยังเห็นหลังย่อ
        b = os.path.basename(t)
        # สไปรต์ native 44x62 (ชาย+หญิง) ต้องใช้ outline หนา 2 px
        rad = 2 if (b.startswith('hero_m_') or (b.startswith('hero_') and b[5:6] in 'dlru')) else radius
        add_outline(im, rad).save(t)
        n += 1
    print('outline applied:', n, 'files (radius=%d)' % radius)
    return 0


if __name__ == '__main__':
    sys.exit(main())
