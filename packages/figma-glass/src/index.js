// figma-glass: Figma's Glass effect for the web.
// Geometry and lighting are baked per element size into a displacement map and two light maps;
// the browser only resamples the live backdrop through an SVG filter (backdrop-filter: url()).
// Math follows docs/SPEC.md, calibrated against Figma exports.

const SVGNS = 'http://www.w3.org/2000/svg';

// Figma panel values, same units as the Plugin API (0..1 except depth, frost, angle).
const DEFAULTS = Object.freeze({
  lightAngle: -45,      // degrees
  lightIntensity: 0.8,  // 0..1
  refraction: 0.8,      // 0..1
  depth: 20,            // px
  dispersion: 0.5,      // 0..1
  frost: 4,             // Figma blur radius, px
  splay: 0,             // 0..1
  radius: 16,           // corner radius, px
  // Calibration constants (UI value -> renderer value).
  bevel: 1,             // bevel size, px
  frostScale: 0.43,     // gaussian sigma = frost * frostScale
  soften: 0.19,         // Figma resamples the backdrop softly even at frost 0: 3x3 kernel [s, 1-2s, s]
  dispersionScale: 0.2, // chromaticAberration = dispersion * dispersionScale
  // Engine.
  taps: 0,              // dispersion samples per channel: 8 (Figma), 3 or 1; 0 = 8, in WebKit 1 (CPU filters)
  mode: 'auto',         // auto | backdrop | element | mirror | fallback | off; auto never picks mirror:
                        // cloning the source DOM is the caller's decision. Per rendering engine:
                        // { chromium, webkit, gecko }, a missing key is auto
  fill: 'transparent',  // layer fill, painted over the glass like in Figma
  filterDpr: 0,         // density the filter kernels are built for; 0 = devicePixelRatio
  blur: 'auto',         // frost: auto | convolve | gaussian | css (mirror only)
  // source: the element under the glass, for element and mirror engines (default document.body)
});

const linstep = (a, b, x) => Math.min(1, Math.max(0, (x - a) / Math.max(1e-5, b - a)));
const smoothstep = (a, b, x) => { const t = linstep(a, b, x); return t * t * (3 - 2 * t); };

