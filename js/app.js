'use strict';
/* 画面全体: タブ切り替え・2 画面表示・テーマ・ショートカット */

const TAB_ORDER = ['code', 'memo', 'table', 'algo', 'tmpl'];

const App = {
  state: null,

  init() {
    this.state = Object.assign({ tab: 'code', split: '', theme: null }, Store.get('app', {}));
    if (this.state.theme) document.documentElement.dataset.theme = this.state.theme;

    CodeTest.init();
    Memo.init();
    TableTool.init();
    Algo.init();
    Templates.init();

    $$('.tab').forEach(b => b.addEventListener('click', () => this.show(b.dataset.tab)));
    $('#splitSel').value = this.state.split;
    $('#splitSel').addEventListener('change', e => { this.state.split = e.target.value; this.layout(); });
    $('#themeBtn').addEventListener('click', () => this.toggleTheme());
    $('#helpBtn').addEventListener('click', () => $('#helpDlg').showModal());

    document.addEventListener('keydown', e => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-5]$/.test(e.code)) {
        e.preventDefault();
        this.show(TAB_ORDER[+e.code.slice(5) - 1]);
      }
    });
    this.layout();
  },

  show(tab) {
    this.state.tab = tab;
    this.layout();
  },

  layout() {
    const { tab } = this.state;
    const split = this.state.split && this.state.split !== tab ? this.state.split : '';
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.panel').forEach(p => {
      p.classList.toggle('show-left', p.dataset.panel === tab);
      p.classList.toggle('show-right', p.dataset.panel === split);
    });
    $('#main').classList.toggle('split', !!split);
    Store.set('app', this.state);
  },

  isShown(panel) {
    return this.state.tab === panel || this.state.split === panel;
  },

  /** 現在の言語のエディタのカーソル位置にコードを挿入 */
  insertCode(text) {
    if (!this.isShown('code')) this.show('code');
    CodeTest.editor.insertSnippet(text);
    toast('エディタに挿入しました（Ctrl+Z で元に戻せます）');
  },

  toggleTheme() {
    const cur = document.documentElement.dataset.theme ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    this.state.theme = next;
    Store.set('app', this.state);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
