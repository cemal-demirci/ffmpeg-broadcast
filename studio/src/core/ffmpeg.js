// Cemal.cloud bcast Studio | find FFmpeg on this computer, or download a build
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const EXE = process.platform === 'win32' ? '.exe' : '';

// Builds with x264, x265 and SRT, downloaded on the user's request from the
// projects that publish them (the app does not ship FFmpeg itself).
const DOWNLOADS = {
  'win32-x64': {
    label: 'BtbN FFmpeg-Builds (GPL, win64)',
    archives: ['https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'],
  },
  'darwin-arm64': {
    label: 'Martin Riedl FFmpeg build server (macOS arm64)',
    archives: ['https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip',
               'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip'],
  },
  'darwin-x64': {
    label: 'Martin Riedl FFmpeg build server (macOS Intel)',
    archives: ['https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/release/ffmpeg.zip',
               'https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/release/ffprobe.zip'],
  },
  'linux-x64': {
    label: 'BtbN FFmpeg-Builds (GPL, linux64)',
    archives: ['https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz'],
  },
};

const platformKey = () => `${process.platform}-${process.arch}`;
const downloadable = () => !!DOWNLOADS[platformKey()];

function exec(bin, args, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ ok: !err, stdout: String(stdout || ''), stderr: String(stderr || ''), err }));
  });
}

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

/** Places to look, most specific first. */
function candidates(opts = {}) {
  const c = [];
  if (opts.custom) c.push({ path: opts.custom, source: 'seçtiğiniz' });
  if (opts.downloadDir) c.push({ path: path.join(opts.downloadDir, 'bin', `ffmpeg${EXE}`), source: 'indirilen' });
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const extra = process.platform === 'win32'
    ? [path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links'), 'C:\\ffmpeg\\bin',
       path.join(process.env.ProgramFiles || 'C:\\Program Files', 'ffmpeg', 'bin')]
    : ['/opt/ffmpeg-broadcast/bin', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
  for (const d of [...extra, ...pathDirs]) {
    c.push({ path: path.join(d, `ffmpeg${EXE}`), source: d.includes('homebrew') ? 'Homebrew' : d.includes('ffmpeg-broadcast') ? 'ffmpeg-broadcast' : 'sistem' });
  }
  return c;
}

/** First FFmpeg with an ffprobe next to it that actually runs. */
async function locate(opts = {}) {
  const seen = new Set();
  for (const c of candidates(opts)) {
    const key = path.resolve(c.path).toLowerCase();
    if (seen.has(key) || !isFile(c.path)) continue;
    seen.add(key);
    const probe = path.join(path.dirname(c.path), `ffprobe${EXE}`);
    if (!isFile(probe)) continue;
    const info = await inspect(c.path);
    if (info) return { ...info, ffprobe: probe, source: c.source };
  }
  return null;
}

/** Version and what it can encode / write. */
async function inspect(ffmpegPath) {
  const v = await exec(ffmpegPath, ['-hide_banner', '-version']);
  if (!v.ok) return null;
  const version = (/ffmpeg version (\S+)/.exec(v.stdout) || [])[1] || 'unknown';
  const [enc, mux] = await Promise.all([
    exec(ffmpegPath, ['-hide_banner', '-encoders']),
    exec(ffmpegPath, ['-hide_banner', '-muxers']),
  ]);
  const names = (txt, re) => new Set(txt.split('\n').map((l) => (re.exec(l) || [])[1]).filter(Boolean));
  return {
    path: ffmpegPath,
    version,
    encoders: names(enc.stdout, /^\s[VAS][A-Z.]{5}\s+(\S+)/),
    muxers: names(mux.stdout, /^\s+D?E\s+(\S+)/),
  };
}

/** Which presets this FFmpeg can run, and what is missing for the others. */
function checkPresets(info, presets) {
  const out = {};
  for (const p of presets) {
    const missing = [];
    for (const e of p.encoders) if (!info.encoders.has(e)) missing.push(e);
    for (const m of p.muxers || []) if (info.muxers.size && !info.muxers.has(m)) missing.push(m);
    out[p.name] = missing;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------
async function downloadTo(url, file, onProgress, fetchImpl) {
  const res = await (fetchImpl || fetch)(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const outStream = fs.createWriteStream(file);
  let got = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length;
    if (!outStream.write(Buffer.from(value))) await new Promise((r) => outStream.once('drain', r));
    if (onProgress) onProgress(got, total);
  }
  await new Promise((r, j) => outStream.end((e) => (e ? j(e) : r())));
  return got;
}

async function extract(archive, dir) {
  fs.mkdirSync(dir, { recursive: true });
  let r;
  if (archive.endsWith('.tar.xz')) r = await exec('tar', ['-xJf', archive, '-C', dir], 300000);
  else if (process.platform === 'darwin') r = await exec('ditto', ['-x', '-k', archive, dir], 300000);
  else if (process.platform === 'win32') {
    // Windows' own bsdtar reads zip. Call it by full path: a GNU tar from Git or MSYS
    // earlier in PATH cannot. Very old Windows 10 builds have no tar: use PowerShell.
    const sysTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    if (isFile(sysTar)) r = await exec(sysTar, ['-xf', archive, '-C', dir], 300000);
    else {
      const lit = (p) => `'${p.replace(/'/g, "''")}'`;
      r = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `Expand-Archive -LiteralPath ${lit(archive)} -DestinationPath ${lit(dir)} -Force`], 600000);
    }
  } else r = await exec('unzip', ['-q', '-o', archive, '-d', dir], 300000);
  if (!r.ok) throw new Error(`could not unpack ${path.basename(archive)}: ${r.stderr || r.err}`);
}

function findFile(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const f = findFile(p, name); if (f) return f; }
    else if (e.name === name) return p;
  }
  return null;
}

