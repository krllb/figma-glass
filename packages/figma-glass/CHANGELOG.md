# Changelog

## 0.2.1

- Docs: the examples set `source` and `mode: { webkit: 'mirror', gecko: 'mirror' }`, so they refract in
  Safari and Firefox as copied.

## 0.2.0

- `figma-glass/react`: `<Glass>`, the glass as a React component. Glass props update the glass only when
  they change; `source` takes a ref; React 18 or later.
- The glass puts its layers back when the element's children are rewritten, as React does with a single
  text child.
- Checked in Firefox: `element` and `mirror` within 3–4 levels of Chromium.

## 0.1.0

First release.
