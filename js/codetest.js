'use strict';
/* コードテスト画面: エディタ + テストケース + 判定 */

const SKELETONS = {
  cpp: `#include <bits/stdc++.h>
using namespace std;
using ll = long long;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int N;
    cin >> N;
    cout << N << "\\n";
    return 0;
}
`,
  python: `import sys
input = sys.stdin.readline  # 高速化。末尾の改行に注意 (split() / strip() で消える)


def main():
    N = int(input())
    print(N)


main()
`,
};

const CodeTest = {
  state: null,
  editor: null,
  running: false,
  results: {}, // caseId -> {status, timeMs, note, stdout, stderr}

  init() {
    const def = {
      lang: 'cpp', std: 'gnu++17', backend: 'auto', tl: 2, font: 14, floatTol: false, left: null,
      codes: { cpp: SKELETONS.cpp, python: SKELETONS.python },
      cases: [{ id: uid(), input: '', expected: '' }],
    };
    this.state = Object.assign(def, Store.get('code', {}));
    if (!this.state.cases.length) this.state.cases.push({ id: uid(), input: '', expected: '' });
    this.save = debounce(() => Store.set('code', this.state), 300);

    const s = this.state;
    this.editor = new CodeEditor($('#editorHost'), {
      lang: s.lang,
      value: s.codes[s.lang] ?? SKELETONS[s.lang],
      onChange: v => { s.codes[s.lang] = v; this.save(); },
      onRun: () => this.runAll(),
      onCursor: (l, c) => { $('#cursorPos').textContent = `${l} 行, ${c} 列`; },
    });
    this.editor.setFontSize(s.font);

    $('#langSel').value = s.lang;
    $('#stdSel').value = s.std;
    $('#backendSel').value = s.backend;
    $('#tlInput').value = s.tl;
    $('#floatTol').checked = s.floatTol;
    if (s.left) $('#codeLayout').style.setProperty('--code-left', s.left);
    this.syncLangUi();

    $('#langSel').addEventListener('change', e => {
      s.lang = e.target.value;
      this.editor.setLang(s.lang);
      this.editor.setValue(s.codes[s.lang] ?? SKELETONS[s.lang]);
      this.syncLangUi(); this.save();
    });
    $('#stdSel').addEventListener('change', e => { s.std = e.target.value; this.save(); });
    $('#backendSel').addEventListener('change', e => { s.backend = e.target.value; this.updateBackendStatus(); this.save(); });
    $('#tlInput').addEventListener('change', e => { s.tl = Math.max(0.5, Math.min(20, +e.target.value || 2)); e.target.value = s.tl; this.save(); });
    $('#floatTol').addEventListener('change', e => { s.floatTol = e.target.checked; this.save(); this.rejudge(); });
    $('#fontDec').addEventListener('click', () => this.setFont(s.font - 1));
    $('#fontInc').addEventListener('click', () => this.setFont(s.font + 1));
    $('#skeletonBtn').addEventListener('click', async () => {
      if (await confirmBox('ひな形に置き換えますか？', '現在のコードは消えます（Ctrl+Z で戻せます）。', '置き換える')) {
        this.editor.replace(0, this.editor.getValue().length, SKELETONS[s.lang], 0);
      }
    });
    $('#runAllBtn').addEventListener('click', () => this.runAll());
    $('#addCaseBtn').addEventListener('click', () => { s.cases.push({ id: uid(), input: '', expected: '' }); this.renderCases(); this.save(); $$('#caseList .case textarea.in').pop().focus(); });
    $('#clearCasesBtn').addEventListener('click', async () => {
      if (!(await confirmBox('テストケースを全て削除しますか？'))) return;
      s.cases = [{ id: uid(), input: '', expected: '' }]; this.results = {}; this.renderCases(); this.save();
    });
    $('#pasteSampleBtn').addEventListener('click', () => this.pasteSamples());
    this.initSplitter();
    this.renderCases();
    Runner.detectLocal().then(() => this.updateBackendStatus());
  },

  setFont(px) {
    this.state.font = Math.max(10, Math.min(28, px));
    this.editor.setFontSize(this.state.font);
    this.save();
  },

  syncLangUi() {
    $('#stdSel').hidden = this.state.lang !== 'cpp';
    this.updateBackendStatus();
  },

  updateBackendStatus() {
    const s = this.state;
    const b = Runner.resolve(s.backend, s.lang);
    let msg = '実行環境: ' + Runner.label(b);
    if (b === 'local' && Runner.local) msg += ` (${s.lang === 'cpp' ? Runner.local.cpp || 'g++ が見つかりません' : Runner.local.python})`;
    if (b === 'local' && !Runner.local) msg += ' — 未接続（server.py を起動して http://localhost:8000 を開いてください）';
    if (b === 'wandbox') msg += ' — インターネット経由・時間は通信込み';
    if (b === 'pyodide') msg += s.lang === 'python' ? ' — 初回のみ読み込みに数秒' : ' — ※C++ は非対応';
    $('#backendStatus').textContent = msg;
  },

  initSplitter() {
    const sp = $('#codeSplitter'), lay = $('#codeLayout');
    sp.addEventListener('pointerdown', e => {
      e.preventDefault();
      sp.setPointerCapture(e.pointerId);
      sp.classList.add('drag');
      const rect = lay.getBoundingClientRect();
      const move = ev => {
        const p = Math.max(20, Math.min(80, (ev.clientX - rect.left) / rect.width * 100));
        lay.style.setProperty('--code-left', p.toFixed(1) + '%');
      };
      const up = () => {
        sp.classList.remove('drag');
        sp.removeEventListener('pointermove', move);
        sp.removeEventListener('pointerup', up);
        this.state.left = lay.style.getPropertyValue('--code-left');
        this.save();
      };
      sp.addEventListener('pointermove', move);
      sp.addEventListener('pointerup', up);
    });
  },

  // ---------------- テストケース ----------------
  renderCases() {
    const list = $('#caseList');
    list.innerHTML = '';
    this.state.cases.forEach((c, i) => list.appendChild(this.caseEl(c, i)));
    this.updateSummary();
  },

  caseEl(c, i) {
    const el = document.createElement('div');
    el.className = 'case';
    el.dataset.id = c.id;
    el.innerHTML = `
      <div class="case-head">
        <button class="fold" title="折りたたみ">▾</button>
        <span class="title">ケース ${i + 1}</span>
        <span class="badge">未実行</span>
        <span class="time"></span>
        <span class="spacer"></span>
        <button class="run" title="このケースだけ実行">▶ 実行</button>
        <button class="dup" title="複製">複製</button>
        <button class="del" title="削除">✕</button>
      </div>
      <div class="case-body">
        <div><div class="field-label">入力</div><textarea class="in" spellcheck="false" wrap="off"></textarea></div>
        <div><div class="field-label">期待される出力 <span>（空なら比較しない）</span></div><textarea class="exp" spellcheck="false" wrap="off"></textarea></div>
        <div class="full result" hidden>
          <div class="field-label">実際の出力 <button class="copy-out">コピー</button><button class="to-exp" title="この出力を期待出力に設定">期待出力にする</button></div>
          <pre class="out stdout"></pre>
          <div class="errwrap" hidden><div class="field-label">標準エラー出力 / メッセージ</div><pre class="out err"></pre></div>
        </div>
      </div>`;
    const inp = $('.in', el), exp = $('.exp', el);
    inp.value = c.input; exp.value = c.expected;
    inp.addEventListener('input', () => { c.input = inp.value; this.save(); });
    exp.addEventListener('input', () => { c.expected = exp.value; this.save(); this.rejudge(c.id); });
    for (const ta of [inp, exp]) {
      ta.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.runAll(); }
      });
    }
    $('.fold', el).addEventListener('click', () => { el.classList.toggle('collapsed'); $('.fold', el).textContent = el.classList.contains('collapsed') ? '▸' : '▾'; });
    $('.run', el).addEventListener('click', () => this.runCases([c]));
    $('.dup', el).addEventListener('click', () => {
      const idx = this.state.cases.indexOf(c);
      this.state.cases.splice(idx + 1, 0, { id: uid(), input: c.input, expected: c.expected });
      this.renderCases(); this.save();
    });
    $('.del', el).addEventListener('click', () => {
      this.state.cases = this.state.cases.filter(x => x !== c);
      if (!this.state.cases.length) this.state.cases.push({ id: uid(), input: '', expected: '' });
      delete this.results[c.id];
      this.renderCases(); this.save();
    });
    $('.copy-out', el).addEventListener('click', () => copyText((this.results[c.id] || {}).stdout || ''));
    $('.to-exp', el).addEventListener('click', () => {
      const r = this.results[c.id]; if (!r) return;
      exp.value = c.expected = r.stdout; this.save(); this.rejudge(c.id);
    });
    if (this.results[c.id]) this.paintResult(el, c);
    return el;
  },

  paintResult(el, c) {
    const r = this.results[c.id];
    const badge = $('.badge', el);
    el.classList.remove('st-AC', 'st-WA', 'st-RE', 'st-TLE', 'st-CE');
    if (!r) { badge.className = 'badge'; badge.textContent = '未実行'; $('.time', el).textContent = ''; $('.result', el).hidden = true; return; }
    const label = { AC: 'AC', WA: 'WA', RE: 'RE', TLE: 'TLE', CE: 'CE', DONE: '実行済', RUN: '実行中…' }[r.status] || r.status;
    badge.className = 'badge ' + r.status;
    badge.textContent = label;
    el.classList.add('st-' + r.status);
    $('.time', el).textContent = r.timeMs != null ? `${Math.round(r.timeMs)} ms${r.note ? ' (' + r.note + ')' : ''}` : '';
    if (r.status === 'RUN') return;
    $('.result', el).hidden = r.status === 'CE';
    const outEl = $('.stdout', el);
    if (r.status === 'WA') {
      const norm = s => s.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.replace(/\s+$/, ''));
      const a = norm(r.stdout), e = norm(c.expected);
      outEl.innerHTML = a.map((l, i) => {
        const h = escapeHtml(l) || ' ';
        return l !== (e[i] ?? null) ? `<span class="ln-bad" title="期待: ${escapeHtml(e[i] ?? '(行なし)')}">${h}</span>` : h;
      }).join('\n') + (e.length > a.length ? `\n<span class="ln-bad">(… 期待出力はあと ${e.length - a.length} 行あります)</span>` : '');
    } else {
      outEl.textContent = r.stdout || '';
    }
    const msgs = [];
    if (r.stderr) msgs.push(r.stderr.replace(/\n+$/, ''));
    if (r.status === 'RE') msgs.push(`終了コード: ${r.exitCode}`);
    if (r.status === 'TLE') msgs.push(`時間制限 ${this.state.tl} 秒を超えました`);
    $('.errwrap', el).hidden = !msgs.length;
    $('.err', el).textContent = msgs.join('\n');
  },

  statusFor(c, res) {
    if (res.verdict === 'TLE') return 'TLE';
    if (res.verdict === 'RE') return 'RE';
    if (!c.expected.trim()) return 'DONE';
    return judgeOutput(res.stdout, c.expected, this.state.floatTol ? 1e-6 : 0) ? 'AC' : 'WA';
  },

  rejudge(onlyId) {
    for (const c of this.state.cases) {
      if (onlyId && c.id !== onlyId) continue;
      const r = this.results[c.id];
      if (!r || !r.raw) continue;
      r.status = this.statusFor(c, r.raw);
      const el = $(`.case[data-id="${c.id}"]`);
      if (el) this.paintResult(el, c);
    }
    this.updateSummary();
  },

  updateSummary() {
    const cases = this.state.cases;
    const rs = cases.map(c => this.results[c.id]).filter(Boolean);
    const sum = $('#caseSummary');
    if (!rs.length) { sum.textContent = `${cases.length} 件`; sum.className = 'summary'; return; }
    const judged = rs.filter(r => r.status !== 'DONE' && r.status !== 'RUN');
    const ac = judged.filter(r => r.status === 'AC').length;
    const bad = judged.length - ac;
    sum.textContent = judged.length ? `${ac} / ${judged.length} AC` + (bad ? `（${bad} 件 NG）` : '') : `${cases.length} 件`;
    sum.className = 'summary ' + (judged.length && !bad ? 'ok' : bad ? 'ng' : '');
  },

  runAll() { return this.runCases(this.state.cases); },

  async runCases(cases) {
    if (this.running) { toast('実行中です…'); return; }
    if (!cases.length) return;
    const s = this.state;
    this.running = true;
    $('#runAllBtn').disabled = true;
    const cm = $('#compileMsg');
    cm.hidden = true;
    for (const c of cases) {
      this.results[c.id] = { status: 'RUN' };
      const el = $(`.case[data-id="${c.id}"]`);
      if (el) this.paintResult(el, c);
    }
    const t0 = performance.now();
    try {
      const out = await Runner.run({
        backend: s.backend, lang: s.lang, code: this.editor.getValue(), std: s.std,
        inputs: cases.map(c => c.input), timeLimit: s.tl,
        onProgress: i => {
          if (i < 0) $('#backendStatus').textContent = 'Python 実行環境を読み込み中…（初回のみ）';
          else if (cases.length > 1) $('#backendStatus').textContent = `実行中… ${i + 1} / ${cases.length}`;
        },
      });
      if (out.compileError) {
        cm.hidden = false; cm.className = 'compile-msg err';
        cm.textContent = 'コンパイルエラー\n\n' + out.compileError;
        for (const c of cases) this.results[c.id] = { status: 'CE' };
      } else {
        if (out.compileWarn && out.compileWarn.trim()) {
          cm.hidden = false; cm.className = 'compile-msg';
          cm.textContent = '警告\n\n' + out.compileWarn;
        }
        cases.forEach((c, i) => {
          const r = out.results[i];
          this.results[c.id] = { raw: r, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, timeMs: r.timeMs, note: r.note, status: this.statusFor(c, r) };
        });
      }
    } catch (e) {
      cm.hidden = false; cm.className = 'compile-msg err';
      cm.textContent = String(e.message || e);
      for (const c of cases) delete this.results[c.id];
    } finally {
      this.running = false;
      $('#runAllBtn').disabled = false;
      this.updateBackendStatus();
      for (const c of cases) {
        const el = $(`.case[data-id="${c.id}"]`);
        if (el) this.paintResult(el, c);
      }
      this.updateSummary();
      const total = performance.now() - t0;
      const rs = cases.map(c => this.results[c.id]).filter(Boolean);
      if (rs.length && rs.every(r => r.status === 'AC')) toast(`全て AC 🎉 (${Math.round(total)} ms)`);
    }
  },

  // ---------------- サンプル貼り付け ----------------
  async pasteSamples() {
    const r = await dialog({
      title: 'サンプルを貼り付け',
      desc: '問題文の「入力例 1 … 出力例 1 …」の部分をそのまま貼り付けてください（複数可）。見出しがなければ全体を 1 つの入力として追加します。',
      text: '',
      placeholder: '入力例 1\n3\n1 2 3\n\n出力例 1\n6\n\n入力例 2\n…',
      ok: '追加', alt: '置き換え',
    });
    if (r.action === 'cancel' || !r.value.trim()) return;
    const found = parseSamples(r.value);
    if (!found.length) { toast('サンプルが見つかりませんでした'); return; }
    const newCases = found.map(f => ({ id: uid(), input: f.input, expected: f.output }));
    if (r.action === 'alt') { this.state.cases = newCases; this.results = {}; }
    else {
      // 空のケースしかない場合は置き換え
      const nonEmpty = this.state.cases.filter(c => c.input.trim() || c.expected.trim());
      this.state.cases = nonEmpty.concat(newCases);
    }
    this.renderCases(); this.save();
    toast(`${found.length} 件のサンプルを取り込みました`);
  },
};

