import sys, numpy as np
from PIL import Image
sys.path.insert(0, sys.path[0])
from model import render
C = sys.argv[1]
fig = np.asarray(Image.open(f'{C}/data/board2.png').convert('RGB')).astype(float)
def fcell(i): c, r = i % 5, i // 5; return fig[r*280:r*280+240, c*280:c*280+240]
bg = fcell(15); tgt = fcell(19)[60:180, 40:200]
P = dict(refr=.8, dist=20, bevel=1, splay=0)
best = None
for sigma in (0, .3, .5, .7, .9):
    for ca in (.05, .1, .15, .2, .25, .3, .4):
        e = np.abs(render(bg, 40, 60, 160, 120, 32, P, ca, sigma) - tgt).mean()
        if best is None or e < best[0]: best = (e, sigma, ca)
        print(f'sigma {sigma} ca {ca}: {e:.2f}')
print('best', best)
e0 = np.abs(render(bg, 40, 60, 160, 120, 32, P, .2, 0) - tgt).mean()
print('no-blur ca .2:', round(e0, 2))