function sdfRoundBox(px, py, hx, hy, r) {
  r = Math.min(r, hx, hy);
  const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// Direction away from the nearest edge; zero on the flat inner rectangle.
function edgeNormal(px, py, hx, hy, rad, bevel, out) {
  const r = Math.min(hx, hy, rad);
  const rfx = Math.abs(px) - (hx - r), rfy = Math.abs(py) - (hy - r);
  out[0] = out[1] = 0;
  if (Math.max(rfx, rfy) <= -bevel * (bevel >= rad ? 1 : 0)) return;
  const sh = Math.max(-Math.min(rfx, rfy), 0);
  const rx = rfx + sh, ry = rfy + sh, l = Math.hypot(rx, ry);
  if (l <= 1e-10) return;
  out[0] = rx / l * Math.sign(px);
  out[1] = ry / l * Math.sign(py);
}

// Bakes the offset field and the additive light into canvases at device resolution.
function bake(w, h, o, dpr) {
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  const hx = w / 2, hy = h / 2;
  const dist = Math.max(1, o.depth), bevel = o.bevel, I = o.refraction, splay = o.splay;
  const Li = o.lightIntensity, radRefr = Math.max(o.radius, bevel, dist);
  const st = o.lightAngle * Math.PI / 180 + Math.PI / 2;
  const Lx = Math.cos(st), Ly = Math.sin(st);
  const ox = new Float32Array(W * H), oy = new Float32Array(W * H), lt = new Float32Array(W * H);
  const n = [0, 0], m = [0, 0];
  let maxAbs = 0;
  for (let j = 0; j < H; j++) {
    const py = (j + 0.5) / dpr - hy;
    for (let i = 0; i < W; i++) {
      const px = (i + 0.5) / dpr - hx, k = j * W + i;
      const sdf = sdfRoundBox(px, py, hx, hy, o.radius);
      if (sdf > 0) continue;
      // Refraction offset.
      const sg = linstep(-dist - bevel, -bevel, sdf);
      const si = 0.999 * dist;
      const sj = Math.min(si, Math.max(-si, Math.pow(sg, 3.5) * dist * I));
      const sk = I * 0.2 * si;
      const sl = linstep(-bevel - 1e-4, -bevel * 0.3, sdf);
      edgeNormal(px, py, hx, hy, radRefr, bevel, n);
      const l = Math.hypot(px, py), rx = l > 1e-10 ? px / l : 0, ry = l > 1e-10 ? py / l : 0;
      const mx = n[0] * (1 - splay) + rx * splay, my = n[1] * (1 - splay) + ry * splay;
      const mag = sj + (sk - sj) * sl;
      ox[k] = -mx * mag; oy[k] = -my * mag;
      maxAbs = Math.max(maxAbs, Math.abs(ox[k]), Math.abs(oy[k]));
      // Light: rim highlight towards the light, weaker one opposite, faint bevel shading.
      const ss = smoothstep(-bevel - 0.001, -bevel * 0.2, sdf);
      edgeNormal(px, py, hx, hy, o.radius, bevel, m);
      const d = m[0] * Lx + m[1] * Ly;
      let a = smoothstep(0.35, 1, -d) * ss * Li + smoothstep(0.35, 1, d) * ss * Li * 0.6;
      const sx = Math.pow(linstep(-dist, -bevel + 1e-4, sdf), 2);
      a += (mx * Lx + my * Ly) * sx * 0.05 * Li;
      lt[k] = a;
    }
  }
  const scale = 2 * maxAbs + 2;
  const disp = canvasFrom(W, H, (k, px) => {
    px[0] = Math.round((0.5 + ox[k] / scale) * 255);
    px[1] = Math.round((0.5 + oy[k] / scale) * 255);
    px[2] = 128;
  });
  const lightPos = canvasFrom(W, H, (k, px) => { px[0] = px[1] = px[2] = Math.round(Math.min(1, Math.max(0, lt[k])) * 255); });
  // Stored inverted so the arithmetic composite keeps alpha at 1: out = in + (1 - neg) - 1.
  const lightNegInv = canvasFrom(W, H, (k, px) => { px[0] = px[1] = px[2] = 255 - Math.round(Math.min(1, Math.max(0, -lt[k])) * 255); });
  return { scale, disp, lightPos, lightNegInv, light: lt, W, H };
}

function canvasFrom(W, H, fill) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H), d = img.data, px = [0, 0, 0, 255];
  for (let k = 0; k < W * H; k++) {
    px[3] = 255;
    fill(k, px);
    d[k * 4] = px[0]; d[k * 4 + 1] = px[1]; d[k * 4 + 2] = px[2]; d[k * 4 + 3] = px[3];
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Figma samples each channel along the offset with triangle weights: R ahead, B behind.
function dispersionTaps(count) {
  if (count <= 1) return [{ f: 0, w: 1 }];
  const taps = [];
  for (let i = 0; i < count; i++) {
    const f = count === 8 ? i / 7 - 0.5 : (i + 0.5) / count - 0.5;
    const w = 1 - Math.abs(f * 2);
    if (w > 0) taps.push({ f, w });
  }
  const sum = taps.reduce((s, t) => s + t.w, 0);
  taps.forEach(t => { t.w /= sum; });
  return taps;
}

// Skia renders blur in steps: [requested, rendered] sigma, measured in headless Chromium
// (software raster). Pick the request whose result lands nearest the target.
const SIGMA_TABLE = [[0, 0], [1, 1.15], [1.5, 1.45], [2, 2.2], [2.5, 2.5], [3, 3.2], [4, 4.25],
  [5, 4.55], [6, 5.6], [8, 7.8], [10, 10.2]];
function chromeSigma(target) {
  const [rLast, eLast] = SIGMA_TABLE[SIGMA_TABLE.length - 1];
  if (target > eLast) return target * rLast / eLast;
  let best = SIGMA_TABLE[0];
  for (const row of SIGMA_TABLE) if (Math.abs(row[1] - target) < Math.abs(best[1] - target)) best = row;
  return best[0];
}

function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  // Older WebKit reads only xlink:href.
  if (attrs.href) e.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', attrs.href);
  if (parent) parent.appendChild(e);
  return e;
}

// pad: the lens is wider than the glass so frost sees the real backdrop past the edge.
// A baked map grown to the lens size, the margin filled with the map's neutral value.
function padMap(src, padPx, neutral) {
  const c = document.createElement('canvas');
  c.width = src.width + 2 * padPx; c.height = src.height + 2 * padPx;
  const ctx = c.getContext('2d');
  ctx.fillStyle = neutral; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, padPx, padPx);
  return c.toDataURL();
}

