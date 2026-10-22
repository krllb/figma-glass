# Drives headless Firefox through Marionette (no geckodriver): open a URL, wait for #result, print it,
# optional screenshot. Usage: python3 ff.py <url> [wait] [shot.png]
import json, socket, subprocess, sys, time, base64, os, tempfile
FF = '/Applications/Firefox.app/Contents/MacOS/firefox'
PORT = 2828
def start(profile):
    os.makedirs(profile, exist_ok=True)
    with open(os.path.join(profile, 'user.js'), 'w') as f:
        f.write(f'user_pref("marionette.port", {PORT});\nuser_pref("browser.shell.checkDefaultBrowser", false);\n')
    p = subprocess.Popen([FF, '--headless', '--marionette', '--no-remote', '-profile', profile, '-width', '1300', '-height', '1000'],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            s = socket.create_connection(('127.0.0.1', PORT)); return p, s
        except OSError: time.sleep(0.2)
    raise SystemExit('marionette did not start')
class M:
    def __init__(self, s): self.s, self.id, self.buf = s, 0, b''; self.read()
    def read(self):
        while b':' not in self.buf: self.buf += self.s.recv(65536)
        n, rest = self.buf.split(b':', 1); n = int(n)
        while len(rest) < n: rest += self.s.recv(65536)
        self.buf = rest[n:]; return json.loads(rest[:n])
    def cmd(self, name, params=None):
        self.id += 1; m = json.dumps([0, self.id, name, params or {}]).encode()
        self.s.sendall(str(len(m)).encode() + b':' + m)
        while True:
            r = self.read()
            if r[1] == self.id:
                if r[2]: raise RuntimeError(r[2])
                return r[3]
def run(url, wait=15, shot=None):
    p, s = start(os.path.join(tempfile.gettempdir(), 'figma-glass-firefox'))
    try:
        m = M(s); m.cmd('WebDriver:NewSession', {'capabilities': {}})
        m.cmd('WebDriver:SetWindowRect', {'width': 1300, 'height': 1000})
        m.cmd('WebDriver:Navigate', {'url': url})
        t, out = time.time(), ''
        while time.time() - t < wait and not out:
            time.sleep(0.5)
            out = m.cmd('WebDriver:ExecuteScript', {'script': "const r=document.getElementById('result');return r?r.textContent:''", 'args': []}).get('value', '')
        if shot: open(shot, 'wb').write(base64.b64decode(m.cmd('WebDriver:TakeScreenshot', {})['value']))
        return out
    finally:
        try: m.cmd('Marionette:Quit', {'flags': ['eForceQuit']})
        except Exception: pass
        p.kill()
if __name__ == '__main__':
    print(run(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 15, sys.argv[3] if len(sys.argv) > 3 else None))
