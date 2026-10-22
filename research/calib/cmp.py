import sys, numpy as np
from PIL import Image
sys.path.insert(0, sys.path[0])
from model import displacement
fig = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
web = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(float)[:240, :240]
fbg = fig[0:240, 0:240]
fcell = fig[0:240, 280:520]
xs = np.arange(240) + .5
def field(cell, bg):
    Rx = bg[..., 0].mean(0); Gy = bg[..., 1].mean(1)
    c = cell[60:180, 40:200]
    gy, gx = np.mgrid[0:120, 0:160] + .5
    return np.interp(c[..., 0], Rx, xs) - (gx + 40), np.interp(c[..., 1], Gy, xs) - (gy + 60)
print('web backdrop R row:', web[5, ::30, 0].astype(int), ' figma:', fbg[5, ::30, 0].astype(int))
wbg = web.copy()
fx, fy = field(fcell, fbg)
wx, wy = field(web, fbg)
print('row 60 figma:', np.round(fx[60, :20], 1))
print('row 60 web  :', np.round(wx[60, :20], 1))
print('col 80 figma:', np.round(fy[:16, 80], 1))
print('col 80 web  :', np.round(wy[:16, 80], 1))
e = np.hypot(fx - wx, fy - wy)
print(f'field diff mean {e.mean():.2f}px p95 {np.percentile(e,95):.2f}px')
print('rgb diff mean', np.abs(fcell - web).mean())
