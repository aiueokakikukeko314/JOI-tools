'use strict';
/* 表: DP 表やシミュレーション用のグリッドエディタ */

const CELL_COLORS = [
  { id: '', label: '色なし' },
  { id: 'rgba(239,68,68,.30)', label: '赤' },
  { id: 'rgba(59,130,246,.30)', label: '青' },
  { id: 'rgba(34,197,94,.30)', label: '緑' },
  { id: 'rgba(234,179,8,.38)', label: '黄' },
  { id: 'rgba(168,85,247,.30)', label: '紫' },
  { id: 'rgba(120,120,120,.30)', label: '灰' },
];
const MAX_DIM = 100;

function makeTable(name, rows = 5, cols = 5) {
  return {
    id: uid(), name, rows, cols, base: 0,
    cells: Array.from({ length: rows }, () => Array(cols).fill('')),
    colors: Array.from({ length: rows }, () => Array(cols).fill('')),
  };
}

const TableTool = {
  state: null,
  sel: null,      // {r1,c1,r2,c2}
  anchor: null,
  dragging: false,

  init() {
    const t = makeTable('dp', 6, 8);
    this.state = Object.assign({ tables: [t], cur: t.id }, Store.get('table', {}));
    if (!this.state.tables.length) this.state.tables.push(makeTable('表 1'));
    this.save = debounce(() => Store.set('table', this.state), 300);

    $('#tblSel').addEventListener('change', e => { this.state.cur = e.target.value; this.render(); this.save(); });
    $('#tblNew').addEventListener('click', async () => {
      const n = await askText('新しい表の名前', '表 ' + (this.state.tables.length + 1));
      if (!n) return;
      const nt = makeTable(n, 5, 5);
      this.state.tables.push(nt); this.state.cur = nt.id; this.render(); this.save();
    });
    $('#tblRename').addEventListener('click', async () => {
      const n = await askText('表の名前', this.tbl().name);
      if (n) { this.tbl().name = n; this.render(); this.save(); }
    });
    $('#tblDelete').addEventListener('click', async () => {
      if (!(await confirmBox(`「${this.tbl().name}」を削除しますか？`, '', '削除'))) return;
      this.state.tables = this.state.tables.filter(x => x.id !== this.state.cur);
      if (!this.state.tables.length) this.state.tables.push(makeTable('表 1'));
      this.state.cur = this.state.tables[0].id; this.render(); this.save();
    });
    $('#tblResize').addEventListener('click', () => {
      this.resizeTo(+$('#tblRows').value, +$('#tblCols').value);
    });
    for (const id of ['#tblRows', '#tblCols']) {
      $(id).addEventListener('keydown', e => { if (e.key === 'Enter') $('#tblResize').click(); });
    }
    $$('#tblBase button').forEach(b => b.addEventListener('click', () => { this.tbl().base = +b.dataset.base; this.render(); this.save(); }));

    const cr = $('#tblColors');
    for (const c of CELL_COLORS) {
      const b = document.createElement('button');
      b.className = 'swatch' + (c.id ? '' : ' none');
      b.title = c.label;
      if (c.id) b.style.background = c.id;
      b.addEventListener('click', () => this.colorSel(c.id));
      cr.appendChild(b);
    }
    $('#tblFill').addEventListener('click', async () => {
      if (!this.sel) { toast('先にセルを選択してください'); return; }
      const v = await askText('選択範囲を埋める値', '0');
      if (v === null) return;
      this.eachSel((r, c) => { this.tbl().cells[r][c] = v; });
      this.render(); this.save();
    });
    $('#tblClearSel').addEventListener('click', () => {
      if (!this.sel) { toast('先にセルを選択してください'); return; }
      this.eachSel((r, c) => { this.tbl().cells[r][c] = ''; this.tbl().colors[r][c] = ''; });
      this.render(); this.save();
    });
    $('#tblImport').addEventListener('click', () => this.importText());
    $('#tblExport').addEventListener('click', () => copyText(this.exportText($('#tblExportFmt').value)));

    document.addEventListener('mouseup', () => { this.dragging = false; });
    this.render();
  },

  tbl() { return this.state.tables.find(t => t.id === this.state.cur) || this.state.tables[0]; },

  resizeTo(R, C) {
    R = Math.max(1, Math.min(MAX_DIM, R | 0)); C = Math.max(1, Math.min(MAX_DIM, C | 0));
    const t = this.tbl();
    const grow = (arr) => {
      const out = [];
      for (let r = 0; r < R; r++) {
        const row = (arr[r] || []).slice(0, C);
        while (row.length < C) row.push('');
        out.push(row);
      }
      return out;
    };
    t.cells = grow(t.cells); t.colors = grow(t.colors);
    t.rows = R; t.cols = C;
    this.sel = null;
    this.render(); this.save();
  },

  render() {
    const t = this.tbl();
    $('#tblSel').innerHTML = this.state.tables.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
    $('#tblSel').value = t.id;
    $('#tblRows').value = t.rows; $('#tblCols').value = t.cols;
    $$('#tblBase button').forEach(b => b.classList.toggle('on', +b.dataset.base === t.base));

    let h = '<table class="grid"><thead><tr><th class="corner" title="行＼列">i＼j</th>';
    for (let c = 0; c < t.cols; c++) h += `<th data-c="${c}">${c + t.base}</th>`;
    h += '<th class="add"><button data-act="addcol" title="列を追加">+</button></th></tr></thead><tbody>';
    for (let r = 0; r < t.rows; r++) {
      h += `<tr><th data-r="${r}">${r + t.base}</th>`;
      for (let c = 0; c < t.cols; c++) {
        const bg = t.colors[r][c] ? ` style="background:${t.colors[r][c]}"` : '';
        h += `<td data-r="${r}" data-c="${c}"${bg}><input value="${escapeHtml(t.cells[r][c])}" spellcheck="false"></td>`;
      }
      h += '</tr>';
    }
    h += `<tr><th><button data-act="addrow" title="行を追加">+</button></th></tr></tbody></table>`;
    const wrap = $('#tblWrap');
    wrap.innerHTML = h;
    this.bindGrid(wrap);
    this.paintSel();
  },

  bindGrid(wrap) {
    const t = this.tbl();
    wrap.querySelector('[data-act=addcol]').addEventListener('click', () => this.resizeTo(t.rows, t.cols + 1));
    wrap.querySelector('[data-act=addrow]').addEventListener('click', () => this.resizeTo(t.rows + 1, t.cols));
    // 行/列見出しクリックで行全体・列全体を選択
    $$('thead th[data-c]', wrap).forEach(th => th.addEventListener('click', () => {
      const c = +th.dataset.c; this.sel = { r1: 0, c1: c, r2: t.rows - 1, c2: c }; this.paintSel();
    }));
    $$('tbody th[data-r]', wrap).forEach(th => th.addEventListener('click', () => {
      const r = +th.dataset.r; this.sel = { r1: r, c1: 0, r2: r, c2: t.cols - 1 }; this.paintSel();
    }));
    wrap.querySelectorAll('td').forEach(td => {
      const r = +td.dataset.r, c = +td.dataset.c;
      const inp = td.firstElementChild;
      td.addEventListener('mousedown', e => {
        if (e.shiftKey && this.anchor) {
          e.preventDefault();
          this.setSel(this.anchor[0], this.anchor[1], r, c);
        } else {
          this.anchor = [r, c];
          this.setSel(r, c, r, c);
          this.dragging = true;
        }
      });
      td.addEventListener('mouseenter', () => {
        if (this.dragging && this.anchor) this.setSel(this.anchor[0], this.anchor[1], r, c);
      });
      inp.addEventListener('focus', () => {
        if (!this.sel || this.sel.r1 !== this.sel.r2 || this.sel.c1 !== this.sel.c2 || this.sel.r1 !== r || this.sel.c1 !== c) {
          if (!this.dragging) { this.anchor = [r, c]; this.setSel(r, c, r, c); }
        }
        inp.select();
      });
      inp.addEventListener('input', () => { t.cells[r][c] = inp.value; this.save(); });
      inp.addEventListener('keydown', e => this.onCellKey(e, r, c, inp));
    });
  },

  onCellKey(e, r, c, inp) {
    const t = this.tbl();
    let nr = r, nc = c;
    if (e.key === 'Enter') { nr = e.shiftKey ? r - 1 : r + 1; }
    else if (e.key === 'ArrowUp') nr = r - 1;
    else if (e.key === 'ArrowDown') nr = r + 1;
    else if (e.key === 'ArrowLeft' && inp.selectionStart === 0 && inp.selectionEnd === 0) nc = c - 1;
    else if (e.key === 'ArrowRight' && inp.selectionStart === inp.value.length) nc = c + 1;
    else if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel && (this.sel.r1 !== this.sel.r2 || this.sel.c1 !== this.sel.c2)) {
      e.preventDefault();
      this.eachSel((rr, cc) => { t.cells[rr][cc] = ''; });
      this.render(); this.save();
      return;
    } else return;
    e.preventDefault();
    if (e.key === 'Enter' && nr >= t.rows) { this.resizeTo(t.rows + 1, t.cols); }
    this.focusCell(Math.max(0, Math.min(this.tbl().rows - 1, nr)), Math.max(0, Math.min(t.cols - 1, nc)));
  },

  focusCell(r, c) {
    const inp = $(`#tblWrap td[data-r="${r}"][data-c="${c}"] input`);
    if (inp) { this.anchor = [r, c]; this.setSel(r, c, r, c); inp.focus(); }
  },

  setSel(r1, c1, r2, c2) {
    this.sel = { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
    this.paintSel();
  },

  paintSel() {
    const s = this.sel;
    $$('#tblWrap td').forEach(td => {
      const r = +td.dataset.r, c = +td.dataset.c;
      td.classList.toggle('sel', !!s && r >= s.r1 && r <= s.r2 && c >= s.c1 && c <= s.c2);
    });
    $$('#tblWrap thead th[data-c]').forEach(th => { const c = +th.dataset.c; th.classList.toggle('hl', !!s && c >= s.c1 && c <= s.c2); });
    $$('#tblWrap tbody th[data-r]').forEach(th => { const r = +th.dataset.r; th.classList.toggle('hl', !!s && r >= s.r1 && r <= s.r2); });
  },

  eachSel(fn) {
    const s = this.sel; if (!s) return;
    for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) fn(r, c);
  },

  colorSel(col) {
    if (!this.sel) { toast('先にセルを選択してください（ドラッグ / Shift+クリックで範囲）'); return; }
    this.eachSel((r, c) => { this.tbl().colors[r][c] = col; });
    this.render(); this.save();
  },

  async importText() {
    const r = await dialog({
      title: 'テキストから表を作成',
      desc: 'スペース・タブ・カンマ区切りのテキストを貼り付けてください（Excel / スプレッドシートからのコピーも可）。',
      text: '', placeholder: '1 2 3\n4 5 6', ok: 'この表に読み込む', alt: '新しい表として作成',
    });
    if (r.action === 'cancel' || !r.value.trim()) return;
    const lines = r.value.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
    const sep = lines.some(l => l.includes('\t')) ? /\t/ : lines.some(l => l.includes(',')) ? /\s*,\s*/ : /\s+/;
    const rows = lines.map(l => l.trim().split(sep));
    const R = Math.min(MAX_DIM, rows.length), C = Math.min(MAX_DIM, Math.max(...rows.map(x => x.length)));
    let t;
    if (r.action === 'alt') {
      t = makeTable('読み込み ' + (this.state.tables.length + 1), R, C);
      this.state.tables.push(t); this.state.cur = t.id;
    } else {
      t = this.tbl();
      Object.assign(t, makeTable(t.name, R, C), { id: t.id, base: t.base });
    }
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) t.cells[i][j] = rows[i][j] ?? '';
    this.sel = null;
    this.render(); this.save();
    toast(`${R} × ${C} の表を読み込みました`);
  },

  exportText(fmt) {
    const t = this.tbl();
    const cells = t.cells;
    const numeric = cells.every(row => row.every(v => v.trim() === '' || /^-?\d+(\.\d+)?$/.test(v.trim())));
    const val = v => (numeric ? (v.trim() === '' ? '0' : v.trim()) : JSON.stringify(v));
    const name = /^[A-Za-z_]\w*$/.test(t.name) ? t.name : 'a';
    switch (fmt) {
      case 'md': {
        const head = '| i\\j | ' + Array.from({ length: t.cols }, (_, c) => c + t.base).join(' | ') + ' |';
        const sep = '|' + ' --- |'.repeat(t.cols + 1);
        const body = cells.map((row, r) => `| ${r + t.base} | ` + row.map(v => v.replace(/\|/g, '\\|')).join(' | ') + ' |');
        return [head, sep, ...body].join('\n');
      }
      case 'csv':
        return cells.map(row => row.map(v => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(',')).join('\n');
      case 'cpp': {
        const type = numeric ? 'long long' : 'string';
        return `vector<vector<${type}>> ${name} = {\n` + cells.map(row => '    {' + row.map(val).join(', ') + '}').join(',\n') + '\n};';
      }
      case 'py':
        return `${name} = [\n` + cells.map(row => '    [' + row.map(val).join(', ') + ']').join(',\n') + '\n]';
      default:
        return cells.map(row => row.map(v => (v === '' ? '.' : v)).join(' ')).join('\n');
    }
  },
};