// The filter region is the lens box and every map covers all of it, so no coordinate in the filter
// depends on where the engine puts user space for an HTML element (WebKit and Chromium differ).
// dpr: filters run in device pixels; feConvolveMatrix and Skia's blur steps are per device pixel.
// Returns the number of primitives.
function buildFilter(filter, o, baked, urls, dpr, cssFrost, taps) {
  const edge = 'duplicate';
  Object.entries({ x: 0, y: 0, width: 1, height: 1, filterUnits: 'objectBoundingBox',
    'color-interpolation-filters': 'sRGB' }).forEach(([k, v]) => filter.setAttribute(k, v));
  const img = { preserveAspectRatio: 'none' };
  let src = 'SourceGraphic', count = 0;
  if (o.soften > 0) {
    const s = o.soften, k = [s, 1 - 2 * s, s];
    const kernel = k.flatMap(a => k.map(b => a * b)).join(' ');
    el('feConvolveMatrix', { in: src, order: 3, kernelMatrix: kernel, edgeMode: edge, preserveAlpha: 'true', result: 'soft' }, filter);
    src = 'soft'; count++;
  }
  const sigma = cssFrost ? 0 : o.frost * o.frostScale * dpr;
  // WebKit shifts the maps that follow feGaussianBlur, so it always gets the convolution.
  if (sigma > 0 && o.blur !== 'gaussian' && (sigma <= 12 || isWebKit() || o.blur === 'convolve')) {
    // Exact gaussian, separable: Skia's blur is stepped at small sigmas.
    const r = Math.ceil(sigma * 3), k = [];
    for (let i = -r; i <= r; i++) k.push(Math.exp(-i * i / (2 * sigma * sigma)));
    const sum = k.reduce((a, b) => a + b, 0), kernel = k.map(v => v / sum).join(' ');
    el('feConvolveMatrix', { in: src, order: `${2 * r + 1} 1`, kernelMatrix: kernel, edgeMode: edge, preserveAlpha: 'true', result: 'frostX' }, filter);
    el('feConvolveMatrix', { in: 'frostX', order: `1 ${2 * r + 1}`, kernelMatrix: kernel, edgeMode: edge, preserveAlpha: 'true', result: 'frost' }, filter);
    src = 'frost'; count += 2;
  } else if (sigma > 0) {
    // Skia's stepped sigmas are corrected only in Chromium; WebKit blurs with three box passes.
    const sd = isChromium() ? chromeSigma(sigma) : sigma;
    el('feGaussianBlur', { in: src, stdDeviation: sd / dpr, edgeMode: edge, result: 'frost' }, filter);
    src = 'frost'; count++;
  }
  el('feImage', Object.assign({ href: urls.disp, result: 'map' }, img), filter); count++;
  const displace = (scale, result) => {
    el('feDisplacementMap', { in: src, in2: 'map', scale, xChannelSelector: 'R', yChannelSelector: 'G', result }, filter);
    count++;
    return result;
  };
  const ca = o.dispersion * o.dispersionScale;
  let refr;
  if (ca < 0.001) {
    refr = displace(baked.scale, 'refr');
  } else {
    const chans = [];
    ['R', 'G', 'B'].forEach((ch, c) => {
      const shift = (1 - c) * 0.5; // R: f + 0.5, G: f, B: f - 0.5
      const all = dispersionTaps(taps);
      let acc = null;
      all.forEach((t, i) => {
        const r = displace(baked.scale * (1 + (t.f + shift) * ca), `d${ch}${i}`);
        if (!acc) { acc = r; return; }
        const k2 = i === 1 ? all[0].w : 1;
        el('feComposite', { in: acc, in2: r, operator: 'arithmetic', k1: 0, k2, k3: t.w, k4: 0, result: `a${ch}${i}` }, filter);
        count++;
        acc = `a${ch}${i}`;
      });
      const keep = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
      keep[c * 6] = 1;
      el('feColorMatrix', { in: acc, type: 'matrix', values: keep.join(' '), result: `c${ch}` }, filter);
      count++;
      chans.push(`c${ch}`);
    });
    el('feComposite', { in: chans[0], in2: chans[1], operator: 'arithmetic', k2: 1, k3: 1, result: 'rg' }, filter);
    el('feComposite', { in: 'rg', in2: chans[2], operator: 'arithmetic', k2: 1, k3: 1, result: 'refr' }, filter);
    count += 2;
    refr = 'refr';
  }
  el('feImage', Object.assign({ href: urls.lp, result: 'lp' }, img), filter);
  el('feImage', Object.assign({ href: urls.ln, result: 'ln' }, img), filter);
  el('feComposite', { in: refr, in2: 'lp', operator: 'arithmetic', k2: 1, k3: 1, result: 'lit' }, filter);
  el('feComposite', { in: 'lit', in2: 'ln', operator: 'arithmetic', k2: 1, k3: 1, k4: -1, result: 'shade' }, filter);
  // Opaque output: k4 = -1 takes the alpha down with it.
  el('feColorMatrix', { in: 'shade', type: 'matrix', values: '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1' }, filter);
  return count + 5;
}

function isChromium() {
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  if (brands) return brands.some(b => /Chromium/.test(b.brand));
  // userAgentData exists only on https and localhost. Chrome on iOS says CriOS and is WebKit.
  return /\b(Chrome|Chromium)\/\d/.test(navigator.userAgent);
}

// The rendering engine, not the browser: Chrome, Edge and Firefox on iOS are WebKit.
const engineName = () => isChromium() ? 'chromium' : /AppleWebKit/.test(navigator.userAgent) ? 'webkit' : 'gecko';

const isWebKit = () => engineName() === 'webkit';

const supportsMozElement = () => !!(window.CSS && CSS.supports('background-image', '-moz-element(#a)'));

// Engines differ only in how the backdrop reaches the filter:
//   backdrop  backdrop-filter: url()                     Chromium
//   element   -moz-element() of the source + filter: url() Firefox
//   mirror    live clone of the source + filter: url()   any browser
//   fallback  backdrop blur + baked light, no refraction
const ENGINES = ['backdrop', 'element', 'mirror', 'fallback', 'off'];
const warned = new Set();

// mode is one engine for every browser or an object keyed by rendering engine.
function pickEngine(o, node) {
  let mode = o.mode;
  if (mode && typeof mode === 'object') mode = mode[engineName()];
  if (mode == null) mode = 'auto';
  if (ENGINES.includes(mode)) return mode;
  if (mode !== 'auto' && !warned.has(mode)) {
    warned.add(mode);
    console.warn(`figma-glass: unknown mode "${mode}", using auto`);
  }
  if (isChromium()) return 'backdrop';
  // -moz-element() of an ancestor would paint the glass into its own backdrop.
  if (supportsMozElement() && !o.source.contains(node)) return 'element';
  return 'fallback';
}

