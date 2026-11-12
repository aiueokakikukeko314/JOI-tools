'use strict';
/*
 * 軽量コードエディタ。
 * textarea (入力) の後ろに色付けした <pre> を重ねる方式。外部ライブラリ不要。
 * 機能: 行番号 / シンタックスハイライト (C++, Python) / 自動インデント /
 *       括弧の自動補完 / Tab・Shift+Tab 字下げ / Ctrl+/ コメント切替
 */

const CPP_KW = new Set(('alignas alignof and asm auto break case catch class const constexpr const_cast continue ' +
  'decltype default delete do dynamic_cast else enum explicit export extern false for friend goto if inline ' +
  'mutable namespace new noexcept not nullptr operator or private protected public register reinterpret_cast ' +
  'return sizeof static static_assert static_cast struct switch template this throw true try typedef typeid ' +
  'typename union using virtual volatile while xor concept requires co_await co_return co_yield').split(' '));
const CPP_TYPES = new Set(('int long short char bool float double void unsigned signed size_t string vector ' +
  'map set multiset unordered_map unordered_set pair tuple queue priority_queue deque stack array bitset ' +
  'll ull ld pii pll vi vll vvi vvl P greater less std cin cout cerr endl int64_t uint64_t int32_t __int128 ' +
  'istream ostream function iota sort').split(' '));
const PY_KW = new Set(('False None True and as assert async await break class continue def del elif else except ' +
  'finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case').split(' '));
const PY_BUILTIN = new Set(('int str float list dict set tuple range len print input map sorted sum min max abs ' +
  'enumerate zip open sys reversed any all bool pow divmod ord chr bin hex iter next object super isinstance ' +
  'deque defaultdict Counter heapq bisect heappush heappop bisect_left bisect_right math itertools functools ' +
  'lru_cache cache accumulate permutations combinations product').split(' '));

