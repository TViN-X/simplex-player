'use strict';

const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const {
  app, BrowserWindow, ipcMain, dialog, shell, screen, Menu
} = require('electron');
const { MusicLibrary } = require('./library');
const { SettingsStore } = require('./settings');
const { PlaylistStore } = require('./playlists');
const { registerAppScheme, installAppProtocol } = require('./protocol');
const updater = require('./updater');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setName('Simplex player');
app.setAppUserModelId('com.simplex.player');

const APP_DIR = path.join(__dirname, '..', 'app');
const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');
const isDev = process.argv.includes('--dev');
const isMac = process.platform === 'darwin';
const MINI_SIZE = { width: 404, height: 118 };
const MINI_MARGIN = 26;
const MIN_WINDOW = { width: 920, height: 640 };

let mainWindow = null;
let library = null;
let playlists = null;
let settings = null;
let initPromise = null;
let windowStatePath = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

registerAppScheme();

function safeJsonRead(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function sanitizeMiniBounds(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return {
    x: Math.round(value.x),
    y: Math.round(value.y),
    width: MINI_SIZE.width,
    height: MINI_SIZE.height
  };
}

function getWindowState() {
  const defaults = {
    width: 1280,
    height: 830,
    x: undefined,
    y: undefined,
    maximized: false,
    miniBounds: null,
    miniOnTop: true
  };
  const saved = safeJsonRead(windowStatePath, null);
  if (!saved || !Number.isFinite(saved.width) || !Number.isFinite(saved.height)) return defaults;

  const bounds = {
    width: Math.max(920, Math.min(2400, saved.width)),
    height: Math.max(640, Math.min(1600, saved.height)),
    x: Number.isFinite(saved.x) ? saved.x : undefined,
    y: Number.isFinite(saved.y) ? saved.y : undefined
  };

  if (bounds.x !== undefined && bounds.y !== undefined) {
    const display = screen.getDisplayMatching(bounds);
    const area = display.workArea;
    const visible = bounds.x < area.x + area.width - 80
      && bounds.x + bounds.width > area.x + 80
      && bounds.y < area.y + area.height - 60
      && bounds.y + bounds.height > area.y + 30;
    if (!visible) {
      bounds.x = undefined;
      bounds.y = undefined;
    }
  }

  return {
    ...bounds,
    maximized: Boolean(saved.maximized),
    miniBounds: sanitizeMiniBounds(saved.miniBounds),
    miniOnTop: saved.miniOnTop !== false
  };
}

let windowSaveTimer = null;
let lastWindowState = null;
let miniPrefs = { bounds: null, onTop: true };

function writeWindowState() {
  if (!windowStatePath || !lastWindowState) return;
  try {
    fs.writeFileSync(windowStatePath, JSON.stringify(lastWindowState, null, 2), 'utf8');
  } catch {
    // Window state persistence is best-effort.
  }
}

function queueWindowStateSave() {
  clearTimeout(windowSaveTimer);
  windowSaveTimer = setTimeout(writeWindowState, 350);
}

function rememberWindowState(win) {
  if (!win || win.isDestroyed() || !lastWindowState || win.__simplexSuppressState) return;

  if (win.__simplexMini) {
    const miniBounds = sanitizeMiniBounds(win.getBounds());
    miniPrefs.bounds = miniBounds;
    lastWindowState.miniBounds = miniBounds;
  } else {
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    lastWindowState.x = bounds.x;
    lastWindowState.y = bounds.y;
    lastWindowState.width = bounds.width;
    lastWindowState.height = bounds.height;
    lastWindowState.maximized = win.isMaximized();
  }

  queueWindowStateSave();
}

function sendWindowState(win) {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  win.webContents.send('window:state', {
    maximized: win.isMaximized(),
    mini: Boolean(win.__simplexMini),
    miniOnTop: miniPrefs.onTop
  });
}

function enterMiniMode(win) {
  if (!win || win.isDestroyed() || win.__simplexMini) return;

  win.__simplexRestore = {
    bounds: win.isMaximized() ? win.getNormalBounds() : win.getBounds(),
    maximized: win.isMaximized(),
    alwaysOnTop: win.isAlwaysOnTop()
  };

  if (win.isMaximized()) win.unmaximize();

  const width = MINI_SIZE.width;
  const height = MINI_SIZE.height;
  const saved = miniPrefs.bounds;
  const display = screen.getDisplayMatching(saved || win.__simplexRestore.bounds);
  const area = display.workArea;
  const x = saved
    ? Math.min(Math.max(saved.x, area.x), area.x + area.width - width)
    : area.x + area.width - width - MINI_MARGIN;
  const y = saved
    ? Math.min(Math.max(saved.y, area.y), area.y + area.height - height)
    : area.y + MINI_MARGIN;

  win.__simplexMini = true;
  win.setResizable(true);
  win.setMinimumSize(width, height);
  win.setMaximumSize(width, height);
  win.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width,
    height
  });
  win.setResizable(false);
  win.setAlwaysOnTop(miniPrefs.onTop, 'floating');
  sendWindowState(win);
}

