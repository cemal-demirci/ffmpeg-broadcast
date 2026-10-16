// Cemal.cloud bcast Studio | the only door between the window and the app
'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

async function call(channel, ...args) {
  const r = await ipcRenderer.invoke(channel, ...args);
  if (r && r.ok) return r.data;
  const e = new Error((r && r.error) || 'bilinmeyen hata');
  e.code = r && r.code;
  if (r && r.extra) Object.assign(e, r.extra);
  throw e;
}

const listeners = new Map();
ipcRenderer.on('studio:event', (_e, ev) => {
  for (const fn of listeners.get(ev.kind) || []) { try { fn(ev); } catch (err) { console.error(err); } }
});

contextBridge.exposeInMainWorld('studio', {
  on(kind, fn) {
    if (!listeners.has(kind)) listeners.set(kind, new Set());
    listeners.get(kind).add(fn);
    return () => listeners.get(kind).delete(fn);
  },
  pathForFile: (file) => webUtils.getPathForFile(file),

  appInfo: () => call('app:info'),
  openExternal: (url) => call('app:openExternal', url),
  showItem: (p) => call('app:showItem', p),
  copy: (text) => call('app:copy', text),
  settings: () => call('settings:get'),
  saveSettings: (patch) => call('settings:set', patch),

  ffmpegStatus: (refresh) => call('ffmpeg:status', refresh),
  downloadFfmpeg: () => call('ffmpeg:download'),
  chooseFfmpeg: () => call('ffmpeg:choose'),

  presets: () => call('presets:list'),
  pickFiles: () => call('files:pick'),
  pickDir: () => call('files:pickDir'),
  pickKey: () => call('files:pickKey'),

  probe: (input) => call('job:probe', input),
  fit: (inputs, opts) => call('job:fit', inputs, opts),
  plan: (o) => call('job:plan', o),
  startJob: (id, o) => call('job:start', id, o),
  cancelJob: (id) => call('job:cancel', id),

  servers: () => call('servers:list'),
  saveServer: (server, secret) => call('servers:save', server, secret),
  removeServer: (id) => call('servers:remove', id),
  testServer: (server, secret) => call('servers:test', server, secret),
  serverInfo: (id) => call('servers:info', id),
  forgetHost: (id) => call('servers:forgetHost', id),
  install: (id, o) => call('servers:install', id, o),
  browse: (id, dir) => call('servers:browse', id, dir),
  remotePlan: (id, o) => call('servers:plan', id, o),
  runRemote: (serverId, id, o) => call('servers:runJob', serverId, id, o),
});
