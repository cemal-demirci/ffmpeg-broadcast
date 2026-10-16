// Cemal.cloud bcast Studio | the window
'use strict';

const api = window.studio;

// ---------------------------------------------------------------------------
// small DOM kit
// ---------------------------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
const fill = (el, ...kids) => { el.replaceChildren(); for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k))); return el; };

const ICON = {
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
  wave: '<path d="M3 12h1.5M7 8v8M10.5 5v14M14 9v6M17.5 7v10M21 11v2"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  play: '<path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8h.01"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 9.5 10.5 12l-3 2.5M13 15h3.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l.9 11.2A2 2 0 0 0 8.9 20h6.2a2 2 0 0 0 2-1.8L18 7M9 7V4.5h6V7"/>',
  refresh: '<path d="M20 11.5A8 8 0 0 0 5.6 6.6L4 8M4 4v4h4M4 12.5a8 8 0 0 0 14.4 4.9L20 16M20 20v-4h-4"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 19.5h16"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l3 3M14 9l2 2"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  bolt: '<path d="M13 3 5 13.5h6l-1 7.5 8-10.5h-6z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  signal: '<path d="M5 18.5a1.5 1.5 0 1 0 0-.01"/><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/>',
};
const icon = (name, cls = '') => h('span', { class: `ic ${cls}`, 'aria-hidden': 'true',
  html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>` });

function btn(label, onClick, { cls = '', ic, title, disabled, id } = {}) {
  return h('button', { class: `btn ${cls}`, onclick: onClick, title, disabled, id, type: 'button' }, ic ? icon(ic) : null, label);
}
const iconBtn = (ic, title, onClick, cls = 'ghost') => h('button', { class: `btn icon ${cls}`, title, 'aria-label': title, onclick: onClick, type: 'button' }, icon(ic));

function toggle(title, sub, checked, onChange, id) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked, id, 'aria-label': title, onchange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'switch-row' },
    h('span', { class: 'txt' }, h('span', { class: 't' }, title), sub ? h('span', { class: 's' }, sub) : null),
    h('span', { class: 'switch' }, input, h('span', { class: 'track' }), h('span', { class: 'knob' })));
}

function seg(options, value, onChange, cls = '') {
  return h('div', { class: `seg ${cls}`, role: 'radiogroup' }, options.map(([v, label]) =>
    h('button', { type: 'button', class: v === value ? 'on' : '', role: 'radio', 'aria-checked': String(v === value),
      onclick: () => onChange(v) }, label)));
}

const badge = (text, cls = '', title) => h('span', { class: `badge ${cls}`, title }, text);

// ---------------------------------------------------------------------------
// format
// ---------------------------------------------------------------------------
function fmtDur(s) {
  if (!(s >= 0) || !Number.isFinite(s)) return '';
  s = Math.round(s);
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
}
function fmtSize(b) {
  if (!(b >= 0)) return '';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}
const base = (p) => String(p).split(/[\\/]/).pop();
const plural = (n, word) => `${n} ${word}`;
const CAT = { contribution: 'Katkı / playout', post: 'Kurgu', distribution: 'Yayın', ott: 'OTT / web', audio: 'Ses' };
const CAT_SHORT = { contribution: 'Katkı', post: 'Kurgu', distribution: 'Yayın', ott: 'OTT', audio: 'Ses' };
const TC_RE = /^\d{2}:\d{2}:\d{2}[:;]\d{2}$/;
/** 1920×1080i25 · TFF · 1 ses akışı, 2 kanal */
function describeTr(src) {
  if (!src) return '';
  const parts = [];
  if (src.width) {
    const il = /^(tt|bb|tb|bt)$/.test(src.fieldOrder || '');
    const [n, d] = String(src.rate || '').split('/').map(Number);
    const fps = d ? n / d : n;
    parts.push(`${src.width}×${src.height}${il ? 'i' : 'p'}${fps ? +fps.toFixed(2) : ''}`);
    if (il) parts.push(/^t/.test(src.fieldOrder) ? 'TFF' : 'BFF');
  } else parts.push('yalnız ses');
  parts.push(src.audioStreams ? `${src.audioStreams} ses akışı, ${src.audioChannels} kanal` : 'ses yok');
  return parts.join(' · ');
}
const extLabel = (p) => (p.ladder || p.ext === '/' ? 'HLS' : `.${p.ext}`);

let seq = 0;
const newId = () => `j${Date.now().toString(36)}${(seq++).toString(36)}`;

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
const S = {
  info: null,
  settings: {},
  ff: undefined,          // undefined while looking, null when missing
  ffDl: null,             // { pct, step } while downloading
  presets: [],
  view: 'local',
  cat: 'all',
  staged: [],
  preset: null,
  opts: { r128: false, overwrite: false, tc: '', tracks: '', srcScan: '' },
  outDir: '',
  fit: {},
  jobs: [],
  servers: [],
  sel: null,
  sinfo: {},              // server id -> { loading, info, error, code, extra }
  inst: {},               // server id -> install log state
  rform: {},              // server id -> remote job form
};

const presetByName = (n) => S.presets.find((p) => p.name === n);
const missingFor = (name) => (S.ff && S.ff.missing && S.ff.missing[name]) || [];

function saveSettings() {
  api.saveSettings({ preset: S.preset, options: S.opts, outDir: S.outDir, lastServer: S.sel }).catch(() => {});
}

// ---------------------------------------------------------------------------
// toasts, modals
// ---------------------------------------------------------------------------
function toast(kind, text, ms = 5000) {
  const t = h('div', { class: `toast ${kind}` }, icon(kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : 'info'), h('div', null, text));
  $('#toasts').append(t);
  setTimeout(() => t.remove(), ms);
}

function modal({ title, body, foot, wide, onClose }) {
  const back = h('div', { class: 'modal-back' });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  const m = h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('h3', null, title), h('span', { class: 'x' }, iconBtn('x', 'Kapat', close))),
    h('div', { class: 'modal-body' }, body),
    foot ? h('div', { class: 'modal-foot' }, typeof foot === 'function' ? foot(close) : foot) : null);
  back.append(m);
  $('#modalRoot').append(back);
  const first = m.querySelector('input:not([type=checkbox]), select');
  if (first) setTimeout(() => first.focus(), 30);
  return { close, el: m };
}

function confirmBox(title, text, okLabel, danger) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title, body: h('p', { class: 'muted' }, text),
      onClose: () => { if (!done) resolve(false); },
      foot: (close) => [h('span', { class: 'left' }),
        btn('Vazgeç', () => close(), { cls: 'ghost' }),
        btn(okLabel, () => { done = true; resolve(true); close(); }, { cls: danger ? 'danger' : 'primary' })],
    });
    return m;
  });
}

// ---------------------------------------------------------------------------
// FFmpeg
// ---------------------------------------------------------------------------
async function refreshFfmpeg(refresh) {
  S.ff = undefined;
  renderFf();
  try { S.ff = await api.ffmpegStatus(refresh); } catch (e) { S.ff = null; toast('err', e.message); }
  afterFfChange();
}

function afterFfChange() {
  renderFf(); renderBanner(); renderNav(); renderPresets(); renderActions();
  if (S.ff) reprobe();
}

async function downloadFf() {
  if (S.ffDl) return;
  S.ffDl = { pct: 0, step: '' };
  renderFf(); renderBanner();
  try {
    S.ff = await api.downloadFfmpeg();
    toast('ok', `FFmpeg ${S.ff.version} indirildi ve hazır.`);
  } catch (e) { toast('err', `İndirme başarısız: ${e.message}`, 9000); }
  S.ffDl = null;
  afterFfChange();
}

async function chooseFf() {
  try { S.ff = await api.chooseFfmpeg(); afterFfChange(); } catch (e) { toast('err', e.message, 8000); }
}

function ffDetails() {
  const f = S.ff;
  const missing = Object.entries(f.missing || {}).filter(([, m]) => m.length);
  modal({
    title: 'FFmpeg',
    body: h('div', { class: 'col', style: { gap: '12px' } },
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Sürüm'), h('div', { class: 'mono selectable' }, f.version)),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Kaynak'), h('div', null, f.source)),
        h('div', { class: 'field full' }, h('span', { class: 'lbl' }, 'ffmpeg'), h('div', { class: 'mono selectable ellipsis', title: f.path }, f.path)),
        h('div', { class: 'field full' }, h('span', { class: 'lbl' }, 'ffprobe'), h('div', { class: 'mono selectable ellipsis', title: f.ffprobe }, f.ffprobe))),
      missing.length
        ? h('div', { class: 'note warn' }, icon('alert'), h('div', null, `Bu FFmpeg ${missing.length} preseti çalıştıramaz: `,
            missing.map(([n, m]) => `${n} (${m.join(', ')})`).join('; '), '. ffmpeg-broadcast build’i ya da indirilen build hepsini destekler.'))
        : h('div', { class: 'note ok' }, icon('check'), h('div', null, `${S.presets.length} presetin hepsi bu FFmpeg ile çalışır.`))),
    foot: (close) => [
      h('span', { class: 'left' }, btn('Yeniden tara', () => { close(); refreshFfmpeg(true); }, { cls: 'ghost sm', ic: 'refresh' })),
      btn('Başka FFmpeg seç', () => { close(); chooseFf(); }, { cls: 'sm', ic: 'folder' }),
      S.info.canDownloadFfmpeg ? btn('Güncel build indir', () => { close(); downloadFf(); }, { cls: 'sm', ic: 'download' }) : null,
    ],
  });
}

function renderFf() {
  const el = $('#ffPill');
  el.className = 'ff-pill no-drag';
  if (S.ffDl) {
    const pct = S.ffDl.pct;
    fill(el, h('span', { class: 'dot' }),
      h('span', { class: 'label', id: 'ffDlLabel' }, S.ffDl.step === 'unpack' ? 'FFmpeg açılıyor…' : `FFmpeg indiriliyor${pct != null ? ` %${Math.floor(pct)}` : '…'}`),
      h('span', { class: 'mini-bar' }, h('i', { id: 'ffDlBar', style: { width: `${pct || 0}%` } })), h('span', { style: { width: '6px' } }));
    return;
  }
  if (S.ff === undefined) { fill(el, h('span', { class: 'dot' }), h('span', { class: 'label muted' }, 'FFmpeg aranıyor…'), h('span', { style: { width: '6px' } })); return; }
  if (!S.ff) {
    el.classList.add('missing');
    fill(el, h('span', { class: 'dot' }), h('span', { class: 'label' }, 'FFmpeg yok'),
      S.info.canDownloadFfmpeg ? btn('İndir', downloadFf, { cls: 'primary sm' }) : null,
      btn('Seç', chooseFf, { cls: 'ghost sm' }));
    return;
  }
  el.classList.add('ok');
  const n = Object.values(S.ff.missing || {}).filter((m) => m.length).length;
  fill(el, h('span', { class: 'dot' }),
    h('span', { class: 'label', title: S.ff.path }, 'FFmpeg ', h('b', null, S.ff.version.replace(/-cemalcloud$/, '')), h('span', { class: 'faint' }, ` · ${S.ff.source}`),
      n ? h('span', { class: 'faint' }, ` · ${n} preset yok`) : null),
    iconBtn('gear', 'FFmpeg ayrıntıları', ffDetails));
}

function renderBanner() {
  const el = $('#ffBanner');
  if (S.ff !== null && !S.ffDl) { el.replaceChildren(); return; }
  if (S.ffDl) {
    fill(el, h('div', { class: 'banner' }, icon('download', 'xl'),
      h('div', { class: 'grow' }, h('h3', null, 'FFmpeg indiriliyor'),
        h('p', null, 'x264, x265 ve SRT içeren bir build. Bittiğinde presetler hemen açılır.'),
        h('div', { class: 'bar', style: { marginTop: '10px' } }, h('i', { id: 'ffDlBar2', style: { width: `${S.ffDl.pct || 0}%` } })))));
    return;
  }
  fill(el, h('div', { class: 'banner' }, icon('alert', 'xl'),
    h('div', { class: 'grow' }, h('h3', null, 'Bu bilgisayarda FFmpeg bulunamadı'),
      h('p', null, 'bcast Studio FFmpeg’i içinde taşımaz. Tek tıkla x264, x265 ve SRT içeren güncel bir build indirir ',
        h('span', { class: 'faint' }, process_label()), '; kurulu bir FFmpeg’iniz varsa onu da seçebilirsiniz.')),
    h('div', { class: 'actions' },
      S.info.canDownloadFfmpeg ? btn('FFmpeg’i indir', downloadFf, { cls: 'primary', ic: 'download' }) : null,
      btn('Bilgisayardakini seç', chooseFf, { ic: 'folder' }))));
}
function process_label() {
  return S.info.platform === 'darwin' ? '(Martin Riedl build sunucusu, GPL)' : '(BtbN FFmpeg-Builds, GPL)';
}

api.on('ffmpeg', (ev) => {
  if (ev.type !== 'progress' || !S.ffDl) return;
  S.ffDl.step = ev.step;
  if (ev.total) S.ffDl.pct = (ev.received / ev.total) * 100;
  const pct = S.ffDl.pct || 0;
  const label = $('#ffDlLabel');
  if (label) label.textContent = ev.step === 'unpack' ? 'FFmpeg açılıyor…' : `FFmpeg indiriliyor %${Math.floor(pct)}${ev.total ? '' : ` (${fmtSize(ev.received)})`}`;
  for (const id of ['#ffDlBar', '#ffDlBar2']) { const b = $(id); if (b) b.style.width = `${pct}%`; }
});

// ---------------------------------------------------------------------------
// navigation
// ---------------------------------------------------------------------------
function setView(v) {
  S.view = v;
  for (const b of document.querySelectorAll('.nav-item')) b.classList.toggle('active', b.dataset.view === v);
  $('#view-local').classList.toggle('hidden', v !== 'local');
  $('#view-servers').classList.toggle('hidden', v !== 'servers');
  if (v === 'servers') { renderServers(); if (S.sel && !S.sinfo[S.sel]) loadInfo(S.sel); }
}

function renderNav() {
  const running = (where) => S.jobs.filter((j) => (where === 'local' ? j.where === 'local' : j.where !== 'local') && ['running', 'starting'].includes(j.status)).length;
  const lr = running('local'), rr = running('remote');
  fill($('#navLocal'), icon('monitor'), h('span', { class: 'grow' }, h('span', { class: 't' }, 'Bu bilgisayar'),
    h('span', { class: 's' }, S.ff ? `FFmpeg ${S.ff.version.replace(/-cemalcloud$/, '')}` : S.ff === null ? 'FFmpeg yok' : '…')),
    lr ? badge(String(lr), 'ok') : null);
  const inst = Object.values(S.inst).filter((x) => x.running).length;
  fill($('#navServers'), icon('server'), h('span', { class: 'grow' }, h('span', { class: 't' }, 'Sunucular'),
    h('span', { class: 's' }, S.servers.length ? plural(S.servers.length, 'sunucu') : 'IP ile ekleyin')),
    rr || inst ? badge(String(rr + inst), 'info') : null);

  const act = S.jobs.filter((j) => ['running', 'starting'].includes(j.status));
  const instRows = Object.entries(S.inst).filter(([, x]) => x.running);
  const el = $('#navActivity');
  if (!act.length && !instRows.length) { el.replaceChildren(); return; }
  fill(el, h('div', { class: 'head' }, 'Şu an'),
    act.map((j) => h('div', { class: 'act', dataset: { act: j.id }, onclick: () => setView(j.where === 'local' ? 'local' : 'servers') },
      h('div', { class: 'n ellipsis' }, j.name), h('div', { class: 'faint', style: { fontSize: '11px' } },
        `${j.preset}${j.where !== 'local' ? ` · ${serverName(j.where)}` : ''}`),
      h('div', { class: `bar${j.pct == null ? ' indeterminate' : ''}` }, h('i', { style: { width: `${j.pct || 0}%` } })))),
    instRows.map(([id]) => h('div', { class: 'act', onclick: () => { S.sel = id; setView('servers'); } },
      h('div', { class: 'n ellipsis' }, `Kurulum: ${serverName(id)}`),
      h('div', { class: 'bar indeterminate' }, h('i')))));
}

function renderFoot() {
  const repo = 'https://github.com/cemal-demirci/ffmpeg-broadcast';
  fill($('#sidebarFoot'),
    h('div', { class: 'links' },
      h('button', { class: 'link', onclick: () => api.openExternal(repo) }, 'GitHub'),
      h('button', { class: 'link', onclick: () => api.openExternal(`${repo}/blob/main/LICENSE`) }, 'Lisans'),
      h('button', { class: 'link', onclick: () => api.openExternal('mailto:cemaldemirci0034@gmail.com?subject=bcast%20Studio%20ticari%20lisans') }, 'Ticari lisans')),
    h('div', null, `bcast Studio ${S.info.version} · Cemal.cloud`),
    h('div', null, 'Ticari olmayan kullanım ücretsiz.'));
}

// ---------------------------------------------------------------------------
// local: sources
// ---------------------------------------------------------------------------
async function addFiles(paths) {
  const fresh = [];
  for (const p of paths) {
    if (!p || S.staged.some((s) => s.input === p)) continue;
    const s = { input: p, name: base(p), probing: true };
    S.staged.push(s);
    fresh.push(s);
  }
  if (!fresh.length) return;
  renderSources(); renderActions();
  await Promise.all(fresh.map(probeOne));
  renderSources(); refreshFit();
}

async function probeOne(s) {
  s.probing = true; s.error = null;
  try { Object.assign(s, await api.probe(s.input)); } catch (e) { s.error = e.message; s.errorCode = e.code; }
  s.probing = false;
}

async function reprobe() {
  const again = S.staged.filter((s) => s.error);
  if (!again.length) { refreshFit(); return; }
  await Promise.all(again.map(probeOne));
  renderSources(); refreshFit();
}

let fitTimer = null;
function refreshFit() {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(async () => {
    const inputs = S.staged.filter((s) => !s.error && !s.probing).map((s) => s.input);
    if (!inputs.length || !S.ff) { S.fit = {}; renderPresets(); renderSources(); renderActions(); return; }
    try { S.fit = await api.fit(inputs, { ...S.opts, outDir: S.outDir || undefined }); } catch { S.fit = {}; }
    renderPresets(); renderSources(); renderActions();
  }, 120);
}

function renderSources() {
  const card = $('#sourcesCard');
  const n = S.staged.length;
  const drop = h('div', { class: `dropzone${n ? ' compact' : ''}`, id: 'dropzone', role: 'button', tabindex: '0',
    onclick: pickFiles, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFiles(); } } },
  icon('upload', 'xl'),
  n ? h('b', null, 'Daha fazla dosya bırakın ya da tıklayın')
    : [h('b', null, 'Kaynak dosyaları buraya bırakın'), h('div', null, 'ya da tıklayıp seçin. MXF, MOV, MP4, TS, WAV… FFmpeg’in okuduğu her şey.')]);
  const fit = S.fit[S.preset];
  const rows = S.staged.map((s) => {
    const audio = s.src && !s.src.width;
    let state = null, why = null;
    if (s.probing) state = badge('okunuyor…');
    else if (s.error) { state = badge('okunamadı', 'err'); why = h('div', { class: 'why err' }, s.error); }
    else if (fit && fit.reasons[s.input]) { state = badge('uymuyor', 'warn'); why = h('div', { class: 'why' }, fit.reasons[s.input]); }
    else if (fit) state = badge('uygun', 'ok');
    return h('div', { class: 'src', dataset: { src: s.input } },
      h('div', { class: `thumb ${audio ? 'audio' : 'video'}` }, icon(audio ? 'wave' : 'film', 'lg')),
      h('div', { class: 'grow' },
        h('div', { class: 'name ellipsis', title: s.input }, s.name),
        h('div', { class: 'meta ellipsis', title: s.desc || s.input }, s.src ? [describeTr(s.src), s.duration ? ` · ${fmtDur(s.duration)}` : '', s.size ? ` · ${fmtSize(s.size)}` : ''] : s.input),
        why),
      h('div', { class: 'fit' }, state),
      iconBtn('x', 'Listeden çıkar', () => { S.staged = S.staged.filter((x) => x !== s); renderSources(); refreshFit(); renderActions(); }));
  });
  fill(card,
    h('div', { class: 'card-head' }, h('h2', null, 'Kaynaklar'), n ? h('span', { class: 'sub' }, plural(n, 'dosya')) : null,
      h('span', { class: 'spacer' }),
      btn('Dosya ekle', pickFiles, { cls: 'sm', ic: 'plus' }),
      n ? btn('Temizle', () => { S.staged = []; S.fit = {}; renderSources(); renderPresets(); renderActions(); }, { cls: 'ghost sm' }) : null),
    drop,
    n ? h('div', { class: 'src-list' }, rows) : null);
}

async function pickFiles() {
  try { addFiles(await api.pickFiles()); } catch (e) { toast('err', e.message); }
}

// ---------------------------------------------------------------------------
// local: presets and options
// ---------------------------------------------------------------------------
function renderPresets() {
  const card = $('#presetsCard');
  if (!card) return;
  const counts = {};
  for (const p of S.presets) counts[p.category] = (counts[p.category] || 0) + 1;
  const list = S.presets.filter((p) => S.cat === 'all' || p.category === S.cat);
  const items = list.map((p) => {
    const miss = missingFor(p.name);
    const f = S.fit[p.name];
    const bad = f && f.total ? f.total - f.ok : 0;
    const firstReason = f && Object.values(f.reasons)[0];
    return h('button', { class: `preset${p.name === S.preset ? ' on' : ''}${miss.length ? ' off' : ''}`, type: 'button', role: 'radio',
      'aria-checked': String(p.name === S.preset), dataset: { preset: p.name },
      onclick: () => { S.preset = p.name; saveSettings(); renderPresets(); renderSources(); renderActions(); } },
    h('span', { class: 'radio' }),
    h('span', { class: 'grow' },
      h('div', { class: 'pn' }, p.name),
      h('div', { class: 'pd' }, p.desc),
      miss.length || bad ? h('div', { class: 'pw' },
        miss.length ? badge(`bu FFmpeg’de yok: ${miss.join(', ')}`, 'err') : null,
        bad ? (f.ok ? badge(`${f.ok}/${f.total} kaynağa uygun`, '', firstReason) : badge(f.total === 1 ? 'bu kaynağa uymuyor' : 'kaynaklara uymuyor', 'warn', firstReason)) : null) : null),
    h('span', { class: 'ext' }, badge(extLabel(p), 'mono')));
  });
  const prev = $('#presetList');
  const keep = prev ? prev.scrollTop : null;
  fill(card,
    h('div', { class: 'card-head' }, h('h2', null, 'Preset'), h('span', { class: 'sub' }, String(S.presets.length))),
    h('div', { class: 'cat-tabs', role: 'tablist' },
      [['all', 'Tümü']].concat(S.info.categories.filter((c) => counts[c]).map((c) => [c, CAT_SHORT[c]]))
        .map(([c, label]) => h('button', { type: 'button', class: S.cat === c ? 'on' : '', role: 'tab', 'aria-selected': String(S.cat === c),
          title: c === 'all' ? `${S.presets.length} preset` : `${CAT[c]}: ${counts[c]} preset`,
          onclick: () => { S.cat = c; renderPresets(); } }, label))),
    h('div', { class: 'preset-list', role: 'radiogroup', id: 'presetList' }, items));
  if (keep != null && prev.isConnected === false) $('#presetList').scrollTop = keep;
}

function renderOptions() {
  const o = S.opts;
  const tc = h('input', { class: `input mono${o.tc && !TC_RE.test(o.tc) ? ' invalid' : ''}`, id: 'optTc', placeholder: '10:00:00:00', value: o.tc, maxlength: '11',
    oninput: (e) => { o.tc = e.target.value.trim(); e.target.classList.toggle('invalid', !!o.tc && !TC_RE.test(o.tc)); saveSettings(); renderActions(); refreshFit(); } });
  const tracks = h('select', { class: 'input', id: 'optTracks', onchange: (e) => { o.tracks = e.target.value; saveSettings(); refreshFit(); } },
    [['', 'Preset’e göre'], ['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16']].map(([v, l]) => h('option', { value: v, selected: o.tracks === v ? 'selected' : null }, l)));
  const out = S.outDir
    ? h('div', { class: 'row', style: { height: '34px' } }, h('button', { class: 'btn sm grow', type: 'button', title: S.outDir, onclick: pickOutDir }, icon('folder'), h('span', { class: 'ellipsis mono' }, base(S.outDir) || S.outDir)),
      iconBtn('x', 'Kaynağın yanına yaz', () => { S.outDir = ''; saveSettings(); renderOptions(); }))
    : h('div', { class: 'row', style: { height: '34px' } }, h('button', { class: 'btn sm grow', type: 'button', onclick: pickOutDir, title: 'Çıktılar her kaynağın kendi klasörüne yazılır' }, icon('folder'), 'Kaynağın yanına'));
  fill($('#optionsCard'),
    h('div', { class: 'card-head' }, h('h2', null, 'Seçenekler'), h('span', { class: 'sub' }, 'alan sırası, frame rate ve ses düzeni kaynağa göre kendiliğinden ayarlanır')),
    h('div', { class: 'opt-grid' },
      h('div', { class: 'field s3' }, toggle('EBU R128 ses seviyesi', '-23 LUFS, -1 dBTP, LRA 7', o.r128, (v) => { o.r128 = v; saveSettings(); }, 'optR128')),
      h('div', { class: 'field s3' }, toggle('Üzerine yaz', 'Aynı adlı çıktı varsa değiştir', o.overwrite, (v) => { o.overwrite = v; saveSettings(); }, 'optOverwrite')),
      h('div', { class: 'field s2' }, h('label', { for: 'optTc', title: 'MXF ve MOV çıktılarına yazılır' }, 'Başlangıç timecode'), tc),
      h('div', { class: 'field s2' }, h('label', { for: 'optTracks' }, 'Mono ses track'), tracks),
      h('div', { class: 'field s2' }, h('span', { class: 'lbl' }, 'Çıktı klasörü'), out),
      h('div', { class: 'field s6' }, h('span', { class: 'lbl', title: 'Kaynağın metadatası yanlışsa elle seçin; normalde ffprobe karar verir.' }, 'Kaynak tarama (metadata yanlışsa)'),
        seg([['', 'Otomatik (ffprobe)'], ['i', 'Interlaced'], ['p', 'Progressive']], o.srcScan, (v) => { o.srcScan = v; saveSettings(); renderOptions(); refreshFit(); }, 'full'))));
}

async function pickOutDir() {
  const d = await api.pickDir();
  if (d) { S.outDir = d; saveSettings(); renderOptions(); }
}

function readyInputs() {
  const fit = S.fit[S.preset];
  return S.staged.filter((s) => !s.error && !s.probing && !(fit && fit.reasons[s.input]));
}

function renderActions() {
  const el = $('#actionBar');
  const ready = readyInputs();
  const skipped = S.staged.filter((s) => !s.probing).length - ready.length;
  const miss = missingFor(S.preset);
  const tcBad = S.opts.tc && !TC_RE.test(S.opts.tc);
  let why = '';
  if (!S.ff) why = 'Önce FFmpeg gerekli.';
  else if (miss.length) why = `Bu FFmpeg ${S.preset} için ${miss.join(', ')} içermiyor.`;
  else if (tcBad) why = 'Timecode 10:00:00:00 biçiminde olmalı.';
  else if (!S.staged.length) why = 'Kaynak dosya ekleyin.';
  else if (!ready.length) why = 'Seçili preset bu kaynaklara uymuyor.';
  else if (skipped > 0) why = `${skipped} dosya bu presete uymadığı ya da okunamadığı için atlanacak.`;
  const disabled = !S.ff || !!miss.length || tcBad || !ready.length;
  fill(el, h('div', { class: 'col', style: { gap: '0', width: '100%' } },
    h('div', { class: 'row' },
      btn('Komut', showCommand, { ic: 'terminal', cls: 'lg', disabled, title: 'Çalıştırmadan, tam FFmpeg komutunu gösterir', id: 'btnShow' }),
      btn(ready.length > 1 ? `${ready.length} işi kuyruğa ekle` : 'Kuyruğa ekle', enqueueLocal, { cls: 'primary lg grow', ic: 'play', disabled, id: 'btnQueue' })),
    why ? h('div', { class: 'why' }, why) : null));
}

async function showCommand() {
  const s = readyInputs()[0];
  if (!s) return;
  try {
    const r = await api.plan({ preset: S.preset, input: s.input, ...S.opts, outDir: S.outDir || undefined });
    commandModal(`${S.preset} · ${s.name}`, r.argv, r.command, describeTr(s.src));
  } catch (e) { toast('err', e.message, 8000); }
}

function prettyArgv(argv) {
  // one option and its values per line, the output on its own line, like a hand-written script
  const q = (a) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);
  const groups = [[q(argv[0])]];
  argv.slice(1, -1).forEach((a) => { if (/^-[a-zA-Z]/.test(a)) groups.push([q(a)]); else groups[groups.length - 1].push(q(a)); });
  if (argv.length > 1) groups.push([q(argv[argv.length - 1])]);
  return groups.map((g) => g.join(' ')).join(' \\\n  ');
}

function commandModal(title, argv, command, source) {
  modal({
    title, wide: true,
    body: h('div', { class: 'col', style: { gap: '10px' } },
      source ? h('div', { class: 'muted' }, 'Kaynak: ', h('span', { class: 'mono' }, source)) : null,
      h('pre', { class: 'cmd', id: 'cmdText' }, argv ? prettyArgv(argv) : command)),
    foot: (close) => [h('span', { class: 'left faint' }, 'bcast --show ile aynı komut; uygulama da tam olarak bunu çalıştırır.'),
      btn('Kopyala', async () => { await api.copy(command); toast('ok', 'Komut panoya kopyalandı.', 2500); }, { ic: 'copy' }),
      btn('Kapat', close, { cls: 'ghost' })],
  });
}

// ---------------------------------------------------------------------------
// jobs (local and remote share the queue)
// ---------------------------------------------------------------------------
function enqueueLocal() {
  const ready = readyInputs();
  for (const s of ready) {
    S.jobs.push({ id: newId(), where: 'local', input: s.input, name: s.name, preset: S.preset, status: 'queued', log: [],
      duration: s.duration, src: s.src, o: { preset: S.preset, input: s.input, ...S.opts, outDir: S.outDir || undefined } });
  }
  toast('ok', ready.length > 1 ? `${ready.length} iş kuyruğa eklendi.` : 'İş kuyruğa eklendi.', 2500);
  renderJobs(); pump();
}

function pump() {
  const busy = new Set(S.jobs.filter((j) => ['running', 'starting'].includes(j.status)).map((j) => j.where));
  for (const j of S.jobs) {
    if (j.status === 'queued' && !busy.has(j.where)) { busy.add(j.where); startJob(j); }
  }
  renderNav();
}

async function startJob(j) {
  j.status = 'starting'; j.pct = null; j.error = null; j.log = [];
  updateJob(j);
  try {
    const r = j.where === 'local' ? await api.startJob(j.id, j.o) : await api.runRemote(j.where, j.id, j.o);
    if (!j.output) j.output = r.output;
    if (j.status === 'starting') j.status = 'running';
  } catch (e) {
    j.status = 'failed'; j.error = e.message;
    pump();
  }
  updateJob(j);
}

function finishedNotice(j) {
  if (document.hasFocus()) return;
  try { new Notification(j.status === 'done' ? 'İş bitti' : 'İş başarısız', { body: `${j.name} → ${j.preset}`, silent: false }); } catch { /* not allowed */ }
}

function lastError(j) {
  const lines = j.log.filter((l) => !/^\s*(frame|size|time|bitrate|speed)=/.test(l));
  const pick = lines.slice().reverse().find((l) => /error|invalid|failed|not |unable|cannot|no such|bcast:/i.test(l)) || lines[lines.length - 1];
  return pick ? pick.replace(/^bcast:\s*/, '').trim() : '';
}

api.on('job', (ev) => {
  const j = S.jobs.find((x) => x.id === ev.id);
  if (!j) return;
  switch (ev.type) {
    case 'start':
      Object.assign(j, { command: ev.command, argv: ev.argv, duration: ev.duration, output: ev.output, status: 'running' });
      updateJob(j); renderNav();
      break;
    case 'progress':
      Object.assign(j, { pct: ev.pct, speed: ev.speed, eta: ev.eta, time: ev.time, fps: ev.fps });
      updateProgress(j);
      break;
    case 'log':
      j.log.push(ev.line);
      if (j.log.length > 800) j.log.splice(0, j.log.length - 800);
      if (logView && logView.id === j.id) logView.append(ev.line);
      break;
    case 'done':
      j.status = ev.cancelled ? 'cancelled' : ev.code === 0 ? 'done' : 'failed';
      j.seconds = ev.seconds;
      if (j.status === 'done') j.pct = 100;
      if (j.status === 'failed') j.error = lastError(j) || `ffmpeg ${ev.code} koduyla çıktı`;
      updateJob(j); finishedNotice(j); pump();
      break;
    case 'error':
      j.status = 'failed'; j.error = ev.error;
      updateJob(j); finishedNotice(j); pump();
      break;
    default:
  }
});

const STATUS = { queued: ['sırada', ''], starting: ['başlıyor', 'info'], running: ['çalışıyor', 'ok'], done: ['bitti', 'ok'], failed: ['hata', 'err'], cancelled: ['iptal', 'warn'] };

function statsText(j) {
  if (j.status === 'running' || j.status === 'starting') {
    if (j.pct == null) return j.time ? `${fmtDur(j.time)} işlendi` : 'hazırlanıyor';
    const parts = [`%${Math.floor(j.pct)}`];
    if (j.speed) parts.push(`${j.speed.toFixed(2)}x`);
    if (j.eta != null) parts.push(`kalan ${fmtDur(j.eta)}`);
    return parts.join(' · ');
  }
  if (j.status === 'done') return j.seconds ? `${fmtDur(j.seconds)} sürdü` : 'bitti';
  if (j.status === 'queued') return 'sırada';
  return '';
}

function jobRow(j) {
  const [label, cls] = STATUS[j.status];
  const active = ['running', 'starting'].includes(j.status);
  const finished = ['done', 'failed', 'cancelled'].includes(j.status);
  const acts = [];
  if (j.command) acts.push(iconBtn('terminal', 'Komut', () => commandModal(`${j.preset} · ${j.name}`, j.argv, j.command, j.src ? describeTr(j.src) : null)));
  if (j.log.length) acts.push(iconBtn('list', 'Kayıt', () => openLog(j)));
  if (j.status === 'done' && j.where === 'local') acts.push(iconBtn('folder', 'Klasörde göster', () => api.showItem(j.output)));
  if (active || j.status === 'queued') acts.push(iconBtn('stop', 'İptal', () => cancelJob(j), 'ghost danger'));
  if (j.status === 'failed' || j.status === 'cancelled') acts.push(iconBtn('refresh', 'Yeniden dene', () => { j.status = 'queued'; j.output = null; updateJob(j); pump(); }));
  if (finished) acts.push(iconBtn('x', 'Listeden kaldır', () => { S.jobs = S.jobs.filter((x) => x !== j); renderJobs(); if (j.where !== 'local') renderServerDetail(); }));
  const barCls = j.status === 'done' ? ' done' : j.status === 'failed' ? ' fail' : active && j.pct == null ? ' indeterminate' : '';
  return h('div', { class: `job ${j.status}`, dataset: { job: j.id } },
    h('div', { class: 'top' },
      h('span', { class: 'title ellipsis', title: j.input }, j.name), h('span', { class: 'arrow' }, '→'), h('span', { class: 'jpreset' }, j.preset),
      j.where !== 'local' && S.view === 'local' ? h('span', { class: 'where' }, serverName(j.where)) : null,
      badge(label, cls),
      h('div', { class: 'actions' }, acts)),
    j.output ? h('div', { class: 'out ellipsis', title: j.output }, j.output) : null,
    j.status !== 'queued' ? h('div', { class: 'prog' },
      h('div', { class: `bar${barCls}` }, h('i', { style: { width: `${j.status === 'done' ? 100 : j.pct || 0}%` } })),
      h('span', { class: 'stats' }, statsText(j))) : null,
    j.status === 'failed' && j.error ? h('div', { class: 'err' }, j.error) : null);
}

function updateJob(j) {
  const els = document.querySelectorAll(`[data-job="${j.id}"]`);
  if (!els.length) { if (j.where === 'local') renderJobs(); else renderServerDetail(); return; }
  for (const el of els) el.replaceWith(jobRow(j));
  renderJobsHead();
}

function updateProgress(j) {
  for (const el of document.querySelectorAll(`[data-job="${j.id}"]`)) {
    const bar = el.querySelector('.bar');
    if (bar && j.pct != null) { bar.classList.remove('indeterminate'); bar.querySelector('i').style.width = `${j.pct}%`; }
    const st = el.querySelector('.stats');
    if (st) st.textContent = statsText(j);
  }
  const a = document.querySelector(`[data-act="${j.id}"] .bar`);
  if (a && j.pct != null) { a.classList.remove('indeterminate'); a.querySelector('i').style.width = `${j.pct}%`; }
}

async function cancelJob(j) {
  if (j.status === 'queued') { j.status = 'cancelled'; updateJob(j); pump(); return; }
  try { await api.cancelJob(j.id); } catch (e) { toast('err', e.message); }
}

function renderJobsHead() {
  const head = $('#jobsHead');
  if (!head) return;
  const local = S.jobs.filter((j) => j.where === 'local');
  const run = local.filter((j) => ['running', 'starting'].includes(j.status)).length;
  const q = local.filter((j) => j.status === 'queued').length;
  const fin = local.filter((j) => ['done', 'failed', 'cancelled'].includes(j.status)).length;
  fill(head, h('h2', null, 'İşler'),
    h('span', { class: 'sub' }, [run ? `${run} çalışıyor` : '', q ? `${q} sırada` : ''].filter(Boolean).join(' · ')),
    h('span', { class: 'spacer' }),
    fin ? btn('Bitenleri temizle', () => { S.jobs = S.jobs.filter((j) => j.where !== 'local' || !['done', 'failed', 'cancelled'].includes(j.status)); renderJobs(); }, { cls: 'ghost sm' }) : null);
  renderNav();
}

function renderJobs() {
  const local = S.jobs.filter((j) => j.where === 'local');
  fill($('#jobsCard'),
    h('div', { class: 'card-head', id: 'jobsHead' }),
    local.length ? h('div', { class: 'jobs' }, local.map(jobRow))
      : h('div', { class: 'empty' }, 'Henüz iş yok. Kaynak ekleyin, preset seçin, kuyruğa ekleyin; işler sırayla çalışır.'));
  renderJobsHead();
}

let logView = null;
function openLog(j) {
  const pre = h('pre', { class: 'cmd', style: { maxHeight: '60vh', minHeight: '240px' } }, j.log.join('\n'));
  logView = { id: j.id, append: (line) => { const near = pre.scrollTop + pre.clientHeight > pre.scrollHeight - 30; pre.append(`\n${line}`); if (near) pre.scrollTop = pre.scrollHeight; } };
  modal({
    title: `Kayıt · ${j.name}`, wide: true, body: pre,
    onClose: () => { logView = null; },
    foot: (close) => [h('span', { class: 'left' }), btn('Kopyala', () => api.copy(j.log.join('\n')).then(() => toast('ok', 'Kayıt kopyalandı.', 2000)), { ic: 'copy' }), btn('Kapat', close, { cls: 'ghost' })],
  });
  setTimeout(() => { pre.scrollTop = pre.scrollHeight; }, 20);
}

// ---------------------------------------------------------------------------
// servers
// ---------------------------------------------------------------------------
const serverName = (id) => { const s = S.servers.find((x) => x.id === id); return s ? s.name || s.host : 'sunucu'; };
const inst = (id) => (S.inst[id] ||= { lines: [], step: null, failed: false, compiled: 0, running: false, code: null, t0: 0, presetsOnly: false });
const rform = (id) => (S.rform[id] ||= { input: '', output: '', preset: S.settings.remotePreset || S.preset || 'xdcam-hd422-1080i25', r128: false, overwrite: false, tc: '' });

async function reloadServers() {
  S.servers = await api.servers();
  if (S.sel && !S.servers.some((s) => s.id === S.sel)) S.sel = null;
  if (!S.sel && S.servers[0]) S.sel = S.servers[0].id;
  renderNav();
  if (S.view === 'servers') renderServers();
}

async function loadInfo(id) {
  S.sinfo[id] = { ...(S.sinfo[id] || {}), loading: true, error: null };
  if (S.sel === id) renderServerDetail();
  renderServerList();
  try {
    const info = await api.serverInfo(id);
    S.sinfo[id] = { info };
    if (info.following || info.installing) { const st = inst(id); if (!st.running) { st.running = true; st.t0 = Date.now(); st.lines = []; st.compiled = 0; st.step = null; } }
  } catch (e) {
    S.sinfo[id] = { error: e.message, code: e.code, extra: { known: e.known, presented: e.presented } };
    if (e.code === 'HOST_KEY_CHANGED') hostKeyModal(id, e);
  }
  if (S.sel === id) renderServerDetail();
  renderServerList(); renderNav();
}

function renderServers() {
  $('.servers-grid').classList.toggle('none', !S.servers.length);
  renderServerList(); renderServerDetail();
}

function renderServerList() {
  const el = $('#serverList');
  const rows = S.servers.map((s) => {
    const si = S.sinfo[s.id] || {};
    const st = inst(s.id).running ? 'busy' : si.error ? 'err' : si.info ? 'ok' : '';
    return h('button', { class: `srv${s.id === S.sel ? ' on' : ''}`, type: 'button', dataset: { server: s.id },
      onclick: () => { S.sel = s.id; saveSettings(); renderServers(); if (!S.sinfo[s.id]) loadInfo(s.id); } },
    h('span', { class: 'avatar' }, icon('server', 'lg'), h('span', { class: `st ${st}` })),
    h('span', { class: 'grow' },
      h('div', { class: 'n ellipsis' }, s.name || s.host),
      h('div', { class: 'h ellipsis' }, `${s.username}@${s.host}${s.port !== 22 ? `:${s.port}` : ''}`)),
    si.info && si.info.ffmpeg ? badge('kurulu', 'ok') : si.info ? badge('boş') : null);
  });
  fill(el,
    h('div', { class: 'card-head', style: { margin: '0 2px 4px' } }, h('h2', null, 'Sunucular'), h('span', { class: 'spacer' }),
      btn('Sunucu ekle', () => serverForm(), { cls: 'primary sm', ic: 'plus', id: 'btnAddServer' })),
    rows,
    S.servers.length ? h('div', { class: 'faint', style: { fontSize: '11.5px', padding: '6px 4px' } },
      'Bağlantı SSH ile; sunucu kimliği ilk bağlantıda kaydedilir, değişirse uyarılırsınız.') : null);
}

function renderServerDetail() {
  const el = $('#serverDetail');
  if (!el) return;
  if (!S.sel) {
    fill(el, h('div', { class: 'card empty-hero' }, icon('server', 'xl'),
      h('h2', null, 'Dosya sunucudaysa, kodlama da orada olsun'),
      h('p', null, 'IP adresi, kullanıcı adı ve şifre (ya da SSH anahtarı) yeter. Dosyalar sunucuda kalır; buraya yalnızca ilerleme gelir.'),
      h('div', { class: 'how' },
        h('div', null, h('b', null, '1'), h('span', null, 'Sunucuyu ekleyin'), h('small', null, 'sunucu kimliği ilk bağlantıda kaydedilir')),
        h('div', null, h('b', null, '2'), h('span', null, 'Tek tıkla kurun'), h('small', null, 'FFmpeg kaynaktan derlenir, /opt/ffmpeg-broadcast')),
        h('div', null, h('b', null, '3'), h('span', null, 'Dosyayı seçip kodlayın'), h('small', null, 'aynı 19 preset, aynı komut'))),
      btn('Sunucu ekle', () => serverForm(), { cls: 'primary lg', ic: 'plus', id: 'btnAddServerHero' })));
    return;
  }
  const s = S.servers.find((x) => x.id === S.sel);
  if (!s) { S.sel = null; renderServerDetail(); return; }
  const si = S.sinfo[s.id] || {};
  fill(el, overviewCard(s, si), si.info ? installCard(s, si.info) : null, si.info ? remoteJobCard(s, si.info) : null);
}

function overviewCard(s, si) {
  const i = si.info;
  const sudo = i && (i.sudo === '' ? 'root' : i.sudo === 'nopass' ? 'şifresiz' : i.sudo === 'password' ? 'şifreyle' : i.sudo && i.sudo.error ? 'yok' : '—');
  let body;
  if (si.loading && !i) body = h('div', { class: 'tiles' }, ['Sistem', 'İşlemci', 'Bellek', 'Boş disk', 'sudo', 'FFmpeg'].map((k) => h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v faint' }, '…'))));
  else if (si.error) {
    body = h('div', { class: 'note err', style: { marginTop: '14px' } }, icon('alert'),
      h('div', { class: 'grow' }, h('div', null, si.error),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          si.code === 'HOST_KEY_CHANGED' ? btn('Kimliği incele', () => hostKeyModal(s.id, si.extra), { cls: 'sm' }) : null,
          ['AUTH', 'SUDO', 'KEY_READ'].includes(si.code) ? btn('Düzenle', () => serverForm(s), { cls: 'sm', ic: 'edit' }) : null,
          btn('Tekrar dene', () => loadInfo(s.id), { cls: 'sm', ic: 'refresh' }))));
  } else if (i) {
    body = [h('div', { class: 'tiles' },
      tile('Sistem', i.os || '?'), tile('İşlemci', `${i.cpus} çekirdek · ${i.arch}`), tile('Bellek', `${i.memGB} GB`),
      tile('Boş disk', `${i.freeDiskGB} GB`, '/var/tmp'), tile('sudo', sudo, i.sudo && i.sudo.error),
      tile('FFmpeg', i.ffmpeg ? i.ffmpeg.replace(/-cemalcloud$/, '') : 'kurulu değil', null, !!i.ffmpeg)),
    i.sudo && i.sudo.error ? h('div', { class: 'note warn', style: { marginTop: '10px' } }, icon('alert'), h('div', null, i.sudo.error)) : null,
    i.hostKey ? h('div', { class: 'hostkey' }, icon('shield'), 'Sunucu kimliği ', h('span', { class: 'mono selectable' }, i.hostKey),
      i.newHostKey ? h('span', null, ' · ilk bağlantıda kaydedildi') : null) : null];
  } else body = null;
  return h('div', { class: 'card' },
    h('div', { class: 'hero' },
      h('div', { class: 'big' }, icon('server', 'xl')),
      h('div', { class: 'grow' }, h('h1', { class: 'ellipsis' }, s.name || s.host), h('div', { class: 'addr selectable' }, `${s.username}@${s.host}:${s.port}`)),
      h('div', { class: 'acts' },
        iconBtn('refresh', 'Yenile', () => loadInfo(s.id)),
        btn('Düzenle', () => serverForm(s), { cls: 'sm', ic: 'edit' }),
        btn('Sil', () => removeServer(s), { cls: 'sm danger', ic: 'trash' }))),
    body);
}

function tile(k, v, title, accent) {
  return h('div', { class: 'tile', title: title || v }, h('div', { class: 'k' }, k), h('div', { class: 'v', style: accent ? { color: 'var(--accent)' } : null }, v));
}

const STEPS = [
  ['deps', 'Paketler', /Installing build dependencies/],
  ['src', 'Kaynak kod', /Cloning/],
  ['conf', 'Yapılandırma', /Configuring/],
  ['build', 'Derleme', /Building with/],
  ['inst', 'Kurulum', /Installing to/],
  ['done', 'Bitti', /\] Done\.|presets installed/],
];

function installCard(s, i) {
  const st = inst(s.id);
  const children = [];
  const head = h('div', { class: 'card-head' }, h('h2', null, 'ffmpeg-broadcast'),
    st.running ? badge('kuruluyor', 'info') : i.ffmpeg ? badge(`${i.ffmpeg.replace(/-cemalcloud$/, '')} · ${i.presets} preset`, 'ok') : badge('kurulu değil'),
    h('span', { class: 'spacer' }));
  children.push(head);
  if (!i.apt) children.push(h('div', { class: 'note warn' }, icon('alert'), h('div', null, `Kurulum Ubuntu / Debian (apt) bekliyor; bu sunucu: ${i.os}. Sunucuda zaten /opt/ffmpeg-broadcast varsa işler yine çalışır.`)));

  if (st.running || st.lines.length) {
    if (!st.presetsOnly) {
      const at = STEPS.findIndex(([k]) => k === st.step);
      children.push(h('div', { class: 'steps' }, STEPS.map(([k, label], idx) => {
        let c = '';
        if (st.failed && idx === Math.max(at, 0)) c = 'fail';
        else if (idx < at || (!st.running && st.code === 0)) c = 'done';
        else if (idx === at && st.running) c = 'now';
        else if (idx === 0 && at < 0 && st.running) c = 'now';
        return h('span', { class: `step ${c}` }, h('span', { class: 'd' }), label);
      })));
    }
    const term = h('div', { class: `term${st.running && !st.presetsOnly ? ' live' : ''}`, id: `term-${s.id}` });
    for (const l of st.lines.slice(-700)) term.append(termLine(l));
    setTimeout(() => { term.scrollTop = term.scrollHeight; }, 0);
    children.push(term);
    children.push(h('div', { class: 'term-meta', id: `termMeta-${s.id}` }, termMeta(st)));
    if (!st.running && st.code != null) {
      children.push(h('div', { class: `note ${st.code === 0 ? 'ok' : 'err'}`, style: { marginTop: '10px' } }, icon(st.code === 0 ? 'check' : 'alert'),
        h('div', null, st.code === 0 ? `Kurulum bitti${st.minutes ? ` (${st.minutes.toFixed(1)} dk)` : ''}.` : `Kurulum ${st.code} koduyla bitti. Kayıttaki son satırlara bakın; sorunu giderip tekrar deneyebilirsiniz.`)));
    }
  }

  if (!st.running) {
    if (!i.ffmpeg) {
      children.push(h('p', { class: 'muted', style: { margin: '4px 0 6px' } },
        'FFmpeg sunucuda kaynaktan derlenir ve /opt/ffmpeg-broadcast altına kurulur; sistem FFmpeg’ine dokunmaz. ',
        `${i.cpus} çekirdekte ${i.cpus >= 8 ? '5-10' : i.cpus >= 4 ? '10-15' : '15-30'} dakika sürer. Bağlantı koparsa derleme sunucuda sürer, uygulamayı açınca kaldığı yerden izlenir.`));
      const nv = { v: false };
      children.push(toggle('NVIDIA NVENC / NVDEC ekle', 'Sunucuda NVIDIA sürücüsü varsa donanım kodlama', false, (v) => { nv.v = v; }, `nvenc-${s.id}`));
      children.push(h('div', { class: 'row', style: { marginTop: '10px' } },
        btn('Sunucuya kur', () => startInstall(s.id, { nvenc: nv.v }), { cls: 'primary', ic: 'download', disabled: !i.apt || (i.sudo && i.sudo.error), id: 'btnInstall' })));
    } else {
      children.push(h('div', { class: 'row', style: { marginTop: st.lines.length ? '10px' : '0' } },
        h('span', { class: 'muted grow' }, `${i.presets} preset, ${S.info.remotePrefix}/bin`),
        btn('Presetleri güncelle', () => startInstall(s.id, { presetsOnly: true }), { cls: 'sm', ic: 'refresh', disabled: i.sudo && i.sudo.error, title: 'Bu uygulamadaki bcast ve presetleri sunucuya yükler; derleme yapmaz' }),
        btn('Yeniden derle', async () => { if (await confirmBox('Yeniden derlensin mi?', 'FFmpeg sunucuda baştan derlenir; süren işler etkilenmez ama sunucu bir süre meşgul olur.', 'Derle')) startInstall(s.id, {}); }, { cls: 'sm ghost', disabled: !i.apt })));
    }
  }
  return h('div', { class: 'card' }, children);
}

function termLine(l) {
  let cls = '';
  if (/\[cemal\.cloud ffmpeg\] ERROR|^E: |error:/i.test(l)) cls = 'l-err';
  else if (/WARN/.test(l)) cls = 'l-warn';
  else if (/\[cemal\.cloud ffmpeg\]/.test(l)) cls = 'l-step';
  else if (/^\s*(CC|CXX|AS|X86ASM|LD|AR|STRIP|GEN|HOSTCC)\s/.test(l)) cls = 'l-cc';
  return h('div', { class: cls }, l);
}

function termMeta(st) {
  const secs = st.running ? (Date.now() - st.t0) / 1000 : (st.minutes || 0) * 60;
  return [h('span', null, `süre ${fmtDur(secs)}`), st.compiled ? h('span', null, `${st.compiled} dosya derlendi`) : null, h('span', null, `${st.lines.length} satır`)];
}

async function startInstall(id, o) {
  const st = inst(id);
  Object.assign(st, { lines: [], step: null, failed: false, compiled: 0, running: true, code: null, t0: Date.now(), presetsOnly: !!o.presetsOnly, minutes: 0 });
  renderServerDetail(); renderNav(); renderServerList();
  try { await api.install(id, o); }
  catch (e) { st.running = false; st.lines.push(`hata: ${e.message}`); st.code = -1; st.failed = true; toast('err', e.message, 8000); renderServerDetail(); renderNav(); renderServerList(); }
}

const pendingLines = new Map();
let flushQueued = false;
function flushTerm() {
  flushQueued = false;
  for (const [id, lines] of pendingLines) {
    const term = document.getElementById(`term-${id}`);
    if (term) {
      const near = term.scrollTop + term.clientHeight > term.scrollHeight - 40;
      for (const l of lines) term.append(termLine(l));
      while (term.childNodes.length > 900) term.firstChild.remove();
      if (near) term.scrollTop = term.scrollHeight;
      const meta = document.getElementById(`termMeta-${id}`);
      if (meta) fill(meta, termMeta(inst(id)));
    }
  }
  pendingLines.clear();
}

api.on('install', (ev) => {
  const st = inst(ev.id);
  if (ev.type === 'compiled') {
    st.compiled = ev.n;
    const meta = document.getElementById(`termMeta-${ev.id}`);
    if (meta) fill(meta, termMeta(st));
    return;
  }
  if (ev.type === 'line') {
    if (!st.running) { st.running = true; st.t0 = st.t0 || Date.now(); }
    st.lines.push(ev.line);
    if (st.lines.length > 3000) st.lines.splice(0, st.lines.length - 3000);
    const prev = st.step;
    for (const [k, , re] of STEPS) if (re.test(ev.line)) st.step = k;
    if (/\[cemal\.cloud ffmpeg\] ERROR/.test(ev.line)) st.failed = true;
    if (st.step !== prev && S.sel === ev.id && S.view === 'servers') { renderServerDetail(); return; }
    if (!pendingLines.has(ev.id)) pendingLines.set(ev.id, []);
    pendingLines.get(ev.id).push(ev.line);
    if (!flushQueued) { flushQueued = true; requestAnimationFrame(flushTerm); }
    return;
  }
  st.running = false;
  if (ev.type === 'done') {
    st.code = ev.code; st.minutes = ev.minutes; st.failed = ev.code !== 0;
    toast(ev.code === 0 ? 'ok' : 'err', ev.code === 0 ? `${serverName(ev.id)}: kurulum bitti.` : `${serverName(ev.id)}: kurulum ${ev.code} koduyla bitti.`, 7000);
  } else {
    st.code = -1; st.failed = true; st.lines.push(`hata: ${ev.error}`);
    toast('err', `${serverName(ev.id)}: ${ev.error}`, 8000);
  }
  if (!document.hasFocus()) { try { new Notification(st.failed ? 'Kurulum başarısız' : 'Kurulum bitti', { body: serverName(ev.id) }); } catch { /* ignore */ } }
  renderNav(); renderServerList();
  loadInfo(ev.id);
});
setInterval(() => {
  for (const [id, st] of Object.entries(S.inst)) {
    if (!st.running) continue;
    const meta = document.getElementById(`termMeta-${id}`);
    if (meta) fill(meta, termMeta(st));
  }
}, 1000);

api.on('server', (ev) => {
  if (ev.type === 'disconnected' && S.sinfo[ev.id] && !inst(ev.id).running) renderServerList();
});

function remoteJobCard(s, i) {
  const f = rform(s.id);
  const jobs = S.jobs.filter((j) => j.where === s.id);
  const can = !!i.ffmpeg;
  const inputEl = h('input', { class: 'input mono', id: 'remoteInput', placeholder: '/srv/media/haber.mov', value: f.input,
    oninput: (e) => { f.input = e.target.value.trim(); updateRemoteOut(s.id); syncRemoteBtn(s.id); } });
  const outEl = h('input', { class: 'input mono', id: 'remoteOutput', value: f.output, placeholder: 'girdinin yanına, otomatik',
    oninput: (e) => { f.output = e.target.value.trim(); } });
  const presetSel = h('select', { class: 'input', id: 'remotePreset', onchange: (e) => { f.preset = e.target.value; api.saveSettings({ remotePreset: f.preset }).catch(() => {}); updateRemoteOut(s.id); } },
    S.info.categories.map((c) => h('optgroup', { label: CAT[c] }, S.presets.filter((p) => p.category === c).map((p) =>
      h('option', { value: p.name, selected: p.name === f.preset ? 'selected' : null }, `${p.name}  ·  ${extLabel(p)}`)))));
  const tcEl = h('input', { class: 'input mono', placeholder: '10:00:00:00', value: f.tc, maxlength: '11',
    oninput: (e) => { f.tc = e.target.value.trim(); e.target.classList.toggle('invalid', !!f.tc && !TC_RE.test(f.tc)); syncRemoteBtn(s.id); } });
  setTimeout(() => updateRemoteOut(s.id), 0);
  return h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', null, 'Sunucuda çalıştır'), h('span', { class: 'sub' }, 'dosya sunucuda kalır, yalnızca ilerleme gelir')),
    !can ? h('div', { class: 'note' }, icon('info'), h('div', null, 'Önce ffmpeg-broadcast’i kurun; sonra sunucudaki bir dosyayı seçip presetle kodlayabilirsiniz.')) : null,
    h('div', { class: 'form-grid' },
      h('div', { class: 'field full' }, h('label', { for: 'remoteInput' }, 'Girdi (sunucudaki dosya)'),
        h('div', { class: 'row' }, inputEl, btn('Gözat', () => browseModal(s.id), { ic: 'folder', disabled: !can }))),
      h('div', { class: 'field' }, h('label', { for: 'remotePreset' }, 'Preset'), presetSel),
      h('div', { class: 'field' }, h('label', null, 'Başlangıç timecode'), tcEl),
      h('div', { class: 'field full' }, h('label', { for: 'remoteOutput' }, 'Çıktı'), outEl),
      h('div', { class: 'field' }, toggle('EBU R128', '-23 LUFS', f.r128, (v) => { f.r128 = v; })),
      h('div', { class: 'field' }, toggle('Üzerine yaz', null, f.overwrite, (v) => { f.overwrite = v; }))),
    h('div', { class: 'row', style: { marginTop: '12px' } }, h('span', { class: 'grow' }),
      btn('Sunucuda çalıştır', () => enqueueRemote(s.id), { cls: 'primary', ic: 'play', id: 'btnRunRemote', disabled: !can || !f.input })),
    jobs.length ? h('div', { class: 'jobs', style: { marginTop: '14px' } }, jobs.map(jobRow)) : null);
}

function syncRemoteBtn(id) {
  const f = rform(id);
  const b = $('#btnRunRemote');
  const i = (S.sinfo[id] || {}).info;
  if (b) b.disabled = !(i && i.ffmpeg) || !f.input || (f.tc && !TC_RE.test(f.tc));
}

let outTimer = null;
function updateRemoteOut(id) {
  clearTimeout(outTimer);
  outTimer = setTimeout(async () => {
    const f = rform(id);
    const el = $('#remoteOutput');
    if (!el) return;
    if (!f.input) { el.placeholder = 'girdinin yanına, otomatik'; return; }
    try { const r = await api.remotePlan(id, { input: f.input, preset: f.preset }); el.placeholder = r.output; } catch { /* ignore */ }
  }, 150);
}

function enqueueRemote(id) {
  const f = rform(id);
  if (!f.input) return;
  if (f.tc && !TC_RE.test(f.tc)) { toast('err', 'Timecode 10:00:00:00 biçiminde olmalı.'); return; }
  S.jobs.push({ id: newId(), where: id, input: f.input, name: base(f.input), preset: f.preset, status: 'queued', log: [],
    o: { preset: f.preset, input: f.input, output: f.output || undefined, r128: f.r128, overwrite: f.overwrite, tc: f.tc } });
  renderServerDetail(); pump();
}

function browseModal(id) {
  const f = rform(id);
  const pathEl = h('input', { class: 'input mono', value: '' });
  const list = h('div', { class: 'entries' });
  let cur = '.';
  const go = async (dir) => {
    fill(list, h('div', { class: 'empty' }, 'okunuyor…'));
    try {
      const r = await api.browse(id, dir);
      cur = r.path; pathEl.value = r.path;
      const parent = r.path === '/' ? null : r.path.replace(/\/[^/]+\/?$/, '') || '/';
      fill(list,
        parent ? h('button', { class: 'entry dir', type: 'button', onclick: () => go(parent) }, icon('up'), '..') : null,
        r.entries.map((e) => h('button', { class: `entry${e.dir ? ' dir' : ''}`, type: 'button', title: e.name,
          onclick: () => { const p = `${r.path === '/' ? '' : r.path}/${e.name}`; if (e.dir) go(p); else { f.input = p; m.close(); renderServerDetail(); } } },
        icon(e.dir ? 'folder' : /\.(wav|aif|aiff|mp3|flac|m4a)$/i.test(e.name) ? 'wave' : 'film'), h('span', { class: 'ellipsis' }, e.name),
        !e.dir ? h('span', { class: 'sz' }, fmtSize(e.size)) : null)),
        r.entries.length ? null : h('div', { class: 'empty' }, 'boş klasör'));
    } catch (err) { fill(list, h('div', { class: 'empty' }, err.message)); }
  };
  pathEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(pathEl.value.trim() || '/'); });
  const m = modal({
    title: `Sunucuda dosya seç · ${serverName(id)}`, wide: true,
    body: h('div', { class: 'browser' }, h('div', { class: 'path' }, icon('folder'), pathEl, btn('Git', () => go(pathEl.value.trim() || '/'), { cls: 'sm' })), list),
    foot: (close) => [h('span', { class: 'left faint' }, 'Bir dosyaya tıklayın; klasöre tıklayınca içine girer.'), btn('Kapat', close, { cls: 'ghost' })],
  });
  const start = f.input ? f.input.replace(/\/[^/]*$/, '') || '/' : '.';
  go(start).then(() => { if (!cur) go('.'); });
}

function hostKeyModal(id, e) {
  const known = (e && e.known) || '?', presented = (e && e.presented) || '?';
  modal({
    title: 'Sunucunun kimliği değişti',
    body: h('div', { class: 'col', style: { gap: '12px' } },
      h('div', { class: 'note warn' }, icon('alert'), h('div', null,
        'Bu adres daha önce başka bir kimlikle karşıladı. Sunucuyu yeniden kurduysanız ya da IP başka makineye geçtiyse normaldir. Kurmadıysanız araya giren biri olabilir; bağlanmayın, şifre göndermeyin.')),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Kayıtlı'), h('div', { class: 'mono selectable' }, known)),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Şimdi gelen'), h('div', { class: 'mono selectable' }, presented))),
    foot: (close) => [h('span', { class: 'left' }), btn('Bağlanma', close, { cls: 'ghost' }),
      btn('Yeni kimliğe güven', async () => { close(); await api.forgetHost(id); loadInfo(id); }, { cls: 'danger' })],
  });
}

async function removeServer(s) {
  const ok = await confirmBox(`${s.name || s.host} silinsin mi?`, 'Yalnızca bu listedeki kayıt, kayıtlı şifre ve sunucu kimliği silinir. Sunucudaki dosyalara ve kurulu FFmpeg’e dokunulmaz.', 'Sil', true);
  if (!ok) return;
  await api.removeServer(s.id);
  delete S.sinfo[s.id];
  if (S.sel === s.id) S.sel = null;
  await reloadServers();
}

function serverForm(existing) {
  const d = existing ? { ...existing } : { name: '', host: '', port: 22, username: '', auth: 'password', keyPath: '' };
  const sec = { password: '', passphrase: '', sudoPassword: '' };
  const keep = existing && existing.hasSecret;
  const result = h('div');
  const body = h('div');
  const input = (key, props = {}, obj = d) => h('input', { class: `input${props.mono ? ' mono' : ''}`, value: obj[key] == null ? '' : String(obj[key]),
    oninput: (e) => { obj[key] = e.target.value; }, ...props, mono: null });
  const draw = () => {
    const authFields = d.auth === 'password'
      ? h('div', { class: 'field full' }, h('label', null, 'Şifre'), input('password', { type: 'password', id: 'srvPassword', placeholder: keep ? 'kayıtlı (değiştirmek için yazın)' : '' }, sec))
      : d.auth === 'key'
        ? [h('div', { class: 'field full' }, h('label', null, 'SSH anahtarı'),
          h('div', { class: 'row' }, input('keyPath', { mono: true, placeholder: '~/.ssh/id_ed25519', id: 'srvKey' }),
            btn('Seç', async () => { const k = await api.pickKey(); if (k) { d.keyPath = k; draw(); } }, { ic: 'key' }))),
        h('div', { class: 'field full' }, h('label', null, 'Anahtar parolası'), input('passphrase', { type: 'password', placeholder: keep ? 'kayıtlı ya da yok' : 'yoksa boş bırakın' }, sec))]
        : h('div', { class: 'field full' }, h('div', { class: 'note' }, icon('info'), h('div', null,
          S.info.platform === 'win32' ? 'Windows OpenSSH agent’ındaki anahtarlar kullanılır (ssh-add ile ekleyin).' : 'SSH_AUTH_SOCK’taki agent kullanılır (ssh-add ile ekleyin; macOS Anahtar Zinciri dahil).')));
    fill(body, h('div', { class: 'form-grid' },
      h('div', { class: 'field full' }, h('label', null, 'Ad'), input('name', { placeholder: 'encoder-1', id: 'srvName' })),
      h('div', { class: 'field' }, h('label', null, 'Adres (IP ya da alan adı)'), input('host', { mono: true, placeholder: '203.0.113.10', id: 'srvHost' })),
      h('div', { class: 'field' }, h('label', null, 'Port'), input('port', { mono: true, type: 'number', min: '1', max: '65535', id: 'srvPort' })),
      h('div', { class: 'field full' }, h('label', null, 'Kullanıcı'), input('username', { mono: true, placeholder: 'ubuntu', id: 'srvUser' })),
      h('div', { class: 'field full' }, h('span', { class: 'lbl' }, 'Giriş'),
        seg([['password', 'Şifre'], ['key', 'SSH anahtarı'], ['agent', 'ssh-agent']], d.auth, (v) => { d.auth = v; draw(); }, 'full')),
      authFields,
      h('div', { class: 'field full' }, h('label', null, 'sudo şifresi (isteğe bağlı)'), input('sudoPassword', { type: 'password', id: 'srvSudo', placeholder: keep ? 'kayıtlı ya da giriş şifresi' : 'boşsa giriş şifresi denenir' }, sec),
        h('span', { class: 'hint' }, 'Kurulum root yetkisi ister. root ile ya da şifresiz sudo ile bağlanıyorsanız gerekmez.')),
      h('div', { class: 'field full' }, h('div', { class: `note${S.info.secureSecrets ? ' ok' : ' warn'}` }, icon(S.info.secureSecrets ? 'shield' : 'alert'), h('div', null,
        S.info.secureSecrets
          ? `Şifreler ${S.info.platform === 'darwin' ? 'macOS Anahtar Zinciri' : S.info.platform === 'win32' ? 'Windows DPAPI' : 'sistem anahtar deposu'} ile şifrelenip bu bilgisayarda saklanır; düz metin olarak hiçbir yere yazılmaz.`
          : 'Bu sistemde güvenli anahtar deposu yok; şifreler diske yazılmaz, yalnızca uygulama açıkken hatırlanır.'))),
      h('div', { class: 'field full' }, result)));
  };
  draw();
  const valid = () => {
    if (!d.host.trim()) return 'Adres gerekli.';
    if (!d.username.trim()) return 'Kullanıcı adı gerekli.';
    const p = Number(d.port);
    if (!(p >= 1 && p <= 65535)) return 'Port 1 ile 65535 arasında olmalı.';
    if (d.auth === 'key' && !d.keyPath) return 'SSH anahtarı dosyasını seçin.';
    if (d.auth === 'password' && !sec.password && !keep) return 'Şifre gerekli.';
    return null;
  };
  const clean = () => ({ ...d, host: d.host.trim(), username: d.username.trim(), port: Number(d.port) || 22, name: (d.name || '').trim() || d.host.trim() });
  const test = async () => {
    const err = valid();
    if (err) { fill(result, h('div', { class: 'note err' }, icon('alert'), h('div', null, err))); return; }
    fill(result, h('div', { class: 'note' }, icon('refresh'), h('div', null, 'Bağlanılıyor…')));
    try {
      const r = await api.testServer(clean(), sec);
      const sudo = r.sudo === '' ? 'root' : r.sudo === 'nopass' ? 'şifresiz sudo' : r.sudo === 'password' ? 'sudo şifreyle' : null;
      fill(result, h('div', { class: `note ${r.sudo && r.sudo.error ? 'warn' : 'ok'}` }, icon(r.sudo && r.sudo.error ? 'alert' : 'check'), h('div', null,
        h('div', null, `Bağlandı: ${r.os}, ${r.cpus} çekirdek, ${r.memGB} GB. `, sudo ? `Yetki: ${sudo}.` : r.sudo && r.sudo.error ? r.sudo.error : '',
          r.ffmpeg ? ` ffmpeg-broadcast kurulu (${r.ffmpeg}).` : ''),
        r.newHostKey ? h('div', { class: 'mono', style: { marginTop: '4px', fontSize: '11px' } }, `Sunucu kimliği kaydedildi: ${r.newHostKey}`) : null)));
    } catch (e) {
      fill(result, h('div', { class: 'note err' }, icon('alert'), h('div', null, e.message)));
      if (e.code === 'HOST_KEY_CHANGED' && existing) hostKeyModal(existing.id, e);
    }
  };
  modal({
    title: existing ? 'Sunucuyu düzenle' : 'Sunucu ekle',
    body,
    foot: (close) => [
      h('span', { class: 'left' }, btn('Bağlantıyı dene', test, { ic: 'bolt', id: 'btnTestServer' })),
      btn('Vazgeç', close, { cls: 'ghost' }),
      btn('Kaydet', async () => {
        const err = valid();
        if (err) { fill(result, h('div', { class: 'note err' }, icon('alert'), h('div', null, err))); return; }
        try {
          const saved = await api.saveServer(clean(), sec);
          close();
          delete S.sinfo[saved.id];
          S.sel = saved.id; saveSettings();
          await reloadServers();
          setView('servers');
        } catch (e) { fill(result, h('div', { class: 'note err' }, icon('alert'), h('div', null, e.message))); }
      }, { cls: 'primary', id: 'btnSaveServer' }),
    ],
  });
}

// ---------------------------------------------------------------------------
// drag and drop anywhere in the window
// ---------------------------------------------------------------------------
function bindDrop() {
  let depth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  document.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; document.body.classList.add('dragging'); });
  document.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('dragging'); });
  document.addEventListener('dragover', (e) => { e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    const paths = files.map((f) => { try { return api.pathForFile(f); } catch { return null; } }).filter(Boolean);
    if (!paths.length) return;
    setView('local');
    addFiles(paths);
  });
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------
async function init() {
  S.info = await api.appInfo();
  document.body.classList.add(`platform-${S.info.platform}`);
  S.settings = await api.settings();
  S.presets = await api.presets();
  S.preset = presetByName(S.settings.preset) ? S.settings.preset : 'xdcam-hd422-1080i25';
  Object.assign(S.opts, S.settings.options || {});
  S.outDir = S.settings.outDir || '';
  S.servers = await api.servers();
  S.sel = S.servers.some((s) => s.id === S.settings.lastServer) ? S.settings.lastServer : (S.servers[0] || {}).id || null;

  for (const b of document.querySelectorAll('.nav-item')) b.addEventListener('click', () => setView(b.dataset.view));
  bindDrop();
  renderFoot(); renderNav(); renderFf(); renderBanner();
  renderSources(); renderJobs(); renderPresets(); renderOptions(); renderActions();
  setTimeout(() => { const on = document.querySelector('.preset.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }, 0);
  await refreshFfmpeg(false);
  document.body.dataset.ready = '1';
}

window.addEventListener('error', (e) => toast('err', `Arayüz hatası: ${e.message}`, 10000));
init().catch((e) => { document.body.dataset.ready = 'error'; toast('err', `Başlatılamadı: ${e.message}`, 20000); });
