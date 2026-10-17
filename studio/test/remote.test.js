// Cemal.cloud bcast Studio | servers over real SSH
//
// Needs an SSH server and a sudo user (with a sudo password):
//   BCAST_TEST_SSH_HOST, BCAST_TEST_SSH_PORT, BCAST_TEST_SSH_USER, BCAST_TEST_SSH_PASS
// BCAST_TEST_FULL_INSTALL=1 builds FFmpeg on the server (20+ minutes); otherwise
// only bcast + presets are installed next to an existing /opt/ffmpeg-broadcast.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const net = require('net');
const { Server, RemoteError } = require('../src/core/remote');
const notice = require('./notice');

const env = process.env;
const cfg = { host: env.BCAST_TEST_SSH_HOST, port: Number(env.BCAST_TEST_SSH_PORT || 22), username: env.BCAST_TEST_SSH_USER, auth: 'password' };
const secret = { password: env.BCAST_TEST_SSH_PASS };
const KIT = path.resolve(__dirname, '..', '..');
const skip = !cfg.host && 'BCAST_TEST_SSH_HOST not set';
const notes = [];

function memoryHosts() {
  const m = new Map();
  return { get: (k) => m.get(k), set: (k, v) => m.set(k, v), map: m };
}

test('server: connect, host key trust on first use, refuse a changed key', { skip }, async () => {
  const hosts = memoryHosts();
  const s = await new Server(cfg, secret, hosts).connect();
  assert.ok(s.newHostKey && s.newHostKey.startsWith('SHA256:'), 'first connection records the host key');
  s.close();
  const again = await new Server(cfg, secret, hosts).connect();
  assert.strictEqual(again.newHostKey, null, 'second connection matches the stored key');
  again.close();
  hosts.set(`${cfg.host}:${cfg.port}`, 'SHA256:somethingelse');
  await assert.rejects(new Server(cfg, secret, hosts).connect(), (e) => e.code === 'HOST_KEY_CHANGED');
  notes.push('host key pinned, a changed key is refused');
});

test('server: a connection dropped during the handshake is tried once more', { skip }, async () => {
  let n = 0;
  const proxy = net.createServer((sock) => {
    n++;
    if (n === 1) { sock.destroy(); return; }          // drop the first attempt
    const up = net.connect(cfg.port, cfg.host);
    sock.pipe(up).pipe(sock);
    up.on('error', () => sock.destroy());
    sock.on('error', () => up.destroy());
  });
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  try {
    const s = await new Server({ ...cfg, host: '127.0.0.1', port: proxy.address().port }, secret, memoryHosts()).connect();
    s.close();
    assert.strictEqual(n, 2, 'connected on the second attempt');
  } finally { proxy.close(); }
  notes.push('a handshake dropped once is retried');
});

test('server: wrong password is a clear error', { skip }, async () => {
  await assert.rejects(new Server(cfg, { password: 'wrong' }, memoryHosts()).connect(), (e) => e instanceof RemoteError && e.code === 'AUTH');
});

test('server: info, sudo with password, browse', { skip }, async () => {
  const s = await new Server(cfg, secret, memoryHosts()).connect();
  try {
    const info = await s.info();
    assert.ok(info.os && info.cpus > 0 && info.apt, `info: ${JSON.stringify(info)}`);
    assert.strictEqual(await s.sudoMode(), 'password', 'test user needs a sudo password');
    const who = await s.root('id -u');
    assert.strictEqual(who.stdout.trim(), '0', 'root() runs as root');
    const home = await s.browse('.');
    assert.ok(home.path.startsWith('/'), 'browse resolves the home directory');
    notes.push(`server ${info.os}, ${info.cpus} CPU; sudo with password works`);
  } finally { s.close(); }
});

test('server: install, then run a preset there', { skip, timeout: 90 * 60 * 1000 }, async () => {
  const s = await new Server(cfg, secret, memoryHosts()).connect();
  try {
    const lines = [];
    const full = env.BCAST_TEST_FULL_INSTALL === '1';
    const t0 = Date.now();
    const code = await s.install({ kitDir: KIT, presetsOnly: !full, onLine: (l) => lines.push(l) });
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    assert.strictEqual(code, 0, `install exit ${code}\n${lines.slice(-30).join('\n')}`);
    const info = await s.info();
    assert.ok(info.ffmpeg, 'ffmpeg-broadcast is on the server');
    assert.ok(info.presets >= 19, `presets installed (${info.presets})`);
    notes.push(`${full ? 'full build + install' : 'bcast + presets install'} over SSH in ${mins} min (FFmpeg ${info.ffmpeg}, ${info.presets} presets, ${lines.length} log lines)`);

    // a source on the server, then a preset run there
    const home = (await s.browse('.')).path;
    const src = `${home}/bcast-src.mp4`;
    const mk = await s.exec(`/opt/ffmpeg-broadcast/bin/ffmpeg -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=1920x1080:rate=50:duration=8 ` +
      `-f lavfi -i sine=duration=8 -ac 2 -c:v libx264 -preset ultrafast -c:a aac ${src}`);
    assert.strictEqual(mk.code, 0, mk.stderr);
    const progress = [];
    let start = null;
    const job = s.runJob({ preset: 'dvb-h264-1080i25', input: src, output: `${home}/bcast-out.ts`, overwrite: true, r128: true,
      onStart: (x) => { start = x; }, onProgress: (p) => progress.push(p) });
    const r = await job.done;
    assert.strictEqual(r.code, 0, 'remote job exits 0');
    assert.ok(start && start.duration > 7, 'duration probed on the server');
    assert.ok(progress.some((p) => p.pct > 0 && p.pct < 100), 'progress arrives while it runs');
    assert.ok(progress.some((p) => p.done), 'progress reaches the end');
    const probe = await s.exec(`/opt/ffmpeg-broadcast/bin/ffprobe -v error -select_streams v:0 -show_entries stream=field_order,width -of csv=p=0 ${home}/bcast-out.ts`);
    assert.match(probe.stdout, /1920,tt/, 'output is 1080i25 top field first');

    // cancel
    const long = s.runJob({ preset: 'dvb-h264-1080i25', input: src, output: `${home}/bcast-cancel.ts`, overwrite: true,
      onProgress: () => {} });
    setTimeout(() => long.cancel(), 1500);
    const c = await long.done;
    assert.ok(c.cancelled && c.code !== 0, `cancel stops the job (code ${c.code})`);
    notes.push(`remote job dvb-h264-1080i25: ${progress.length} progress updates, output 1080i tff, cancel works`);
  } finally { s.close(); }
});

test.after(() => {
  if (notes.length) console.log(`remote: ${notes.join('; ')}`);
  if (notes.length) notice('Server module over SSH', notes.join('; '));
});
