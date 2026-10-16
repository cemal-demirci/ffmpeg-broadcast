// Cemal.cloud bcast Studio | local jobs: progress, refusals, cancel
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const job = require('../src/core/job');
const ff = require('../src/core/ffmpeg');

const PRESETS = path.resolve(__dirname, '..', '..', 'presets');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bcast-job-'));
let FF;

test.before(async () => {
  FF = await ff.locate({});
  assert.ok(FF, 'an FFmpeg is needed for these tests');
  execFileSync(FF.path, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=50:duration=10',
    '-f', 'lavfi', '-i', 'sine=duration=10', '-ac', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', path.join(tmp, 'src.mp4')]);
});

const base = () => ({ ffmpeg: FF.path, ffprobe: FF.ffprobe, presetsDir: PRESETS, input: path.join(tmp, 'src.mp4') });

test('a preset runs with progress and the right output', async () => {
  const out = path.join(tmp, 'proxy.mp4');
  const seen = [];
  let started = null;
  const h = job.start({ ...base(), preset: 'proxy-h264-540p', output: out, onStart: (s) => { started = s; }, onProgress: (p) => seen.push(p) });
  const r = await h.done;
  assert.strictEqual(r.code, 0);
  assert.ok(started && started.source.startsWith('1280x720 progressive 50'), JSON.stringify(started && started.source));
  assert.ok(seen.some((p) => p.done && p.pct === 100), 'progress ends at 100');
  const info = execFileSync(FF.ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out]).toString().trim();
  assert.strictEqual(info, '960,540');
});

test('an existing output is not overwritten unless asked', async () => {
  const out = path.join(tmp, 'exists.mp4');
  fs.writeFileSync(out, 'keep me');
  await assert.rejects(job.start({ ...base(), preset: 'proxy-h264-540p', output: out }).done, /zaten var/);
  assert.strictEqual(fs.readFileSync(out, 'utf8'), 'keep me');
});

test('a preset that does not fit the source is refused with the reason', async () => {
  await assert.rejects(job.start({ ...base(), preset: 'dnxhr-hqx', output: path.join(tmp, 'x.mxf'), srcScan: 'i' }).done, /frame-based/);
});

test('cancel stops ffmpeg and removes the half-written file', async () => {
  const out = path.join(tmp, 'cancel.mxf');
  const h = job.start({ ...base(), preset: 'xdcam-hd422-720p50', output: out, onProgress: () => {} });
  setTimeout(() => h.cancel(), 1500);
  const r = await h.done;
  assert.ok(r.cancelled, 'marked cancelled');
  assert.ok(!fs.existsSync(out), 'no partial output left');
});
