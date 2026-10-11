from collections import Counter
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
assets = ROOT / 'assets/desktop'
source = Image.open(assets / 'icon.png').convert('RGBA')
# Threshold actual mark against the near-black background; retain coloured
# skull edging and swords. No drawing, tracing, or invented silhouette.
alpha = Image.new('L', source.size)
alpha.putdata([255 if max(r, g, b) > 60 else 0 for r, g, b, _ in source.getdata()])
colour = source.copy()
colour.putalpha(alpha)
silhouette = Image.new('RGBA', source.size, (0, 0, 0, 0))
silhouette.putalpha(alpha)
# Crop exactly the thresholded source content, then leave one logical pixel
# of transparent breathing room at 16px and two at 32px.
bounds = alpha.getbbox()
for name, size, image in [
    ('trayTemplate.png', 16, silhouette),
    ('trayTemplate@2x.png', 32, silhouette),
    ('trayColour.png', 32, colour),
]:
    crop = image.crop(bounds)
    padding = size // 16
    crop.thumbnail((size-padding*2, size-padding*2), Image.Resampling.LANCZOS)
    output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    output.paste(crop, ((size-crop.width)//2, (size-crop.height)//2))
    output.save(assets / name, optimize=True)

receipt = dict(source='assets/desktop/icon.png', source_sha256=hashlib.sha256((assets/'icon.png').read_bytes()).hexdigest(), method='max(R,G,B)>60 threshold to alpha; actual pixel-derived mark only; content bbox crop; Lanczos downsample; transparent padding', threshold=60, bbox=bounds, outputs={})
for name in ['trayTemplate.png', 'trayTemplate@2x.png', 'trayColour.png']:
    path = assets / name
    image = Image.open(path)
    alphas = list(image.getchannel('A').getdata())
    receipt['outputs'][name] = dict(dimensions=image.size, mode=image.mode, alpha_min=min(alphas), alpha_max=max(alphas), transparent_pixels=alphas.count(0), visible_pixels=sum(a>0 for a in alphas), rgb_colour_count=len({p[:3] for p in image.getdata() if p[3]>0}), sha256=hashlib.sha256(path.read_bytes()).hexdigest(), bytes=path.stat().st_size)
(ROOT/'proof/T27/assets.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt, indent=2))

# Pixel audit contact sheet: actual generated pixels at nearest-neighbour zoom,
# plus true-size icons on synthetic light/dark/high-contrast surfaces.
board = Image.new('RGB', (1000, 510), '#e8e8e8')
draw = ImageDraw.Draw(board)
for column, name in enumerate(['trayTemplate.png', 'trayTemplate@2x.png', 'trayColour.png']):
    image = Image.open(assets / name)
    x = column*330+15
    draw.text((x, 12), name, fill='black')
    for row, (label, bg, tint) in enumerate([
        ('light', '#f5f5f5', (0,0,0)), ('dark', '#151515', (255,255,255)), ('high contrast', '#000000', (255,255,255)),
    ]):
        y = 45+row*150
        draw.rectangle((x, y, x+310, y+140), fill=bg)
        actual = image.copy()
        if 'Template' in name:
            actual = Image.new('RGBA', image.size, (*tint,255))
            actual.putalpha(image.getchannel('A'))
        board.paste(actual.resize((128,128),Image.Resampling.NEAREST), (x+10,y+6), actual.resize((128,128),Image.Resampling.NEAREST))
        board.paste(actual, (x+165,y+55), actual)
        draw.text((x+155,y+15), label+' / true size', fill='black' if row==0 else 'white')
board.save(ROOT/'proof/T27/icon-pixels.png')
