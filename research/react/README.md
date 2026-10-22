# React stand

`test.html` renders `<Glass>` with React 18 from esm.sh in StrictMode (development build), then checks:
30 re-renders with the same props and a new `onRender` each time (no glass update), a changed `frost`
(one update), the text child rewritten by React (layers survive), `source` as a ref, `as="button"`
with a forwarded ref, and unmount (nothing left). The result lands in `#result`; in Safari read it with
`python3 research/safari/wd.py "http://localhost:8080/research/react/test.html" 25`.
