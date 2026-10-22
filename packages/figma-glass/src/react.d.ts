import type { ElementType, ForwardRefExoticComponent, HTMLAttributes, ReactNode, RefAttributes, RefObject } from 'react';
import type { GlassOptions } from './index.js';

export type GlassProps = Partial<Omit<GlassOptions, 'source'>> & Omit<HTMLAttributes<HTMLElement>, 'onRender'> & {
  /** The element to render, div by default. */
  as?: ElementType;
  /**
   * The element under the glass, or a ref to it; Chromium ignores it. Safari and Firefox refract only
   * this element: point it at the block the glass covers.
   */
  source?: HTMLElement | RefObject<HTMLElement | null> | null;
  children?: ReactNode;
};

/**
 * An element with Figma's Glass on it. The glass props take the values from Figma's Glass panel
 * (percentages become 0..1); the rest go to the element. A change of a glass prop updates the glass.
 *
 * @example
 * <Glass refraction={0.8} depth={20} dispersion={0.5} frost={4} lightAngle={-45} lightIntensity={0.8}
 *   radius={9999} fill="rgba(255,255,255,.2)" source={heroRef} mode={{ webkit: 'mirror' }}>
 *   Buy
 * </Glass>
 */
export const Glass: ForwardRefExoticComponent<GlassProps & RefAttributes<HTMLElement>>;
