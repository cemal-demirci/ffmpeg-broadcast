// Cemal.cloud bcast Studio | main process
//
// The window never touches Node: everything it can do is one of the IPC calls
// below (see preload.js). Encoding runs here or on a server over SSH.
'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, net, Menu, nativeTheme, clipboard } = require('electron');

if (process.env.BCAST_STUDIO_USERDATA) app.setPath('userData', path.resolve(process.env.BCAST_STUDIO_USERDATA));

const bc = require('../core/bcast');
const ff = require('../core/ffmpeg');
const job = require('../core/job');
const { Server, PREFIX } = require('../core/remote');
const { Store } = require('../core/store');

// presets, bcast and the build script: the repo in development, Resources/bcast when packaged
const KIT = app.isPackaged ? path.join(process.resourcesPath, 'bcast') : path.resolve(__dirname, '..', '..', '..');
const PRESETS = path.join(KIT, 'presets');
const LINKS = ['https://github.com/cemal-demirci/', 'https://cemal.cloud', 'mailto:cemaldemirci0034@gmail.com',
  'https://ffmpeg.org', 'https://github.com/BtbN/FFmpeg-Builds', 'https://ffmpeg.martin-riedl.de'];

let win = null;
let store = null;
let ffCache = null;            // located FFmpeg (or null) until something changes
let quitting = false;
const jobs = new Map();        // job id -> { cancel, remote }
const conns = new Map();       // server id -> Promise<Server>
const installs = new Map();    // server id -> true while the app follows an install
const sessionSecrets = new Map();
const probes = new Map();      // input path -> { mtime, src }

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const send = (kind, data) => { if (win && !win.isDestroyed()) win.webContents.send('studio:event', { kind, ...data }); };

function coded(code, message) { const e = new Error(message); e.code = code; return e; }

/** Every handler returns { ok, data } or { ok: false, error, code } so the window gets clean messages. */
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!win || event.sender !== win.webContents) return { ok: false, error: 'unknown sender' };
    try { return { ok: true, data: await fn(...args) }; }
    catch (e) { return { ok: false, error: e.message || String(e), code: e.code || null, extra: e.known ? { known: e.known, presented: e.presented } : undefined }; }
  });
}

function cipher() {
  return {
    available: () => {
      if (!safeStorage.isEncryptionAvailable()) return false;
      // Linux without a keyring falls back to a fixed key: not worth calling "encrypted"
      if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') return false;
      return true;
    },
    encrypt: (s) => safeStorage.encryptString(s),
    decrypt: (b) => safeStorage.decryptString(b),
  };
}

const presetList = () => bc.listPresets(PRESETS);
const ffDownloadDir = () => path.join(app.getPath('userData'), 'ffmpeg');

async function ffmpegInfo(refresh) {
  if (ffCache && !refresh) return ffCache;
  ffCache = await ff.locate({ custom: store.settings().ffmpegPath, downloadDir: ffDownloadDir() });
  return ffCache;
}

function publicFfmpeg(info) {
  if (!info) return null;
  return { path: info.path, ffprobe: info.ffprobe, version: info.version, source: info.source,
    missing: ff.checkPresets(info, presetList()) };
}

async function probeCached(input) {
  const info = await ffmpegInfo();
  if (!info) throw coded('NO_FFMPEG', 'FFmpeg bulunamadı. Üstteki FFmpeg düğmesinden indirin ya da seçin.');
  const st = fs.statSync(input);
  const hit = probes.get(input);
  if (hit && hit.mtime === st.mtimeMs) return hit;
  const src = await bc.probe(info.ffprobe, input);
  const entry = { mtime: st.mtimeMs, size: st.size, src };
  probes.set(input, entry);
  return entry;
}

const optsOf = (o) => ({ overwrite: !!o.overwrite, r128: !!o.r128, tc: o.tc || '', tracks: o.tracks || '', srcScan: o.srcScan || '' });

function outputFor(input, presetName, outDir, posix) {
  const p = presetList().find((x) => x.name === presetName);
  if (!p) throw coded('PRESET', `bilinmeyen preset: ${presetName}`);
  if (!posix) return bc.defaultOutput(input, p, outDir);
  const dir = outDir || path.posix.dirname(input);
  const base = path.posix.basename(input).replace(/\.[^.]+$/, '');
  return p.ladder || p.ext === '/' ? path.posix.join(dir, `${base}_${p.name}`) : path.posix.join(dir, `${base}_${p.name}.${p.ext || 'mov'}`);
}

