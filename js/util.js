'use strict';
/* 共通ユーティリティ: 保存・通知・ダイアログ・コピーなど */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const Store = {
  prefix: 'joi-tools:',
  get(key, def) {
    try {
      const v = localStorage.getItem(this.prefix + key);
      return v == null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(this.prefix + key, JSON.stringify(val)); return true; }
    catch (e) { toast('保存に失敗しました（容量オーバーの可能性）'); return false; }
  },
};

/** 連続呼び出しをまとめる */
function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer = null;
function toast(msg, ms = 2000) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

async function copyText(text, label = 'コピーしました') {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) { /* ignore */ }
    ta.remove();
  }
  toast(label);
}

function download(filename, data, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function uid() { return Math.random().toString(36).slice(2, 10); }

/**
 * 汎用ダイアログ。
 * opts: {title, desc, text (textarea 初期値), input (1行入力初期値), ok, alt, cancel}
 * 戻り値: {action: 'ok'|'alt'|'cancel', value}
 */
function dialog(opts) {
  return new Promise(resolve => {
    const dlg = $('#dlg');
    $('#dlgTitle').textContent = opts.title || '';
    $('#dlgDesc').textContent = opts.desc || '';
    $('#dlgDesc').hidden = !opts.desc;
    const ta = $('#dlgText'), inp = $('#dlgInput');
    ta.hidden = opts.text === undefined;
    inp.hidden = opts.input === undefined;
    ta.value = opts.text ?? '';
    inp.value = opts.input ?? '';
    if (opts.placeholder) { ta.placeholder = opts.placeholder; inp.placeholder = opts.placeholder; }
    else { ta.placeholder = ''; inp.placeholder = ''; }
    $('#dlgOk').textContent = opts.ok || 'OK';
    $('#dlgCancel').textContent = opts.cancel || 'キャンセル';
    $('#dlgCancel').hidden = opts.cancel === false;
    const alt = $('#dlgAlt');
    alt.hidden = !opts.alt;
    alt.textContent = opts.alt || '';
    const onClose = () => {
      dlg.removeEventListener('close', onClose);
      const action = dlg.returnValue || 'cancel';
      resolve({ action, value: !ta.hidden ? ta.value : inp.value });
    };
    dlg.addEventListener('close', onClose);
    dlg.returnValue = '';
    dlg.showModal();
    setTimeout(() => (!inp.hidden ? inp : !ta.hidden ? ta : $('#dlgOk')).focus(), 0);
  });
}

async function askText(title, init = '', desc = '') {
  const r = await dialog({ title, desc, input: init });
  return r.action === 'ok' ? r.value.trim() : null;
}
async function confirmBox(title, desc = '', ok = 'OK') {
  const r = await dialog({ title, desc, ok });
  return r.action === 'ok';
}

/** "2e5", "2*10^5", "10^18", "200,000" などを数値に */
function parseBigNum(s) {
  s = String(s).trim().replace(/[,_\s]/g, '').replace(/×/g, '*').replace(/\*\*/g, '^');
  if (!s) return NaN;
  let m = s.match(/^(\d+(?:\.\d+)?)\*10\^(\d+)$/);
  if (m) return parseFloat(m[1]) * Math.pow(10, +m[2]);
  m = s.match(/^10\^(\d+)$/);
  if (m) return Math.pow(10, +m[1]);
  m = s.match(/^(\d+)\^(\d+)$/);
  if (m) return Math.pow(+m[1], +m[2]);
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}
