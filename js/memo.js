'use strict';
/* メモ: テキスト + 手書きキャンバス (ペン / 消しゴム / 図形 / 番号付きノード / 文字) */

const INK_COLORS = [
  { id: 'ink', label: '黒 (テーマに合わせる)' },
  { id: '#e53935', label: '赤' },
  { id: '#1e88e5', label: '青' },
  { id: '#43a047', label: '緑' },
  { id: '#fb8c00', label: 'オレンジ' },
  { id: '#8e24aa', label: '紫' },
];

const Memo = {
  state: null,
  canvas: null, ctx: null, dpr: 1, w: 0, h: 0,
  cur: null, base: null, history: [], future: [], sawPen: false,

  init() {
    const first = { id: uid(), name: 'ページ 1', text: '', shapes: [] };
    this.state = Object.assign({ pages: [first], cur: first.id, view: 'both', grid: true, color: 'ink', width: 3, tool: 'pen', nodeNext: 1 }, Store.get('memo', {}));
    if (!this.state.pages.length) this.state.pages.push(first);
    this.save = debounce(() => Store.set('memo', this.state), 400);

    this.canvas = $('#drawCanvas');
    this.ctx = this.canvas.getContext('2d');

    // テキスト
    $('#memoText').addEventListener('input', e => { this.page().text = e.target.value; this.save(); });

    // ページ操作
    $('#memoPageSel').addEventListener('change', e => { this.state.cur = e.target.value; this.loadPage(); this.save(); });
    $('#memoAddPage').addEventListener('click', () => {
      const p = { id: uid(), name: 'ページ ' + (this.state.pages.length + 1), text: '', shapes: [] };
      this.state.pages.push(p); this.state.cur = p.id; this.loadPage(); this.save();
    });
    $('#memoRenamePage').addEventListener('click', async () => {
      const n = await askText('ページ名', this.page().name);
      if (n) { this.page().name = n; this.renderPageSel(); this.save(); }
    });
    $('#memoDelPage').addEventListener('click', async () => {
      if (!(await confirmBox(`「${this.page().name}」を削除しますか？`, 'テキストと手書きが消えます。', '削除'))) return;
      this.state.pages = this.state.pages.filter(p => p.id !== this.state.cur);
      if (!this.state.pages.length) this.state.pages.push({ id: uid(), name: 'ページ 1', text: '', shapes: [] });
      this.state.cur = this.state.pages[0].id; this.loadPage(); this.save();
    });

    // 表示切替
    $$('#memoView button').forEach(b => b.addEventListener('click', () => { this.state.view = b.dataset.view; this.applyView(); this.save(); }));

    // 道具
    $$('#toolSeg button').forEach(b => b.addEventListener('click', () => this.setTool(b.dataset.tool)));
    const row = $('#colorRow');
    for (const c of INK_COLORS) {
      const b = document.createElement('button');
      b.className = 'swatch'; b.title = c.label; b.dataset.color = c.id;
      b.style.background = c.id === 'ink' ? 'var(--fg)' : c.id;
      b.addEventListener('click', () => { this.state.color = c.id; this.syncTools(); this.save(); });
      row.appendChild(b);
    }
    $('#penWidth').value = this.state.width;
    $('#penWidth').addEventListener('input', e => { this.state.width = +e.target.value; this.save(); });
    $('#nodeNext').value = this.state.nodeNext;
    $('#nodeNext').addEventListener('change', e => { this.state.nodeNext = parseInt(e.target.value, 10) || 0; this.save(); });
    $('#drawUndo').addEventListener('click', () => this.undo());
    $('#drawRedo').addEventListener('click', () => this.redo());
    $('#drawGrid').addEventListener('click', () => { this.state.grid = !this.state.grid; this.syncTools(); this.save(); });
    $('#drawClear').addEventListener('click', () => {
      if (!this.page().shapes.length) return;
      this.pushHistory(); this.page().shapes = []; this.render(); this.save();
    });
    $('#drawSave').addEventListener('click', () => this.exportPng());

    // キャンバス入力
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => this.onDown(e));
    cv.addEventListener('pointermove', e => this.onMove(e));
    cv.addEventListener('pointerup', e => this.onUp(e));
    cv.addEventListener('pointercancel', e => this.onUp(e));
    new ResizeObserver(() => this.resize()).observe($('#canvasWrap'));

    document.addEventListener('keydown', e => this.onKey(e));
    // テーマ変更時に色を再計算
    new MutationObserver(() => this.render()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.render());

    this.loadPage();
    this.applyView();
    this.syncTools();
  },

  page() { return this.state.pages.find(p => p.id === this.state.cur) || this.state.pages[0]; },

  renderPageSel() {
    const sel = $('#memoPageSel');
    sel.innerHTML = this.state.pages.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    sel.value = this.page().id;
  },

  loadPage() {
    this.state.cur = this.page().id;
    this.renderPageSel();
    $('#memoText').value = this.page().text;
    this.history = []; this.future = [];
    this.render();
  },

  applyView() {
    const l = $('#memoLayout');
    l.classList.remove('view-both', 'view-text', 'view-draw');
    l.classList.add('view-' + this.state.view);
    $$('#memoView button').forEach(b => b.classList.toggle('on', b.dataset.view === this.state.view));
    requestAnimationFrame(() => this.resize());
  },

  setTool(t) { this.state.tool = t; this.syncTools(); this.save(); },

  syncTools() {
    $$('#toolSeg button').forEach(b => b.classList.toggle('on', b.dataset.tool === this.state.tool));
    $$('#colorRow .swatch').forEach(b => b.classList.toggle('on', b.dataset.color === this.state.color));
    $('#canvasWrap').classList.toggle('grid', this.state.grid);
    $('#drawGrid').classList.toggle('primary', this.state.grid);
    this.canvas.style.cursor = this.state.tool === 'text' ? 'text' : 'crosshair';
  },

  isVisible() { return this.canvas.offsetParent !== null; },

  onKey(e) {
    if (!this.isVisible()) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || $('#dlg').open) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
    if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); return; }
    if (mod || e.altKey) return;
    const map = { p: 'pen', e: 'eraser', l: 'line', a: 'arrow', r: 'rect', o: 'ellipse', n: 'node', t: 'text' };
    const t = map[e.key.toLowerCase()];
    if (t) { e.preventDefault(); this.setTool(t); }
  },

  // ---------------- 描画 ----------------
  cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); },
  colorOf(c) { return c === 'ink' ? this.cssVar('--fg') : c; },

  resize() {
    const wrap = $('#canvasWrap');
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = window.devicePixelRatio || 1;
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.canvas.style.width = r.width + 'px';
    this.canvas.style.height = r.height + 'px';
    this.render();
  },

  render(extra) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    for (const s of this.page().shapes) this.drawShape(ctx, s);
    if (extra) this.drawShape(ctx, extra);
  },

  /** 描画中は確定済みの図をオフスクリーンに保存しておき、毎フレームそれを貼るだけにする */
  snapshotBase() {
    if (!this.base) this.base = document.createElement('canvas');
    this.base.width = this.canvas.width; this.base.height = this.canvas.height;
    const b = this.base.getContext('2d');
    b.clearRect(0, 0, this.base.width, this.base.height);
    b.drawImage(this.canvas, 0, 0);
  },

  renderWithBase(extra) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (extra) this.drawShape(ctx, extra);
  },

  drawShape(ctx, s) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = s.t === 'eraser' ? 'destination-out' : 'source-over';
    const col = s.t === 'eraser' ? '#000' : this.colorOf(s.c);
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = s.w;
    switch (s.t) {
      case 'pen': case 'eraser': {
        const p = s.pts;
        if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.w / 2, 0, Math.PI * 2); ctx.fill(); break; }
        ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i < p.length - 1; i++) {
          ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
        }
        ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
        ctx.stroke();
        break;
      }
      case 'line': case 'arrow': {
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        if (s.t === 'arrow') {
          const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), L = 10 + s.w * 2;
          ctx.beginPath();
          ctx.moveTo(s.x2, s.y2);
          ctx.lineTo(s.x2 - L * Math.cos(a - 0.4), s.y2 - L * Math.sin(a - 0.4));
          ctx.lineTo(s.x2 - L * Math.cos(a + 0.4), s.y2 - L * Math.sin(a + 0.4));
          ctx.closePath(); ctx.fill();
        }
        if (s.label) {
          ctx.font = `600 14px ${this.cssVar('--sans')}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
          ctx.fillText(s.label, mx, my - 10);
        }
        break;
      }
      case 'rect':
        ctx.strokeRect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1));
        break;
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, Math.abs(s.x2 - s.x1) / 2, Math.abs(s.y2 - s.y1) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'node': {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = this.cssVar('--surface'); ctx.fill();
        ctx.lineWidth = Math.max(2, s.w * 0.7); ctx.stroke();
        ctx.fillStyle = col;
        ctx.font = `700 ${Math.round(s.r * 0.95)}px ${this.cssVar('--sans')}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.label, s.x, s.y + 1);
        break;
      }
      case 'text':
        ctx.font = `${s.size}px ${this.cssVar('--sans')}`;
        ctx.textBaseline = 'top';
        String(s.s).split('\n').forEach((ln, i) => ctx.fillText(ln, s.x, s.y + i * s.size * 1.25));
        break;
    }
    ctx.restore();
  },

  // ---------------- 入力 ----------------
  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10];
  },

  nodeAt(x, y, pad = 6) {
    const sh = this.page().shapes;
    for (let i = sh.length - 1; i >= 0; i--) {
      const s = sh[i];
      if (s.t === 'node' && Math.hypot(s.x - x, s.y - y) <= s.r + pad) return s;
    }
    return null;
  },

  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'pen') this.sawPen = true;
    if (this.sawPen && e.pointerType === 'touch') return; // ペン使用中は手のひらを無視
    if (this.textInput) { this.commitText(); return; }
    const [x, y] = this.pos(e);
    const st = this.state, t = st.tool;
    if (t === 'text') { e.preventDefault(); this.openText(x, y); return; }
    if (t === 'node') {
      this.pushHistory();
      const r = 15 + st.width;
      this.page().shapes.push({ t: 'node', c: st.color, w: st.width, x, y, r, label: String(st.nodeNext) });
      st.nodeNext++; $('#nodeNext').value = st.nodeNext;
      this.render(); this.save();
      return;
    }
    this.canvas.setPointerCapture(e.pointerId);
    this.snapshotBase();
    if (t === 'pen') this.cur = { t: 'pen', c: st.color, w: st.width, pts: [[x, y]] };
    else if (t === 'eraser') this.cur = { t: 'eraser', w: st.width * 5, pts: [[x, y]] };
    else this.cur = { t, c: st.color, w: st.width, x1: x, y1: y, x2: x, y2: y };
    this.renderWithBase(this.cur);
  },

  onMove(e) {
    if (!this.cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const c = this.cur;
    for (const ev of (evs.length ? evs : [e])) {
      const [x, y] = this.pos(ev);
      if (c.pts) {
        const l = c.pts[c.pts.length - 1];
        if (Math.abs(l[0] - x) + Math.abs(l[1] - y) >= 1) c.pts.push([x, y]);
      } else {
        c.x2 = x; c.y2 = y;
        if (ev.shiftKey && (c.t === 'rect' || c.t === 'ellipse')) {
          const d = Math.max(Math.abs(x - c.x1), Math.abs(y - c.y1));
          c.x2 = c.x1 + Math.sign(x - c.x1 || 1) * d; c.y2 = c.y1 + Math.sign(y - c.y1 || 1) * d;
        }
      }
    }
    this.renderWithBase(c);
  },

  onUp() {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    if (!c.pts) {
      if (Math.hypot(c.x2 - c.x1, c.y2 - c.y1) < 3) { this.render(); return; }
      if (c.t === 'line' || c.t === 'arrow') this.snapToNodes(c);
    }
    this.pushHistory();
    this.page().shapes.push(c);
    this.render();
    this.save();
  },

  /** 線の端がノード上なら中心に吸着し、円の外周で切る */
  snapToNodes(c) {
    const a = this.nodeAt(c.x1, c.y1), b = this.nodeAt(c.x2, c.y2);
    let x1 = a ? a.x : c.x1, y1 = a ? a.y : c.y1, x2 = b ? b.x : c.x2, y2 = b ? b.y : c.y2;
    const d = Math.hypot(x2 - x1, y2 - y1);
    if (d < 1) return;
    const ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    if (a) { x1 += ux * a.r; y1 += uy * a.r; }
    if (b) { x2 -= ux * (b.r + (c.t === 'arrow' ? 1 : 0)); y2 -= uy * (b.r + (c.t === 'arrow' ? 1 : 0)); }
    Object.assign(c, { x1, y1, x2, y2 });
  },

  openText(x, y) {
    const inp = document.createElement('textarea');
    inp.className = 'canvas-text-input';
    inp.rows = 1;
    const size = 14 + this.state.width * 2;
    inp.style.left = x + 'px'; inp.style.top = y + 'px';
    inp.style.fontSize = size + 'px';
    inp.style.color = this.colorOf(this.state.color);
    inp.placeholder = 'Enter で確定 / Shift+Enter で改行';
    $('#canvasWrap').appendChild(inp);
    this.textInput = { el: inp, x, y, size };
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); this.commitText(); }
      else if (ev.key === 'Escape') { this.textInput = null; inp.remove(); }
    });
    inp.addEventListener('input', () => { inp.rows = inp.value.split('\n').length; });
    inp.addEventListener('blur', () => setTimeout(() => this.commitText(), 0));
    inp.focus();
  },

  commitText() {
    const ti = this.textInput;
    if (!ti) return;
    this.textInput = null;
    const s = ti.el.value;
    ti.el.remove();
    if (!s.trim()) return;
    this.pushHistory();
    this.page().shapes.push({ t: 'text', c: this.state.color, x: ti.x + 2, y: ti.y + 1, size: ti.size, s });
    this.render(); this.save();
  },

  // ---------------- 履歴 ----------------
  pushHistory() {
    this.history.push(this.page().shapes.slice());
    if (this.history.length > 200) this.history.shift();
    this.future = [];
  },
  undo() {
    if (!this.history.length) return;
    this.future.push(this.page().shapes);
    this.page().shapes = this.history.pop();
    this.render(); this.save();
  },
  redo() {
    if (!this.future.length) return;
    this.history.push(this.page().shapes);
    this.page().shapes = this.future.pop();
    this.render(); this.save();
  },

  exportPng() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const x = c.getContext('2d');
    x.fillStyle = this.cssVar('--surface');
    x.fillRect(0, 0, c.width, c.height);
    if (this.state.grid) {
      x.strokeStyle = this.cssVar('--border'); x.lineWidth = 1;
      const g = 24 * this.dpr;
      x.beginPath();
      for (let i = 0; i <= c.width; i += g) { x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, c.height); }
      for (let j = 0; j <= c.height; j += g) { x.moveTo(0, j + 0.5); x.lineTo(c.width, j + 0.5); }
      x.stroke();
    }
    x.drawImage(this.canvas, 0, 0);
    c.toBlob(b => download(`${this.page().name}.png`, b));
  },
};
