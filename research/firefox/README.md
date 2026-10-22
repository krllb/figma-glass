# Firefox

`ff.py` drives headless Firefox through its built-in Marionette protocol (no geckodriver, no Node):
opens a page, waits for `#result`, prints it, optionally saves a screenshot. Serve the repo root
(`pnpm site`), then for example:

    python3 research/firefox/ff.py "http://localhost:8080/research/safari/element.html" 15 element.png

The stands live in `research/safari/`; `element.html` puts each glass beside its source, which is when
`auto` picks the `element` engine (`-moz-element()`).
