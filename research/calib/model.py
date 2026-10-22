import sys, numpy as np
from PIL import Image

def linstep(a, b, x): return np.clip((x - a) / max(1e-5, b - a), 0, 1)

def sdf_round_box(px, py, hx, hy, r):
    r = min(r, hx, hy)
    qx, qy = np.abs(px) - (hx - r), np.abs(py) - (hy - r)
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r

def normal(px, py, hx, hy, rad, bevel):
    r = min(hx, hy, rad)
    rfx, rfy = np.abs(px) - (hx - r), np.abs(py) - (hy - r)
    inner = np.maximum(rfx, rfy) <= -bevel * (1.0 if bevel >= rad else 0.0)
    sh = np.maximum(-np.minimum(rfx, rfy), 0)
    rx, ry = rfx + sh, rfy + sh
    l = np.hypot(rx, ry); l = np.where(l > 1e-10, l, 1)
    nx, ny = rx / l * np.sign(px), ry / l * np.sign(py)
    nx[inner] = 0; ny[inner] = 0
    return nx, ny

def displacement(w, h, radius, P):
    """Figma glass offset field (node px). P: dict with refr, dist, bevel, splay."""
    ys, xs = np.mgrid[0:h, 0:w] + 0.5
    hx, hy = w / 2, h / 2
    px, py = xs - hx, ys - hy
    sdf = sdf_round_box(px, py, hx, hy, radius)
    dist, bevel, I = P['dist'], P['bevel'], P['refr']
    sg = linstep(-dist - bevel, -bevel, sdf)
    si = 0.999 * dist
    sj = np.clip(sg ** 3.5 * dist * I, -si, si)
    sk = I * 0.2 * si
    sl = linstep(-bevel - 1e-4, -bevel * 0.3, sdf)
    nx, ny = normal(px, py, hx, hy, max(radius, max(bevel, dist)), bevel)
    l = np.hypot(px, py); l = np.where(l > 1e-10, l, 1)
    s = P.get('splay', 0)
    mx, my = nx * (1 - s) + px / l * s, ny * (1 - s) + py / l * s
    mag = sj * (1 - sl) + sk * sl
    return -mx * mag, -my * mag, sdf

def gblur(a, s):
    if s <= 0: return a
    r = int(np.ceil(s * 4)); x = np.arange(-r, r + 1); k = np.exp(-x**2 / (2 * s * s)); k /= k.sum()
    pad = [(r, r), (r, r)] + [(0, 0)] * (a.ndim - 2)
    p = np.pad(a, pad, mode='edge')
    p = np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 1, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 0, p)

def bilinear(img, x, y):
    h, w = img.shape[:2]
    x = np.clip(x - .5, 0, w - 1.001); y = np.clip(y - .5, 0, h - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int); fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    a, b, c, d = img[y0, x0], img[y0, x0 + 1], img[y0 + 1, x0], img[y0 + 1, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy

def render(bg, gx, gy, w, h, radius, P, ca, sigma):
    """Glass over bg (H,W,3): node at (gx,gy) size w*h. Returns the glass region."""
    dx, dy, sdf = displacement(w, h, radius, P)
    src = gblur(bg, sigma)
    ys, xs = np.mgrid[0:h, 0:w] + .5
    X, Y = xs + gx, ys + gy
    if ca < 1e-3:
        return bilinear(src, X + dx, Y + dy)
    out = np.zeros((h, w, 3))
    taps = [(i / 7 - .5, 1 - abs(2 * (i / 7 - .5))) for i in range(8)]
    ws = sum(t[1] for t in taps)
    for c, sh in ((0, .5), (1, 0), (2, -.5)):
        for f, wt in taps:
            k = 1 + (f + sh) * ca
            out[..., c] += bilinear(src, X + dx * k, Y + dy * k)[..., c] * wt / ws
    return out