/** 問題文テキストから入出力例を抜き出す */
function parseSamples(text) {
  text = text.replace(/\r\n?/g, '\n');
  const re = /^[ \t]*(?:#+\s*)?(入力例|出力例|サンプル入力|サンプル出力|Sample\s*Input|Sample\s*Output|Input\s*Example|Output\s*Example|Example\s*Input|Example\s*Output)\s*#?\s*(\d*)[ \t]*[:：]?[ \t]*(?:Copy|コピー)?[ \t]*$/gim;
  const marks = [];
  let m;
  while ((m = re.exec(text))) {
    const kind = /入力|input/i.test(m[1]) ? 'in' : 'out';
    marks.push({ kind, num: m[2] ? +m[2] : null, start: m.index, end: m.index + m[0].length });
  }
  if (!marks.length) return [{ input: text.replace(/^\n+/, '').replace(/\s+$/, '') + '\n', output: '' }];

  const clean = (body) => {
    const lines = body.split('\n').filter(l => !/^\s*(Copy|コピー)\s*$/i.test(l));
    while (lines.length && !lines[0].trim()) lines.shift();
    // 最初の空行以降は解説文とみなして捨てる
    const blank = lines.findIndex(l => !l.trim());
    const keep = blank >= 0 ? lines.slice(0, blank) : lines;
    const s = keep.map(l => l.replace(/\s+$/, '')).join('\n');
    return s ? s + '\n' : '';
  };

  const byNum = new Map();
  let auto = 0;
  marks.forEach((mk, i) => {
    const body = clean(text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : text.length));
    let key = mk.num;
    if (key == null) key = mk.kind === 'in' ? ++auto : auto;
    if (!byNum.has(key)) byNum.set(key, { input: '', output: '' });
    byNum.get(key)[mk.kind === 'in' ? 'input' : 'output'] = body;
  });
  return [...byNum.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]).filter(x => x.input || x.output);
}
