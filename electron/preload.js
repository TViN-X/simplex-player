'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const api = {
  init: () => ipcRenderer.invoke('app:init'),
  pickFolders: () => ipcRenderer.invoke('dialog:pick-folders'),
  pickFiles: () => ipcRenderer.invoke('dialog:pick-files'),
  addPaths: (paths) => ipcRenderer.invoke('library:add-paths', paths),
  removeTrack: (id) => ipcRenderer.invoke('library:remove', id),
  clearLibrary: () => ipcRenderer.invoke('library:clear'),
  createPlaylist: (name, trackIds) => ipcRenderer.invoke('playlist:create', { name, trackIds }),
  renamePlaylist: (id, name) => ipcRenderer.invoke('playlist:rename', { id, name }),
  deletePlaylist: (id) => ipcRenderer.invoke('playlist:delete', id),
  addPlaylistTracks: (id, trackIds) => ipcRenderer.invoke('playlist:add-tracks', { id, trackIds }),
  removePlaylistTrack: (id, trackId) => ipcRenderer.invoke('playlist:remove-track', { id, trackId }),
  reorderPlaylist: (id, trackIds) => ipcRenderer.invoke('playlist:reorder', { id, trackIds }),
  revealTrack: (id) => ipcRenderer.invoke('library:reveal', id),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  windowControl: (action) => ipcRenderer.invoke('window:control', action),
  getWindowState: () => ipcRenderer.invoke('window:state'),
  setMiniOnTop: (value) => ipcRenderer.invoke('window:set-mini-on-top', Boolean(value)),
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  onWindowState: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('window:state', listener);
    return () => ipcRenderer.removeListener('window:state', listener);
  },
  onScanProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('scan:progress', listener);
    return () => ipcRenderer.removeListener('scan:progress', listener);
  },
  platform: process.platform
};

contextBridge.exposeInMainWorld('simplex', api);
