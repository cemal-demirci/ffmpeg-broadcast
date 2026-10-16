// Cemal.cloud bcast Studio | the JS engine must build exactly what bash bcast builds.
//
// For every preset x source x option set, bcast is run with a fake "ffmpeg"
// that only records its argv (ffprobe next to it is the real one, so bcast
// probes the real file). The JS engine probes the same file and builds its
// argv. Both lists must be identical, and errors must match.
//
// Needs ffmpeg + ffprobe on PATH and bash (Linux / macOS CI).
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const bc = require('../src/core/bcast');

const REPO = path.resolve(__dirname, '..', '..');
const PRESETS = path.join(REPO, 'presets');
const BCAST = path.join(REPO, 'bcast');
const which = (b) => execFileSync('bash', ['-c', `command -v ${b}`]).toString().trim();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bcast-eq-'));
const FAKE_DIR = path.join(tmp, 'fake');
fs.mkdirSync(FAKE_DIR);
const FAKE = path.join(FAKE_DIR, 'ffmpeg');
fs.writeFileSync(FAKE, '#!/usr/bin/env bash\nprintf \'%s\\0\' "$@" > "$FAKE_OUT"\n', { mode: 0o755 });
fs.symlinkSync(which('ffprobe'), path.join(FAKE_DIR, 'ffprobe'));
const FFPROBE = path.join(FAKE_DIR, 'ffprobe');

const ff = (...a) => execFileSync(which('ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', ...a]);
const TONE4 = 'sine=frequency=1000:sample_rate=48000:duration=1';

// Sources that drive every branch: interlaced / progressive, 25 / 50 / 29.97,
// HD / SD, audio channel counts, audio only, video only.
const SOURCES = {
  'hd-1080i25-4ch': (o) => ff('-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=25:duration=1', '-f', 'lavfi', '-i', TONE4,
    '-filter_complex', '[1:a]pan=4c|c0=c0|c1=c0|c2=c0|c3=c0[a]', '-map', '0:v', '-map', '[a]', '-vf', 'setfield=tff',
    '-c:v', 'mpeg2video', '-flags', '+ildct+ilme', '-c:a', 'pcm_s24le', o),
  'hd-1080p50-2ch': (o) => ff('-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=50:duration=1', '-f', 'lavfi', '-i', TONE4,
    '-ac', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', o),
  'hd-1080p25-1ch': (o) => ff('-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=25:duration=1', '-f', 'lavfi', '-i', TONE4,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'pcm_s16le', o),
  'hd-720p2997-2ch': (o) => ff('-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30000/1001:duration=1', '-f', 'lavfi', '-i', TONE4,
    '-ac', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', o),
  'sd-576i25-2ch': (o) => ff('-f', 'lavfi', '-i', 'testsrc2=size=720x576:rate=25:duration=1', '-f', 'lavfi', '-i', TONE4,
    '-ac', '2', '-vf', 'setfield=bff', '-c:v', 'mpeg2video', '-flags', '+ildct+ilme', '-c:a', 'pcm_s16le', o),
  'audio-only-stereo': (o) => ff('-f', 'lavfi', '-i', TONE4, '-ac', '2', '-c:a', 'pcm_s16le', o),
  'video-only-540p25': (o) => ff('-f', 'lavfi', '-i', 'testsrc2=size=960x540:rate=25:duration=1', '-c:v', 'libx264', '-preset', 'ultrafast', o),
};
const EXT = { 'audio-only-stereo': 'wav', 'hd-1080i25-4ch': 'mxf', 'sd-576i25-2ch': 'mxf' };

const OPTION_SETS = [
  { label: 'defaults', o: {}, args: [] },
  { label: 'r128+tc+y+re', o: { r128: true, tc: '10:00:00:00', overwrite: true, realtime: true }, args: ['--r128', '--tc', '10:00:00:00', '-y', '--realtime'] },
  { label: 'tracks2+scan-p', o: { tracks: 2, srcScan: 'p' }, args: ['--tracks', '2', '--src-scan', 'p'] },
  { label: 'scan-i+extra', o: { srcScan: 'i', extra: ['-t', '1', '-metadata', 'title=a b'] }, args: ['--src-scan', 'i'], extra: ['-t', '1', '-metadata', 'title=a b'] },
];

function runBash(preset, input, output, set, outFile) {
  return new Promise((resolve) => {
    const args = [...set.args, preset, input, output, ...(set.extra ? ['--', ...set.extra] : [])];
    const p = spawn('bash', [BCAST, ...args], {
      env: { ...process.env, BCAST_FFMPEG: FAKE, BCAST_PRESETS: PRESETS, FAKE_OUT: outFile },
    });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, err }));
  });
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