function isOpaque(color) {
  return color && color !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(color);
}

// Colour painted behind the source: the clone has no ancestors to inherit it from.
function backdropColor(el) {
  for (let e = el; e; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (isOpaque(c)) return c;
  }
  return '#fff';
}

let uid = 0;
let defs = null;
function svgDefs() {
  if (defs) return defs;
  const svg = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', 'data-glass-ignore': '' });
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(svg);
  defs = el('defs', {}, svg);
  return defs;
}

// The mirror's copy never animates or scrolls smoothly on its own: it takes the original's values
// every frame. WebKit moves an animated element to its own GPU layer, and the lens filter skips it.
let cloneRules = null;
function cloneStyle() {
  if (cloneRules) return;
  cloneRules = document.createElement('style');
  cloneRules.setAttribute('data-glass-ignore', '');
  cloneRules.textContent = '[data-glass-clone],[data-glass-clone] *{animation:none!important;transition:none!important;scroll-behavior:auto!important}';
  document.head.appendChild(cloneRules);
}

function layerDiv(css) {
  const d = document.createElement('div');
  d.setAttribute('data-glass-ignore', '');
  d.style.cssText = 'position:absolute;inset:0;pointer-events:none;border-radius:inherit;z-index:-1;' + css;
  return d;
}

const decode = url => { const i = new Image(); i.src = url; return i.decode().catch(() => {}); };

// Not copied when restyling the clone: what the mirror manages itself.
const KEEP = /^(animation|transition|will-change|pointer-events)/;
const ROOT_SET = /^(filter|position|left|top|right|bottom|inset|margin|width|height|inline-size|block-size|min-|max-|box-sizing|transform|translate|rotate|scale)/;
// Embedded documents and players: a box of the same size, nothing that loads or plays twice.
const BOXED = /^(IFRAME|OBJECT|EMBED|AUDIO)$/;
const KEYFRAME_META = new Set(['offset', 'easing', 'composite', 'computedOffset']);
const hyphen = p => p.startsWith('--') ? p : p.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

// The copy of an element replaced by another tag, keeping its look.
function standIn(c, tag, keepChildren) {
  const s = document.createElement(tag);
  for (const a of ['class', 'style']) { const v = c.getAttribute(a); if (v !== null) s.setAttribute(a, v); }
  if (keepChildren) while (c.firstChild) s.appendChild(c.firstChild);
  c.replaceWith(s);
  return s;
}

function copyValue(orig, c) {
  if (orig.tagName === 'BUTTON' || orig.type === 'file') return;
  if ('value' in orig) c.value = orig.value;
  if ('checked' in orig) c.checked = orig.checked;
}

