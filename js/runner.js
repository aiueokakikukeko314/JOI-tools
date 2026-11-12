'use strict';
/*
 * コード実行バックエンド
 *  - local   : 同梱の server.py (手元の g++ / python) を使う。正確な時間計測・オフライン可
 *  - wandbox : https://wandbox.org の公開 API (C++ / Python)。インターネット接続が必要
 *  - pyodide : ブラウザ内の Python (WebAssembly)。Python のみ
 *
 * どのバックエンドも run() の戻り値は共通:
 *   { compileError: string|null, compileWarn: string, results: [{stdout, stderr, exitCode, timeMs, verdict, note}] }
 *   verdict: 'OK' | 'RE' | 'TLE'
 */

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const WANDBOX = 'https://wandbox.org/api';

// Pyodide を動かす Worker のソース (file:// で開いても動くよう Blob から生成)
const PY_WORKER_SRC = `
importScripts(${JSON.stringify(PYODIDE_URL + 'pyodide.js')});
let ready = loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_URL)} }).then(async py => {
  py.runPython(\`
import sys, io, time, traceback
def __joi_run(src, data):
    sys.stdin = io.TextIOWrapper(io.BytesIO(data.encode()), encoding='utf-8')
    out = io.TextIOWrapper(io.BytesIO(), encoding='utf-8', write_through=True)
    err = io.TextIOWrapper(io.BytesIO(), encoding='utf-8', write_through=True)
    sys.stdout, sys.stderr = out, err
    code = 0
    t0 = time.perf_counter()
    try:
        exec(compile(src, 'Main.py', 'exec'), {'__name__': '__main__'})
    except SystemExit as e:
        if e.code is None: code = 0
        elif isinstance(e.code, int): code = e.code
        else:
            print(e.code, file=err); code = 1
    except BaseException:
        traceback.print_exc(file=err); code = 1
    t1 = time.perf_counter()
    sys.stdout.flush(); sys.stderr.flush()
    o = out.buffer.getvalue().decode('utf-8', 'replace')
    r = err.buffer.getvalue().decode('utf-8', 'replace')
    sys.stdout, sys.stderr = sys.__stdout__, sys.__stderr__
    return [o, r, code, (t1 - t0) * 1000]
\`);
  return py;
});
onmessage = async (e) => {
  const { id, type, code, stdin } = e.data;
  try {
    const py = await ready;
    if (type === 'init') { postMessage({ id, ready: true }); return; }
    const fn = py.globals.get('__joi_run');
    const res = fn(code, stdin);
    const [stdout, stderr, exitCode, timeMs] = res.toJs();
    res.destroy();
    fn.destroy();
    postMessage({ id, stdout, stderr, exitCode, timeMs });
  } catch (err) {
    postMessage({ id, fatal: String(err && err.message || err) });
  }
};`;

