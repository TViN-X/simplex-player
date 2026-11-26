'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  volume: 0.78,
  muted: false,
  shuffle: false,
  repeat: 'off',
  lastTrackId: null,
  lastTime: 0,
  lastPlaylistId: null
});

const REPEAT_MODES = new Set(['off', 'all', 'one']);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitize(patch, current) {
  const next = { ...current };

  if (patch && typeof patch === 'object') {
    if (Number.isFinite(Number(patch.volume))) {
      next.volume = clamp(Number(patch.volume), 0, 1);
    }
    if (typeof patch.muted === 'boolean') next.muted = patch.muted;
    if (typeof patch.shuffle === 'boolean') next.shuffle = patch.shuffle;
    if (typeof patch.repeat === 'string' && REPEAT_MODES.has(patch.repeat)) {
      next.repeat = patch.repeat;
    }
    if (patch.lastTrackId === null || typeof patch.lastTrackId === 'string') {
      next.lastTrackId = patch.lastTrackId;
    }
    if (Number.isFinite(Number(patch.lastTime))) {
      next.lastTime = clamp(Number(patch.lastTime), 0, 24 * 60 * 60);
    }
    if (patch.lastPlaylistId === null || typeof patch.lastPlaylistId === 'string') {
      next.lastPlaylistId = patch.lastPlaylistId || null;
    }
  }

  return next;
}

class SettingsStore {
  constructor(userDataDir) {
    this.filePath = path.join(userDataDir, 'settings.json');
    this.current = { ...DEFAULT_SETTINGS };
    this.writeChain = Promise.resolve();
  }

  async load() {
    try {
      const raw = await fsp.readFile(this.filePath, 'utf8');
      this.current = sanitize(JSON.parse(raw), { ...DEFAULT_SETTINGS });
    } catch {
      this.current = { ...DEFAULT_SETTINGS };
    }
    return { ...this.current };
  }

  async save(patch) {
    this.current = sanitize(patch, this.current);
    const snapshot = { ...this.current };
    this.writeChain = this.writeChain
      .catch(() => {})
      .then(async () => {
        const temp = `${this.filePath}.${process.pid}.tmp`;
        await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
        await fsp.writeFile(temp, JSON.stringify(snapshot, null, 2), 'utf8');
        await fsp.rename(temp, this.filePath);
      });
    await this.writeChain;
    return { ...this.current };
  }

  get() {
    return { ...this.current };
  }
}

module.exports = {
  SettingsStore,
  DEFAULT_SETTINGS
};
