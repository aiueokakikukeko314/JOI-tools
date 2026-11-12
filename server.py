#!/usr/bin/env python3
"""
JOI Tools ローカルサーバー

    python3 server.py            # http://localhost:8000 を開く
    python3 server.py --port 8080 --no-browser

アプリ本体 (index.html など) を配信し、さらに手元の g++ / python で
コードを実行する API (/api/run) を提供します。インターネット不要で、
実行時間も正確に測れます。

安全のため 127.0.0.1 でのみ待ち受け、他のサイトからのリクエストは拒否します。
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
MAX_OUTPUT = 2 * 1024 * 1024  # 出力は最大 2MB まで返す
MAX_BODY = 32 * 1024 * 1024
ALLOWED_STD = {"gnu++17", "gnu++20", "c++17", "c++20"}
IS_WIN = os.name == "nt"


def find_cxx():
    for name in ("g++", "clang++"):
        p = shutil.which(name)
        if p:
            return p
    return None


def tool_version(cmd):
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        line = (out.stdout or out.stderr).strip().splitlines()
        return line[0] if line else None
    except Exception:
        return None


CXX = find_cxx()
CXX_VERSION = tool_version([CXX, "--version"]) if CXX else None
PY_VERSION = "Python " + sys.version.split()[0]


def truncate(b):
    if len(b) > MAX_OUTPUT:
        return b[:MAX_OUTPUT].decode("utf-8", "replace") + "\n…(出力が長すぎるため省略)"
    return b.decode("utf-8", "replace")


def run_one(cmd, stdin_text, time_limit, cwd):
    """1 ケース実行。TLE は時間制限 + 少しの猶予で打ち切る"""
    data = stdin_text.encode("utf-8")
    t0 = time.perf_counter()
    try:
        p = subprocess.run(cmd, input=data, capture_output=True, cwd=cwd,
                           timeout=time_limit + 0.5)
        ms = (time.perf_counter() - t0) * 1000
        verdict = "OK"
        if p.returncode != 0:
            verdict = "RE"
        elif ms > time_limit * 1000:
            verdict = "TLE"
        return {"stdout": truncate(p.stdout), "stderr": truncate(p.stderr),
                "exitCode": p.returncode, "timeMs": ms, "verdict": verdict, "note": ""}
    except subprocess.TimeoutExpired as e:
        return {"stdout": truncate(e.stdout or b""), "stderr": truncate(e.stderr or b""),
                "exitCode": -1, "timeMs": time_limit * 1000, "verdict": "TLE", "note": "打ち切り"}


def handle_run(req):
    lang = req.get("lang")
    code = req.get("code", "")
    inputs = req.get("inputs", [])
    tl = float(req.get("timeLimit", 2))
    tl = max(0.1, min(tl, 30.0))
    std = req.get("std") or "gnu++17"
    if std not in ALLOWED_STD:
        std = "gnu++17"
    if not isinstance(inputs, list) or not all(isinstance(s, str) for s in inputs):
        raise ValueError("inputs が不正です")

    work = tempfile.mkdtemp(prefix="joi-tools-")
    try:
        result = {"compileError": None, "compileWarn": "", "results": []}
        if lang == "cpp":
            if not CXX:
                raise ValueError("g++ が見つかりません。C++ コンパイラをインストールしてください。")
            src = os.path.join(work, "main.cpp")
            exe = os.path.join(work, "main.exe" if IS_WIN else "main")
            with open(src, "w", encoding="utf-8") as f:
                f.write(code)
            try:
                c = subprocess.run([CXX, f"-std={std}", "-O2", "-Wall", "-o", exe, src],
                                   capture_output=True, cwd=work, timeout=60)
            except subprocess.TimeoutExpired:
                result["compileError"] = "コンパイルが 60 秒以内に終わりませんでした。"
                return result
            msg = (c.stderr + c.stdout).decode("utf-8", "replace").replace(src, "main.cpp")
            if c.returncode != 0:
                result["compileError"] = msg or "コンパイルに失敗しました"
                return result
            result["compileWarn"] = msg
            cmd = [exe]
        elif lang == "python":
            src = os.path.join(work, "main.py")
            with open(src, "w", encoding="utf-8") as f:
                f.write(code)
            cmd = [sys.executable, src]
        else:
            raise ValueError("未対応の言語です: %r" % lang)

        for s in inputs:
            r = run_one(cmd, s, tl, work)
            if lang == "python":
                r["stderr"] = r["stderr"].replace(os.path.join(work, ""), "")
            result["results"].append(r)
        return result
    finally:
        shutil.rmtree(work, ignore_errors=True)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _api_allowed(self):
        # DNS リバインディング対策: Host が localhost 系であること
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        if host not in ("localhost", "127.0.0.1", "::1"):
            return False
        # 他サイトからの送信対策: 独自ヘッダー必須 (付けるとブラウザは事前確認を行い、こちらは許可しない)
        return self.headers.get("X-JOI-Tools") == "1"

    def do_GET(self):
        if self.path.split("?")[0] == "/api/ping":
            if not self._api_allowed():
                return self._json(403, {"ok": False, "error": "forbidden"})
            return self._json(200, {"ok": True, "cpp": CXX_VERSION, "python": PY_VERSION})
        if self.path.startswith("/api/"):
            return self._json(404, {"error": "not found"})
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/run":
            return self._json(404, {"error": "not found"})
        if not self._api_allowed():
            return self._json(403, {"error": "forbidden"})
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            return self._json(415, {"error": "Content-Type は application/json にしてください"})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BODY:
            return self._json(413, {"error": "リクエストが大きすぎます"})
        try:
            req = json.loads(self.rfile.read(n).decode("utf-8"))
            return self._json(200, handle_run(req))
        except ValueError as e:
            return self._json(400, {"error": str(e)})
        except Exception as e:  # 予期しないエラー
            return self._json(500, {"error": "%s: %s" % (type(e).__name__, e)})


def main():
    ap = argparse.ArgumentParser(description="JOI Tools ローカルサーバー")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-browser", action="store_true", help="ブラウザを自動で開かない")
    args = ap.parse_args()

    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = "http://localhost:%d/" % args.port
    print("JOI Tools: %s" % url)
    print("  C++   : %s" % (CXX_VERSION or "見つかりません (g++ をインストールしてください)"))
    print("  Python: %s" % PY_VERSION)
    print("終了するには Ctrl+C")
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n終了しました")


if __name__ == "__main__":
    main()
