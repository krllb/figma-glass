# 10-90% width of the black/white edge under each glass, in CSS px (screenshots at 2x).
import sys
from PIL import Image
def width(path, scale=2):
    im = Image.open(path).convert('L'); out = []
    for i in range(3):
        cx, cy = (20 + i * 320 + 150) * scale, (20 + 100) * scale
        row = [sum(im.getpixel((x, cy + d)) for d in (-4, 0, 4)) / 3 for x in range(cx - 60 * scale, cx + 60 * scale)]
        lo, hi = min(row), max(row)
        a = next(k for k, v in enumerate(row) if v > lo + 0.1 * (hi - lo))
        b = next(k for k, v in enumerate(row) if v > lo + 0.9 * (hi - lo))
        out.append(round((b - a) / scale, 1))
    return out
for p in sys.argv[1:]: print(p.split('/')[-1], width(p))
