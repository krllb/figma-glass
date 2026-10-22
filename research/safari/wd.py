# Runs a stand page in real Safari through safaridriver and prints its #result.
# Once: Safari → Settings → Advanced → Show features for web developers, then Developer → Allow remote
# automation. Serve the repo root (pnpm site) and run safaridriver -p 4444 in another terminal.
# Usage: python3 wd.py <url> [wait seconds] [screenshot.png]
import json, sys, time, base64, urllib.request
BASE = 'http://localhost:4444'
def req(method, path, body=None):
    r = urllib.request.Request(BASE + path, method=method, headers={'Content-Type': 'application/json'},
        data=None if body is None else json.dumps(body).encode())
    return json.load(urllib.request.urlopen(r, timeout=120))['value']
def run(url, wait=15, shot=None, size=(1300, 1000)):
    sid = req('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}})['sessionId']
    try:
        s = f'/session/{sid}'
        req('POST', s + '/window/rect', {'width': size[0], 'height': size[1], 'x': 0, 'y': 0})
        req('POST', s + '/url', {'url': url})
        t, out = time.time(), ''
        while time.time() - t < wait and not out:
            time.sleep(0.5)
            out = req('POST', s + '/execute/sync', {'script': "const r=document.getElementById('result');return r?r.textContent:''", 'args': []})
        if shot:
            open(shot, 'wb').write(base64.b64decode(req('GET', s + '/screenshot')))
        return out
    finally:
        req('DELETE', f'/session/{sid}')
if __name__ == '__main__':
    print(run(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 15, sys.argv[3] if len(sys.argv) > 3 else None))