// ---------------------------------------------------------------------------
// servers
// ---------------------------------------------------------------------------
function secretFor(id) { return { ...store.secret(id), ...(sessionSecrets.get(id) || {}) }; }

function dropConn(id) {
  const c = conns.get(id);
  conns.delete(id);
  if (c) c.then((s) => s.close()).catch(() => {});
}

async function serverFor(id) {
  if (conns.has(id)) {
    try { const s = await conns.get(id); if (s.conn) return s; } catch { /* reconnect below */ }
    conns.delete(id);
  }
  const cfg = store.server(id);
  if (!cfg) throw coded('NO_SERVER', 'sunucu bulunamadı');
  const p = new Server(cfg, secretFor(id), store.hosts()).connect().then((s) => {
    s.conn.on('close', () => { if (conns.get(id) === p) conns.delete(id); send('server', { id, type: 'disconnected' }); });
    return s;
  });
  conns.set(id, p);
  p.catch(() => { if (conns.get(id) === p) conns.delete(id); });
  return p;
}

function followInstall(id, s, starter) {
  if (installs.has(id)) return false;
  installs.set(id, true);
  const t0 = Date.now();
  starter((line) => send('install', { id, type: 'line', line }), (n) => send('install', { id, type: 'compiled', n }))
    .then((code) => send('install', { id, type: 'done', code, minutes: (Date.now() - t0) / 60000 }))
    .catch((e) => send('install', { id, type: 'error', error: e.message, code: e.code }))
    .finally(() => installs.delete(id));
  return true;
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
function registerIpc() {
  handle('app:info', () => ({
    version: app.getVersion(), platform: process.platform, arch: process.arch,
    secureSecrets: store.canStoreSecrets(), canDownloadFfmpeg: ff.downloadable(),
    categories: bc.CATEGORIES, remotePrefix: PREFIX,
  }));
  handle('app:openExternal', (url) => {
    if (!LINKS.some((l) => String(url).startsWith(l))) throw coded('LINK', 'bu bağlantı açılamaz');
    return shell.openExternal(url);
  });
  handle('app:copy', (text) => { clipboard.writeText(String(text)); return true; });
  handle('app:showItem', (p) => { if (fs.existsSync(p)) shell.showItemInFolder(p); });
  handle('settings:get', () => store.settings());
  handle('settings:set', (patch) => {
    const allowed = ['outDir', 'preset', 'options', 'remotePreset', 'lastServer'];
    const clean = Object.fromEntries(Object.entries(patch || {}).filter(([k]) => allowed.includes(k)));
    return store.setSettings(clean);
  });

  // ---- FFmpeg --------------------------------------------------------------
  handle('ffmpeg:status', async (refresh) => publicFfmpeg(await ffmpegInfo(!!refresh)));
  handle('ffmpeg:download', async () => {
    let last = 0;
    const info = await ff.download(ffDownloadDir(), (p) => {
      const now = Date.now();
      if (p.step === 'unpack' || now - last > 150) { last = now; send('ffmpeg', { type: 'progress', ...p }); }
    }, (url, init) => net.fetch(url, init));
    store.setSettings({ ffmpegPath: '' });
    ffCache = info;
    probes.clear();
    return publicFfmpeg(info);
  });
  handle('ffmpeg:choose', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'FFmpeg seçin', properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'ffmpeg.exe', extensions: ['exe'] }] : [] });
    if (r.canceled || !r.filePaths[0]) return publicFfmpeg(await ffmpegInfo());
    const chosen = r.filePaths[0];
    const probe = path.join(path.dirname(chosen), `ffprobe${ff.EXE}`);
    if (!fs.existsSync(probe)) throw coded('NO_FFPROBE', `ffprobe aynı klasörde yok: ${path.dirname(chosen)}`);
    const info = await ff.inspect(chosen);
    if (!info) throw coded('BAD_FFMPEG', 'Seçilen dosya çalışan bir FFmpeg değil.');
    store.setSettings({ ffmpegPath: chosen });
    probes.clear();
    return publicFfmpeg(await ffmpegInfo(true));
  });

  // ---- presets and files ---------------------------------------------------
  handle('presets:list', () => presetList());
  handle('files:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Kaynak dosyalar', properties: ['openFile', 'multiSelections'] });
    return r.canceled ? [] : r.filePaths;
  });
  handle('files:pickDir', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Çıktı klasörü', properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  handle('files:pickKey', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'SSH anahtarı', properties: ['openFile', 'showHiddenFiles'],
      defaultPath: path.join(app.getPath('home'), '.ssh') });
    return r.canceled ? null : r.filePaths[0];
  });

  // ---- local jobs ----------------------------------------------------------
  handle('job:probe', async (input) => {
    const p = await probeCached(input);
    if (!p.src.width && !p.src.audioStreams) throw coded('NOT_MEDIA', 'ffprobe bu dosyayı okuyamadı (medya dosyası mı?)');
    return { input, name: path.basename(input), size: p.size, duration: p.src.duration, src: p.src,
      desc: bc.describeSource(p.src, {}) };
  });

  /** For each preset: can it run on these inputs with these options, and if not, why. */
  handle('job:fit', async (inputs, o = {}) => {
    const out = {};
    const srcs = [];
    for (const i of inputs) { try { srcs.push({ input: i, src: (await probeCached(i)).src }); } catch { /* listed with its own error */ } }
    for (const p of presetList()) {
      const preset = bc.loadPreset(PRESETS, p.name);
      const reasons = {};
      for (const { input, src } of srcs) {
        try { bc.buildCommand({ ffmpeg: 'ffmpeg', presetName: p.name, preset, src, input, output: outputFor(input, p.name, o.outDir), ...optsOf(o) }); }
        catch (e) { reasons[input] = e.message; }
      }
      out[p.name] = { ok: srcs.length - Object.keys(reasons).length, total: srcs.length, reasons };
    }
    return out;
  });

  /** The exact command, without running it (bcast --show). */
  handle('job:plan', async (o) => {
    const info = await ffmpegInfo();
    const { src } = await probeCached(o.input);
    const output = o.output || outputFor(o.input, o.preset, o.outDir);
    const { argv } = bc.buildCommand({ ffmpeg: info.path, presetName: o.preset, preset: bc.loadPreset(PRESETS, o.preset),
      src, input: o.input, output, ...optsOf(o) });
    return { argv, command: job.shellQuote(argv), output, source: bc.describeSource(src, optsOf(o)) };
  });

  handle('job:start', async (id, o) => {
    if (jobs.has(id)) throw coded('BUSY', 'bu iş zaten çalışıyor');
    const info = await ffmpegInfo();
    if (!info) throw coded('NO_FFMPEG', 'FFmpeg bulunamadı.');
    const output = o.output || outputFor(o.input, o.preset, o.outDir);
    let last = 0;
    const h = job.start({
      ffmpeg: info.path, ffprobe: info.ffprobe, presetsDir: PRESETS, preset: o.preset, input: o.input, output, ...optsOf(o),
      onStart: (x) => send('job', { id, type: 'start', command: x.command, argv: x.argv, duration: x.duration, output }),
      onProgress: (p) => { const now = Date.now(); if (p.done || now - last > 200) { last = now; send('job', { id, type: 'progress', ...p }); } },
      onLog: (line) => send('job', { id, type: 'log', line }),
    });
    jobs.set(id, { cancel: h.cancel });
    h.done
      .then((r) => send('job', { id, type: 'done', code: r.code, cancelled: r.cancelled, seconds: r.seconds, output }))
      .catch((e) => send('job', { id, type: 'error', error: e.message }))
      .finally(() => jobs.delete(id));
    return { output };
  });
  handle('job:cancel', (id) => { const j = jobs.get(id); if (j) j.cancel(); return !!j; });

  // ---- servers -------------------------------------------------------------
  handle('servers:list', () => store.servers().map((s) => ({ ...s, hasSecret: s.hasSecret || sessionSecrets.has(s.id), connected: conns.has(s.id), installing: installs.has(s.id) })));
  handle('servers:save', (server, secret) => {
    const saved = store.saveServer(server, secret);
    if (secret && Object.values(secret).some(Boolean) && !store.canStoreSecrets()) sessionSecrets.set(saved.id, secret);
    else if (secret && Object.values(secret).some(Boolean)) sessionSecrets.delete(saved.id);
    dropConn(saved.id);
    return saved;
  });
  handle('servers:remove', (id) => { dropConn(id); sessionSecrets.delete(id); store.removeServer(id); return true; });
  /** Try a server config without saving it. */
  handle('servers:test', async (server, secret) => {
    const merged = server.id ? { ...secretFor(server.id), ...Object.fromEntries(Object.entries(secret || {}).filter(([, v]) => v)) } : (secret || {});
    const hosts = store.hosts();
    const s = await new Server(server, merged, hosts).connect();
    try {
      const info = await s.info();
      let sudo = null;
      try { sudo = await s.sudoMode(); } catch (e) { sudo = { error: e.message }; }
      return { ...info, sudo, newHostKey: s.newHostKey };
    } finally { s.close(); }
  });
  handle('servers:info', async (id) => {
    const s = await serverFor(id);
    const info = await s.info();
    let sudo = null;
    try { sudo = await s.sudoMode(); } catch (e) { sudo = { error: e.message }; }
    if (info.installing && !installs.has(id)) followInstall(id, s, (onLine, onCompiled) => s.follow({ onLine, onCompiled }));
    return { ...info, sudo, newHostKey: s.newHostKey, following: installs.has(id) };
  });
  handle('servers:forgetHost', (id) => { const s = store.server(id); if (s) store.forgetHost(`${s.host}:${s.port}`); dropConn(id); return true; });
  handle('servers:install', async (id, o = {}) => {
    const s = await serverFor(id);
    const info = await s.info();
    if (info.installing) { followInstall(id, s, (onLine, onCompiled) => s.follow({ onLine, onCompiled })); return { following: true }; }
    await s.sudoMode();
    followInstall(id, s, (onLine, onCompiled) => s.install({ kitDir: KIT, nvenc: !!o.nvenc, presetsOnly: !!o.presetsOnly, jobs: o.jobs, onLine, onCompiled }));
    return { started: true };
  });
  handle('servers:browse', async (id, dir) => (await serverFor(id)).browse(dir || '.'));
  handle('servers:plan', (id, o) => ({ output: o.output || outputFor(o.input, o.preset, o.outDir, true) }));
  handle('servers:runJob', async (serverId, id, o) => {
    if (jobs.has(id)) throw coded('BUSY', 'bu iş zaten çalışıyor');
    const s = await serverFor(serverId);
    const output = o.output || outputFor(o.input, o.preset, o.outDir, true);
    let last = 0;
    const h = s.runJob({
      preset: o.preset, input: o.input, output, ...optsOf(o),
      onStart: (x) => send('job', { id, type: 'start', command: x.command, duration: x.duration, output, server: serverId }),
      onProgress: (p) => { const now = Date.now(); if (p.done || now - last > 200) { last = now; send('job', { id, type: 'progress', ...p }); } },
      onLine: (line) => send('job', { id, type: 'log', line }),
    });
    jobs.set(id, { cancel: h.cancel, remote: serverId });
    h.done
      .then((r) => send('job', { id, type: 'done', code: r.code, cancelled: r.cancelled, output }))
      .catch((e) => send('job', { id, type: 'error', error: e.message }))
      .finally(() => jobs.delete(id));
    return { output };
  });
}