function exitMiniMode(win) {
  if (!win || win.isDestroyed() || !win.__simplexMini) return;

  const restore = win.__simplexRestore || {};
  const bounds = restore.bounds && Number.isFinite(restore.bounds.width)
    ? restore.bounds
    : { width: 1280, height: 830 };

  win.__simplexSuppressState = true;
  win.__simplexMini = false;
  win.setResizable(true);
  win.setAlwaysOnTop(Boolean(restore.alwaysOnTop));
  win.setMaximumSize(0, 0);
  win.setMinimumSize(MIN_WINDOW.width, MIN_WINDOW.height);
  win.setBounds(bounds);
  if (restore.maximized) win.maximize();

  win.__simplexRestore = null;
  setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    win.__simplexSuppressState = false;
    rememberWindowState(win);
  }, 520);

  sendWindowState(win);
}

function sendScanProgress(sender, payload) {
  if (!sender.isDestroyed()) sender.send('scan:progress', payload);
  const win = BrowserWindow.fromWebContents(sender);
  if (!win || win.isDestroyed()) return;
  if (payload.phase === 'scan') {
    win.setProgressBar(2);
  } else if (payload.total > 0) {
    win.setProgressBar(Math.max(0.02, payload.done / payload.total));
  } else {
    win.setProgressBar(-1);
  }
}

function sendUpdateEvent(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:event', payload);
  }
}

async function pruneOrphanTracks() {
  const referenced = new Set();
  for (const playlist of playlists.serialize()) {
    for (const trackId of playlist.trackIds) referenced.add(trackId);
  }
  const orphans = library.serialize()
    .filter((track) => !referenced.has(track.id))
    .map((track) => track.id);
  if (orphans.length) await library.removeMany(orphans);
  return library.serialize();
}

function createWindow() {
  const saved = getWindowState();
  miniPrefs = { bounds: saved.miniBounds, onTop: saved.miniOnTop };
  lastWindowState = {
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    maximized: saved.maximized,
    miniBounds: saved.miniBounds,
    miniOnTop: saved.miniOnTop
  };

  const windowOptions = {
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: MIN_WINDOW.width,
    minHeight: MIN_WINDOW.height,
    show: false,
    backgroundColor: '#08080b',
    title: 'Simplex player',
    icon: ICON_PATH,
    autoHideMenuBar: true,
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 20, y: 19 }
        }
      : {
          frame: false
        }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  };

  const win = new BrowserWindow(windowOptions);
  mainWindow = win;
  Menu.setApplicationMenu(null);

  win.loadURL('simplex://app/index.html');

  win.once('ready-to-show', () => {
    if (saved.maximized) win.maximize();
    win.show();
    sendWindowState(win);
  });

  win.on('resize', () => rememberWindowState(win));
  win.on('move', () => rememberWindowState(win));
  win.on('close', () => {
    rememberWindowState(win);
    clearTimeout(windowSaveTimer);
    writeWindowState();
  });
  win.on('maximize', () => sendWindowState(win));
  win.on('unmaximize', () => sendWindowState(win));

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith('simplex://app/')) event.preventDefault();
  });

  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