const CPP_RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(^[ \t]*#[^\n]*)|(\b(?:0[xX][0-9a-fA-F']+|\d[\d']*\.?\d*(?:[eE][+-]?\d+)?)[uUlLfF]*\b)|([A-Za-z_]\w*)/gm;
const PY_RE = /(#[^\n]*)|("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|[rbfuRBFU]{0,2}"(?:\\.|[^"\\\n])*"?|[rbfuRBFU]{0,2}'(?:\\.|[^'\\\n])*'?)|(^[ \t]*@[\w.]+)|(\b\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?j?\b)|([A-Za-z_]\w*)/gm;

function highlight(code, lang) {
  const re = lang === 'python' ? PY_RE : CPP_RE;
  const kw = lang === 'python' ? PY_KW : CPP_KW;
  const types = lang === 'python' ? PY_BUILTIN : CPP_TYPES;
  re.lastIndex = 0;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    if (m[0] === '') { re.lastIndex++; continue; }
    out += escapeHtml(code.slice(last, m.index));
    const t = escapeHtml(m[0]);
    let cls = null;
    if (m[1]) cls = 'com';
    else if (m[2]) cls = 'str';
    else if (m[3]) cls = 'pre';
    else if (m[4]) cls = 'num';
    else if (m[5]) {
      if (kw.has(m[5])) cls = 'kw';
      else if (types.has(m[5])) cls = 'type';
      else if (code[re.lastIndex] === '(') cls = 'fn';
    }
    out += cls ? `<span class="tk-${cls}">${t}</span>` : t;
    last = re.lastIndex;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
const CLOSERS = new Set([')', ']', '}']);

class CodeEditor {
  constructor(host, opts = {}) {
    this.lang = opts.lang || 'cpp';
    this.unit = '    ';
    this.onChange = opts.onChange || (() => {});
    this.onRun = opts.onRun || (() => {});
    this.onCursor = opts.onCursor || (() => {});
    host.innerHTML = `
      <div class="ed">
        <div class="ed-gutter"><pre></pre></div>
        <div class="ed-body">
          <pre class="ed-hl" aria-hidden="true"><code></code></pre>
          <textarea class="ed-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="コードエディタ"></textarea>
        </div>
      </div>`;
    this.root = host.firstElementChild;
    this.ta = $('.ed-input', this.root);
    this.code = $('.ed-hl code', this.root);
    this.gutter = $('.ed-gutter pre', this.root);
    this.lineCount = -1;
    this.curLine = -1;
    this.raf = 0;

    this.ta.value = opts.value || '';
    this.ta.addEventListener('input', () => { this.schedule(); this.onChange(this.ta.value); });
    this.ta.addEventListener('scroll', () => this.syncScroll());
    this.ta.addEventListener('keydown', e => this.onKeyDown(e));
    const cur = () => this.updateCursor();
    this.ta.addEventListener('keyup', cur);
    this.ta.addEventListener('click', cur);
    this.ta.addEventListener('select', cur);
    this.render();
  }

  getValue() { return this.ta.value; }
  setValue(v) { this.ta.value = v; this.render(); this.ta.scrollTop = 0; this.syncScroll(); }
  setLang(l) { this.lang = l; this.render(); }
  focus() { this.ta.focus(); }
  setFontSize(px) { this.root.style.setProperty('--ed-font', px + 'px'); this.syncScroll(); }

  schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  render() {
    const v = this.ta.value;
    this.code.innerHTML = highlight(v, this.lang) + '\n';
    const n = v.split('\n').length;
    if (n !== this.lineCount) { this.lineCount = n; this.curLine = -1; }
    this.updateCursor(true);
    this.syncScroll();
  }

  updateCursor(force) {
    const v = this.ta.value, s = this.ta.selectionStart;
    let line = 1, lastNl = -1;
    for (let i = 0; i < s; i++) if (v.charCodeAt(i) === 10) { line++; lastNl = i; }
    const col = s - lastNl;
    if (force || line !== this.curLine) {
      this.curLine = line;
      let g = '';
      for (let i = 1; i <= this.lineCount; i++) g += (i === line ? `<span class="cur">${i}</span>` : i) + '\n';
      this.gutter.innerHTML = g;
    }
    this.onCursor(line, col);
  }

  syncScroll() {
    const { scrollTop: t, scrollLeft: l } = this.ta;
    this.code.style.transform = `translate(${-l}px, ${-t}px)`;
    this.gutter.style.transform = `translateY(${-t}px)`;
  }

  /** [start,end) を text で置き換える。Ctrl+Z で戻せるよう execCommand を優先 */
  replace(start, end, text, selStart, selEnd) {
    const ta = this.ta;
    ta.focus();
    ta.setSelectionRange(start, end);
    let ok = false;
    try { ok = text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok || ta.value.slice(start, start + text.length) !== text) {
      ta.setRangeText(text, start, end, 'end');
      ta.dispatchEvent(new Event('input'));
    }
    const a = selStart ?? start + text.length;
    ta.setSelectionRange(a, selEnd ?? a);
    this.updateCursor();
  }

  /** カーソル位置にスニペットを挿入 (2行目以降は現在行のインデントを付与) */
  insertSnippet(text) {
    const v = this.ta.value, s = this.ta.selectionStart, e = this.ta.selectionEnd;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    const indent = v.slice(ls, s).match(/^[ \t]*/)[0];
    const atLineStart = v.slice(ls, s).trim() === '';
    let t = text.replace(/\n/g, '\n' + indent);
    if (atLineStart) t = t.replace(/^[ \t]*/, '');
    if (!t.endsWith('\n') && v[e] !== undefined && v[e] !== '\n') t += '\n';
    this.replace(s, e, t);
  }

  lineRange() {
    const v = this.ta.value;
    const s = this.ta.selectionStart;
    let e = this.ta.selectionEnd;
    if (e > s && v[e - 1] === '\n') e--;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let le = v.indexOf('\n', e);
    if (le < 0) le = v.length;
    return [ls, le];
  }

  indentLines() {
    const [ls, le] = this.lineRange();
    const block = this.ta.value.slice(ls, le);
    const out = block.split('\n').map(l => (l.length ? this.unit + l : l)).join('\n');
    this.replace(ls, le, out, ls, ls + out.length);
  }

  dedentLines() {
    const [ls, le] = this.lineRange();
    const s0 = this.ta.selectionStart, e0 = this.ta.selectionEnd;
    const block = this.ta.value.slice(ls, le);
    const re = new RegExp('^( {1,' + this.unit.length + '}|\\t)');
    const out = block.split('\n').map(l => l.replace(re, '')).join('\n');
    if (out === block) return;
    if (s0 === e0) {
      const removed = block.length - out.length;
      const pos = Math.max(ls, s0 - removed);
      this.replace(ls, le, out, pos);
    } else {
      this.replace(ls, le, out, ls, ls + out.length);
    }
  }

  toggleComment() {
    const mark = this.lang === 'python' ? '#' : '//';
    const [ls, le] = this.lineRange();
    const lines = this.ta.value.slice(ls, le).split('\n');
    const nonEmpty = lines.filter(l => l.trim());
    if (!nonEmpty.length) return;
    const esc = mark.replace(/\//g, '\\/');
    const isCommented = nonEmpty.every(l => new RegExp('^\\s*' + esc).test(l));
    let out;
    if (isCommented) {
      out = lines.map(l => l.replace(new RegExp('^(\\s*)' + esc + ' ?'), '$1'));
    } else {
      const minIndent = Math.min(...nonEmpty.map(l => l.match(/^\s*/)[0].length));
      out = lines.map(l => (l.trim() ? l.slice(0, minIndent) + mark + ' ' + l.slice(minIndent) : l));
    }
    const text = out.join('\n');
    this.replace(ls, le, text, ls, ls + text.length);
  }

  onKeyDown(e) {
    if (e.isComposing || e.keyCode === 229) return;
    const ta = this.ta, v = ta.value;
    const s = ta.selectionStart, en = ta.selectionEnd;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key === 'Enter') { e.preventDefault(); this.onRun(); return; }
    if (mod && (e.key === '/' || e.code === 'Slash')) { e.preventDefault(); this.toggleComment(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); toast('自動保存されています'); return; }
    if (mod || e.altKey) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) this.dedentLines();
      else if (s !== en && v.slice(s, en).includes('\n')) this.indentLines();
      else {
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        const col = s - ls;
        const n = this.unit.length - (col % this.unit.length);
        this.replace(s, en, ' '.repeat(n));
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const lineBefore = v.slice(ls, s);
      const indent = lineBefore.match(/^[ \t]*/)[0];
      const trimmed = this.lang === 'python'
        ? lineBefore.replace(/#.*$/, '').trimEnd()
        : lineBefore.replace(/\/\/.*$/, '').trimEnd();
      const last = trimmed.slice(-1);
      const next = v[en];
      if (this.lang !== 'python' && PAIRS[last] && next === PAIRS[last] && CLOSERS.has(next)) {
        const mid = '\n' + indent + this.unit;
        this.replace(s, en, mid + '\n' + indent, s + mid.length);
        return;
      }
      let extra = '';
      let ind = indent;
      if (this.lang === 'python') {
        if (last === ':' || last === '(' || last === '[' || last === '{') extra = this.unit;
        else if (/^\s*(return|pass|break|continue|raise)\b/.test(lineBefore) && ind.length >= this.unit.length) {
          ind = ind.slice(this.unit.length);
        }
      } else if (last === '{' || last === '(' || last === '[') {
        extra = this.unit;
      }
      this.replace(s, en, '\n' + ind + extra);
      return;
    }

    if (e.key === 'Backspace' && s === en && s > 0) {
      const pair = v[s - 1] + (v[s] || '');
      if (['()', '[]', '{}', '""', "''"].includes(pair)) {
        e.preventDefault(); this.replace(s - 1, s + 1, ''); return;
      }
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const before = v.slice(ls, s);
      if (before.length && /^ +$/.test(before)) {
        e.preventDefault();
        const n = before.length % this.unit.length || this.unit.length;
        this.replace(s - n, s, '');
      }
      return;
    }

    // 閉じ括弧: 直後に同じ文字があれば飛び越える / 行頭なら字下げを戻す
    if (CLOSERS.has(e.key) || e.key === '"' || e.key === "'") {
      if (s === en && v[s] === e.key) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); this.updateCursor(); return; }
    }
    if (e.key === '}' && s === en && this.lang !== 'python') {
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const before = v.slice(ls, s);
      if (/^ +$/.test(before) && before.length >= this.unit.length) {
        e.preventDefault();
        this.replace(ls, s, before.slice(this.unit.length) + '}');
        return;
      }
    }

    // 開き括弧の自動補完
    if (PAIRS[e.key]) {
      const open = e.key, close = PAIRS[open];
      const prev = v[s - 1] || '';
      const next = v[en] || '';
      const isQuote = open === '"' || open === "'";
      if (s !== en) {
        e.preventDefault();
        const inner = v.slice(s, en);
        this.replace(s, en, open + inner + close, s + 1, s + 1 + inner.length);
        return;
      }
      const nextOk = next === '' || /[\s)\]};,]/.test(next);
      const prevOk = !isQuote || !/[\w"'\\]/.test(prev);
      if (nextOk && prevOk) {
        e.preventDefault();
        this.replace(s, en, open + close, s + 1);
      }
    }
  }
}
