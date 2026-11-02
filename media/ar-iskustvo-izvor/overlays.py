# Overlay grafike za AR animaciju (540x1170 ekran telefona). Tekst i UI ne pravi AI.
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.abspath(__file__))
W, H = 540, 1170
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def brackets(size, color, name, width=6, center=None):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cx, cy = center or (W // 2, H // 2 - 40)
    h, L = size // 2, size // 4
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = cx + sx * h, cy + sy * h
            d.line([(x, y), (x - sx * L, y)], fill=color, width=width)
            d.line([(x, y), (x, y - sy * L)], fill=color, width=width)
    im.save(f'{D}/ov-{name}.png')


brackets(300, (255, 255, 255, 230), 'scan')
brackets(170, (255, 214, 10, 255), 'lock', 7, (288, 554))

# Link koji kamera ponudi posle skeniranja (gost ga dodirne)
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
f = ImageFont.truetype(FB, 26)
txt = 'pizza.foodar.org'
tw = d.textlength(txt, font=f)
bw, bh = tw + 70, 58; x0, y0 = (W - bw) / 2, H // 2 + 120
d.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=29, fill=(255, 214, 10, 245))
d.ellipse([x0 + 18, y0 + 20, x0 + 36, y0 + 38], outline=(30, 30, 30, 255), width=3)
d.text((x0 + 48, y0 + 13), txt, font=f, fill=(30, 30, 30, 255))
im.save(f'{D}/ov-link.png')


def tap(cx, cy, name):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for r, a in ((44, 70), (30, 120), (18, 200)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, a))
    im.save(f'{D}/ov-{name}.png')


tap(W // 2 + 40, H // 2 + 149, 'tap-link')
tap(W // 2 + 30, 1017, 'tap-ar')

# Oznaka u AR prikazu
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
f = ImageFont.truetype(FB, 22)
d.rounded_rectangle([W / 2 - 78, 112, W / 2 + 78, 154], radius=21, fill=(20, 20, 20, 170))
d.text((W / 2, 133), 'AR  ·  1:1', font=f, fill=(255, 255, 255, 255), anchor='mm')
im.save(f'{D}/ov-ar.png')
print('ok')
