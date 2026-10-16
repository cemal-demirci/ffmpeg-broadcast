// Cemal.cloud bcast Studio | the bcast preset engine in JavaScript
//
// A line-by-line port of ../../bcast (bash). Given a preset and what ffprobe
// says about the source, it builds exactly the same ffmpeg argument list as
// `bcast` does. test/equivalence.test.js runs both on real files and compares
// the argv byte for byte, so the desktop app and the servers encode the same.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const CATEGORIES = ['contribution', 'post', 'distribution', 'ott', 'audio'];

class BcastError extends Error {}

// ---------------------------------------------------------------------------
// Presets: "key = value" lines, '#' comments. Values are never evaluated.
// ---------------------------------------------------------------------------
function parsePreset(text, file = 'preset') {
  const p = {};
  text.split('\n').forEach((raw, i) => {
    let line = raw.replace(/\r$/, '');
    const hash = line.indexOf('#');
    if (hash >= 0) line = line.slice(0, hash);
    if (/^\s*$/.test(line)) return;
    const m = /^\s*([a-z_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) throw new BcastError(`${file}:${i + 1}: expected 'key = value'`);
    p[m[1]] = m[2].replace(/\s+$/, '');
  });
  return p;
}

function loadPreset(dir, name) {
  const file = path.join(dir, `${name}.preset`);
  if (!/^[a-z0-9._-]+$/.test(name) || !fs.existsSync(file)) {
    throw new BcastError(`unknown preset '${name}' (see: bcast --list)`);
  }
  return parsePreset(fs.readFileSync(file, 'utf8'), file);
}

function listPresets(dir) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.preset'))
    .sort()
    .map((f) => {
      const name = f.slice(0, -'.preset'.length);
      const p = loadPreset(dir, name);
      return {
        name,
        desc: p.desc || '',
        category: p.category || '',
        ext: p.ext || '',
        ladder: !!p.ladder,
        audioOnly: p.video === 'none',
        tracks: p.tracks || '',
        encoders: requiredEncoders(p),
        muxers: requiredMuxers(p),
      };
    });
}

// pget: the value, or the default when empty / missing (like ${v:-default})
const pget = (p, key, def = '') => (p[key] ? p[key] : def);

// read -r -a: split on whitespace, no quoting
const words = (s) => (s ? s.split(/[ \t\n]+/).filter(Boolean) : []);

/** Encoders a preset needs, to tell which presets a given FFmpeg can run. */
function requiredEncoders(p) {
  const out = new Set();
  for (const key of ['video', 'audio']) {
    const w = words(p[key]);
    for (let i = 0; i < w.length - 1; i++) {
      if (w[i] === '-c:v' || w[i] === '-c:a') out.add(w[i + 1]);
    }
  }
  if (p.ladder) out.add('libx264');
  return [...out];
}

/** Output formats (muxers) a preset writes. */
function requiredMuxers(p) {
  if (p.ladder) return ['hls'];
  const w = words(p.format);
  const out = [];
  for (let i = 0; i < w.length - 1; i++) if (w[i] === '-f') out.push(w[i + 1]);
  return out;
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------
function run(bin, args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => resolve(err && !stdout ? '' : String(stdout)));
  });
}

/** Same three ffprobe queries as bcast, plus the duration for the progress bar. */
async function probe(ffprobe, input) {
  const q = (args) => run(ffprobe, ['-v', 'error', ...args, input]);
  const [vinfo, astreams, ach, dur] = await Promise.all([
    q(['-select_streams', 'v:0', '-show_entries', 'stream=width,height,field_order,r_frame_rate', '-of', 'default=nw=1']),
    q(['-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0']),
    q(['-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0']),
    q(['-show_entries', 'format=duration', '-of', 'csv=p=0']),
  ]);
  const field = (k) => {
    const m = new RegExp(`^${k}=(.*)$`, 'm').exec(vinfo);
    return m ? m[1].replace(/\r$/, '') : '';
  };
  const achLine = (ach.split('\n')[0] || '').replace(/[^0-9]/g, '');
  return {
    width: field('width'),
    height: field('height'),
    fieldOrder: field('field_order'),
    rate: field('r_frame_rate'),
    audioStreams: astreams.split('\n').filter((l) => /./.test(l)).length,
    audioChannels: achLine ? parseInt(achLine, 10) : 0,
    duration: parseFloat(dur) || 0,
  };
}

