'use client';
// figma-glass for React: <Glass> renders an element and keeps the glass on it in step with its props.
import { createElement, forwardRef, useEffect, useRef } from 'react';
import { attach, DEFAULTS } from './index.js';

const OPTIONS = new Set([...Object.keys(DEFAULTS), 'source', 'onRender']);

// The glass options among the props; source may be a ref, read once React has attached it.
function split(props) {
  const options = {}, rest = {};
  for (const k in props) (OPTIONS.has(k) ? options : rest)[k] = props[k];
  return { options, rest };
}
function resolve(options) {
  const o = {};
  for (const k in options) {
    // onRender reaches the glass once, as a wrapper that calls the latest one.
    if (k === 'onRender') continue;
    let v = options[k];
    if (k === 'source' && v && typeof v === 'object' && 'current' in v) v = v.current;
    if (v !== undefined && v !== null) o[k] = v;
  }
  return o;
}
const same = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && a && b
  && !(a instanceof Node) && JSON.stringify(a) === JSON.stringify(b));

const Glass = forwardRef(function Glass({ as = 'div', children, ...props }, ref) {
  const { options, rest } = split(props);
  const node = useRef(null), glass = useRef(null), applied = useRef({});
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    applied.current = resolve(latest.current);
    glass.current = attach(node.current, Object.assign({}, applied.current,
      { onRender: state => { if (latest.current.onRender) latest.current.onRender(state); } }));
    return () => { glass.current.destroy(); glass.current = null; };
  }, []);

  // Only what changed reaches the glass: an update rebuilds the filter, a re-render alone should not.
  useEffect(() => {
    if (!glass.current) return;
    const next = resolve(options), patch = {};
    for (const k of new Set([...Object.keys(next), ...Object.keys(applied.current)])) {
      if (!same(next[k], applied.current[k])) patch[k] = k in next ? next[k] : (k === 'source' ? document.body : DEFAULTS[k]);
    }
    if (Object.keys(patch).length) { glass.current.update(patch); applied.current = next; }
  });

  const setRef = el => {
    node.current = el;
    if (typeof ref === 'function') ref(el); else if (ref) ref.current = el;
  };
  return createElement(as, Object.assign({}, rest, { ref: setRef }), children);
});

export { Glass };
