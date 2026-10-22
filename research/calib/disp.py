import sys, numpy as np
from PIL import Image
sys.path.insert(0, sys.path[0])
from model import displacement
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
def cell(i):
    c, r = i % 5, i // 5
    return im[r*280:r*280+240, c*280:c*280+240]
bg = cell(0); xs = np.arange(240) + .5
Rx = bg[..., 0].mean(0); Gy = bg[..., 1].mean(1)
gy, gx = np.mgrid[0:120, 0:160] + .5
dx, dy, sdf = displacement(160, 120, 32, dict(refr=.8, dist=20, bevel=1, splay=0))
m = (sdf < -0.5) & (np.hypot(dx, dy) > 3)
for i, ca in ((1, 0), (10, .5), (11, 1)):
    c = cell(i)[60:180, 40:200]
    mx = np.interp(c[..., 0], Rx, xs) - (gx + 40)   # R channel -> x displacement
    my = np.interp(c[..., 1], Gy, xs) - (gy + 60)   # G channel -> y displacement
    kx = (mx[m] * dx[m]).sum() / (dx[m] ** 2).sum()
    ky = (my[m] * dy[m]).sum() / (dy[m] ** 2).sum()
    print(f'cell {i} disp={ca}: R-channel gain {kx:.3f} (model 1+0.5ca={1+.5*ca:.3f}),  G-channel gain {ky:.3f} (model 1.0)')
