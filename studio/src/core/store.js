// Cemal.cloud bcast Studio | settings, servers and known host keys on disk
//
// Passwords and key passphrases are encrypted with the operating system
// (Electron safeStorage: Keychain on macOS, DPAPI on Windows). When that is
// not available they are not stored at all and the app asks each time.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Store {
  /** cipher: { available(), encrypt(string) -> Buffer, decrypt(Buffer) -> string } */
  constructor(dir, cipher) {
    this.dir = dir;
    this.cipher = cipher;
    fs.mkdirSync(dir, { recursive: true });
  }

  file(name) { return path.join(this.dir, name); }

  read(name, def) {
    try { return JSON.parse(fs.readFileSync(this.file(name), 'utf8')); } catch { return def; }
  }

  write(name, data) {
    const tmp = `${this.file(name)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file(name));
  }

  // ---- settings -----------------------------------------------------------
  settings() { return this.read('settings.json', {}); }
  setSettings(patch) { const s = { ...this.settings(), ...patch }; this.write('settings.json', s); return s; }

  // ---- servers ------------------------------------------------------------
  rawServers() { return this.read('servers.json', []); }

  /** Servers without secrets, for the window. */
  servers() {
    return this.rawServers().map(({ secret, ...s }) => ({ ...s, hasSecret: !!secret }));
  }

  canStoreSecrets() { return !!(this.cipher && this.cipher.available()); }

  /** Save (create or update). secret: { password, passphrase, sudoPassword } or undefined to keep. */
  saveServer(server, secret) {
    const list = this.rawServers();
    const id = server.id || crypto.randomUUID();
    const prev = list.find((s) => s.id === id) || {};
    const entry = {
      id,
      name: String(server.name || server.host || '').slice(0, 80),
      host: String(server.host || '').trim(),
      port: Number(server.port) || 22,
      username: String(server.username || '').trim(),
      auth: ['password', 'key', 'agent'].includes(server.auth) ? server.auth : 'password',
      keyPath: server.keyPath || '',
      secret: prev.secret,
    };
    if (!entry.host || !entry.username) throw new Error('adres ve kullanıcı adı gerekli');
    if (secret && Object.values(secret).some(Boolean)) {
      entry.secret = this.canStoreSecrets()
        ? this.cipher.encrypt(JSON.stringify(secret)).toString('base64')
        : undefined;
    }
    const i = list.findIndex((s) => s.id === id);
    if (i >= 0) list[i] = entry; else list.push(entry);
    this.write('servers.json', list);
    return { ...entry, secret: undefined, hasSecret: !!entry.secret };
  }

  removeServer(id) {
    const list = this.rawServers();
    const s = list.find((x) => x.id === id);
    this.write('servers.json', list.filter((x) => x.id !== id));
    if (s) this.forgetHost(`${s.host}:${s.port}`);
  }

  server(id) { return this.rawServers().find((s) => s.id === id) || null; }

  secret(id) {
    const s = this.server(id);
    if (!s || !s.secret || !this.canStoreSecrets()) return {};
    try { return JSON.parse(this.cipher.decrypt(Buffer.from(s.secret, 'base64'))); } catch { return {}; }
  }

  // ---- known hosts (trust on first use) ----------------------------------
  hosts() {
    return {
      get: (k) => this.read('known_hosts.json', {})[k],
      set: (k, v) => { const h = this.read('known_hosts.json', {}); h[k] = v; this.write('known_hosts.json', h); },
    };
  }

  forgetHost(hostport) {
    const h = this.read('known_hosts.json', {});
    delete h[hostport];
    this.write('known_hosts.json', h);
  }
}

module.exports = { Store };
