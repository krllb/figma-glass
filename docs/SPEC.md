# Figma Glass: math and calibration

How the library reproduces Figma's Glass effect, and how closely. Every formula below was checked
against Figma's own exports, pixel by pixel.

## Panel values

| Panel | Plugin API | Meaning in the math | Checked on |
| --- | --- | --- | --- |
| Refraction 80 | `refraction` 0.8 | refraction strength `I` = 0.8 | offset field, 8 cells |
| Depth 20 | `depth` 20 | refraction distance `d` = 20 px | same |
| — | — | bevel `b` = 1 px | same |
| Splay 0 | `splay` 0 | splay, 0…1 | same |
| Dispersion 50 | `dispersion` 0.5 | chromatic aberration `ca` = 0.2 · dispersion | channel shift |
| Frost 4 | `radius` 4 | gaussian σ = 0.43 · frost | checkerboard, frost 4/10/20 |
| Light −45° | `lightAngle` −45 | angle in radians + π/2 | grey backdrop |
| Light 80% | `lightIntensity` 0.8 | light strength `I_L` = 0.8 | same |

Figma also softens the backdrop at frost 0: a `[0.19, 0.62, 0.19]` kernel on each axis.

## Formulas

`sdf` is the distance to the shape's edge (negative inside), `d` = depth, `b` = bevel, `I` = refraction.

- Backdrop sample offset: `-dir · mix(sj, sk, sl)`, where
  `sj = clamp(linstep(-d-b, -b, sdf)^3.5 · d · I, ±0.999d)`, `sk = 0.2 · I · 0.999d`,
  `sl = linstep(-b, -0.3b, sdf)`.
- `dir = mix(edge normal, normal from the centre, splay)`. The edge normal uses the corner radius
  `max(radius, b, d)` and is zero on the flat centre.
- Dispersion: 8 samples `f = i/7 − 0.5` weighted `1 − |2f|`; channel R takes the offset
  `· (1 + (f + 0.5)·ca)`, G `(1 + f·ca)`, B `(1 + (f − 0.5)·ca)`.
- Light, `L = (cos θ, sin θ)`, `θ = angle + 90°`, `n` the edge normal for the real radius:
  `smoothstep(0.35, 1, n·(−L)) · rim · I_L` + `0.6 ·` the same for `n·L` + `(dir·L) · linstep(-d, -b, sdf)² · 0.05 · I_L`,
  `rim = smoothstep(-b, -0.2b, sdf)`. Added to the colour in sRGB.
- Order: softening → frost → refraction and dispersion → light → the layer's fill on top.
- Frost blurs the backdrop together with what lies past the glass's edge. The softening kernel is per
  device pixel (checked against a 2x Figma export).

## Engines

The math is the same everywhere; engines differ only in how the backdrop reaches the filter. The filter
sits on a "lens": wider than the glass by the frost reach and clipped back to the glass's shape with
`clip-path`, so the blur sees the backdrop past the edge.

| Engine | Backdrop from | Where |
| --- | --- | --- |
| `backdrop` | `backdrop-filter: url()` on the lens | Chromium |
| `element` | `-moz-element(#source)` + `filter: url()` | Firefox |
| `mirror` | a live copy of `source` + `filter: url()` | everywhere; checked in Chromium and Safari |
| `fallback` | `backdrop-filter: blur()` + a white highlight with alpha | everywhere, no refraction |

`auto`: Chromium → backdrop, Firefox → element (when the glass is outside `source`), otherwise fallback.
Mirror only through an explicit `mode: 'mirror'`: copying the source's DOM is the caller's decision.
`mode` can be an object keyed by rendering engine: `{ chromium, webkit, gecko }`, a missing key is `auto`.
The rendering engine, not the browser: Chrome, Edge and Firefox on iOS are WebKit. Chromium is detected by
`userAgentData`, and without it (http, not localhost) by `Chrome/` in the user agent. `CSS.supports` lies
about `backdrop-filter: url()` in Safari.

Mirror keeps the copy in step with the original:
- position and scale: the glass's own scale (`transform: scale` on press) is undone on the copy, rotation
  is not; sizes come from ResizeObserver's `borderBoxSize`, without `offsetWidth` rounding;
