import sys, numpy as np
from PIL import Image
sys.path.insert(0, sys.path[0])
from model import render, displacement
C = sys.argv[1]
fig = np.asarray(Image.open(f'{C}/data/board2.png').convert('RGB')).astype(float)
def fcell(i): c, r = i % 5, i // 5; return fig[r*280:r*280+240, c*280:c*280+240]
bg = fcell(15); tgt = fcell(19)[60:180, 40:200]
P = dict(refr=.8, dist=20, bevel=1, splay=0)
_, _, sdf = displacement(160, 120, 32, P)
for sigma in (.5, .7):
    e = np.abs(render(bg, 40, 60, 160, 120, 32, P, .2, sigma) - tgt).mean(2)
    bins = [(-200, -25), (-25, -15), (-15, -8), (-8, -4), (-4, -2), (-2, -1), (-1, 0.01)]
    print('sigma', sigma, ' '.join(f'[{a},{b}):{e[(sdf>=a)&(sdf<b)].mean():.1f}' for a, b in bins))
# corner vs straight
e = np.abs(render(bg, 40, 60, 160, 120, 32, P, .2, .7) - tgt).mean(2)
print('straight edge band err', e[40:80, :12].mean().round(1), ' corner err', e[:28, :28].mean().round(1), ' interior', e[30:90, 40:120].mean().round(1))
