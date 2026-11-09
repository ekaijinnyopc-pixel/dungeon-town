#!/usr/bin/env python3
"""พิมพ์ ASCII art ของ tile ในชุด Tiny Town เพื่อระบุตัวตนด้วยตา"""
from PIL import Image
import os, sys, collections

D = 'assets/tiles/town'
LEG = {
    (132,198,105):'G', (139,216,125):'g', (101,165,86):'d', (71,159,74):'D',
    (63,38,49):'#', (61,33,45):'@',
    (253,190,83):'Y', (227,134,40):'o', (232,69,55):'R', (255,255,255):'W',
    (234,165,108):'t', (207,130,84):'b', (189,108,74):'B', (118,59,54):'d',
    (254,201,156):'c', (119,56,51):'r',
    (90,105,136):'S', (139,155,180):'s', (192,203,220):'W', (82,96,124):'k',
    (140,156,181):'p', (38,43,68):'n', (232,69,55):'R',
    (253,190,83):'Y', (101,165,86):'d',
}

def render(idx):
    p = os.path.join(D, 'tile_%04d.png' % idx)
    im = Image.open(p).convert('RGBA'); px = im.load()
    out = []
    for y in range(im.size[1]):
        row = ''
        for x in range(im.size[0]):
            r,g,b,a = px[x,y]
            if a < 8:
                row += ' '
            else:
                row += LEG.get((r,g,b), '?')
        out.append(row)
    return out

if __name__ == '__main__':
    args = [int(a) for a in sys.argv[1:]]
    for i in args:
        print('=== tile_%04d ===' % i)
        for l in render(i):
            print(l)