- edits: an attribute or text edit is copied onto the one node; the copy is rebuilt only when nodes are
  added or removed; edits inside glass layers (its own and other instances') do not count;
- size: the copy follows `source` through ResizeObserver;
- animations: the copy never animates itself (`animation`/`transition: none !important`); every frame it
  takes the values of every property the original animates (`document.getAnimations()`), including
  animations started after the copy was made; when an animation ends the copy returns to its own style;
- fixed and sticky: inside the transformed copy, fixed is relative to the copy and sticky never sticks, so
  both become offset boxes, moved every frame onto the original's place on screen.
  `background-attachment: fixed` is not corrected;
- scrolling, `<video>`/`<canvas>` (redrawn every frame; a video sized by its `width`/`height`
  attributes), form values (on `input`/`change` events; a `value` set from code without an event is not
  seen).

Form controls in the copy lose `name` and `form`: otherwise a copied radio unchecks the original, and a
copied field is submitted with the page's form. iframe, object, embed and audio become empty boxes of the
same size; custom elements become a `span` with their `display` and children (otherwise their
`connectedCallback` runs on every rebuild); `autofocus` is removed. The copy loses ids and the source's
ancestors; its root and elements with an id take inline the computed values that came out different.
Elements without an id, styled through a selector outside `source`, can still differ. Every glass has its
own copy: ten glasses over one `source` make ten copies.

Lifecycle: new maps and a new filter apply once the maps have loaded; until then the previous glass
stays (a filter whose map has not loaded paints black). Maps are cached by geometry and light; frost,
dispersion, fill and engine changes reuse them. A change of `devicePixelRatio` renders again. The layers
sit on the node's border box, like the maps. `destroy` restores the node's styles, `update` after it does
nothing. An unknown `mode` warns in the console and falls back to `auto`.

Chromium pitfalls:
- `feConvolveMatrix` and `feGaussianBlur`'s steps work in device pixels, not CSS pixels: on retina frost
  came out half as strong. Kernels are built for `devicePixelRatio`.
- `backdrop-filter` sees the backdrop only inside its own element, hence the oversized lens.
- `mix-blend-mode` on a sibling layer isolates the group, and the lens gets an empty backdrop.
- Inside an ancestor with both `border-radius` and `overflow: hidden`, Chrome's GPU raster drops the
  rounding of `clip-path: inset(... round r)` on the lens and shows the frost as a rectangle (software
  raster, as in headless containers, keeps it). The lens also gets an SVG mask of the same rounded
  rectangle; Safari ignores that mask on the filtered lens, so both stay.

## Calibration (levels out of 255, inside the shape)

| Cell | Mean | p99 |
| --- | --- | --- |
| Refraction, UV backdrop | offset field within ±1 px (8-bit backdrop limit) | |
| Dispersion 1 | 1.9 | 17 |
| Frost 4 | 1.0 | 4 |
| Light −45° / 30° | 0.9 | 2 |
| Screenshot config (80/20/50/4/0, −45°/80%, fill 20%) | 1.7 | 10 |
| Frost 4 / 10 / 20, at the edge too, 1x and 2x | 1.0–1.8 | |
| Dispersion and config, 2x against Figma's 2x export | 1.5–1.9 | 10 |

Backdrop and mirror give the same pixels in Chromium.

The reference is a calibration frame in Figma; the comparison scripts are in `research/calib/`.

## Not done

- The outer pixel ring: our highlight is brighter (201 against 190); Figma antialiases the edge by
  coverage.
- Corner smoothing: Figma has its own curve, not carried over. CSS `border-radius` gives a plain circle.
- Arbitrary shapes: Figma takes normals from the shape's height map; we do rounded rectangles only.
- Frost is exact (convolution) up to σ 12 device px: frost ≈ 28 at 1x, ≈ 14 at 2x. Above that
  `feGaussianBlur` with Skia's steps; the step table was measured in headless Chromium with software
  raster and may differ on the GPU.
- Firefox (`element`) is not checked.
- Safari 26.2 (`mirror`), checked through `safaridriver` on a Mac on 2026-10-22, stands in
  `research/safari/`:
  - `backdrop-filter: url()` passes `CSS.supports` but paints nothing, so `auto` picks fallback and
    refraction takes `mode: 'mirror'`;
  - convolution works in device pixels, as in Chromium: a kernel built for density 1 blurred exactly
    half as wide (2 / 5.5 / 11 px for 10–90% at frost 4 / 10 / 20, against 4 / 11 / 21 in Chromium).
    `filterDpr` now defaults to `devicePixelRatio` everywhere;
  - WebKit paints the page in tiles of 1024 device pixels and runs the filter on each tile alone: a glass
    across a tile edge showed two lenses (seams at x = 1024 CSS px and y = 512 CSS px at 2x). The lens in
    mirror and element gets `transform: translateZ(0)`, its own compositing layer, and the seam is gone.
    `will-change: transform` and `will-change: filter` alone do not help;
  - CSS `blur()` on the copy before the lens filter works: the "broken lens" seen earlier was the same
    tile seam. `feGaussianBlur` still shifts the light and offset maps inwards, so WebKit never gets it;
  - frost: convolution up to σ 9 device px (frost ≈ 10 at 2x), CSS `blur()` on the copy above that. Mean
    difference from Chromium on a checkerboard: 2.4 / 1.8 / 0.0 levels at frost 4 / 10 / 20;
  - Safari moves an animated element to its own layer and the lens filter skips it: the copy does not
    animate itself, it takes the original's values every frame, only for what is under the lens;
  - `feDisplacementMap` in WebKit takes the nearest pixel, truncating, without interpolation;
  - WebKit repaints only the rectangles that changed and runs the filter on each alone: a small lens
    appeared around every moved word. On any change to the copy the lens switches between two identical
    filters, and WebKit runs it on the whole lens;
  - colour is not the cause: the filter works in sRGB, colour and grey maps shift the same (tiles 1b,
    3a, 3b in `site/diag.html`);
  - speed, a 320×120 glass over a CSS animation, fps: no glass 61; mirror 60; `taps: 8` 45; frost 14 by
    convolution 45, by CSS 60; frost 20 by convolution 33, by CSS 59. The size of `source` does not change
    the steady cost (1500 rows: still 60) but does change rebuilds: with a node added and removed every
    frame, 60 with the block under the glass as `source`, 54 with a page of 300 rows, 27 with 1500.
- GPU performance is not measured: 8 dispersion samples make 18 `feDisplacementMap`, a large frost makes
  long convolution kernels.
