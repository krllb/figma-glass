import sys, numpy as np
from PIL import Image
im = np.asarray(Image.open(sys.argv[1]).convert('RGBA')).astype(float)
def cell(i):
    c, r = i % 5, i // 5
    return im[r*280:r*280+240, c*280:c*280+240]
bg = cell(0)
print('backdrop R along x (row 120):', bg[120, ::30, 0].astype(int))
print('backdrop G along y (col 120):', bg[::30, 120, 1].astype(int))
print('backdrop B mean', bg[...,2].mean())
for i in (13, 14):
    g = cell(i)
    print(i, 'gray center', g[120,120,:3], 'outside', g[10,10,:3])
    print('  row 120 x=40..80:', g[120,40:80,0].astype(int))
    print('  col 120 y=60..100:', g[60:100,120,0].astype(int))
b = cell(1)
print('base center vs backdrop center', b[120,120,:3], bg[120,120,:3])
print('ratio', b[100:140,100:140,:3].mean((0,1)) / bg[100:140,100:140,:3].mean((0,1)))
