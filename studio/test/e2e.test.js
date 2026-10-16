// Cemal.cloud bcast Studio | the real app, driven like a user
//
// Launches the app (the packaged one when BCAST_E2E_APP points at it), clicks
// through it and checks the files it writes with ffprobe.
//
//   BCAST_E2E_APP            packaged executable (default: this folder with the dev Electron)
//   BCAST_E2E_SHOTS          folder for screenshots
//   BCAST_E2E_DOWNLOAD=1     download FFmpeg through the app first (Windows / macOS CI)
//   BCAST_E2E_SSH_HOST/PORT/USER/PASS   also add a server and run a job on it
//   BCAST_E2E_FULL_INSTALL=1 build FFmpeg on that server from the app (otherwise "Presetleri güncelle")
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { _electron } = require('playwright-core');

const env = process.env;
const APP_DIR = path.resolve(__dirname, '..');
const SHOTS = env.BCAST_E2E_SHOTS ? path.resolve(env.BCAST_E2E_SHOTS) : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bcast-e2e-'));
const MEDIA = path.join(tmp, 'media');
fs.mkdirSync(MEDIA);
const notes = [];
const platform = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[process.platform] || process.platform;

let app, win, ff;

const shot = async (name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await win.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};
const mockOpen = (files) => app.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: f }); }, files);
/** Streams of a file as ffprobe sees them (JSON, so MXF / TS layouts do not matter). */
const streams = (file, bin) => JSON.parse(execFileSync(bin || ff.ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', file]).toString()).streams;
const jobStates = () => win.evaluate(() => [...document.querySelectorAll('#jobsCard .job')].map((j) => ({
  cls: j.className, text: j.innerText.replace(/\s+/g, ' ') })));

/** Wait until at least n jobs are listed and none of them is still queued or running. */
async function waitJobs(n, timeout = 240000) {
  await win.waitForFunction((k) => {
    const rows = document.querySelectorAll('#jobsCard .job');
    return rows.length >= k && !document.querySelector('#jobsCard .job.queued, #jobsCard .job.starting, #jobsCard .job.running');
  }, n, { timeout, polling: 250 });
  return jobStates();
}
const pageErrors = [];

test.before(async () => {
  const exe = env.BCAST_E2E_APP || require('electron');
  const args = env.BCAST_E2E_APP ? [] : [APP_DIR];
  if (process.platform === 'linux') args.unshift('--no-sandbox');
  app = await _electron.launch({ executablePath: exe, args, timeout: 180000,
    env: { ...process.env, BCAST_STUDIO_USERDATA: path.join(tmp, 'userdata') } });
  win = await app.firstWindow();
  win.on('pageerror', (e) => pageErrors.push(e.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 820));
  await win.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
});

test.afterEach(() => assert.deepStrictEqual(pageErrors, [], 'no errors in the window'));

test.after(async () => {
  if (app) await app.close();
  const summary = `${platform}: ${notes.join('; ')}`;
  console.log(`e2e: ${summary}`);
  if (env.GITHUB_ACTIONS && notes.length) console.log(`::notice title=bcast Studio app (${platform})::${notes.join('; ')}`);
});

test('FFmpeg is found, or downloaded from the app', { timeout: 15 * 60 * 1000 }, async () => {
  if (env.BCAST_E2E_DOWNLOAD === '1') {
    const t0 = Date.now();
    const found = await win.evaluate(() => window.studio.ffmpegStatus());
    if (found) { await win.click('#ffPill button[title="FFmpeg ayrıntıları"]'); await win.click('text=Güncel build indir'); }
    else await win.click('#ffBanner button:has-text("indir")');
    await win.waitForSelector('#ffDlBar', { timeout: 30000 });
    await shot('01-ffmpeg-download');
    await win.waitForFunction(() => !document.querySelector('#ffDlBar') && document.querySelector('#ffPill.ok'), null, { timeout: 14 * 60 * 1000 });
    ff = await win.evaluate(() => window.studio.ffmpegStatus());
    assert.strictEqual(ff.source, 'indirilen', 'the app uses the FFmpeg it downloaded');
    notes.push(`FFmpeg ${ff.version} downloaded from the app in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } else {
    await win.waitForSelector('#ffPill.ok', { timeout: 30000 });
    ff = await win.evaluate(() => window.studio.ffmpegStatus());
    notes.push(`FFmpeg ${ff.version} found (${ff.source})`);
  }
  const missing = Object.entries(ff.missing).filter(([, m]) => m.length).map(([n]) => n);
  if (env.BCAST_E2E_DOWNLOAD === '1') assert.deepStrictEqual(missing, [], 'the downloaded build runs every preset');
  notes.push(`${Object.keys(ff.missing).length - missing.length}/${Object.keys(ff.missing).length} presets supported`);

  // sources, made with the same FFmpeg
  const mk = (...a) => execFileSync(ff.path, ['-hide_banner', '-loglevel', 'error', '-y', ...a]);
  mk('-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=25:duration=12', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000:duration=12',
    '-vf', 'setfield=tff', '-c:v', 'mpeg2video', '-flags', '+ildct+ilme', '-b:v', '25M', '-c:a', 'pcm_s24le', '-ac', '2', path.join(MEDIA, 'haber_1080i25.mxf'));
  mk('-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=50:duration=5', '-f', 'lavfi', '-i', 'sine=duration=5',
    '-ac', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', path.join(MEDIA, 'spor_1080p50.mp4'));
  mk('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=5', '-ac', '2', '-c:a', 'pcm_s16le', path.join(MEDIA, 'jenerik.wav'));
  mk('-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=50:duration=120', '-f', 'lavfi', '-i', 'sine=duration=120',
    '-ac', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-c:a', 'aac', path.join(MEDIA, 'uzun_1080p50.mp4'));
});

test('sources are read and every preset says whether it fits', async () => {
  await mockOpen(['haber_1080i25.mxf', 'spor_1080p50.mp4', 'jenerik.wav'].map((f) => path.join(MEDIA, f)));
  await win.click('#dropzone');
  await win.waitForFunction(() => document.querySelectorAll('#sourcesCard .src .fit .badge').length === 3 &&
    !/okunuyor/.test(document.querySelector('#sourcesCard').innerText), null, { timeout: 30000 });
  await win.click('[data-preset="xdcam-hd422-1080i25"]');
  await win.waitForTimeout(400);
  const meta = await win.evaluate(() => [...document.querySelectorAll('#sourcesCard .src')].map((s) => s.innerText.replace(/\s+/g, ' ')));
  assert.match(meta[0], /1920×1080i25 · TFF/, 'interlaced source described');
  assert.match(meta[1], /1920×1080p50/, 'progressive source described');
  assert.match(meta[0], /uygun/); assert.match(meta[1], /uygun/);
  assert.match(meta[2], /uymuyor/, 'audio-only source does not fit a video preset');
  await win.click('[data-preset="dnxhr-hqx"]');
  await win.waitForTimeout(300);
  const dnx = await win.evaluate(() => document.querySelector('#sourcesCard .src').innerText);
  assert.match(dnx, /uymuyor/, 'DNxHR HQX refuses an interlaced source before anything runs');
  await shot('02-sources-fit');
  notes.push('fit check: 3 sources, DNxHR HQX refuses 1080i before running');
});

test('the command is shown before running, and it is what runs', async () => {
  await win.click('[data-preset="xdcam-hd422-1080i25"]');
  await win.click('#btnShow');
  await win.waitForSelector('#cmdText');
  const cmd = await win.textContent('#cmdText');
  assert.ok(cmd.includes('-c:v mpeg2video') && cmd.includes('+ildct+ilme') && cmd.includes('-f mxf'), cmd);
  await shot('03-command');
  await win.keyboard.press('Escape');
});

test('a queue runs on this computer and writes correct broadcast files', { timeout: 10 * 60 * 1000 }, async () => {
  await win.click('[data-preset="xdcam-hd422-1080i25"]');
  await win.waitForFunction(() => /2 işi/.test(document.querySelector('#btnQueue').textContent));
  await win.click('#btnQueue');
  await win.waitForFunction(() => /%/.test((document.querySelector('#jobsCard .job.running .stats') || {}).textContent || '') ||
    document.querySelectorAll('#jobsCard .job.done').length === 2, null, { timeout: 60000, polling: 100 });
  await shot('04-local-running');
  let jobs = await waitJobs(2);
  assert.ok(jobs.every((j) => /done/.test(j.cls)), JSON.stringify(jobs));
  for (const src of ['haber_1080i25', 'spor_1080p50']) {
    const out = path.join(MEDIA, `${src}_xdcam-hd422-1080i25.mxf`);
    const st = streams(out);
    const v = st.find((x) => x.codec_type === 'video');
    assert.deepStrictEqual([v.codec_name, v.width, v.height, v.field_order], ['mpeg2video', 1920, 1080, 'tt'], `${src}: XDCAM HD422 1080i TFF`);
    const a = st.filter((x) => x.codec_type === 'audio');
    assert.deepStrictEqual(a.map((x) => x.channels), [1, 1, 1, 1], `${src}: 4 mono audio tracks`);
  }

  // audio + HLS ladder in the same queue
  await win.click('[data-preset="wav-r128"]');
  await win.waitForTimeout(300);
  await win.click('#btnQueue');
  await win.click('[data-preset="hls-abr-1080"]');
  await win.waitForTimeout(300);
  await win.click('#btnQueue');
  const queued = await win.evaluate(() => document.querySelectorAll('#jobsCard .job').length);
  assert.ok(queued >= 5, `wav-r128 and hls-abr-1080 queued (${queued} jobs)`);
  jobs = await waitJobs(queued, 8 * 60 * 1000);
  const failed = jobs.filter((j) => !/done/.test(j.cls));
  assert.deepStrictEqual(failed, [], 'every job in the queue finishes');
  const wav = streams(path.join(MEDIA, 'jenerik_wav-r128.wav'))[0];
  assert.deepStrictEqual([wav.codec_name, wav.sample_rate], ['pcm_s24le', '48000'], 'BWF 48 kHz 24-bit');
  const hls = path.join(MEDIA, 'spor_1080p50_hls-abr-1080');
  assert.ok(fs.existsSync(path.join(hls, 'master.m3u8')), 'HLS master playlist');
  const variants = fs.readdirSync(hls).filter((d) => fs.existsSync(path.join(hls, d, 'index.m3u8')));
  assert.strictEqual(variants.length, 4, `4 HLS renditions (${variants.join(', ')})`);
  const top = streams(path.join(hls, 'v0', 'init_0.mp4')).find((x) => x.codec_type === 'video');
  assert.deepStrictEqual([top.codec_name, top.width, top.height], ['h264', 1920, 1080], 'top rendition 1080p H.264');
  await shot('05-local-done');
  notes.push(`${jobs.length} local jobs: XDCAM 1080i TFF with 4 mono tracks, BWF R128, HLS ladder with ${variants.length} renditions`);
});

test('an existing output is refused unless "Üzerine yaz" is on', async () => {
  if (await win.$('#jobsCard button:has-text("Bitenleri temizle")')) await win.click('#jobsCard button:has-text("Bitenleri temizle")');
  await mockOpen([path.join(MEDIA, 'jenerik.wav')]);
  await win.click('#sourcesCard button:has-text("Temizle")');
  await win.click('#dropzone');
  await win.click('[data-preset="wav-r128"]');
  await win.waitForFunction(() => document.querySelector('#sourcesCard .badge.ok'));
  await win.click('#btnQueue');
  let jobs = await waitJobs(1);
  assert.match(jobs[0].cls, /failed/);
  assert.match(jobs[0].text, /çıktı zaten var/);
  await win.click('#optOverwrite');
  await win.click('#jobsCard .job [title="Listeden kaldır"]');
  await win.click('#btnQueue');
  jobs = await waitJobs(1);
  assert.match(jobs[0].cls, /done/, 'with "Üzerine yaz" it runs');
  await win.click('#optOverwrite');
  await win.click('#jobsCard .job [title="Listeden kaldır"]');
});

test('cancel stops FFmpeg and removes the half-written file', { timeout: 5 * 60 * 1000 }, async () => {
  if (await win.$('#jobsCard button:has-text("Bitenleri temizle")')) await win.click('#jobsCard button:has-text("Bitenleri temizle")');
  await mockOpen([path.join(MEDIA, 'uzun_1080p50.mp4')]);
  await win.click('#sourcesCard button:has-text("Temizle")');
  await win.click('#dropzone');
  await win.click('[data-preset="prores-422hq"]');
  await win.waitForFunction(() => document.querySelector('#sourcesCard .badge.ok'));
  await win.click('#btnQueue');
  await win.waitForFunction(() => /%/.test((document.querySelector('#jobsCard .job.running .stats') || {}).textContent || ''), null, { timeout: 60000 });
  await win.click('#jobsCard .job.running [title="İptal"]');
  const jobs = await waitJobs(1);
  assert.match(jobs[0].cls, /cancelled/, JSON.stringify(jobs));
  await new Promise((r) => setTimeout(r, 500));
  assert.ok(!fs.existsSync(path.join(MEDIA, 'uzun_1080p50_prores-422hq.mov')), 'no half-written output left behind');
  notes.push('cancel works and leaves no partial file');
});

const ssh = env.BCAST_E2E_SSH_HOST ? { host: env.BCAST_E2E_SSH_HOST, port: env.BCAST_E2E_SSH_PORT || '22', user: env.BCAST_E2E_SSH_USER, pass: env.BCAST_E2E_SSH_PASS } : null;

test('a server is added by IP, set up and used from the app', { skip: !ssh && 'BCAST_E2E_SSH_HOST not set', timeout: 90 * 60 * 1000 }, async () => {
  await win.click('#navServers');
  await shot('06-servers-empty');
  await win.click('#btnAddServerHero');
  await win.fill('#srvName', 'encoder-1');
  await win.fill('#srvHost', ssh.host);
  await win.fill('#srvPort', ssh.port);
  await win.fill('#srvUser', ssh.user);
  await win.fill('#srvPassword', ssh.pass);
  await win.click('#btnTestServer');
  await win.waitForFunction(() => { const n = [...document.querySelectorAll('.modal .note')].pop(); return n && /Bağlandı|ulaşılamadı|kabul edilmedi/.test(n.innerText); }, null, { timeout: 60000 });
  const tested = await win.evaluate(() => [...document.querySelectorAll('.modal .note')].pop().innerText);
  assert.match(tested, /Bağlandı/, tested);
  assert.match(tested, /SHA256:/, 'host key shown and pinned');
  await shot('07-server-form');
  await win.click('#btnSaveServer');
  await win.waitForFunction(() => document.querySelector('.tiles') && !/…/.test(document.querySelector('.tiles').innerText), null, { timeout: 60000 });

  const t0 = Date.now();
  const full = env.BCAST_E2E_FULL_INSTALL === '1';
  if (full) {
    await win.click('#btnInstall');
    await win.waitForFunction(() => /dosya derlendi/.test((document.querySelector('[id^="termMeta-"]') || {}).textContent || '') &&
      parseInt(document.querySelector('[id^="termMeta-"]').textContent.match(/(\d+) dosya/)[1], 10) > 300, null, { timeout: 40 * 60 * 1000, polling: 2000 });
    await shot('08-server-building');
  } else {
    await win.click('text=Presetleri güncelle');
  }
  await win.waitForFunction(() => /Kurulum bitti|koduyla bitti/.test(document.querySelector('#serverDetail').innerText), null, { timeout: 80 * 60 * 1000, polling: 2000 });
  const result = await win.evaluate(() => document.querySelector('#serverDetail .note.ok, #serverDetail .note.err').innerText);
  assert.match(result, /Kurulum bitti/, result);
  await win.waitForFunction(() => /preset/.test((document.querySelector('#serverDetail .card-head .badge.ok') || {}).textContent || ''), null, { timeout: 60000 });
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  const compiled = await win.evaluate(() => ((document.querySelector('[id^="termMeta-"]') || {}).textContent || '').match(/(\d+) dosya/));
  notes.push(full ? `server: FFmpeg built and installed over SSH from the app in ${mins} min (${compiled ? compiled[1] : '?'} files compiled)` : `server: presets updated over SSH in ${mins} min`);

  // a job on the server, picked with the remote browser
  const src = '/tmp/bcast-e2e/haber_1080i25.mxf';
  fs.mkdirSync('/tmp/bcast-e2e', { recursive: true });
  fs.copyFileSync(path.join(MEDIA, 'haber_1080i25.mxf'), src);
  fs.chmodSync('/tmp/bcast-e2e', 0o777);
  await win.fill('#remoteInput', '/tmp/bcast-e2e/');
  await win.click('#serverDetail button:has-text("Gözat")');
  await win.waitForSelector('.entry:has-text("haber_1080i25.mxf")', { timeout: 30000 });
  await shot('09-server-browse');
  await win.click('.entry:has-text("haber_1080i25.mxf")');
  await win.selectOption('#remotePreset', 'dvb-h264-1080i25');
  await win.click('#btnRunRemote');
  await win.waitForFunction(() => /%/.test((document.querySelector('#serverDetail .job.running .stats') || {}).textContent || '') ||
    document.querySelector('#serverDetail .job.done, #serverDetail .job.failed'), null, { timeout: 60000, polling: 100 });
  await shot('10-server-job');
  await win.waitForSelector('#serverDetail .job.done, #serverDetail .job.failed', { timeout: 5 * 60 * 1000 });
  const job = await win.evaluate(() => document.querySelector('#serverDetail .job').className + ' ' + document.querySelector('#serverDetail .job').innerText);
  assert.match(job, /done/, job);
  const v = streams('/tmp/bcast-e2e/haber_1080i25_dvb-h264-1080i25.ts', '/opt/ffmpeg-broadcast/bin/ffprobe').find((x) => x.codec_type === 'video');
  assert.deepStrictEqual([v.codec_name, v.field_order], ['h264', 'tt'], 'DVB H.264 1080i TFF');
  await shot('11-server-done');
  notes.push('server job dvb-h264-1080i25 from the remote file browser: H.264 1080i TFF');
});
