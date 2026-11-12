'use strict';
/* 手順: アルゴリズムの手順を番号付きアウトラインで整理 + 計算量チェッカー */

// [テキスト, 字下げ, 計算量]
const ALGO_TEMPLATES = {
  '考察の進め方 (JOI)': [
    ['問題文を読み、入力・出力・制約を確認する', 0],
    ['小課題 (部分点) ごとの制約を整理する', 0],
    ['サンプルを手で解いて、何を求めるか確かめる', 0],
    ['愚直解 (全探索) を考え、計算量を見積もる', 0],
    ['制約に間に合う解法を考える', 0],
    ['何を固定するか / 何を状態にするか / 単調性はあるか', 1],
    ['実装する', 0],
    ['サンプルで確認する', 0],
    ['コーナーケースを確認する (N=1, 最大ケース, オーバーフロー, 0 や負の値)', 0],
  ],
  'BFS (幅優先探索・最短距離)': [
    ['グラフを隣接リストで受け取る', 0, 'O(N + M)'],
    ['dist を -1 (未訪問) で初期化し、dist[s] = 0 としてキューに s を入れる', 0],
    ['キューが空になるまで繰り返す', 0, 'O(N + M)'],
    ['先頭の頂点 v を取り出す', 1],
    ['v に隣接する u について、dist[u] == -1 なら dist[u] = dist[v] + 1 としてキューに入れる', 1],
    ['dist[t] を出力する (-1 なら到達不可能)', 0],
  ],
  'DFS (深さ優先探索)': [
    ['グラフを隣接リストで受け取る', 0],
    ['visited 配列を false で初期化する', 0],
    ['dfs(v): visited[v] = true にし、未訪問の隣接頂点 u に対して dfs(u) を呼ぶ', 0, 'O(N + M)'],
    ['必要なら行きがけ / 帰りがけで値を計算する (部分木のサイズなど)', 1],
    ['再帰が深くなる場合はスタックを使うか、再帰上限に注意する', 0],
  ],
  'ダイクストラ法': [
    ['重み付きグラフを隣接リストで受け取る (重みは非負)', 0],
    ['dist を INF で初期化し、dist[s] = 0', 0],
    ['優先度付きキューに (0, s) を入れる', 0],
    ['キューが空になるまで繰り返す', 0, 'O((N + M) log N)'],
    ['最小の (d, v) を取り出し、d > dist[v] なら飛ばす', 1],
    ['各辺 (v, u, w) について dist[v] + w < dist[u] なら更新してキューに入れる', 1],
    ['dist を出力する', 0],
  ],
  '二分探索 (答えで二分探索)': [
    ['「答えが x 以下にできるか？」を判定する関数 check(x) を作る', 0, 'O(N)'],
    ['check の単調性を確認する (x が大きいほど true になりやすい)', 0],
    ['ng = (必ず false), ok = (必ず true) を決める', 0],
    ['ok - ng > 1 の間、mid = (ok + ng) / 2 で check して範囲を半分にする', 0, 'O(log V)'],
    ['ok を出力する', 0],
  ],
  '動的計画法 (DP)': [
    ['状態を定義する: dp[i][j] = 「…のときの最大値 / 通り数」', 0],
    ['初期値を決める (dp[0][0] = 0, それ以外は -INF や 0)', 0],
    ['遷移を書く: dp[i+1][?] ← dp[i][j] から', 0],
    ['計算する順番を決める (i の小さい順など)', 0],
    ['答えがどの dp の値か確認する', 0],
    ['計算量 = 状態数 × 遷移の数 を見積もる', 0],
    ['表タブで小さいケースの表を手で書いて確かめる', 0],
  ],
  '累積和': [
    ['S[0] = 0, S[i+1] = S[i] + A[i] を計算する', 0, 'O(N)'],
    ['区間 [l, r) の和は S[r] - S[l]', 0, 'O(1)'],
    ['2 次元なら S[i+1][j+1] = S[i][j+1] + S[i+1][j] - S[i][j] + A[i][j]', 0],
  ],
  'しゃくとり法 (尺取り法)': [
    ['左端 l と右端 r を 0 から始める', 0],
    ['l を 0 から N-1 まで動かす', 0, 'O(N)'],
    ['条件を満たす間 r を進める', 1],
    ['区間 [l, r) について答えを更新する', 1],
    ['l を進める前に A[l] を区間から取り除く', 1],
  ],
  'Union-Find': [
    ['parent[i] = i (各要素が別グループ) で初期化する', 0],
    ['find(x): 根を返す (経路圧縮)', 0, 'O(α(N))'],
    ['unite(a, b): 根どうしをつなぐ (サイズの小さい方を下に)', 0],
    ['same(a, b): find(a) == find(b)', 0],
  ],
  'bit 全探索': [
    ['mask を 0 から 2^N - 1 まで回す', 0, 'O(2^N)'],
    ['i 番目のビットが立っていれば i を選ぶ', 1, 'O(N)'],
    ['選んだものが条件を満たすか確認し、答えを更新する', 1],
  ],
  '貪欲法': [
    ['何を基準に選ぶか決める (締め切り順、小さい順など)', 0],
    ['ソートする', 0, 'O(N log N)'],
    ['順に見て、選べるなら選ぶ', 0, 'O(N)'],
    ['正しさを確認する (交換しても悪くならないか / 反例はないか)', 0],
  ],
  '座標圧縮': [
    ['値をすべて集めてソートし、重複を除く', 0, 'O(N log N)'],
    ['各値を lower_bound で番号 (0, 1, 2, …) に置き換える', 0, 'O(N log N)'],
  ],
};

