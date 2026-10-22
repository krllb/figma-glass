# Safari stands

Pages that check the mirror engine and measure frost and speed in real Safari (`safaridriver`).
Serve the repo root (`pnpm site`), start `safaridriver -p 4444`, then for example:

    python3 research/safari/wd.py "http://localhost:8080/research/safari/edge.html" 15 edge.png

| Page | What |
| --- | --- |
| `test.html` | fixed/sticky, animations after build, typing, border, fractional width, custom elements, cache, destroy |
| `test2.html` | no rebuilds during inline-style animation, `scale(1.2)` alignment, source restyle |
| `test3.html` | source resized through its parent, without a DOM edit |
| `frost.html` | blur width across a black/white edge; `measure.py` reads it from a 2x screenshot |
| `edge.html` | glass on a checkerboard, `lefts`/`tops` place it across WebKit's 1024 px tiles |
| `perf.html` | fps with an animation (and `churn=1`: a node added and removed every frame) under the glass |
