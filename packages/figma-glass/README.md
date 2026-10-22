# figma-glass

Figma's Glass effect for the web. Copy the values from Figma's Glass panel and get the same glass in the
browser: refraction, depth, dispersion, frost, splay and light, calibrated against Figma's own exports.

Demo and playground: https://glass.krllb.com

```sh
npm install figma-glass
```

```js
import { attach } from 'figma-glass';

const glass = attach(document.getElementById('glass'), {
  // Figma panel: Light −45° 80%, Refraction 80, Depth 20, Dispersion 50, Frost 4, Splay 0
  lightAngle: -45, lightIntensity: 0.8,
  refraction: 0.8, depth: 20, dispersion: 0.5, frost: 4, splay: 0,
  radius: 16,
  // What lies under the glass. Chromium reads the backdrop itself; Safari and Firefox refract only
  // a source: see Browsers.
  source: document.getElementById('hero'),
});

glass.update({ frost: 10 });
glass.destroy();
```

## React

```jsx
import { useRef } from 'react';
import { Glass } from 'figma-glass/react';

function Hero() {
  const hero = useRef(null);
  return (
    <section ref={hero}>
      <Glass as="button" refraction={0.8} depth={20} dispersion={0.5} frost={4} lightAngle={-45}
        lightIntensity={0.8} radius={9999} fill="rgba(255,255,255,.2)" source={hero}
        mode={{ webkit: 'mirror' }}>
        Buy
      </Glass>
    </section>
  );
}
```

The glass props are the options below; the rest go to the element (`as`, `className`, handlers, a
`ref`). `source` takes an element or a ref. A changed glass prop updates the glass; a re-render with the
same props does nothing. React 18 or later; the module is marked `'use client'` for Next.js.

## From the Figma panel

| Figma panel | Option | Example |
| --- | --- | --- |
| Light angle | `lightAngle`, degrees | −45° → `-45` |
| Light intensity | `lightIntensity`, 0..1 | 80% → `0.8` |
| Refraction | `refraction`, 0..1 | 80 → `0.8` |
| Depth | `depth`, px | 20 → `20` |
| Dispersion | `dispersion`, 0..1 | 50 → `0.5` |
| Frost | `frost`, px | 4 → `4` |
| Splay | `splay`, 0..1 | 0 → `0` |
| Corner radius | `radius`, px | 16 → `16` |
| Layer fill | `fill`, CSS colour | `rgba(217,217,217,.2)` |

## Browsers

| Engine | How | Result |
| --- | --- | --- |
| Chromium (Chrome, Edge, Opera) | `backdrop-filter` with an SVG filter | within a level or two of Figma's pixels |
| WebKit (Safari, every browser on iOS) | frost and light; refraction with `mode: 'mirror'` | mirror renders a live copy of `source` under the glass |
| Gecko (Firefox) | `-moz-element()` when the glass is outside `source`, otherwise frost and light; refraction inside it with `mode: { gecko: 'mirror' }` | within 3–4 levels of Chromium |

Mirror copies `source`'s DOM under every glass, so keep `source` to the part of the page the glass
actually covers. The copy follows edits, animations, scrolling, typing, fixed and sticky elements, video
and canvas; iframes, embeds and audio become empty boxes, custom elements lose their behaviour.

### Safari

`auto` gives Safari frost and light without refraction. Refraction takes `mirror`, which renders a live
copy of `source` under the glass:

```js
attach(el, { source: document.getElementById('hero'), mode: { webkit: 'mirror' } });
```

Point `source` at the block right under the glass, not at the page. Measured in Safari 26.2 on a Mac:

- Animation under the glass is cheap: only what is under the lens is updated, so a glass over a running
  CSS animation keeps 60 fps whatever the size of `source`.
- Adding or removing elements inside `source` rebuilds the whole copy. With an element added and removed
  every frame, a hero block as `source` keeps 60 fps, a page of 300 rows drops to 54, of 1500 rows to 27.
  A list that re-renders under the glass wants a small `source`.
- Safari takes one dispersion sample per channel; `taps: 8`, Figma's own, costs 60 → 45 fps.
- Frost is exact up to about 10; above that the copy is blurred with CSS, which keeps 60 fps within a
  few levels of Chrome.

Pick the engine per browser, or let `auto` choose:

```js
attach(el, { source: document.getElementById('hero'), mode: { webkit: 'mirror' } });
```

`mode` is `auto`, one of `backdrop`, `element`, `mirror`, `fallback`, `off`, or an object keyed by
`chromium`, `webkit`, `gecko` (a missing key is `auto`). `glass.state.mode` tells which one runs.

## Server rendering

The module touches no browser API on import. Call `attach` on the client, after the element is mounted.
The element's content may be rewritten freely (a framework setting `textContent` included): the glass
puts its layers back.

## License

MIT