const CX_LIST = [
  ['O(1)', n => 0],
  ['O(log N)', n => Math.log10(Math.max(1, Math.log2(n)))],
  ['O(√N)', n => 0.5 * Math.log10(n)],
  ['O(N)', n => Math.log10(n)],
  ['O(N log N)', n => Math.log10(n) + Math.log10(Math.max(1, Math.log2(n)))],
  ['O(N log² N)', n => Math.log10(n) + 2 * Math.log10(Math.max(1, Math.log2(n)))],
  ['O(N√N)', n => 1.5 * Math.log10(n)],
  ['O(N²)', n => 2 * Math.log10(n)],
  ['O(N² log N)', n => 2 * Math.log10(n) + Math.log10(Math.max(1, Math.log2(n)))],
  ['O(N³)', n => 3 * Math.log10(n)],
  ['O(2^N)', n => n * Math.log10(2)],
  ['O(N·2^N)', n => n * Math.log10(2) + Math.log10(n)],
  ['O(N!)', n => logFactorial10(n)],
];

function logFactorial10(n) {
  if (n <= 1) return 0;
  if (n < 1000) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log10(i); return s; }
  return (n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n)) / Math.LN10; // Stirling
}

function fmtPow10(l) {
  if (!Number.isFinite(l)) return '∞';
  if (l < 6) return Math.round(Math.pow(10, l)).toLocaleString();
  if (l > 1e6) return '10^' + Math.round(l).toExponential(1);
  let e = Math.floor(l), m = Math.pow(10, l - e);
  if (m.toFixed(1) === '10.0') { m = 1; e++; }
  return `${m.toFixed(1)}×10^${e}`;
}

