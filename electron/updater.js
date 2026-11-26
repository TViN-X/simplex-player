'use strict';

const { app, shell } = require('electron');

const OWNER = 'TViN-X';
const REPO = 'simplex-player';
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases`;
const LATEST_RELEASE_URL = `${RELEASES_URL}/latest`;
const API_LATEST_URL = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
const CHECK_TIMEOUT = 15000;

let updater = null;
let mode = 'auto';
let reason = '';
let sink = () => {};
let downloadPromise = null;

function compareVersions(a, b) {
  const parse = (value) => String(value || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => {
      const number = Number.parseInt(part, 10);
      return Number.isFinite(number) ? number : 0;
    });

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function normalizeNotes(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : item?.note || ''))
      .filter(Boolean)
      .join('\n\n');
  }
  return typeof value === 'string' ? value : '';
}

function resolveMode() {
  if (!app.isPackaged) {
    return { mode: 'dev', reason: 'Приложение запущено из исходников.' };
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return { mode: 'manual', reason: 'Portable-версия не поддерживает автообновление.' };
  }
  if (process.platform === 'darwin') {
    return { mode: 'manual', reason: 'Сборка для macOS не подписана, поэтому обновление выполняется вручную.' };
  }
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    return { mode: 'manual', reason: 'Автообновление поддерживается только для AppImage.' };
  }
  return { mode: 'auto', reason: '' };
}

function getAutoUpdater() {
  if (updater) return updater;

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = {
    info() {},
    warn() {},
    debug() {},
    error(...args) {
      console.error('[updater]', ...args);
    }
  };

  autoUpdater.on('download-progress', (progress) => {
    sink({
      type: 'progress',
      percent: Number(progress?.percent) || 0,
      transferred: Number(progress?.transferred) || 0,
      total: Number(progress?.total) || 0,
      bytesPerSecond: Number(progress?.bytesPerSecond) || 0
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sink({ type: 'downloaded', version: info?.version || '' });
  });

  autoUpdater.on('error', (error) => {
    sink({ type: 'error', message: error?.message || 'Ошибка обновления' });
  });

  updater = autoUpdater;
  return updater;
}

async function fetchLatestRelease() {
  const response = await fetch(API_LATEST_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `Simplex-player/${app.getVersion()}`
    },
    signal: AbortSignal.timeout(CHECK_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`GitHub API вернул ${response.status}`);
  }

  return response.json();
}

async function checkManual() {
  const release = await fetchLatestRelease();
  const latest = String(release?.tag_name || '').replace(/^v/i, '');
  const currentVersion = app.getVersion();

  if (!latest || compareVersions(latest, currentVersion) <= 0) {
    return {
      status: 'none',
      mode,
      reason,
      currentVersion,
      latestVersion: latest || null
    };
  }

  return {
    status: 'available',
    mode: 'manual',
    reason,
    version: latest,
    name: release?.name || `v${latest}`,
    notes: normalizeNotes(release?.body),
    publishedAt: release?.published_at || '',
    url: release?.html_url || LATEST_RELEASE_URL,
    currentVersion
  };
}

async function checkAuto() {
  const autoUpdater = getAutoUpdater();
  const result = await autoUpdater.checkForUpdates();
  const info = result?.updateInfo;
  const currentVersion = app.getVersion();

  if (!info || compareVersions(info.version, currentVersion) <= 0) {
    return {
      status: 'none',
      mode,
      currentVersion,
      latestVersion: info?.version || null
    };
  }

  return {
    status: 'available',
    mode: 'auto',
    version: info.version,
    name: info.releaseName || `v${info.version}`,
    notes: normalizeNotes(info.releaseNotes),
    publishedAt: info.releaseDate || '',
    url: LATEST_RELEASE_URL,
    currentVersion
  };
}

function init(options = {}) {
  if (typeof options.onEvent === 'function') sink = options.onEvent;

  const resolved = resolveMode();
  mode = resolved.mode;
  reason = resolved.reason;

  if (mode === 'auto') getAutoUpdater();
}

async function check() {
  const resolved = resolveMode();
  mode = resolved.mode;
  reason = resolved.reason;

  if (mode === 'dev') {
    return { status: 'skipped', mode, reason };
  }

  try {
    if (mode === 'auto') {
      try {
        return await checkAuto();
      } catch (error) {
        console.warn('[updater] Автопроверка недоступна:', error?.message || error);
        mode = 'manual';
        reason = 'Автообновление недоступно, скачайте новую версию вручную.';
        return await checkManual();
      }
    }

    return await checkManual();
  } catch (error) {
    return {
      status: 'error',
      mode,
      reason,
      message: error?.message || 'Не удалось проверить обновления'
    };
  }
}

async function download() {
  if (mode !== 'auto') {
    return { status: 'manual', url: LATEST_RELEASE_URL };
  }

  const autoUpdater = getAutoUpdater();
  if (!downloadPromise) {
    downloadPromise = autoUpdater.downloadUpdate().finally(() => {
      downloadPromise = null;
    });
  }

  await downloadPromise;
  return { status: 'downloaded', version: app.getVersion() };
}

function install() {
  if (mode !== 'auto') {
    return { status: 'manual', url: LATEST_RELEASE_URL };
  }

  setImmediate(() => {
    getAutoUpdater().quitAndInstall(false, true);
  });
  return { status: 'installing' };
}

function openRelease(url) {
  const target = typeof url === 'string' && url.startsWith(RELEASES_URL) ? url : LATEST_RELEASE_URL;
  shell.openExternal(target).catch(() => {});
}

module.exports = {
  init,
  check,
  download,
  install,
  openRelease,
  compareVersions
};