// A clone of the source kept in step with it: position, animations, scroll, media, form values,
// fixed and sticky elements. box() is the source's border box in CSS pixels, unrounded.
function createMirror(source, node, layer, box) {
  let blur = '', clone = null, scrollers = [], media = [], dirty = true, patched = false;
  // Source node -> its copy (elements and text), so edits reach the copy without a rebuild.
  let copies = new Map(), restyled = new Set(), pinned = new Map(), moving = new Map();
  const props = new WeakMap(); // Animation -> the properties it animates
  const walk = root => {
    const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = root; n; n = w.nextNode()) out.push(n);
    return out;
  };
  cloneStyle();
  // The clone loses ids and the source's ancestors, and with them the rules that matched through
  // them. Elements with an id and the root take the computed values that came out different.
  function restyle(orig, c) {
    const want = getComputedStyle(orig), got = getComputedStyle(c);
    for (let i = 0; i < want.length; i++) {
      const p = want[i];
      if (KEEP.test(p) || (c === clone && ROOT_SET.test(p))) continue;
      const v = want.getPropertyValue(p);
      if (got.getPropertyValue(p) !== v) c.style.setProperty(p, v);
    }
  }
  // Fixed and sticky elements: inside the transformed copy fixed is relative to the copy and sticky
  // never sticks, so both become offset boxes that frame() moves onto the original's place.
  function pin(orig) {
    const p = getComputedStyle(orig).position;
    if (orig === source || (p !== 'fixed' && p !== 'sticky')) { pinned.delete(orig); return; }
    const old = pinned.get(orig);
    if (old && old.fixed === (p === 'fixed')) return;
    const cs = getComputedStyle(orig), fixed = p === 'fixed';
    pinned.set(orig, fixed
      ? { fixed, x: parseFloat(cs.left) || 0, y: parseFloat(cs.top) || 0, w: cs.width, h: cs.height }
      : { fixed, x: 0, y: 0 });
  }
  // What the mirror sets on a copy, put back after the copy's style attribute is rewritten.
  function own(orig, c) {
    // Restyle first: it would copy the original's fixed or sticky position back.
    if (restyled.has(orig)) restyle(orig, c);
    c.style.willChange = 'auto';
    const p = pinned.get(orig);
    if (p) Object.assign(c.style, { position: p.fixed ? 'absolute' : 'relative', left: p.x + 'px', top: p.y + 'px',
      right: 'auto', bottom: 'auto' }, p.fixed ? { width: p.w, height: p.h } : {});
  }
  function build() {
    dirty = false;
    if (clone) clone.remove();
    clone = source.cloneNode(true);
    const a = walk(source), b = walk(clone), drop = [];
    scrollers = []; media = [];
    copies = new Map(); restyled = new Set(); pinned = new Map(); moving = new Map();
    a.forEach((orig, i) => {
      let c = b[i];
      copies.set(orig, c);
      if (orig.nodeType !== Node.ELEMENT_NODE) return;
      if (orig === node || orig.hasAttribute('data-glass-ignore') || orig.tagName === 'SCRIPT') { drop.push(c); return; }
      if (orig === source || orig.id) restyled.add(orig);
      c.removeAttribute('id');
      c.removeAttribute('autofocus');
      const tag = orig.tagName;
      if (orig !== source && (tag === 'VIDEO' || tag === 'CANVAS')) {
        c = standIn(c, 'canvas');
        media.push([orig, c]);
      } else if (orig !== source && BOXED.test(tag)) {
        const cs = getComputedStyle(orig);
        c = standIn(c, 'div');
        Object.assign(c.style, { display: cs.display === 'inline' ? 'inline-block' : cs.display, width: cs.width, height: cs.height });
      } else if (orig !== source && tag.includes('-') && orig.namespaceURI === 'http://www.w3.org/1999/xhtml') {
        // A custom element would run its connectedCallback (fetches, timers) on every rebuild.
        const display = getComputedStyle(orig).display;
        c = standIn(c, 'span', true);
        c.style.display = display;
      } else if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(tag)) {
        // Nameless and formless: a copied radio would join the original's group and uncheck it, and a
        // copy inside the page's form would be submitted with it.
        c.removeAttribute('name'); c.removeAttribute('form');
        copyValue(orig, c);
      }
      copies.set(orig, c);
      pin(orig);
      if (orig.scrollHeight > orig.clientHeight + 1 || orig.scrollWidth > orig.clientWidth + 1) scrollers.push([orig, c]);
    });
    drop.forEach(c => c.remove());
    // The clone keeps the source's classes: a source stretched with right/bottom or inset would be pinned
    // to the lens box.
    const [w, h] = box();
    Object.assign(clone.style, { position: 'absolute', left: '0', top: '0', right: 'auto', bottom: 'auto', margin: '0',
      width: w + 'px', height: h + 'px', filter: blur, boxSizing: 'border-box', transformOrigin: '0 0', pointerEvents: 'none' });
    clone.setAttribute('data-glass-clone', '');
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
    layer.appendChild(clone);
    for (const [orig, c] of copies) if (orig.nodeType === Node.ELEMENT_NODE && c.isConnected) own(orig, c);
  }
  // An attribute edit is copied onto the one element; JS animation writes style every frame.
  function patch(orig, c, name) {
    if (orig === source || name === 'id') { dirty = true; return; }
    if (name === 'name' || name === 'form' || name === 'autofocus') return;
    // Stand-ins take only their look.
    if (c.tagName !== orig.tagName && name !== 'class' && name !== 'style') return;
    const v = orig.getAttribute(name);
    if (v === null) c.removeAttribute(name); else c.setAttribute(name, v);
    if (name === 'class' || name === 'style') {
      const was = pinned.has(orig);
      pin(orig);
      if (was && !pinned.has(orig)) {
        const s = orig.getAttribute('style');
        if (s === null) c.removeAttribute('style'); else c.setAttribute('style', s);
      }
      own(orig, c);
    }
  }
  // Edits inside this glass and inside any glass layer (other instances write theirs every frame)
  // are not the backdrop.
  const ours = n => {
    const e = n.nodeType === Node.ELEMENT_NODE ? n : n.parentElement;
    return !e || node.contains(e) || !!e.closest('[data-glass-ignore]');
  };
  const mo = new MutationObserver(records => {
    for (const r of records) {
      if (dirty || ours(r.target)) continue;
      const c = copies.get(r.target);
      if (!c || r.type === 'childList') { dirty = true; continue; }
      if (r.type === 'characterData') c.data = r.target.data;
      else patch(r.target, c, r.attributeName);
      patched = true;
    }
  });
  mo.observe(source, { subtree: true, childList: true, attributes: true, characterData: true });
  // Typing and clicks change form values without touching attributes. A checked radio unchecks the
  // rest of its group without events of their own.
  const onInput = e => {
    const t = e.target, group = t.type === 'radio' && t.name
      ? [...source.querySelectorAll('input[type=radio]')].filter(r => r.name === t.name) : [t];
    for (const f of group) { const c = copies.get(f); if (c && c.tagName === f.tagName) copyValue(f, c); }
    patched = true;
  };
  source.addEventListener('input', onInput, true);
  source.addEventListener('change', onInput, true);
  return {
    source,
    // dx, dy: where the source's corner falls in the lens; kx, ky: the source's scale in the lens;
    // sx, sy: the glass's own scale on screen. lens: the area the filter reads, in viewport
    // coordinates. Every write to the clone makes the browser run the filter again (in WebKit on the
    // CPU), so only what is under the lens is updated, and only when it changed.
    // Returns true when the clone changed.
    frame(dx, dy, kx, ky, sx, sy, lens) {
      let changed = dirty || patched;
      patched = false;
      if (dirty) build();
      const t = `translate(${dx}px, ${dy}px)` + (kx !== 1 || ky !== 1 ? ` scale(${kx}, ${ky})` : '');
      if (clone.style.transform !== t) { clone.style.transform = t; changed = true; }
      const away = e => {
        const r = e.getBoundingClientRect();
        return r.right < lens.left || r.left > lens.right || r.bottom < lens.top || r.top > lens.bottom;
      };
      // Whatever animates on the original, including animations started after the copy was made.
      const now = new Map();
      for (const a of document.getAnimations()) {
        const eff = a.effect, target = eff && eff.target;
        // Dropped copies (the glass itself, ignored layers) are not in the backdrop.
        if (!target || eff.pseudoElement || target === source || !copies.has(target) || !copies.get(target).isConnected) continue;
        let list = props.get(a);
        if (!list) {
          list = a.transitionProperty ? [hyphen(a.transitionProperty)]
            : [...new Set(eff.getKeyframes().flatMap(k => Object.keys(k)).filter(p => !KEYFRAME_META.has(p)).map(hyphen))];
          props.set(a, list);
        }
        const set = now.get(target) || new Set();
        list.forEach(p => set.add(p));
        now.set(target, set);
      }
      for (const [o, list] of now) {
        if (away(o)) continue;
        const c = copies.get(o), cs = getComputedStyle(o);
        for (const p of list) {
          const v = cs.getPropertyValue(p);
          if (c.style.getPropertyValue(p) !== v) { c.style.setProperty(p, v); changed = true; }
        }
      }
      // A finished animation leaves the copy to its own style again.
      for (const o of moving.keys()) {
        if (now.has(o)) continue;
        const c = copies.get(o), s = o.getAttribute('style');
        if (s === null) c.removeAttribute('style'); else c.setAttribute('style', s);
        own(o, c);
        changed = true;
      }
      moving = now;
      for (const [o, c] of scrollers) {
        if (c.scrollTop !== o.scrollTop) { c.scrollTop = o.scrollTop; changed = true; }
        if (c.scrollLeft !== o.scrollLeft) { c.scrollLeft = o.scrollLeft; changed = true; }
      }
      for (const [o, p] of pinned) {
        const c = copies.get(o);
        if (!c || !c.isConnected || away(o)) continue;
        if (p.fixed) {
          const cs = getComputedStyle(o);
          if (cs.width !== p.w || cs.height !== p.h) { p.w = c.style.width = cs.width; p.h = c.style.height = cs.height; changed = true; }
        }
        const or = o.getBoundingClientRect(), cr = c.getBoundingClientRect();
        const ex = (or.left - cr.left) / (kx * sx), ey = (or.top - cr.top) / (ky * sy);
        if (Math.abs(ex) > 0.25 || Math.abs(ey) > 0.25) {
          p.x += ex; p.y += ey;
          c.style.left = p.x + 'px'; c.style.top = p.y + 'px';
          changed = true;
        }
      }
      for (const [o, cv] of media) {
        // A video's width and height attributes set its box; the stand-in's buffer gives its box.
        const video = o.tagName === 'VIDEO';
        const w = video ? o.width || o.videoWidth : o.width;
        const h = video ? o.height || (o.width && o.videoWidth ? Math.round(o.width * o.videoHeight / o.videoWidth) : o.videoHeight) : o.height;
        if (!w || !h || away(o)) continue;
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        try { cv.getContext('2d').drawImage(o, 0, 0, w, h); changed = true; } catch (e) { /* not ready yet */ }
      }
      return changed;
    },
    resize() {
      if (!clone) return;
      const [w, h] = box();
      if (clone.style.width !== w + 'px' || clone.style.height !== h + 'px') {
        clone.style.width = w + 'px'; clone.style.height = h + 'px'; patched = true;
      }
    },
    blur(v) { blur = v; if (clone) clone.style.filter = v; },
    destroy() {
      mo.disconnect();
      source.removeEventListener('input', onInput, true);
      source.removeEventListener('change', onInput, true);
      if (clone) clone.remove();
    },
  };
}