const Algo = {
  state: null,

  init() {
    const p = this.newPlan('問題 1');
    this.state = Object.assign({ plans: [p], cur: p.id }, Store.get('algo', {}));
    if (!this.state.plans.length) this.state.plans.push(this.newPlan('問題 1'));
    this.save = debounce(() => Store.set('algo', this.state), 300);

    const tplSel = $('#algoTplSel');
    for (const name of Object.keys(ALGO_TEMPLATES)) {
      const o = document.createElement('option'); o.value = name; o.textContent = name; tplSel.appendChild(o);
    }
    tplSel.addEventListener('change', () => {
      const name = tplSel.value; tplSel.value = '';
      if (!name) return;
      const plan = this.plan();
      const isEmpty = plan.steps.length === 1 && !plan.steps[0].text.trim();
      const add = ALGO_TEMPLATES[name].map(([text, level, cx]) => ({ id: uid(), text, level, cx: cx || '', done: false }));
      plan.steps = isEmpty ? add : plan.steps.concat(add);
      this.render(); this.save();
      toast(`「${name}」の手順を追加しました`);
    });

    $('#planSel').addEventListener('change', e => { this.state.cur = e.target.value; this.render(); this.save(); });
    $('#planNew').addEventListener('click', async () => {
      const n = await askText('手順メモの名前', '問題 ' + (this.state.plans.length + 1));
      if (!n) return;
      const np = this.newPlan(n); this.state.plans.push(np); this.state.cur = np.id; this.render(); this.save();
    });
    $('#planRename').addEventListener('click', async () => {
      const n = await askText('名前', this.plan().name);
      if (n) { this.plan().name = n; this.render(); this.save(); }
    });
    $('#planDelete').addEventListener('click', async () => {
      if (!(await confirmBox(`「${this.plan().name}」を削除しますか？`, '', '削除'))) return;
      this.state.plans = this.state.plans.filter(x => x.id !== this.state.cur);
      if (!this.state.plans.length) this.state.plans.push(this.newPlan('問題 1'));
      this.state.cur = this.state.plans[0].id; this.render(); this.save();
    });
    $('#stepAdd').addEventListener('click', () => {
      const steps = this.plan().steps;
      const last = steps[steps.length - 1];
      this.insertAfter(steps.length - 1, last ? last.level : 0);
    });
    $('#stepsCopy').addEventListener('click', () => copyText(this.toText('')));
    $('#stepsToCode').addEventListener('click', () => {
      const mark = CodeTest.state.lang === 'python' ? '# ' : '// ';
      App.insertCode(this.toText(mark) + '\n');
    });

    $('#cxN').addEventListener('input', () => this.renderCx());
    $('#cxTL').addEventListener('input', () => this.renderCx());
    this.render();
    this.renderCx();
  },

  newPlan(name) { return { id: uid(), name, steps: [{ id: uid(), text: '', level: 0, cx: '', done: false }] }; },
  plan() { return this.state.plans.find(p => p.id === this.state.cur) || this.state.plans[0]; },

  numbers(steps) {
    const cnt = [];
    let prev = -1;
    return steps.map(s => {
      const L = Math.min(s.level, prev + 1);
      s.level = Math.max(0, L);
      cnt.length = s.level + 1;
      for (let i = 0; i < s.level; i++) if (!cnt[i]) cnt[i] = 1;
      cnt[s.level] = (cnt[s.level] || 0) + 1;
      prev = s.level;
      return cnt.join('.');
    });
  },

  toText(mark) {
    const steps = this.plan().steps.filter(s => s.text.trim());
    const nums = this.numbers(steps);
    return steps.map((s, i) => `${mark}${'  '.repeat(s.level)}${nums[i]}. ${s.text.trim()}${s.cx ? `  [${s.cx}]` : ''}`).join('\n');
  },

  render(focus) {
    const plan = this.plan();
    $('#planSel').innerHTML = this.state.plans.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    $('#planSel').value = plan.id;
    const nums = this.numbers(plan.steps);
    const list = $('#stepList');
    list.innerHTML = '';
    plan.steps.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'step' + (s.done ? ' done' : '');
      el.style.paddingLeft = (4 + s.level * 28) + 'px';
      el.innerHTML = `
        <input type="checkbox" class="chk" title="実装済み">
        <span class="num">${nums[i]}.</span>
        <textarea class="txt" rows="1" placeholder="手順を入力…" spellcheck="false"></textarea>
        <input class="cx" placeholder="計算量 O(…)" title="この手順の計算量">
        <span class="ops">
          <button data-op="out" title="字下げを戻す (Shift+Tab)">←</button>
          <button data-op="in" title="字下げ (Tab)">→</button>
          <button data-op="up" title="上へ (Alt+↑)">↑</button>
          <button data-op="down" title="下へ (Alt+↓)">↓</button>
          <button data-op="del" title="削除">✕</button>
        </span>`;
      const chk = $('.chk', el), txt = $('.txt', el), cx = $('.cx', el);
      chk.checked = s.done; txt.value = s.text; cx.value = s.cx || '';
      chk.addEventListener('change', () => { s.done = chk.checked; el.classList.toggle('done', s.done); this.save(); });
      txt.addEventListener('input', () => { s.text = txt.value; this.autoGrow(txt); this.save(); });
      cx.addEventListener('input', () => { s.cx = cx.value; this.save(); });
      txt.addEventListener('keydown', e => this.onKey(e, i, txt));
      $$('.ops button', el).forEach(b => b.addEventListener('click', () => this.op(b.dataset.op, i)));
      list.appendChild(el);
      requestAnimationFrame(() => this.autoGrow(txt));
    });
    if (focus) {
      const idx = plan.steps.findIndex(s => s.id === focus.id);
      const t = list.children[idx] && $('.txt', list.children[idx]);
      if (t) { t.focus(); const p = focus.caret ?? t.value.length; t.setSelectionRange(p, p); }
    }
  },

  autoGrow(t) {
    if (CSS.supports && CSS.supports('field-sizing', 'content')) return;
    t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px';
  },

  insertAfter(i, level, text = '') {
    const steps = this.plan().steps;
    const s = { id: uid(), text, level, cx: '', done: false };
    steps.splice(i + 1, 0, s);
    this.render({ id: s.id, caret: 0 }); this.save();
  },

  op(op, i) {
    const steps = this.plan().steps, s = steps[i];
    if (!s) return;
    const caret = document.activeElement && document.activeElement.classList.contains('txt') ? document.activeElement.selectionStart : undefined;
    if (op === 'in') {
      if (i === 0) return;
      s.level = Math.min(steps[i - 1].level + 1, s.level + 1, 6);
    } else if (op === 'out') {
      s.level = Math.max(0, s.level - 1);
    } else if (op === 'up' || op === 'down') {
      // 子の手順もまとめて移動
      const end = this.blockEnd(i);
      const block = steps.slice(i, end);
      if (op === 'up') {
        if (i === 0) return;
        let j = i - 1;
        while (j > 0 && steps[j].level > s.level) j--;
        steps.splice(i, block.length);
        steps.splice(j, 0, ...block);
      } else {
        if (end >= steps.length) return;
        const nextEnd = this.blockEnd(end);
        const nextLen = nextEnd - end;
        steps.splice(i, block.length);
        steps.splice(i + nextLen, 0, ...block);
      }
    } else if (op === 'del') {
      steps.splice(i, 1);
      if (!steps.length) steps.push({ id: uid(), text: '', level: 0, cx: '', done: false });
      const f = steps[Math.max(0, i - 1)];
      this.render({ id: f.id }); this.save();
      return;
    }
    this.render({ id: s.id, caret }); this.save();
  },

  blockEnd(i) {
    const steps = this.plan().steps, L = steps[i].level;
    let j = i + 1;
    while (j < steps.length && steps[j].level > L) j++;
    return j;
  },

  onKey(e, i, txt) {
    if (e.isComposing || e.keyCode === 229) return;
    const steps = this.plan().steps, s = steps[i];
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const p = txt.selectionStart;
      const rest = s.text.slice(p);
      s.text = s.text.slice(0, p);
      this.insertAfter(i, s.level, rest);
    } else if (e.key === 'Tab') {
      e.preventDefault(); this.op(e.shiftKey ? 'out' : 'in', i);
    } else if (e.key === 'Backspace' && txt.selectionStart === 0 && txt.selectionEnd === 0) {
      if (s.level > 0) { e.preventDefault(); this.op('out', i); }
      else if (!s.text && steps.length > 1) { e.preventDefault(); this.op('del', i); }
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault(); this.op(e.key === 'ArrowUp' ? 'up' : 'down', i);
    } else if (e.key === 'ArrowUp' && !txt.value.slice(0, txt.selectionStart).includes('\n') && i > 0) {
      e.preventDefault(); this.render({ id: steps[i - 1].id });
    } else if (e.key === 'ArrowDown' && !txt.value.slice(txt.selectionEnd).includes('\n') && i + 1 < steps.length) {
      e.preventDefault(); this.render({ id: steps[i + 1].id });
    }
  },

  renderCx() {
    const n = parseBigNum($('#cxN').value);
    const tl = Math.max(0.1, +$('#cxTL').value || 2);
    const tbl = $('#cxTable');
    if (!(n >= 1)) { tbl.innerHTML = '<tr><td class="muted">N に正の数を入れてください（例: 2e5, 2*10^5, 10^18）</td></tr>'; return; }
    const budget = Math.log10(1e8 * tl);
    let h = '<tr><th>計算量</th><th>演算回数</th><th>判定</th></tr>';
    for (const [name, f] of CX_LIST) {
      const l = f(n);
      const cls = l <= budget ? 'ok' : l <= budget + 1 ? 'mid' : 'ng';
      const mark = cls === 'ok' ? '✓ 余裕' : cls === 'mid' ? '△ 微妙' : '✗ 無理';
      h += `<tr class="${cls}"><td class="mono">${name}</td><td class="mono">${fmtPow10(l)}</td><td>${mark}</td></tr>`;
    }
    tbl.innerHTML = h;
  },
};
