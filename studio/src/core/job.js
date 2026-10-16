// Cemal.cloud bcast Studio | run one preset on one file, here, with progress
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const bc = require('./bcast');

/** bash-style quoting, for the "copy command" button. */
function shellQuote(argv) {
  return argv.map((a) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(a) ? a : `'${String(a).replace(/'/g, `'\\''`)}'`)).join(' ');
}

/** Parse ffmpeg -progress key=value blocks. */
function progressParser(duration, onProgress) {
  let buf = '';
  let cur = {};
  let lastT = 0;
  return (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const k = line.slice(0, eq), v = line.slice(eq + 1);
      cur[k] = v;
      if (k === 'progress') {
        const us = parseInt(cur.out_time_us || cur.out_time_ms || '', 10);
        if (Number.isFinite(us) && us > 0) lastT = us / 1e6;      // "N/A" in some blocks: keep the last time
        const t = lastT;
        const speed = parseFloat(cur.speed) || 0;
        if (v !== 'end' && !(speed > 0) && t === 0) { cur = {}; continue; }
        const pct = duration > 0 ? Math.min(100, (t / duration) * 100) : null;
        const eta = duration > 0 && speed > 0 ? Math.max(0, (duration - t) / speed) : null;
        onProgress({ time: t, pct: v === 'end' ? 100 : pct, speed, eta, fps: parseFloat(cur.fps) || 0, done: v === 'end' });
        cur = {};
      }
    }
  };
}

/**
 * Start a job. Returns { id, cancel(), done: Promise<{ code, cancelled, error, argv, output }> }.
 * o: { ffmpeg, ffprobe, presetsDir, preset, input, output, overwrite, r128, tc, tracks, srcScan,
 *      onProgress, onLog, onStart }
 */
function start(o) {
  let child = null;
  let cancelled = false;
  let createdOutput = false;

  const done = (async () => {
    const preset = bc.loadPreset(o.presetsDir, o.preset);
    const src = await bc.probe(o.ffprobe, o.input);
    if (!src.width && !src.audioStreams) throw new bc.BcastError('ffprobe could not read the file (is it a media file?)');
    const { argv, outputIsDir } = bc.buildCommand({
      ffmpeg: o.ffmpeg, presetName: o.preset, preset, src, input: o.input, output: o.output,
      overwrite: !!o.overwrite, r128: !!o.r128, tc: o.tc || '', tracks: o.tracks || '', srcScan: o.srcScan || '',
    });
    if (!o.overwrite && fs.existsSync(o.output) && !outputIsDir) {
      throw new bc.BcastError(`çıktı zaten var: ${o.output} ("Üzerine yaz" ile değiştirebilirsiniz)`);
    }
    if (outputIsDir) fs.mkdirSync(o.output, { recursive: true });
    else createdOutput = !fs.existsSync(o.output);
    if (o.onStart) o.onStart({ argv, command: shellQuote(argv), source: bc.describeSource(src, o), duration: src.duration });
    if (cancelled) return { code: null, cancelled: true, argv, output: o.output };

    // -progress is a global option: put it right after the binary.
    const args = ['-progress', 'pipe:1', '-nostats', ...argv.slice(1)];
    const feed = progressParser(src.duration, o.onProgress || (() => {}));
    const t0 = Date.now();
    const code = await new Promise((resolve) => {
      child = spawn(argv[0], args, { windowsHide: true });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', feed);
      let errBuf = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (d) => {
        errBuf += d;
        let nl;
        while ((nl = errBuf.search(/[\r\n]/)) >= 0) {
          const line = errBuf.slice(0, nl);
          errBuf = errBuf.slice(nl + 1);
          if (line.trim() && o.onLog) o.onLog(line);
        }
      });
      child.on('error', (e) => { if (o.onLog) o.onLog(`error: ${e.message}`); resolve(-1); });
      child.on('close', (c) => { if (errBuf.trim() && o.onLog) o.onLog(errBuf); resolve(c); });
    });
    if (cancelled && createdOutput && !outputIsDir) {
      // no half-written file (Windows may hold the handle a moment after taskkill)
      try { fs.rmSync(o.output, { force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* best effort */ }
    }
    return { code, cancelled, argv, output: o.output, seconds: (Date.now() - t0) / 1000 };
  })();

  return {
    done,
    cancel() {
      cancelled = true;
      if (!child || child.exitCode !== null) return;
      if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => {});
      else child.kill('SIGINT');
    },
  };
}

module.exports = { start, shellQuote, progressParser };
