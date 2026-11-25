'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { nativeImage } = require('electron');

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.wav', '.wave', '.ogg', '.oga', '.opus',
  '.m4a', '.mp4', '.aac', '.webm', '.aif', '.aiff', '.m4b'
]);

const MIME_BY_EXT = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.wave': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.webm': 'audio/webm',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff'
};

const CACHE_VERSION = 1;
let metadataModulePromise = null;

function getMetadataModule() {
  if (!metadataModulePromise) metadataModulePromise = import('music-metadata');
  return metadataModulePromise;
}

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function pathKey(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function extension(filePath) {
  return path.extname(filePath).toLowerCase();
}

function isAudioFile(filePath) {
  return AUDIO_EXTENSIONS.has(extension(filePath));
}

function shortFormat(filePath, codec) {
  const ext = extension(filePath);
  const normalizedCodec = String(codec || '').toLowerCase();
  if (ext === '.m4a' || ext === '.m4b' || ext === '.mp4') {
    return normalizedCodec.includes('alac') ? 'ALAC' : 'AAC';
  }
  if (ext === '.opus' || (ext === '.ogg' && normalizedCodec.includes('opus'))) return 'OPUS';
  if (ext === '.ogg' || ext === '.oga') return 'OGG';
  if (ext === '.wave') return 'WAV';
  return ext.replace('.', '').toUpperCase();
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim();
}

function parseFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  let title = base
    .replace(/^\s*\d{1,3}\s*[\s._-]+\s*/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let artist = '';
  const split = title.split(/\s+-\s+/);
  if (split.length >= 2 && split[0].length < 80) {
    artist = split[0].trim();
    title = split.slice(1).join(' - ').trim();
  }
  return {
    title: title || base || 'Без названия',
    artist
  };
}

function fallbackRecord(filePath) {
  const parsed = parseFilename(filePath);
  return {
    title: parsed.title,
    artist: parsed.artist || 'Неизвестный исполнитель',
    album: path.basename(path.dirname(filePath)) || 'Без альбома',
    duration: 0,
    year: null,
    format: shortFormat(filePath, ''),
    coverKey: null,
    accent: null,
    mtimeMs: 0,
    size: 0
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (channel) => Math.round((channel + m) * 255)
    .toString(16)
    .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function extractAccent(image) {
  try {
    const small = image.resize({ width: 36, height: 36, quality: 'good' });
    const bitmap = small.toBitmap();
    if (!bitmap || bitmap.length < 4) return null;

    const bins = Array.from({ length: 24 }, () => ({
      weight: 0, r: 0, g: 0, b: 0, count: 0
    }));
    let totalWeight = 0;

    for (let i = 0; i + 3 < bitmap.length; i += 4) {
      const b = bitmap[i];
      const g = bitmap[i + 1];
      const r = bitmap[i + 2];
      const a = bitmap[i + 3];
      if (a < 32) continue;

      const hsl = rgbToHsl(r, g, b);
      if (hsl.s < 0.14 || hsl.l < 0.1 || hsl.l > 0.92) continue;

      const weight = hsl.s * (0.45 + 0.55 * (1 - Math.abs(hsl.l - 0.52) * 2));
      if (weight <= 0) continue;
      const bin = bins[Math.floor(hsl.h / 15) % 24];
      bin.weight += weight;
      bin.r += r * weight;
      bin.g += g * weight;
      bin.b += b * weight;
      bin.count += 1;
      totalWeight += weight;
    }

    if (totalWeight < 1.5) return null;

    let bestIndex = 0;
    for (let i = 1; i < bins.length; i += 1) {
      if (bins[i].weight > bins[bestIndex].weight) bestIndex = i;
    }

    const chosen = [bins[(bestIndex + 23) % 24], bins[bestIndex], bins[(bestIndex + 1) % 24]];
    const sum = chosen.reduce((acc, bin) => ({
      weight: acc.weight + bin.weight,
      r: acc.r + bin.r,
      g: acc.g + bin.g,
      b: acc.b + bin.b,
      count: acc.count + bin.count
    }), { weight: 0, r: 0, g: 0, b: 0, count: 0 });

    if (!sum.weight || !sum.count) return null;
    const avgR = sum.r / sum.weight;
    const avgG = sum.g / sum.weight;
    const avgB = sum.b / sum.weight;
    const hsl = rgbToHsl(avgR, avgG, avgB);
    return hslToHex(hsl.h, Math.max(0.5, Math.min(0.88, hsl.s)), Math.max(0.52, Math.min(0.68, hsl.l)));
  } catch {
    return null;
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
  await fsp.rename(tempPath, filePath);
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(workers);
  return results;
}

class MusicLibrary {
  constructor(userDataDir) {
    this.userDataDir = userDataDir;
    this.libraryPath = path.join(userDataDir, 'library.json');
    this.cachePath = path.join(userDataDir, 'metadata-cache.json');
    this.coversDir = path.join(userDataDir, 'covers');
    this.entries = [];
    this.cache = {};
    this.allowedPaths = new Set();
    this.adding = false;
    this.initialized = false;
  }

  async init(onProgress = () => {}) {
    if (this.initialized) return this.serialize();
    await fsp.mkdir(this.coversDir, { recursive: true });

    const stored = await readJson(this.libraryPath, { version: 1, tracks: [] });
    const cacheFile = await readJson(this.cachePath, { version: CACHE_VERSION, records: {} });
    this.cache = cacheFile && cacheFile.version === CACHE_VERSION && cacheFile.records
      ? cacheFile.records
      : {};

    const sourceTracks = Array.isArray(stored.tracks) ? stored.tracks : [];
    const valid = [];
    const missing = [];

    for (const item of sourceTracks) {
      if (!item || typeof item.path !== 'string' || !isAudioFile(item.path)) continue;
      if (!await fileExists(item.path)) {
        missing.push(item.path);
        continue;
      }
      valid.push({
        path: item.path,
        addedAt: Number(item.addedAt) || Date.now()
      });
    }

    const total = valid.length;
    onProgress({ phase: 'metadata', done: 0, total });

    let done = 0;
    this.entries = await mapWithConcurrency(valid, 5, async (item) => {
      const record = await this.analyze(item.path, item.addedAt);
      done += 1;
      onProgress({ phase: 'metadata', done, total });
      return record;
    });

    this.refreshAllowedPaths();
    this.initialized = true;
    await this.save(missing.length > 0);
    return this.serialize();
  }

  refreshAllowedPaths() {
    this.allowedPaths = new Set(this.entries.map((entry) => pathKey(entry.path)));
  }

  isAllowedAudioPath(filePath) {
    return this.allowedPaths.has(pathKey(filePath));
  }

  getTrackById(id) {
    return this.entries.find((entry) => entry.id === id) || null;
  }

  serialize() {
    return this.entries.map((entry) => ({ ...entry }));
  }

  async collectAudioFiles(inputs) {
    const found = [];
    const seen = new Set();

    async function walk(targetPath) {
      let stat;
      try {
        stat = await fsp.lstat(targetPath);
      } catch {
        return;
      }
      if (stat.isSymbolicLink()) return;

      if (stat.isDirectory()) {
        let children;
        try {
          children = await fsp.readdir(targetPath, { withFileTypes: true });
        } catch {
          return;
        }
        children.sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true, sensitivity: 'base' }));
        for (const child of children) {
          await walk(path.join(targetPath, child.name));
        }
        return;
      }

      if (stat.isFile() && isAudioFile(targetPath)) {
        const key = pathKey(targetPath);
        if (!seen.has(key)) {
          seen.add(key);
          found.push(path.resolve(targetPath));
        }
      }
    }

    for (const input of inputs) {
      if (typeof input === 'string' && input.trim()) await walk(input);
    }

    found.sort((a, b) => a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' }));
    return found;
  }

  async addPaths(inputs, onProgress = () => {}) {
    if (this.adding) {
      const error = new Error('Сканирование уже выполняется');
      error.code = 'BUSY';
      throw error;
    }

    this.adding = true;
    try {
      onProgress({ phase: 'scan', done: 0, total: 0 });
      const audioFiles = await this.collectAudioFiles(inputs);
      const existing = new Set(this.entries.map((entry) => pathKey(entry.path)));
      const fresh = audioFiles.filter((item) => !existing.has(pathKey(item)));

      if (!fresh.length) {
        return {
          tracks: this.serialize(),
          added: [],
          addedCount: 0,
          skippedCount: audioFiles.length,
          scannedCount: audioFiles.length
        };
      }

      const total = fresh.length;
      let done = 0;
      onProgress({ phase: 'metadata', done: 0, total });
      const addedAt = Date.now();

      const newEntries = await mapWithConcurrency(fresh, 5, async (filePath) => {
        const record = await this.analyze(filePath, addedAt);
        done += 1;
        onProgress({ phase: 'metadata', done, total });
        return record;
      });

      this.entries.push(...newEntries);
      this.entries.sort((a, b) => a.path.localeCompare(b.path, 'ru', { numeric: true, sensitivity: 'base' }));
      this.refreshAllowedPaths();
      await this.save(false);

      return {
        tracks: this.serialize(),
        added: newEntries.map((entry) => ({ ...entry })),
        addedCount: newEntries.length,
        skippedCount: audioFiles.length - fresh.length,
        scannedCount: audioFiles.length
      };
    } finally {
      this.adding = false;
    }
  }

  async remove(id) {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index === -1) return { tracks: this.serialize(), removed: false };
    const [removed] = this.entries.splice(index, 1);
    delete this.cache[pathKey(removed.path)];
    this.refreshAllowedPaths();
    await this.save(true);
    return { tracks: this.serialize(), removed: true };
  }

  async clear() {
    this.entries = [];
    this.cache = {};
    this.refreshAllowedPaths();
    await this.save(true);
    return { tracks: [] };
  }

  async analyze(filePath, addedAt) {
    const stat = await fsp.stat(filePath);
    const key = pathKey(filePath);
    const cached = this.cache[key];
    const cachedCover = cached?.coverKey
      ? path.join(this.coversDir, `${cached.coverKey}.jpg`)
      : null;

    if (
      cached
      && cached.mtimeMs === stat.mtimeMs
      && cached.size === stat.size
      && (!cachedCover || await fileExists(cachedCover))
    ) {
      return this.toTrack({ ...cached, path: filePath }, addedAt);
    }

    let parsed = null;
    try {
      const mm = await getMetadataModule();
      parsed = await mm.parseFile(filePath, { duration: true });
    } catch {
      parsed = null;
    }

    const common = parsed?.common || {};
    const format = parsed?.format || {};
    const parsedName = parseFilename(filePath);

    let title = cleanText(common.title) || parsedName.title;
    let artist = cleanText(common.artist)
      || cleanText(common.albumartist)
      || (Array.isArray(common.artists) ? cleanText(common.artists.join(', ')) : '')
      || parsedName.artist
      || 'Неизвестный исполнитель';
    let album = cleanText(common.album) || path.basename(path.dirname(filePath)) || 'Без альбома';
    const year = Number(common.year) || null;
    const duration = Number(format.duration);
    let coverKey = null;
    let accent = null;

    const picture = Array.isArray(common.picture) && common.picture.length
      ? common.picture.find((item) => item?.data?.length) || common.picture[0]
      : null;

    if (picture?.data?.length) {
      const saved = await this.saveCover(picture);
      coverKey = saved.coverKey;
      accent = saved.accent;
    }

    const record = {
      title,
      artist,
      album,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      year,
      format: shortFormat(filePath, format.codec),
      coverKey,
      accent,
      mtimeMs: stat.mtimeMs,
      size: stat.size
    };

    this.cache[key] = record;
    return this.toTrack({ ...record, path: filePath }, addedAt);
  }

  async saveCover(picture) {
    try {
      const image = nativeImage.createFromBuffer(picture.data);
      if (image.isEmpty()) return { coverKey: null, accent: null };

      const size = image.getSize();
      const targetWidth = Math.min(800, size.width || 800);
      const targetHeight = Math.max(1, Math.round((size.height || targetWidth) * (targetWidth / (size.width || targetWidth))));
      const resized = image.resize({ width: targetWidth, height: targetHeight, quality: 'good' });
      let jpeg = resized.toJPEG(84);
      if (!jpeg?.length) jpeg = image.toJPEG(84);
      if (!jpeg?.length) return { coverKey: null, accent: extractAccent(image) };

      const coverKey = sha1(picture.data).slice(0, 24);
      const coverPath = path.join(this.coversDir, `${coverKey}.jpg`);
      if (!await fileExists(coverPath)) {
        await fsp.writeFile(coverPath, jpeg);
      }

      return { coverKey, accent: extractAccent(resized) };
    } catch {
      return { coverKey: null, accent: null };
    }
  }

  toTrack(record, addedAt) {
    const absolutePath = path.resolve(record.path);
    const token = Buffer.from(absolutePath, 'utf8').toString('base64url');
    return {
      id: sha1(pathKey(absolutePath)).slice(0, 16),
      path: absolutePath,
      fileName: path.basename(absolutePath),
      title: record.title || 'Без названия',
      artist: record.artist || 'Неизвестный исполнитель',
      album: record.album || 'Без альбома',
      duration: Number(record.duration) || 0,
      year: Number(record.year) || null,
      format: record.format || shortFormat(absolutePath, ''),
      coverUrl: record.coverKey ? `simplex://app/__cover/${record.coverKey}.jpg` : null,
      accent: record.accent || null,
      audioUrl: `simplex://app/__audio/${token}`,
      addedAt: Number(addedAt) || Number(record.addedAt) || Date.now()
    };
  }

  async save(pruneCache = false) {
    if (pruneCache) {
      const active = new Set(this.entries.map((entry) => pathKey(entry.path)));
      for (const key of Object.keys(this.cache)) {
        if (!active.has(key)) delete this.cache[key];
      }
    }

    const library = {
      version: 1,
      tracks: this.entries.map((entry) => ({
        path: entry.path,
        addedAt: entry.addedAt
      }))
    };

    await Promise.all([
      writeJsonAtomic(this.libraryPath, library),
      writeJsonAtomic(this.cachePath, { version: CACHE_VERSION, records: this.cache })
    ]);
  }
}

module.exports = {
  MusicLibrary,
  AUDIO_EXTENSIONS,
  MIME_BY_EXT,
  isAudioFile
};