test('JS engine builds the same ffmpeg argv as bash bcast', { timeout: 15 * 60 * 1000 }, async () => {
  const srcFiles = {};
  for (const [name, make] of Object.entries(SOURCES)) {
    srcFiles[name] = path.join(tmp, `${name}.${EXT[name] || 'mp4'}`);
    make(srcFiles[name]);
  }
  const presets = bc.listPresets(PRESETS).map((p) => p.name);
  const cases = [];
  for (const preset of presets) for (const s of Object.keys(SOURCES)) for (const set of OPTION_SETS) cases.push({ preset, s, set });

  let same = 0, sameErrors = 0;
  const failures = [];
  const probes = {};
  for (const [s, f] of Object.entries(srcFiles)) probes[s] = await bc.probe(FFPROBE, f);

  await pool(cases, 8, async (c, idx) => {
    const id = `${c.preset}|${c.s}|${c.set.label}`;
    const outFile = path.join(tmp, `argv-${id.replace(/[^a-z0-9]+/gi, '_')}`);
    const output = path.join(tmp, 'out', `${c.s}_${c.preset}`);
    const bash = await runBash(c.preset, srcFiles[c.s], output, c.set, outFile);

    let js, jsErr = null;
    try {
      js = bc.buildCommand({
        ffmpeg: FAKE, presetName: c.preset, preset: bc.loadPreset(PRESETS, c.preset), src: probes[c.s],
        input: srcFiles[c.s], output, ...c.set.o,
      }).argv;
    } catch (e) { jsErr = e.message; }

    if (bash.code !== 0) {
      const msg = bash.err.replace(/\x1b\[[0-9;]*m/g, '').replace(/^bcast:\s*/m, '').trim().split('\n').pop();
      if (jsErr && msg.endsWith(jsErr)) sameErrors++;
      else failures.push(`${id}: bash failed (${msg}) but JS ${jsErr ? `failed differently (${jsErr})` : 'built a command'}`);
      return;
    }
    if (jsErr) { failures.push(`${id}: JS failed (${jsErr}) but bash built a command`); return; }
    const bashArgv = fs.readFileSync(outFile, 'utf8').split('\0').slice(0, -1);
    try { assert.deepStrictEqual(js.slice(1), bashArgv); same++; }
    catch { failures.push(`${id}:\n  bash: ${JSON.stringify(bashArgv)}\n  js:   ${JSON.stringify(js.slice(1))}`); }
  });

  console.log(`equivalence: ${same} identical commands, ${sameErrors} identical refusals, ${failures.length} differences ` +
              `(${presets.length} presets x ${Object.keys(SOURCES).length} sources x ${OPTION_SETS.length} option sets)`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::notice title=bcast engine equivalence::${same} identical commands and ${sameErrors} identical refusals across ${cases.length} cases (${presets.length} presets x ${Object.keys(SOURCES).length} sources x ${OPTION_SETS.length} option sets)`);
  }
  assert.strictEqual(failures.length, 0, failures.slice(0, 10).join('\n'));
  assert.ok(same > cases.length / 2, 'most cases should build a command');
});
