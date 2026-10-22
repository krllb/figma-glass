# Calibration

Scripts that compare Figma's exports of a calibration board with the model (`model.py`, the same math as
the library) and with the library rendered in a browser. Python 3 with numpy and Pillow.

`figma-board-uv.png` and `figma-board-checker.png` are Figma's own 1x exports of the board: glass cells
over a UV gradient, grey and a checkerboard, one setting per cell.

| Script | Input | What |
| --- | --- | --- |
| `probe.py` | an export | prints backdrop profiles and pixel rows of a few cells |
| `disp.py` | the UV export | measures the offset field at dispersion 0, 0.5, 1 against the model |
| `fit.py` | the UV export | measures the offset field and fits the refraction parameters |
| `cmp.py` | the UV export, a browser screenshot | offset field of the browser against Figma's |
| `fitdisp.py` | a run folder | fits the backdrop softening and the chromatic aberration |
| `errmap.py` | a run folder | model error against the board by distance to the edge |
| `frost.py` | a run folder | fits the frost sigma: browser screenshots against the board |
| `score.py` | a run folder | browser screenshots against the board: mean, p95, p99 inside the shape |

A run folder holds `data/board2.png` (the board exported from Figma) and `web<N>/1440-viewport.png`
(screenshots of the playground at the same settings). Run folders are not in the repo.
