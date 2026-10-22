import sys, numpy as np
from PIL import Image
sys.path.insert(0, sys.path[0])
from model import displacement
C = sys.argv[1]
fig = np.asarray(Image.open(f'{C}/data/board2.png').convert('RGB')).astype(float)
def fcell(i): c, r = i % 5, i // 5; return fig[r*280:r*280+240, c*280:c*280+240]
_, _, sdf = displacement(160, 120, 32, dict(refr=.8, dist=20, bevel=1))
inside = sdf < -1
for cell, web in ((19, '19d'), (20, '20b'), (16, '16b')):
    w = np.asarray(Image.open(f'{C}/web{web}/1440-viewport.png').convert('RGB')).astype(float)[60:180, 40:200]
    d = np.abs(w - fcell(cell)[60:180, 40:200]).mean(2)
    print(f'cell {cell}: mean {d[inside].mean():.2f}  p95 {np.percentile(d[inside],95):.1f}  p99 {np.percentile(d[inside],99):.1f}  (levels of 255, inside shape)')
