// Cemal.cloud bcast Studio | servers: connect over SSH, install ffmpeg-broadcast, run jobs there
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('ssh2');

const PREFIX = '/opt/ffmpeg-broadcast';
const WORK = '/var/tmp/cemalcloud-ffmpeg-broadcast';      // sources + install log on the server
const LOG = `${WORK}/install.log`;
const STATUS = `${WORK}/install.status`;

class RemoteError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

/** OpenSSH style fingerprint: SHA256:base64 without padding. */
const fingerprint = (key) => `SHA256:${crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;

/**
 * One server.
 * cfg: { host, port, username, auth: 'password' | 'key' | 'agent', keyPath }
 * secret: { password, passphrase, sudoPassword }
 * hosts: { get(hostport) -> fingerprint|undefined, set(hostport, fp) }  (trust on first use)
 */
class Server {
  constructor(cfg, secret = {}, hosts) {
    this.cfg = { port: 22, ...cfg };
    this.secret = secret;
    this.hosts = hosts;
    this.conn = null;
    this.newHostKey = null;
    this.sudo = null;           // '' (root), 'nopass', 'password'
  }

  get hostport() { return `${this.cfg.host}:${this.cfg.port}`; }

  /**
   * Connect. A connection that drops during the handshake (reset, lost before
   * the handshake) is tried once more: on busy servers and flaky links the
   * second attempt usually goes through. Refused, unreachable, wrong password
   * and a changed host key are reported at once.
   */
  async connect() {
    try { return await this.connectOnce(); } catch (e) {
      if (e.code !== 'DROPPED') throw e;
      await new Promise((r) => setTimeout(r, 1500));
      return this.connectOnce();
    }
  }

  connectOnce() {
    return new Promise((resolve, reject) => {
      const c = new Client();
      let mismatch = null;
      const opts = {
        host: this.cfg.host,
        port: Number(this.cfg.port) || 22,
        username: this.cfg.username,
        readyTimeout: 20000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 8,
        hostVerifier: (key) => {
          const fp = fingerprint(key);
          const known = this.hosts && this.hosts.get(this.hostport);
          if (!known) { this.newHostKey = fp; if (this.hosts) this.hosts.set(this.hostport, fp); return true; }
          if (known === fp) return true;
          mismatch = { known, presented: fp };
          return false;
        },
      };
      if (this.cfg.auth === 'key') {
        try { opts.privateKey = fs.readFileSync(this.cfg.keyPath); }
        catch (e) { reject(new RemoteError('KEY_READ', `SSH anahtarı okunamadı: ${this.cfg.keyPath}`)); return; }
        if (this.secret.passphrase) opts.passphrase = this.secret.passphrase;
      } else if (this.cfg.auth === 'agent') {
        opts.agent = process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : process.env.SSH_AUTH_SOCK;
      } else {
        opts.password = this.secret.password || '';
        opts.tryKeyboard = true;
      }
      c.on('keyboard-interactive', (_n, _i, _l, prompts, finish) => finish(prompts.map(() => this.secret.password || '')));
      c.on('ready', () => { this.conn = c; resolve(this); });
      c.on('error', (e) => {
        if (mismatch) {
          reject(new RemoteError('HOST_KEY_CHANGED',
            `Sunucunun kimliği değişmiş (beklenen ${mismatch.known}, gelen ${mismatch.presented}). ` +
            'Sunucu yeniden kurulduysa kimliği sıfırlayın; değilse araya giren biri olabilir.', mismatch));
        } else if (e.level === 'client-authentication') {
          reject(new RemoteError('AUTH', 'Kullanıcı adı, şifre ya da anahtar kabul edilmedi.'));
        } else if (/ECONNREFUSED|EHOSTUNREACH|ENOTFOUND|ETIMEDOUT|Timed out/i.test(String(e.code || e.message))) {
          reject(new RemoteError('UNREACHABLE', `${this.hostport} adresine ulaşılamadı (${e.code || e.message}).`));
        } else if (/ECONNRESET|EPIPE|lost before handshake|Connection lost/i.test(String(e.code || e.message))) {
          reject(new RemoteError('DROPPED', `${this.hostport} bağlantıyı el sıkışma sırasında kesti (${e.code || e.message}). Sunucu meşgul olabilir, tekrar deneyin.`));
        } else reject(new RemoteError('SSH', `SSH hatası: ${e.message}`));
      });
      try { c.connect(opts); } catch (e) { reject(new RemoteError('SSH', e.message)); }
    });
  }

  close() { if (this.conn) this.conn.end(); this.conn = null; }

  /** Run a command. Resolves { code, stdout, stderr }. */
  exec(cmd, { stdin, onStdout, onStderr, onStream } = {}) {
    return new Promise((resolve, reject) => {
      this.conn.exec(cmd, (err, stream) => {
        if (err) { reject(new RemoteError('SSH', err.message)); return; }
        if (onStream) onStream(stream);
        let out = '', errOut = '';
        stream.on('data', (d) => { const s = d.toString(); out += s; if (onStdout) onStdout(s); });
        stream.stderr.on('data', (d) => { const s = d.toString(); errOut += s; if (onStderr) onStderr(s); });
        stream.on('close', (code) => resolve({ code: code == null ? -1 : code, stdout: out, stderr: errOut }));
        if (stdin != null) stream.end(stdin); else stream.end();
      });
    });
  }

  /** Work out how to become root: already root, passwordless sudo, or sudo with a password. */
  async sudoMode() {
    if (this.sudo !== null) return this.sudo;
    const id = await this.exec('id -u');
    if (id.stdout.trim() === '0') return (this.sudo = '');
    const n = await this.exec('sudo -n true');
    if (n.code === 0) return (this.sudo = 'nopass');
    const pw = this.secret.sudoPassword || this.secret.password;
    if (!pw) throw new RemoteError('SUDO', 'Bu kullanıcı sudo için şifre istiyor; sunucu ayarlarına sudo şifresini girin.');
    const t = await this.exec("sudo -S -p '' true", { stdin: `${pw}\n` });
    if (t.code !== 0) throw new RemoteError('SUDO', 'sudo şifresi kabul edilmedi (ya da kullanıcının sudo yetkisi yok).');
    return (this.sudo = 'password');
  }

  /** Run a bash snippet as root. */
  async root(script, opts = {}) {
    const mode = await this.sudoMode();
    const cmd = `bash -c ${q(script)}`;
    if (mode === '') return this.exec(cmd, opts);
    if (mode === 'nopass') return this.exec(`sudo -n ${cmd}`, opts);
    const pw = this.secret.sudoPassword || this.secret.password;
    return this.exec(`sudo -S -p '' ${cmd}`, { ...opts, stdin: `${pw}\n` });
  }

  /** What the server is and whether ffmpeg-broadcast is on it. */
  async info() {
    const r = await this.exec([
      '. /etc/os-release 2>/dev/null; echo "os=${PRETTY_NAME:-unknown}"; echo "id=${ID:-}"; echo "ver=${VERSION_ID:-}"',
      'echo "arch=$(uname -m)"; echo "cpus=$(nproc 2>/dev/null)"',
      'echo "mem=$(awk \'/MemTotal/ {printf "%d", $2/1024/1024 + 0.5}\' /proc/meminfo 2>/dev/null)"',
      'echo "disk=$(df -Pk /var/tmp 2>/dev/null | awk \'NR==2 {printf "%d", $4/1024/1024}\')"',
      'echo "apt=$(command -v apt-get >/dev/null && echo 1 || echo 0)"',
      `if [ -x ${PREFIX}/bin/ffmpeg ]; then echo "ffmpeg=$(${PREFIX}/bin/ffmpeg -hide_banner -version 2>/dev/null | head -n1 | awk '{print $3}')"; fi`,
      `if [ -x ${PREFIX}/bin/bcast ]; then echo "presets=$(${PREFIX}/bin/bcast --names 2>/dev/null | wc -l)"; fi`,
      `if [ -f ${STATUS} ]; then echo "lastinstall=$(cat ${STATUS})"; fi`,
      `if [ -f ${WORK}/install.pid ] && [ -d "/proc/$(cat ${WORK}/install.pid)" ] && [ ! -f ${STATUS} ]; then echo installing=1; fi`,
    ].join('; '));
    const kv = {};
    for (const line of r.stdout.split('\n')) { const i = line.indexOf('='); if (i > 0) kv[line.slice(0, i)] = line.slice(i + 1).trim(); }
    return {
      os: kv.os, osId: kv.id, osVersion: kv.ver, arch: kv.arch,
      cpus: parseInt(kv.cpus, 10) || 0, memGB: parseInt(kv.mem, 10) || 0, freeDiskGB: parseInt(kv.disk, 10) || 0,
      apt: kv.apt === '1', ffmpeg: kv.ffmpeg || null, presets: parseInt(kv.presets, 10) || 0,
      installing: kv.installing === '1', lastInstallExit: kv.lastinstall != null ? parseInt(kv.lastinstall, 10) : null,
      user: this.cfg.username, hostKey: this.hosts && this.hosts.get(this.hostport),
    };
  }

  sftp() {
    return new Promise((resolve, reject) => this.conn.sftp((e, s) => (e ? reject(new RemoteError('SFTP', e.message)) : resolve(s))));
  }

  /** Upload the build script, bcast and the presets to a private temp dir. Returns the dir. */
  async uploadKit(kitDir) {
    const dir = (await this.exec('mktemp -d /tmp/cemalcloud-kit.XXXXXX')).stdout.trim();
    if (!dir.startsWith('/tmp/cemalcloud-kit.')) throw new RemoteError('SFTP', 'sunucuda geçici klasör açılamadı');
    const sftp = await this.sftp();
    const put = (l, r) => new Promise((res, rej) => sftp.fastPut(l, r, (e) => (e ? rej(new RemoteError('SFTP', `${path.basename(l)}: ${e.message}`)) : res())));
    const mkdir = (r) => new Promise((res) => sftp.mkdir(r, () => res()));
    await put(path.join(kitDir, 'build-ffmpeg-broadcast.sh'), `${dir}/build-ffmpeg-broadcast.sh`);
    await put(path.join(kitDir, 'bcast'), `${dir}/bcast`);
    await mkdir(`${dir}/presets`);
    for (const f of fs.readdirSync(path.join(kitDir, 'presets'))) {
      if (f.endsWith('.preset')) await put(path.join(kitDir, 'presets', f), `${dir}/presets/${f}`);
    }
    sftp.end();
    await this.exec(`chmod 755 ${q(dir)}/build-ffmpeg-broadcast.sh ${q(dir)}/bcast`);
    return dir;
  }

  /**
   * Build and install on the server. The build runs detached (setsid nohup) and
   * writes to a log, so a dropped connection does not stop it; follow() picks it up again.
   */
  async install({ kitDir, jobs, nvenc, presetsOnly, onLine, onCompiled }) {
    const info = await this.info();
    if (info.installing) throw new RemoteError('BUSY', 'Bu sunucuda zaten bir kurulum sürüyor; "İzle" ile takip edebilirsiniz.');
    if (!info.apt) throw new RemoteError('OS', `Kurulum Ubuntu / Debian (apt) bekliyor; bu sunucu: ${info.os}.`);
    const dir = await this.uploadKit(kitDir);
    const flags = presetsOnly ? ['--presets-only'] : ['--src', `${WORK}/src`, '--jobs', String(jobs || info.cpus || 2), ...(nvenc ? ['--with-nvenc'] : [])];
    const build = `cd ${q(dir)} && bash ./build-ffmpeg-broadcast.sh ${flags.map(q).join(' ')}`;
    // Separate statements: only the build itself goes to the background.
    const runner = `set -e; mkdir -p ${WORK}; rm -f ${STATUS}; : > ${LOG}; chmod 644 ${LOG}; set +e\n` +
      `setsid nohup bash -c ${q(`${build} >> ${LOG} 2>&1; echo $? > ${STATUS}; rm -rf ${q(dir)}`)} >/dev/null 2>&1 < /dev/null &\n` +
      `echo $! > ${WORK}/install.pid`;
    const r = await this.root(runner);
    if (r.code !== 0) throw new RemoteError('INSTALL', `kurulum başlatılamadı: ${stripAnsi(r.stderr || r.stdout).trim()}`);
    return this.follow({ onLine, onCompiled });
  }

  /**
   * Stream the install log until the build finishes. Resolves the exit code.
   * onCompiled(n): how many source files make has compiled so far (the build
   * script keeps make's own output in a separate log under the source dir).
   */
  async follow({ onLine, onCompiled, fromStart = true } = {}) {
    let buf = '';
    let tailStream = null;
    const emit = (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.search(/[\r\n]/)) >= 0) {
        const line = stripAnsi(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
        if (line.trim() && onLine) onLine(line);
      }
    };
    const tail = this.exec(`tail -n ${fromStart ? '+1' : '50'} -F ${LOG} 2>/dev/null`, {
      onStdout: emit, onStream: (s) => { tailStream = s; },
    });
    // Ends when the build writes its exit code, or when the build process is gone without one.
    let status = null;
    let last = -1;
    const wait = await this.exec(`while [ ! -f ${STATUS} ]; do ` +
      `if [ -f ${WORK}/install.pid ] && [ ! -d "/proc/$(cat ${WORK}/install.pid)" ]; then sleep 2; [ -f ${STATUS} ] || { echo status=-1; exit 0; }; fi; ` +
      `echo "compiled=$(cat ${WORK}/src/make-*.log 2>/dev/null | grep -cE '^[[:space:]]*(CC|CXX|AS|X86ASM)[[:space:]]')"; ` +
      `sleep 3; done; sleep 1; echo "status=$(cat ${STATUS})"`, {
      onStdout: (s) => {
        for (const m of s.matchAll(/^(compiled|status)=(-?\d+)/gm)) {
          if (m[1] === 'status') status = parseInt(m[2], 10);
          else if (onCompiled && +m[2] !== last && +m[2] > 0) { last = +m[2]; onCompiled(last); }
        }
      },
    });
    if (status === null) { const m = /status=(-?\d+)/.exec(wait.stdout); if (m) status = parseInt(m[1], 10); }
    if (tailStream) tailStream.close();
    await Promise.race([tail, new Promise((r) => setTimeout(r, 3000))]);
    if (buf.trim() && onLine) onLine(stripAnsi(buf));
    return Number.isFinite(status) ? status : -1;
  }

  /** List a directory on the server (for picking files). */
  async browse(dir) {
    const sftp = await this.sftp();
    try {
      const real = await new Promise((res, rej) => sftp.realpath(dir || '.', (e, p) => (e ? rej(new RemoteError('SFTP', e.message)) : res(p))));
      const list = await new Promise((res, rej) => sftp.readdir(real, (e, l) => (e ? rej(new RemoteError('SFTP', `${real}: ${e.message}`)) : res(l))));
      const entries = list
        .filter((e) => !e.filename.startsWith('.'))
        .map((e) => ({ name: e.filename, dir: (e.attrs.mode & 0o170000) === 0o040000, size: e.attrs.size }))
        .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
      return { path: real, entries };
    } finally { sftp.end(); }
  }

  /**
   * Run bcast on the server. Returns { done: Promise<{code}>, cancel() }.
   * o: { preset, input, output, overwrite, r128, tc, tracks, srcScan, onProgress, onLine, onStart }
   */
  runJob(o) {
    let pid = null;
    let cancelled = false;
    const done = (async () => {
      const dur = await this.exec(`${PREFIX}/bin/ffprobe -v error -show_entries format=duration -of csv=p=0 ${q(o.input)}`);
      const duration = parseFloat(dur.stdout) || 0;
      if (!duration && dur.code !== 0) throw new RemoteError('INPUT', `sunucuda dosya okunamadı: ${o.input}`);
      const args = [];
      if (o.overwrite) args.push('-y');
      if (o.r128) args.push('--r128');
      if (o.tc) args.push('--tc', o.tc);
      if (o.tracks) args.push('--tracks', String(o.tracks));
      if (o.srcScan) args.push('--src-scan', o.srcScan);
      args.push(o.preset, o.input, o.output, '--', '-progress', 'pipe:1', '-nostats');
      const cmd = `${PREFIX}/bin/bcast ${args.map(q).join(' ')}`;
      if (o.onStart) o.onStart({ command: cmd, duration });
      const { progressParser } = require('./job');
      const feed = progressParser(duration, o.onProgress || (() => {}));
      let errBuf = '';
      const r = await this.exec(`echo "PID:$$"; exec ${cmd}`, {
        onStdout: (s) => {
          const m = /^PID:(\d+)\n?/.exec(s);
          if (m && pid === null) { pid = m[1]; s = s.slice(m[0].length); if (cancelled) this.exec(`kill -INT ${pid}`); }
          feed(s);
        },
        onStderr: (s) => {
          errBuf += s;
          let nl;
          while ((nl = errBuf.search(/[\r\n]/)) >= 0) {
            const line = stripAnsi(errBuf.slice(0, nl));
            errBuf = errBuf.slice(nl + 1);
            if (line.trim() && o.onLine) o.onLine(line);
          }
        },
      });
      return { code: r.code, cancelled, output: o.output };
    })();
    return {
      done,
      cancel: () => { cancelled = true; if (pid) this.exec(`kill -INT ${pid}`).catch(() => {}); },
    };
  }
}

module.exports = { Server, RemoteError, fingerprint, PREFIX, WORK };