// ---------------------------------------------------------------------------
// window
// ---------------------------------------------------------------------------
function createWindow() {
  const mac = process.platform === 'darwin';
  nativeTheme.themeSource = 'dark';
  win = new BrowserWindow({
    width: 1240, height: 800, minWidth: 980, minHeight: 640,
    show: false, backgroundColor: '#15181D', title: 'bcast Studio',
    titleBarStyle: mac ? 'hiddenInset' : 'hidden',
    ...(mac ? { trafficLightPosition: { x: 16, y: 17 } } : { titleBarOverlay: { color: '#15181D', symbolColor: '#C3CAD5', height: 48 } }),
    icon: process.platform === 'linux' ? path.join(__dirname, '..', 'renderer', 'icon.png') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, devTools: !app.isPackaged,
    },
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (LINKS.some((l) => url.startsWith(l))) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => {
    if (quitting || jobs.size === 0) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning', buttons: ['İşleri iptal et ve çık', 'Vazgeç'], defaultId: 1, cancelId: 1,
      message: `${jobs.size} iş sürüyor.`, detail: 'Çıkarsanız bu bilgisayardaki işler iptal edilir, yarım dosyalar silinir. Sunucudaki işler de durdurulur.',
    });
    e.preventDefault();
    if (choice !== 0) return;
    // cancel, give ffmpeg a moment to stop and the half-written files to go, then close
    quitting = true;
    for (const j of jobs.values()) j.cancel();
    const t0 = Date.now();
    const iv = setInterval(() => { if (jobs.size === 0 || Date.now() - t0 > 6000) { clearInterval(iv); win.destroy(); } }, 100);
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    store = new Store(app.getPath('userData'), cipher());
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    } else {
      Menu.setApplicationMenu(null);
    }
    registerIpc();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('before-quit', () => { quitting = true; for (const j of jobs.values()) j.cancel(); for (const id of [...conns.keys()]) dropConn(id); });
  app.on('window-all-closed', () => app.quit());
}

