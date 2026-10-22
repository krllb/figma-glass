import sys, numpy as np
from PIL import Image
C = sys.argv[1]
fig = np.asarray(Image.open(f'{C}/data/board2.png').convert('L')).astype(float)
def fcell(i): c, r = i % 5, i // 5; return fig[r*280:r*280+240, c*280:c*280+240]
def wcell(i): return np.asarray(Image.open(f'{C}/web{i}/1440-viewport.png').convert('L')).astype(float)[:240, :240]
def gblur(a, s):
    if s <= 0: return a
    r = int(np.ceil(s * 4)); x = np.arange(-r, r + 1); k = np.exp(-x**2 / (2 * s * s)); k /= k.sum()
    p = np.pad(a, r, mode='edge')
    p = np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 1, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 0, p)
bg = fcell(15)
print('backdrop web vs figma diff', np.abs(wcell(15) - bg).mean())
inner = (slice(90, 150), slice(80, 160))
sig = np.arange(0, 12.01, 0.1)
for i, frost in ((16, 4), (17, 10), (18, 20)):
    res = {}
    for name, img in (('figma', fcell(i)), ('web', wcell(i))):
        errs = [np.abs(gblur(bg, s)[inner] - img[inner]).mean() for s in sig]
        k = int(np.argmin(errs)); res[name] = (sig[k], errs[k])
    print(f'frost {frost}: figma sigma {res["figma"][0]:.1f} (err {res["figma"][1]:.2f})  web sigma {res["web"][0]:.1f} (err {res["web"][1]:.2f})')