/**
 * Download FFmpeg + ffprobe for this platform into destDir/bin.
 * onProgress({ step, received, total })
 */
async function download(destDir, onProgress = () => {}, fetchImpl) {
  const spec = DOWNLOADS[platformKey()];
  if (!spec) throw new Error(`no download for ${platformKey()}; install FFmpeg and choose it`);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'bcast-ffmpeg-'));
  try {
    for (let i = 0; i < spec.archives.length; i++) {
      const url = spec.archives[i];
      const name = url.endsWith('.tar.xz') ? 'a.tar.xz' : `a${i}.zip`;
      const archive = path.join(work, name);
      await downloadTo(url, archive, (received, total) =>
        onProgress({ step: `${i + 1}/${spec.archives.length}`, received, total }), fetchImpl);
      onProgress({ step: 'unpack' });
      await extract(archive, path.join(work, `x${i}`));
    }
    const bin = path.join(destDir, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    for (const tool of ['ffmpeg', 'ffprobe']) {
      const found = findFile(work, `${tool}${EXE}`);
      if (!found) throw new Error(`${tool} not found in the download`);
      const target = path.join(bin, `${tool}${EXE}`);
      fs.copyFileSync(found, target);
      fs.chmodSync(target, 0o755);
      if (process.platform === 'darwin') {
        await exec('xattr', ['-dr', 'com.apple.quarantine', target]);
        if (!(await exec(target, ['-hide_banner', '-version'])).ok) {
          await exec('codesign', ['--force', '--sign', '-', target]);   // ad-hoc signature for Apple silicon
        }
      }
    }
    fs.writeFileSync(path.join(destDir, 'SOURCE.txt'),
      `${spec.label}\n${spec.archives.join('\n')}\nDownloaded ${new Date().toISOString()}\n` +
      'FFmpeg is licensed under the GNU GPL (these builds include x264 / x265). Source: https://ffmpeg.org\n');
    const info = await inspect(path.join(bin, `ffmpeg${EXE}`));
    if (!info) throw new Error('the downloaded FFmpeg does not run on this computer');
    return { ...info, ffprobe: path.join(bin, `ffprobe${EXE}`), source: 'indirilen' };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = { DOWNLOADS, platformKey, downloadable, locate, inspect, checkPresets, download, EXE };