function setupIpc() {
  ipcMain.handle('app:init', async () => {
    if (!initPromise) {
      initPromise = (async () => {
        await settings.load();
        await library.init((payload) => {
          if (mainWindow) sendScanProgress(mainWindow.webContents, payload);
        });
        await playlists.load();
        const existingTracks = library.serialize();
        if (!playlists.fileExisted && existingTracks.length) {
          await playlists.create({
            name: 'Default',
            trackIds: existingTracks.map((track) => track.id)
          });
        } else if (playlists.fileExisted) {
          await pruneOrphanTracks();
        }
        if (mainWindow) mainWindow.setProgressBar(-1);
      })().catch((error) => {
        initPromise = null;
        if (mainWindow) mainWindow.setProgressBar(-1);
        throw error;
      });
    }

    await initPromise;

    // Read live state on every call so reloaded or recreated windows are current.
    return {
      tracks: library.serialize(),
      playlists: playlists.serialize(),
      settings: settings.get(),
      platform: process.platform,
      version: app.getVersion()
    };
  });

  ipcMain.handle('dialog:pick-folders', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Добавить папку с музыкой',
      buttonLabel: 'Добавить',
      properties: ['openDirectory', 'multiSelections']
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('dialog:pick-files', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Добавить треки',
      buttonLabel: 'Добавить',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Аудио',
          extensions: ['mp3', 'flac', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'm4b', 'aac', 'webm', 'aif', 'aiff', 'mp4']
        },
        { name: 'Все файлы', extensions: ['*'] }
      ]
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('library:add-paths', async (event, inputs) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!Array.isArray(inputs)) return { error: 'invalid' };

    try {
      const result = await library.addPaths(
        inputs.filter((item) => typeof item === 'string'),
        (payload) => sendScanProgress(event.sender, payload)
      );
      if (win && !win.isDestroyed()) win.setProgressBar(-1);
      return result;
    } catch (error) {
      if (win && !win.isDestroyed()) win.setProgressBar(-1);
      return {
        error: error.code === 'BUSY' ? 'busy' : 'failed',
        message: error?.message || 'Не удалось добавить музыку'
      };
    }
  });

  ipcMain.handle('library:remove', async (_event, id) => {
    const result = await library.remove(String(id));
    await playlists.dropTrack(String(id));
    return { ...result, playlists: playlists.serialize() };
  });

  ipcMain.handle('library:clear', async () => {
    const result = await library.clear();
    await playlists.dropAllTracks();
    return { ...result, playlists: playlists.serialize() };
  });

  ipcMain.handle('playlist:create', async (_event, payload = {}) => {
    const trackIds = Array.isArray(payload.trackIds)
      ? payload.trackIds.filter((id) => typeof id === 'string' && library.getTrackById(id))
      : [];
    const playlist = await playlists.create({ name: payload.name, trackIds });
    return { playlist, playlists: playlists.serialize() };
  });

  ipcMain.handle('playlist:rename', async (_event, payload = {}) => {
    const playlist = await playlists.rename(String(payload.id || ''), payload.name);
    if (!playlist) return { error: 'not-found', playlists: playlists.serialize() };
    return { playlist, playlists: playlists.serialize() };
  });

  ipcMain.handle('playlist:delete', async (_event, id) => {
    const removed = await playlists.remove(String(id || ''));
    const tracks = await pruneOrphanTracks();
    return { removed, playlists: playlists.serialize(), tracks };
  });

  ipcMain.handle('playlist:add-tracks', async (_event, payload = {}) => {
    const trackIds = Array.isArray(payload.trackIds)
      ? payload.trackIds.filter((id) => typeof id === 'string' && library.getTrackById(id))
      : [];
    const playlist = await playlists.addTracks(String(payload.id || ''), trackIds);
    if (!playlist) return { error: 'not-found', playlists: playlists.serialize() };
    return { playlist, playlists: playlists.serialize() };
  });

  ipcMain.handle('playlist:remove-track', async (_event, payload = {}) => {
    const playlist = await playlists.removeTrack(String(payload.id || ''), String(payload.trackId || ''));
    if (!playlist) return { error: 'not-found', playlists: playlists.serialize() };
    const tracks = await pruneOrphanTracks();
    return { playlist, playlists: playlists.serialize(), tracks };
  });

  ipcMain.handle('playlist:reorder', async (_event, payload = {}) => {
    const playlist = await playlists.reorder(String(payload.id || ''), payload.trackIds);
    if (!playlist) return { error: 'not-found', playlists: playlists.serialize() };
    return { playlist, playlists: playlists.serialize() };
  });

  ipcMain.handle('library:reveal', async (_event, id) => {
    const track = library.getTrackById(String(id));
    if (!track) return false;
    try {
      await fsp.access(track.path);
      shell.showItemInFolder(track.path);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('settings:save', async (_event, patch) => {
    return settings.save(patch);
  });

  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('update:check', () => updater.check());

  ipcMain.handle('update:download', () => updater.download());

  ipcMain.handle('update:install', () => updater.install());

  ipcMain.handle('update:open-release', (_event, url) => {
    updater.openRelease(url);
    return { ok: true };
  });

  ipcMain.handle('window:control', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win || win.isDestroyed()) return { maximized: false, mini: false };

    switch (action) {
      case 'minimize':
        win.minimize();
        break;
      case 'maximize':
        if (win.__simplexMini) break;
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
        break;
      case 'close':
        win.close();
        break;
      case 'toggle-mini':
        if (win.__simplexMini) exitMiniMode(win);
        else enterMiniMode(win);
        break;
      default:
        break;
    }

    return {
      maximized: win.isMaximized(),
      mini: Boolean(win.__simplexMini),
      miniOnTop: miniPrefs.onTop
    };
  });

  ipcMain.handle('window:state', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win || win.isDestroyed()) return { maximized: false, mini: false, miniOnTop: miniPrefs.onTop };
    return {
      maximized: win.isMaximized(),
      mini: Boolean(win.__simplexMini),
      miniOnTop: miniPrefs.onTop
    };
  });

  ipcMain.handle('window:set-mini-on-top', (event, value) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    miniPrefs.onTop = Boolean(value);
    if (lastWindowState) {
      lastWindowState.miniOnTop = miniPrefs.onTop;
      queueWindowStateSave();
    }
    if (win && !win.isDestroyed() && win.__simplexMini) {
      win.setAlwaysOnTop(miniPrefs.onTop, 'floating');
    }
    return { miniOnTop: miniPrefs.onTop };
  });
}

async function bootstrap() {
  const userDataDir = app.getPath('userData');
  await fsp.mkdir(userDataDir, { recursive: true });
  windowStatePath = path.join(userDataDir, 'window-state.json');

  library = new MusicLibrary(userDataDir);
  playlists = new PlaylistStore(userDataDir);
  settings = new SettingsStore(userDataDir);

  installAppProtocol({
    appDir: APP_DIR,
    coversDir: path.join(userDataDir, 'covers'),
    library
  });

  setupIpc();
  updater.init({ onEvent: sendUpdateEvent });
  createWindow();
}

app.whenReady().then(bootstrap);

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