const Runner = {
  local: null,          // server.py の情報 (使えなければ null)
  wandboxList: null,
  pyWorker: null,
  pyReady: false,
  pyMsgId: 0,

  async detectLocal() {
    if (location.protocol === 'file:') return null;
    try {
      const r = await fetch('api/ping', { cache: 'no-store', headers: { 'X-JOI-Tools': '1' } });
      if (!r.ok) return null;
      const j = await r.json();
      this.local = j.ok ? j : null;
    } catch (e) { this.local = null; }
    return this.local;
  },

  /** 'auto' を実際のバックエンドに解決 */
  resolve(backend, lang) {
    if (backend !== 'auto') return backend;
    if (this.local) return 'local';
    return lang === 'python' ? 'pyodide' : 'wandbox';
  },

  label(b) {
    return { local: 'ローカル', wandbox: 'Wandbox', pyodide: 'ブラウザ内 Python' }[b] || b;
  },

  async run({ backend, lang, code, inputs, timeLimit, std, onProgress }) {
    const b = this.resolve(backend, lang);
    if (b === 'local') return this.runLocal(lang, code, inputs, timeLimit, std);
    if (b === 'wandbox') return this.runWandbox(lang, code, inputs, timeLimit, std, onProgress);
    if (b === 'pyodide') {
      if (lang !== 'python') throw new Error('ブラウザ内実行は Python のみ対応です。C++ は「ローカル」か「Wandbox」を選んでください。');
      return this.runPyodide(code, inputs, timeLimit, onProgress);
    }
    throw new Error('不明な実行環境: ' + b);
  },

  // ---------------- local (server.py) ----------------
  async runLocal(lang, code, inputs, timeLimit, std) {
    let r;
    try {
      r = await fetch('api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-JOI-Tools': '1' },
        body: JSON.stringify({ lang, code, inputs, timeLimit, std }),
      });
    } catch (e) {
      throw new Error('ローカルサーバーに接続できません。server.py が起動しているか確認してください。');
    }
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw new Error((j && j.error) || ('ローカルサーバーのエラー: HTTP ' + r.status));
    return j;
  },

  // ---------------- Wandbox ----------------
  async wandboxCompiler(lang) {
    if (!this.wandboxList) {
      try {
        const r = await fetch(WANDBOX + '/list.json');
        this.wandboxList = await r.json();
      } catch (e) { this.wandboxList = []; }
    }
    const want = lang === 'python' ? /^cpython-(\d+)\.(\d+)\.(\d+)$/ : /^gcc-(\d+)\.(\d+)\.(\d+)$/;
    const lname = lang === 'python' ? 'Python' : 'C++';
    const cands = this.wandboxList
      .filter(c => c.language === lname && want.test(c.name))
      .map(c => ({ name: c.name, v: c.name.match(want).slice(1).map(Number) }))
      .sort((a, b) => b.v[0] - a.v[0] || b.v[1] - a.v[1] || b.v[2] - a.v[2]);
    if (cands.length) return cands[0].name;
    return lang === 'python' ? 'cpython-head' : 'gcc-head';
  },

  async runWandbox(lang, code, inputs, timeLimit, std, onProgress) {
    const compiler = await this.wandboxCompiler(lang);
    const out = { compileError: null, compileWarn: '', results: [], compiler };
    for (let i = 0; i < inputs.length; i++) {
      onProgress && onProgress(i);
      const body = {
        compiler, code, stdin: inputs[i], save: false,
        options: lang === 'cpp' ? 'warning' : '',
        'compiler-option-raw': lang === 'cpp' ? `-std=${std || 'gnu++17'}\n-O2` : '',
      };
      const t0 = performance.now();
      let r;
      try {
        r = await fetch(WANDBOX + '/compile.json', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      } catch (e) {
        throw new Error('Wandbox に接続できません（インターネット接続を確認してください）。');
      }
      if (!r.ok) throw new Error('Wandbox のエラー: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
      const j = await r.json();
      const ms = performance.now() - t0;
      const ran = ('program_output' in j) || ('program_error' in j) || j.signal;
      const cerr = j.compiler_error || '';
      if (!ran && j.status !== '0' && cerr) {
        out.compileError = cerr;
        return out;
      }
      if (i === 0) out.compileWarn = cerr;
      const exitCode = Number(j.status || 0);
      let verdict = 'OK', note = '通信込み';
      if (j.signal) {
        verdict = /kill|xcpu/i.test(j.signal) ? 'TLE' : 'RE';
        note += ' / ' + j.signal;
      } else if (exitCode !== 0) verdict = 'RE';
      out.results.push({ stdout: j.program_output || '', stderr: j.program_error || '', exitCode, timeMs: ms, verdict, note });
    }
    return out;
  },

  // ---------------- Pyodide ----------------
  ensurePyWorker() {
    if (this.pyWorker) return this.pyWorker;
    const url = URL.createObjectURL(new Blob([PY_WORKER_SRC], { type: 'text/javascript' }));
    this.pyWorker = new Worker(url);
    this.pyReady = false;
    return this.pyWorker;
  },

  pyCall(msg, timeoutMs) {
    const w = this.ensurePyWorker();
    const id = ++this.pyMsgId;
    return new Promise((resolve, reject) => {
      let timer = null;
      const onMsg = (e) => {
        if (e.data.id !== id) return;
        cleanup();
        if (e.data.fatal) reject(new Error(e.data.fatal));
        else resolve(e.data);
      };
      const onErr = (e) => { cleanup(); this.killPy(); reject(new Error('Python 実行環境の読み込みに失敗しました: ' + (e.message || 'ネットワークを確認してください'))); };
      const cleanup = () => { clearTimeout(timer); w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      if (timeoutMs) timer = setTimeout(() => { cleanup(); this.killPy(); resolve({ timeout: true }); }, timeoutMs);
      w.postMessage({ id, ...msg });
    });
  },

  killPy() {
    if (this.pyWorker) this.pyWorker.terminate();
    this.pyWorker = null;
    this.pyReady = false;
  },

  async runPyodide(code, inputs, timeLimit, onProgress) {
    if (!this.pyReady) {
      onProgress && onProgress(-1);
      await this.pyCall({ type: 'init' }, 0);
      this.pyReady = true;
    }
    const out = { compileError: null, compileWarn: '', results: [] };
    for (let i = 0; i < inputs.length; i++) {
      onProgress && onProgress(i);
      // 時間制限 + 余裕 1 秒で打ち切り (打ち切ると環境の再読み込みが必要)
      const r = await this.pyCall({ type: 'run', code, stdin: inputs[i] }, timeLimit * 1000 + 1000);
      if (r.timeout) {
        out.results.push({ stdout: '', stderr: '', exitCode: -1, timeMs: timeLimit * 1000, verdict: 'TLE', note: '打ち切り' });
        if (i + 1 < inputs.length) { await this.pyCall({ type: 'init' }, 0); this.pyReady = true; }
        continue;
      }
      let verdict = r.exitCode !== 0 ? 'RE' : 'OK';
      if (verdict === 'OK' && r.timeMs > timeLimit * 1000) verdict = 'TLE';
      out.results.push({ stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, timeMs: r.timeMs, verdict, note: 'ブラウザ内' });
    }
    return out;
  },
};

/** 出力の比較 (行末空白・末尾改行は無視。tol>0 なら数値は誤差許容) */
function judgeOutput(actual, expected, tol) {
  const norm = s => s.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
  const a = norm(actual), e = norm(expected);
  if (a === e) return true;
  if (!tol) return false;
  const ta = a.split(/\s+/).filter(Boolean), te = e.split(/\s+/).filter(Boolean);
  if (ta.length !== te.length) return false;
  for (let i = 0; i < ta.length; i++) {
    if (ta[i] === te[i]) continue;
    const x = Number(ta[i]), y = Number(te[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const d = Math.abs(x - y);
    if (d > tol && d > tol * Math.abs(y)) return false;
  }
  return true;
}
