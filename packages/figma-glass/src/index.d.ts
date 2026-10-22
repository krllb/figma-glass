/**
 * figma-glass: Figma's Glass effect for the web. Copy the values from Figma's Glass panel into
 * `attach`; percentages become 0..1, pixels stay pixels.
 *
 * @example
 * // Figma panel: Light −45° 80%, Refraction 80, Depth 20, Dispersion 50, Frost 4, Splay 0
 * import { attach } from 'figma-glass';
 * const glass = attach(document.getElementById('glass'), {
 *   lightAngle: -45, lightIntensity: 0.8, refraction: 0.8, depth: 20, dispersion: 0.5, frost: 4,
 *   splay: 0, radius: 16, fill: 'rgba(255,255,255,.2)',
 *   source: document.getElementById('hero'), // the block under the glass, for Safari and Firefox
 *   mode: { webkit: 'mirror' },              // refraction in Safari; omit for frost and light only
 * });
 * glass.update({ frost: 10 });
 * glass.destroy(); // on unmount
 */

/** How the backdrop reaches the filter. */
export type Engine = 'backdrop' | 'element' | 'mirror' | 'fallback' | 'off';

/** The rendering engine, not the browser: Chrome, Edge and Firefox on iOS are WebKit. */
export type RenderingEngine = 'chromium' | 'webkit' | 'gecko';

/**
 * One engine everywhere, or an engine per rendering engine (a missing key is auto). auto: Chromium →
 * backdrop, Firefox → element when the glass is outside `source`, otherwise fallback (frost and light,
 * no refraction). auto never picks mirror.
 */
export type Mode = 'auto' | Engine | Partial<Record<RenderingEngine, 'auto' | Engine>>;

export interface GlassOptions {
  /** Figma's Light angle, degrees: −45° → -45. */
  lightAngle: number;
  /** Figma's Light intensity, 0..1: 80% → 0.8. */
  lightIntensity: number;
  /** Figma's Refraction, 0..1: 80 → 0.8. */
  refraction: number;
  /** Figma's Depth, px: 20 → 20. */
  depth: number;
  /** Figma's Dispersion, 0..1: 50 → 0.5. */
  dispersion: number;
  /** Figma's Frost, px: 4 → 4. */
  frost: number;
  /** Figma's Splay, 0..1: 0 → 0. */
  splay: number;
  /** The layer's corner radius, px. Overrides the element's border-radius; 9999 makes a pill. */
  radius: number;
  /** Calibration: bevel size, px. Leave as is. */
  bevel: number;
  /** Calibration: gaussian sigma = frost * frostScale. Leave as is. */
  frostScale: number;
  /** Calibration: the soft resampling Figma applies even at frost 0. Leave as is. */
  soften: number;
  /** Calibration: chromatic aberration = dispersion * dispersionScale. Leave as is. */
  dispersionScale: number;
  /** Dispersion samples per channel: 8 (Figma), 3 or 1; 0 picks 8, in WebKit 1 (8 costs 60 → 45 fps). */
  taps: number;
  /** Which engine renders the glass; see Mode. */
  mode: Mode;
  /** The layer's fill from Figma, any CSS colour; painted over the glass, like in Figma. */
  fill: string;
  /** Pixel density the filter kernels are built for; 0 = devicePixelRatio. */
  filterDpr: number;
  /**
   * Frost implementation. auto: exact convolution up to sigma 12 device px, then feGaussianBlur; in
   * WebKit the convolution up to sigma 9 device px, then CSS blur() on the mirror's copy. convolve:
   * always the convolution; gaussian: always feGaussianBlur (shifts the maps in WebKit); css: CSS blur()
   * on the mirror's copy.
   */
  blur: 'auto' | 'convolve' | 'gaussian' | 'css';
  /**
   * The element under the glass, for the element and mirror engines; Chromium ignores it. Default
   * document.body. Mirror copies its DOM under every glass, so point it at the block the glass covers:
   * adding or removing elements inside it rebuilds the copy. Firefox refracts only when the glass is
   * outside it.
   */
  source: HTMLElement;
  /** Called after every render with the current state. */
  onRender?: (state: GlassState) => void;
}

export interface GlassState {
  /** The engine in use, null before the first render and after destroy. */
  mode: Engine | null;
  engine?: RenderingEngine;
  filterDpr?: number;
  taps?: number;
  bakeMs: number;
  primitives: number;
}

export interface Glass {
  /** The options in use; change them through update. */
  readonly options: GlassOptions;
  readonly state: GlassState;
  /** Changes options and renders again on the next frame. Does nothing after destroy. */
  update(patch: Partial<GlassOptions>): void;
  /** Removes the glass and restores the element's styles. */
  destroy(): void;
}

export const DEFAULTS: Readonly<Omit<GlassOptions, 'source' | 'onRender'>>;

/**
 * Applies the glass to an element: the element's own content stays on top, the glass is painted under
 * it. Sets position: relative (when static), isolation and border-radius on the element. Needs a
 * browser: call it on the client after the element is mounted, and destroy() on unmount.
 */
export function attach(node: HTMLElement, options?: Partial<GlassOptions>): Glass;

export interface Baked {
  scale: number;
  disp: HTMLCanvasElement;
  lightPos: HTMLCanvasElement;
  lightNegInv: HTMLCanvasElement;
  light: Float32Array;
  W: number;
  H: number;
}

/** The displacement and light maps for a w×h glass at a pixel density. */
export function bake(w: number, h: number, options: GlassOptions, dpr: number): Baked;