// frame rate in milli-fps, e.g. 25/1 -> 25000, 30000/1001 -> 29970 (awk printf %d)
function rateM(r) {
  const [a, b] = (r || '0/1').split('/');
  const num = parseFloat(a) || 0;
  const den = !b || parseFloat(b) === 0 ? 1 : parseFloat(b);
  return Math.trunc((num / den) * 1000 + 0.5);
}

/** What the source is, in one line (as bcast prints it). */
function describeSource(src, opts = {}) {
  const has = !!src.width;
  if (!has) return `no video, ${src.audioStreams} audio stream(s)`;
  const il = isInterlaced(src, opts);
  const fps = rateM(src.rate) / 1000;
  return `${src.width}x${src.height} ${il ? 'interlaced' : 'progressive'} ${+fps.toFixed(3)} fps, ${src.audioStreams} audio stream(s)`;
}

function isInterlaced(src, opts) {
  let il = /^(tt|bb|tb|bt)$/.test(src.fieldOrder || '');
  if (opts.srcScan === 'i') il = true;
  if (opts.srcScan === 'p') il = false;
  return il;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------
/**
 * Build the ffmpeg argv exactly like bcast.
 * @param {object} o { ffmpeg, presetName, preset, src, input, output,
 *   overwrite, realtime, r128, tc, tracks, srcScan, extra: [] }
 * @returns {{ argv: string[], outputIsDir: boolean }}
 */
function buildCommand(o) {
  const P = o.preset;
  const name = o.presetName;
  const src = o.src;
  const opts = { srcScan: o.srcScan || '' };

  if (o.tracks && !/^[1-9][0-9]?$/.test(String(o.tracks))) throw new BcastError('--tracks must be 1..99');
  if (o.srcScan && !/^[ip]$/.test(o.srcScan)) throw new BcastError('--src-scan must be i or p');
  if (o.tc && !/^[0-9]{2}:[0-9]{2}:[0-9]{2}[:;][0-9]{2}$/.test(o.tc)) throw new BcastError('--tc must look like 10:00:00:00');

  const SRC_W = src.width || '';
  const SRC_H = src.height || '';
  const HAS_VIDEO = SRC_W !== '';
  const A_STREAMS = src.audioStreams || 0;
  const SRC_ACH = src.audioChannels || 0;
  const RATE = rateM(src.rate);
  const INTERLACED = isInterlaced(src, opts);

  if (INTERLACED && pget(P, 'on_interlaced')) throw new BcastError(`${name}: ${pget(P, 'on_interlaced')}`);

  let TW = '', TH = '';
  if (pget(P, 'size')) {
    const m = /^([0-9]+)x([0-9]+)$/.exec(pget(P, 'size'));
    if (!m) throw new BcastError('preset size must be WxH');
    [, TW, TH] = m;
  }

  const num = (v) => (v === '' ? 0 : parseInt(v, 10));
  const scaleFilter = (w, h, interl = 0) => {
    let f = `scale=${w}:${h}`;
    if (interl) f += ':interl=1';
    if (pget(P, 'matrix') === 'bt601' && num(SRC_H) >= 720 && num(h) < 720) {
      f += ':in_color_matrix=bt709:out_color_matrix=bt601';
    }
    return f;
  };

  const VCHAIN = [];
  let OUT_INTERLACED = false;
  const buildVchain = () => {
    const scan = pget(P, 'scan', 'keep');
    const resize = TW !== '' && (TW !== SRC_W || TH !== SRC_H);
    const il = INTERLACED;
    let rate = RATE;
    switch (scan) {
      case 'keep':
        if (resize) VCHAIN.push(scaleFilter(TW, TH, il ? 1 : 0));
        OUT_INTERLACED = il;
        break;
      case 'p':
        if (il) VCHAIN.push('bwdif=mode=send_frame');
        if (resize) VCHAIN.push(scaleFilter(TW, TH));
        break;
      case 'p25':
      case 'p50': {
        const want = scan === 'p50' ? 50000 : 25000;
        if (il) {
          if (want === 50000) { VCHAIN.push('bwdif=mode=send_field'); rate *= 2; }
          else VCHAIN.push('bwdif=mode=send_frame');
        }
        if (rate !== want) VCHAIN.push(`fps=${Math.trunc(want / 1000)}`);
        if (resize) VCHAIN.push(scaleFilter(TW, TH));
        break;
      }
      case 'i25':
        OUT_INTERLACED = true;
        if (il && rate === 25000 && !resize) {
          VCHAIN.push('fieldorder=tff');
        } else {
          if (il) { VCHAIN.push('bwdif=mode=send_field'); rate *= 2; }
          if (rate === 25000) {
            if (resize) VCHAIN.push(scaleFilter(TW, TH));
          } else {
            if (rate !== 50000) VCHAIN.push('fps=50');
            if (resize) VCHAIN.push(scaleFilter(TW, TH));
            VCHAIN.push('tinterlace=mode=interleave_top');
          }
        }
        VCHAIN.push('setfield=tff');
        break;
      default:
        throw new BcastError('preset scan must be keep, p, p25, p50 or i25');
    }
    if (pget(P, 'vf_post')) VCHAIN.push(pget(P, 'vf_post'));
    if (pget(P, 'pix_fmt')) VCHAIN.push(`format=${pget(P, 'pix_fmt')}`);
  };

  const AF = [];
  if (o.r128 && !pget(P, 'af').includes('loudnorm')) AF.push('loudnorm=I=-23:TP=-1:LRA=7');
  if (pget(P, 'af')) AF.push(pget(P, 'af'));
  const RESAMPLE = pget(P, 'resample', '48000');
  if (RESAMPLE !== 'keep') AF.push(`aresample=${RESAMPLE}`);

  const VARGS = words(pget(P, 'video'));
  const VIARGS = words(pget(P, 'video_interlaced'));
  const AARGS = words(pget(P, 'audio'));
  const FARGS = words(pget(P, 'format'));
  const EXTRA = o.extra || [];
  const IN = o.input;
  const OUT = o.output;

  const CMD = [o.ffmpeg || 'ffmpeg', '-hide_banner', '-nostdin', o.overwrite ? '-y' : '-n'];
  if (o.realtime) CMD.push('-re');
  CMD.push('-i', IN);

  let outputIsDir = false;
  if (pget(P, 'ladder')) {
    // ---------------- HLS ABR ladder ----------------
    if (!HAS_VIDEO) throw new BcastError('input has no video stream');
    buildVchain();
    const RUNGS = pget(P, 'ladder').split(',');
    const re = /^([0-9]+)x([0-9]+):([0-9]+)k$/;
    let KEEP = [];
    for (const r of RUNGS) {
      const m = re.exec(r);
      if (!m) throw new BcastError(`bad ladder rung '${r}' (WxH:NNNNk)`);
      if (SRC_H === '' || num(m[2]) <= num(SRC_H)) KEEP.push(r);
    }
    if (KEEP.length === 0) KEEP = [RUNGS[RUNGS.length - 1]];   // never upscale beyond the smallest rung
    const n = KEEP.length;
    let FC = `[0:v:0]${VCHAIN.length ? VCHAIN.join(',') + ',' : ''}split=${n}`;
    for (let i = 0; i < n; i++) FC += `[v${i}]`;
    const BR = [], MAP = [], VSM = [];
    const withAudio = A_STREAMS > 0 && pget(P, 'audio') !== 'none';
    KEEP.forEach((r, i) => {
      const [, w, h, bs] = re.exec(r);
      const b = parseInt(bs, 10);
      FC += `;[v${i}]scale=${w}:${h},format=yuv420p[o${i}]`;
      MAP.push('-map', `[o${i}]`);
      BR.push(`-b:v:${i}`, `${b}k`, `-maxrate:v:${i}`, `${Math.trunc((b * 11) / 10)}k`, `-bufsize:v:${i}`, `${b * 2}k`);
      VSM.push(withAudio ? `v:${i},a:${i}` : `v:${i}`);
    });
    CMD.push('-filter_complex', FC, ...MAP);
    if (withAudio) {
      for (let i = 0; i < n; i++) CMD.push('-map', '0:a:0');
      if (AF.length) CMD.push('-af', AF.join(','));
      CMD.push(...AARGS);
    }
    CMD.push(...VARGS, ...BR, ...EXTRA);
    CMD.push('-f', 'hls', '-hls_time', pget(P, 'hls_time', '4'), '-hls_playlist_type', 'vod',
      '-hls_segment_type', 'fmp4', '-master_pl_name', 'master.m3u8',
      '-hls_segment_filename', `${OUT}/v%v/seg_%05d.m4s`,
      '-var_stream_map', VSM.join(' '), `${OUT}/v%v/index.m3u8`);
    outputIsDir = true;
  } else {
    // ---------------- single output ----------------
    if (pget(P, 'video') === 'none') {
      CMD.push('-vn');
    } else {
      if (!HAS_VIDEO) throw new BcastError(`input has no video stream; preset '${name}' needs video`);
      buildVchain();
      CMD.push('-map', '0:v:0');
      if (VCHAIN.length) CMD.push('-vf', VCHAIN.join(','));
      CMD.push(...VARGS);
      if (OUT_INTERLACED && VIARGS.length) CMD.push(...VIARGS);
    }

    const tracks = o.tracks ? String(o.tracks) : pget(P, 'tracks');
    const chans = pget(P, 'channels');
    if (pget(P, 'audio') === 'none' || A_STREAMS === 0) {
      CMD.push('-an');
    } else if (tracks) {
      // N mono tracks: source channel i -> track i, missing channels are silent
      const t = parseInt(tracks, 10);
      let FC = '[0:a:0]';
      if (AF.length) FC += AF.join(',') + ',';
      FC += `asplit=${t}`;
      for (let i = 0; i < t; i++) FC += `[s${i}]`;
      for (let i = 0; i < t; i++) {
        FC += i < SRC_ACH ? `;[s${i}]pan=mono|c0=c${i}[m${i}]` : `;[s${i}]pan=mono|c0=0*c0[m${i}]`;
      }
      CMD.push('-filter_complex', FC);
      for (let i = 0; i < t; i++) CMD.push('-map', `[m${i}]`);
      CMD.push(...AARGS);
    } else if (chans) {
      // one stream with N channels (e.g. D10 AES3 4/8 ch)
      const c = parseInt(chans, 10);
      let pan = `pan=${chans}c`;
      for (let i = 0; i < c; i++) pan += i < SRC_ACH ? `|c${i}=c${i}` : `|c${i}=0*c0`;
      CMD.push('-map', '0:a:0', '-af', [...AF, pan].join(','), ...AARGS);
    } else {
      CMD.push('-map', pget(P, 'audio_map', 'first') === 'all' ? '0:a' : '0:a:0');
      if (AF.length) CMD.push('-af', AF.join(','));
      CMD.push(...AARGS);
    }

    if (o.tc) CMD.push('-timecode', o.tc);
    CMD.push(...FARGS, ...EXTRA, OUT);
  }
  return { argv: CMD, outputIsDir };
}

/** Default output path for an input + preset: name_preset.ext next to it (or in outDir). */
function defaultOutput(input, presetInfo, outDir) {
  const dir = outDir || path.dirname(input);
  const base = path.basename(input).replace(/\.[^.]+$/, '');
  if (presetInfo.ladder || presetInfo.ext === '/') return path.join(dir, `${base}_${presetInfo.name}`);
  return path.join(dir, `${base}_${presetInfo.name}.${presetInfo.ext || 'mov'}`);
}

module.exports = {
  CATEGORIES, BcastError, parsePreset, loadPreset, listPresets, requiredEncoders,
  probe, rateM, describeSource, buildCommand, defaultOutput,
};