function attach(node, options) {
  const o = Object.assign({ source: document.body }, DEFAULTS, options);
  const id = 'figma-glass-' + (++uid);
  // Painted under the node's own content: the lens (filtered backdrop), fallback light, layer fill.
  // Figma paints the fill over the glass, light included.
  const layer = layerDiv('overflow:hidden;background-repeat:no-repeat');
  const light = layerDiv('background-size:100% 100%');
  const fill = layerDiv('');
  // Put back on destroy.
  const saved = {};
  for (const p of ['position', 'isolation', 'borderRadius', 'backdropFilter', 'webkitBackdropFilter']) saved[p] = node.style[p] || '';
  if (getComputedStyle(node).position === 'static') node.style.position = 'relative';
  node.style.isolation = 'isolate';
  node.setAttribute('data-figma-glass', '');
  node.prepend(layer, light, fill);
  const state = { mode: null, bakeMs: 0, primitives: 0 };
  let raf = 0, loop = 0, size = [0, 0], pad = 0, mirror = null, renders = 0, gen = 0, flip = false;
  let destroyed = false, visible = true, observed = null, named = null;
  // The filter in use with its identical twin (see tick), and the style property it sits on.
  let current = null, prop = null;
  // Baked maps by geometry and light: frost, dispersion, fill and engine changes reuse them.
  let memo = { key: '' };

  // Border boxes in CSS pixels, unrounded and without transforms.
  const boxes = new WeakMap();
  const boxOf = e => boxes.get(e) || [e.offsetWidth, e.offsetHeight];

  function baked(w, h, d) {
    const key = [w, h, d, o.depth, o.bevel, o.refraction, o.splay, o.lightIntensity, o.radius, o.lightAngle].join();
    if (memo.key !== key) memo = { key, baked: bake(w, h, o, d), urls: new Map(), white: '' };
    return memo.baked;
  }
  function mapUrls(b, padPx) {
    let u = memo.urls.get(padPx);
    if (!u) {
      u = { disp: padMap(b.disp, padPx, 'rgb(128,128,128)'), lp: padMap(b.lightPos, padPx, '#000'), ln: padMap(b.lightNegInv, padPx, '#fff') };
      memo.urls.set(padPx, u);
    }
    return u;
  }
  function whiteUrl(b) {
    if (!memo.white) memo.white = canvasFrom(b.W, b.H, (k, px) => {
      px[0] = px[1] = px[2] = 255;
      px[3] = Math.round(Math.min(1, Math.max(0, b.light[k])) * 255);
    }).toDataURL();
    return memo.white;
  }

  function dropFilters() {
    if (current) { current.f.remove(); current.t.remove(); current = null; }
    prop = null;
  }

  function reset() {
    node.style.backdropFilter = saved.backdropFilter;
    node.style.webkitBackdropFilter = saved.webkitBackdropFilter;
    layer.style.filter = layer.style.backdropFilter = layer.style.backgroundImage = layer.style.backgroundColor = layer.style.backgroundSize = layer.style.transform = '';
    layer.style.display = 'none';
    light.style.backgroundImage = '';
    if (mirror && (state.mode !== 'mirror' || mirror.source !== o.source)) { mirror.destroy(); mirror = null; }
  }

  // Per frame: keep the copied backdrop aligned with what is under the glass.
  function tick() {
    loop = 0;
    if (destroyed || !visible || (state.mode !== 'element' && state.mode !== 'mirror')) return;
    const sr = o.source.getBoundingClientRect(), gr = node.getBoundingClientRect();
    const [nw, nh] = boxOf(node), [sw, sh] = boxOf(o.source);
    // The copy lives inside the glass and takes its transform: undo the glass's scale (a press or
    // hover) so the backdrop stays put on screen. Rotation is not undone.
    const unit = v => Math.abs(v - 1) < 1e-3 ? 1 : v;
    const sx = unit(gr.width / nw || 1), sy = unit(gr.height / nh || 1);
    const dx = (sr.left - gr.left) / sx + pad, dy = (sr.top - gr.top) / sy + pad;
    const kx = unit(sr.width / (sw || 1) / sx), ky = unit(sr.height / (sh || 1) / sy);
    if (state.mode === 'element') {
      layer.style.backgroundPosition = `${dx}px ${dy}px`;
      layer.style.backgroundSize = kx === 1 && ky === 1 ? '' : `${sr.width / sx}px ${sr.height / sy}px`;
    } else {
      const reach = pad + o.depth;
      const changed = mirror.frame(dx, dy, kx, ky, sx, sy, { left: gr.left - reach, right: gr.right + reach, top: gr.top - reach, bottom: gr.bottom + reach });
      // WebKit repaints only the rectangles that changed and runs the filter on each of them alone,
      // which draws a small lens around every moved word. Switching to an identical twin filter makes it
      // run the filter on the whole lens.
      if (changed && isWebKit() && current) {
        flip = !flip;
        layer.style.filter = `url(#${flip ? current.t.id : current.f.id})`;
      }
    }
    loop = requestAnimationFrame(tick);
  }

  function render() {
    raf = 0;
    if (destroyed) return;
    const token = ++renders;
    const w = node.offsetWidth, h = node.offsetHeight;
    if (!w || !h) return;
    size = [w, h];
    // The radius the maps use; a large value (9999 for a pill) passed to CSS as is came out as a small
    // radius in Chrome's GPU clip.
    const radius = Math.max(0, Math.min(o.radius, w / 2, h / 2));
    node.style.borderRadius = radius + 'px';
    fill.style.backgroundColor = o.fill || 'transparent';
    const mode = pickEngine(o, node);
    state.mode = mode;
    state.engine = engineName();
    if (o.source !== observed) {
      if (observed && observed !== node) ro.unobserve(observed);
      ro.observe(o.source);
      observed = o.source;
    }
    reset();
    // The layers sit on the border box, like the maps and Figma's glass; inset alone would start at
    // the padding box.
    const cs = getComputedStyle(node);
    const border = ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs[`border${s}Width`]) || 0);
    const inset = grow => border.map(b => -(b + grow) + 'px').join(' ');
    fill.style.inset = light.style.inset = inset(0);
    if (mode === 'off') { dropFilters(); return; }
    const t0 = performance.now();
    const dpr = window.devicePixelRatio || 1;
    // The density the SVG filter runs at; kernels and maps are built for it.
    // Safari 26.2 convolves in device pixels too: a kernel built for 1x blurred half as wide on retina.
    const fdpr = o.filterDpr || dpr;
    state.filterDpr = fdpr;
    const taps = state.taps = o.taps || (isWebKit() ? 1 : 8);
    const b = baked(w, h, Math.min(2, mode === 'fallback' ? dpr : fdpr));
    if (mode === 'fallback') {
      dropFilters();
      state.primitives = 0;
      node.style.backdropFilter = node.style.webkitBackdropFilter = `blur(${o.frost * o.frostScale}px)`;
      light.style.backgroundImage = `url(${whiteUrl(b)})`;
    } else {
      // The lens overhangs the glass by the frost reach and is clipped back to its shape.
      pad = Math.ceil(3 * o.frost * o.frostScale) + 2;
      Object.assign(layer.style, { display: '', inset: inset(pad), borderRadius: '0',
        clipPath: `inset(${pad}px round ${radius}px)` });
      const next = mode === 'backdrop' ? 'backdropFilter' : 'filter';
      // The previous glass stays until the new maps have loaded: a filter whose map is not loaded yet
      // paints black.
      if (current && prop === next) layer.style[next] = `url(#${current.f.id})`;
      else dropFilters();
      prop = next;
      // In WebKit the convolution runs on the CPU and slows down past sigma 9 device px (frost 14 at 2x: 45
      // fps against 60); CSS blur() on the copy keeps 60 at a few levels' cost, so mirror switches there.
      const cssFrost = mode === 'mirror' && (o.blur === 'css'
        || (o.blur === 'auto' && isWebKit() && o.frost * o.frostScale * fdpr > 9));
      const urls = mapUrls(b, Math.round(pad * b.W / w));
      const f = el('filter', { id: `${id}-${++gen}` }, svgDefs());
      state.primitives = buildFilter(f, o, b, urls, fdpr, cssFrost, taps);
      const twin = f.cloneNode(true);
      twin.id = f.id + '-twin';
      f.after(twin);
      Promise.all(Object.values(urls).map(decode)).then(() => {
        if (token !== renders || destroyed) { f.remove(); twin.remove(); return; }
        const old = current;
        current = { f, t: twin };
        flip = false;
        // WebKit may not repaint a CSS-filtered element when a map inside the filter finishes loading.
        layer.style[next] = 'none';
        void layer.offsetWidth;
        layer.style[next] = `url(#${f.id})`;
        if (old) { old.f.remove(); old.t.remove(); }
      });
      if (mode !== 'backdrop') {
        // WebKit paints the page in tiles of 1024 device pixels and runs the filter on each tile alone:
        // a glass across a tile edge showed two lenses. Its own compositing layer keeps the lens whole.
        if (isWebKit()) layer.style.transform = 'translateZ(0)';
        layer.style.backgroundColor = backdropColor(o.source);
        if (mode === 'element') {
          if (!o.source.id) { o.source.id = id + '-source'; named = o.source; }
          layer.style.backgroundImage = `-moz-element(#${o.source.id})`;
        } else if (!mirror) {
          const source = o.source;
          mirror = createMirror(source, node, layer, () => boxOf(source));
        }
        // CSS frost blurs the copy before the lens filter.
        if (mirror) mirror.blur(cssFrost && o.frost > 0 ? `blur(${o.frost * o.frostScale}px)` : '');
        if (!loop) loop = requestAnimationFrame(tick);
      }
    }
    state.bakeMs = performance.now() - t0;
    if (o.onRender) o.onRender(state);
  }
  const schedule = () => { if (!raf && !destroyed) raf = requestAnimationFrame(render); };
  const ro = new ResizeObserver(entries => {
    for (const e of entries) {
      const b = e.borderBoxSize && e.borderBoxSize[0];
      boxes.set(e.target, b ? [b.inlineSize, b.blockSize] : [e.target.offsetWidth, e.target.offsetHeight]);
      if (mirror && e.target === mirror.source) mirror.resize();
    }
    if (node.offsetWidth !== size[0] || node.offsetHeight !== size[1]) schedule();
  });
  ro.observe(node);
  // Off screen the copied backdrop is not kept in step.
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !loop && (state.mode === 'element' || state.mode === 'mirror')) loop = requestAnimationFrame(tick);
  });
  io.observe(node);
  // Zoom or a move to another screen: kernels and maps are built for the pixel density.
  let density = null;
  const onDensity = () => { watchDensity(); schedule(); };
  function watchDensity() {
    if (density) density.removeEventListener('change', onDensity);
    density = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    density.addEventListener('change', onDensity);
  }
  watchDensity();
  schedule();

  return {
    options: o,
    state,
    update(patch) {
      if (destroyed) return;
      Object.assign(o, patch);
      schedule();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      ro.disconnect(); io.disconnect();
      density.removeEventListener('change', onDensity);
      cancelAnimationFrame(raf); cancelAnimationFrame(loop);
      state.mode = null;
      reset();
      dropFilters();
      layer.remove(); light.remove(); fill.remove();
      Object.assign(node.style, saved);
      node.removeAttribute('data-figma-glass');
      if (named && named.id === id + '-source') named.removeAttribute('id');
    },
  };
}

export { attach, bake, DEFAULTS };
