'use strict';

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');

const MAX_NAME_LENGTH = 60;
const MAX_PLAYLISTS = 300;

function cleanName(value, fallback = 'Плейлист') {
  const name = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return name || fallback;
}

function cleanTrackIds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function toPublic(playlist) {
  return {
    id: playlist.id,
    name: playlist.name,
    trackIds: playlist.trackIds.slice(),
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt
  };
}

class PlaylistStore {
  constructor(userDataDir) {
    this.filePath = path.join(userDataDir, 'playlists.json');
    this.items = [];
    this.writeChain = Promise.resolve();
    this.initialized = false;
    this.fileExisted = false;
  }

  async load() {
    if (this.initialized) return this.serialize();
    let stored = null;
    let raw = null;
    try {
      raw = await fsp.readFile(this.filePath, 'utf8');
      this.fileExisted = true;
    } catch {
      raw = null;
    }
    if (raw !== null) {
      try {
        stored = JSON.parse(raw);
      } catch {
        stored = null;
      }
    }

    const source = Array.isArray(stored?.playlists) ? stored.playlists : [];
    const seen = new Set();
    this.items = source
      .filter((item) => item && typeof item === 'object')
      .slice(0, MAX_PLAYLISTS)
      .map((item) => {
        let id = typeof item.id === 'string' && item.id ? item.id : '';
        if (!id || seen.has(id)) id = crypto.randomBytes(8).toString('hex');
        seen.add(id);
        return {
          id,
          name: cleanName(item.name),
          trackIds: cleanTrackIds(item.trackIds),
          createdAt: Number(item.createdAt) || Date.now(),
          updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now()
        };
      });

    this.initialized = true;
    return this.serialize();
  }

  serialize() {
    return this.items.map(toPublic);
  }

  get(id) {
    return this.items.find((item) => item.id === id) || null;
  }

  async persist() {
    const snapshot = [...this.items];
    this.writeChain = this.writeChain
      .catch(() => {})
      .then(async () => {
        const temp = `${this.filePath}.${process.pid}.tmp`;
        await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
        await fsp.writeFile(temp, JSON.stringify({ version: 1, playlists: snapshot }, null, 2), 'utf8');
        await fsp.rename(temp, this.filePath);
      });
    await this.writeChain;
  }

  async create({ name, trackIds } = {}) {
    await this.load();
    const now = Date.now();
    const playlist = {
      id: crypto.randomBytes(8).toString('hex'),
      name: cleanName(name),
      trackIds: cleanTrackIds(trackIds),
      createdAt: now,
      updatedAt: now
    };
    this.items.push(playlist);
    await this.persist();
    return toPublic(playlist);
  }

  async rename(id, name) {
    const playlist = this.get(id);
    if (!playlist) return null;
    playlist.name = cleanName(name, playlist.name);
    playlist.updatedAt = Date.now();
    await this.persist();
    return toPublic(playlist);
  }

  async remove(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    this.items.splice(index, 1);
    await this.persist();
    return true;
  }

  async addTracks(id, trackIds) {
    const playlist = this.get(id);
    if (!playlist) return null;
    const incoming = cleanTrackIds(trackIds);
    const existing = new Set(playlist.trackIds);
    const fresh = incoming.filter((trackId) => !existing.has(trackId));
    if (!fresh.length) return toPublic(playlist);
    playlist.trackIds.push(...fresh);
    playlist.updatedAt = Date.now();
    await this.persist();
    return toPublic(playlist);
  }

  async removeTrack(id, trackId) {
    const playlist = this.get(id);
    if (!playlist) return null;
    const index = playlist.trackIds.indexOf(trackId);
    if (index === -1) return toPublic(playlist);
    playlist.trackIds.splice(index, 1);
    playlist.updatedAt = Date.now();
    await this.persist();
    return toPublic(playlist);
  }

  async reorder(id, trackIds) {
    const playlist = this.get(id);
    if (!playlist) return null;
    if (!Array.isArray(trackIds)) return toPublic(playlist);

    const existing = new Set(playlist.trackIds);
    const seen = new Set();
    const ordered = [];

    for (const trackId of trackIds) {
      if (typeof trackId !== 'string' || !existing.has(trackId) || seen.has(trackId)) continue;
      seen.add(trackId);
      ordered.push(trackId);
    }
    for (const trackId of playlist.trackIds) {
      if (!seen.has(trackId)) ordered.push(trackId);
    }

    if (ordered.join('\n') === playlist.trackIds.join('\n')) return toPublic(playlist);
    playlist.trackIds = ordered;
    playlist.updatedAt = Date.now();
    await this.persist();
    return toPublic(playlist);
  }

  async dropTrack(trackId) {
    let changed = false;
    for (const playlist of this.items) {
      const before = playlist.trackIds.length;
      playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
      if (playlist.trackIds.length !== before) {
        playlist.updatedAt = Date.now();
        changed = true;
      }
    }
    if (changed) await this.persist();
    return changed;
  }

  async dropAllTracks() {
    let changed = false;
    for (const playlist of this.items) {
      if (playlist.trackIds.length) {
        playlist.trackIds = [];
        playlist.updatedAt = Date.now();
        changed = true;
      }
    }
    if (changed) await this.persist();
    return changed;
  }
}

module.exports = {
  PlaylistStore,
  MAX_NAME_LENGTH
};
