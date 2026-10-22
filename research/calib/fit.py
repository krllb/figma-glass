import sys, itertools, numpy as np
from PIL import Image
sys.path.insert(0, sys.path[0])
from model import displacement
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
def cell(i):
    c, r = i % 5, i // 5
    return im[r*280:r*280+240, c*280:c*280+240]
bg = cell(0)
# channel value -> coordinate via backdrop profiles
Rx = bg[:, :, 0].mean(0); Gy = bg[:, :, 1].mean(1)
xs = np.arange(240) + 0.5
def inv(prof, v): return np.interp(v, prof, xs)
def measured(i):
    c = cell(i)[60:180, 40:200]
    sx, sy = inv(Rx, c[..., 0]), inv(Gy, c[..., 1])
    gy, gx = np.mgrid[0:120, 0:160] + 0.5
    return sx - (gx + 40), sy - (gy + 60)
cases = {1: dict(refr=.8, dist=20, splay=0, rad=32), 2: dict(refr=.4, dist=20, splay=0, rad=32),
         3: dict(refr=1, dist=20, splay=0, rad=32), 4: dict(refr=.8, dist=8, splay=0, rad=32),
         5: dict(refr=.8, dist=40, splay=0, rad=32), 6: dict(refr=.8, dist=20, splay=.5, rad=32),
         7: dict(refr=.8, dist=20, splay=1, rad=32), 8: dict(refr=.8, dist=20, splay=0, rad=0)}
def err(i, k_refr, k_dist, bevel, show=False):
    P = dict(cases[i]); rad = P.pop('rad')
    P['refr'] *= k_refr; P['dist'] *= k_dist; P['bevel'] = bevel
    dx, dy, sdf = displacement(160, 120, rad, P)
    mx, my = measured(i)
    m = sdf < -0.5
    e = np.hypot(dx - mx, dy - my)[m]
    if show:
        print(f'case {i}: mean err {e.mean():.3f}px  p95 {np.percentile(e,95):.3f}  max {e.max():.2f}')
        print('  row 60 x0..24 meas:', np.round(mx[60, :24], 1))
        print('  row 60 x0..24 model:', np.round(dx[60, :24], 1))
    return e.mean()
best = None
for kr, kd, bv in itertools.product([0.5, .8, 1, 1.25, 1.5, 2, 2.5, 3], [0.5, .75, 1, 1.25, 1.5, 2], [0.5, 1, 2, 4, 8]):
    s = sum(err(i, kr, kd, bv) for i in cases)
    if best is None or s < best[0]: best = (s, kr, kd, bv)
print('best', best)
_, kr, kd, bv = best
for i in cases: err(i, kr, kd, bv, show=True)
