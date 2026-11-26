(() => {
  'use strict';

  const bridge = window.simplex;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const audio = $('#audio');

  const dom = {
    root: document.documentElement,
    body: document.body,
    boot: $('#boot'),
    emptyView: $('#empty-view'),
    libraryView: $('#library-view'),
    searchInput: $('#search-input'),
    searchClear: $('#search-clear'),
    searchKbd: $('#search-kbd'),
    addBtn: $('#add-btn'),
    addMenu: $('#add-menu'),
    ambientA: $('#ambient-a'),
    ambientB: $('#ambient-b'),
    playBtn: $('#play-btn'),
    prevBtn: $('#prev-btn'),
    nextBtn: $('#next-btn'),
    shuffleBtn: $('#shuffle-btn'),
    repeatBtn: $('#repeat-btn'),
    repeatOne: $('#repeat-one'),
    muteBtn: $('#mute-btn'),
    volumeSlider: $('#volume-slider'),
    seekSlider: $('#seek-slider'),
    timeCurrent: $('#time-current'),
    timeTotal: $('#time-total'),
    nowStatusText: $('#now-status-text'),
    nowTitle: $('#now-title'),
    nowTitleTrack: $('#now-title-track'),
    nowTitleText: $('#now-title-text'),
    nowTitleGhost: $('#now-title-ghost'),
    nowArtist: $('#now-artist'),
    nowAlbum: $('#now-album'),
    volumeValue: $('#volume-value'),
    winMinimize: $('#win-minimize'),
    winMaximize: $('#win-maximize'),
    winClose: $('#win-close'),
    winWidget: $('#win-widget'),
    miniPlayer: $('#mini-player'),
    miniArtImg: $('#mini-art-img'),
    miniArtFallback: $('#mini-art-fallback'),
    miniTitleMask: $('#mini-title-mask'),
    miniTitleTrack: $('#mini-title-track'),
    miniTitle: $('#mini-title'),
    miniTitleGhost: $('#mini-title-ghost'),
    miniArtist: $('#mini-artist'),
    miniProgress: $('#mini-progress'),
    miniProgressBar: $('#mini-progress-bar'),
    miniPlay: $('#mini-play'),
    miniMute: $('#mini-mute'),
    miniOnTop: $('#mini-on-top'),
    miniVolume: $('#mini-volume'),
    miniVolumeValue: $('#mini-volume-value'),
    miniPrev: $('#mini-prev'),
    miniNext: $('#mini-next'),
    miniRestore: $('#mini-restore'),
    miniClose: $('#mini-close'),
    artArea: $('#art-area'),
    artTilt: $('#art-tilt'),
    artFrame: $('#art-frame'),
    artFallback: $('#art-fallback'),
    fallbackLetter: $('#fallback-letter'),
    artFormat: $('#art-format'),
    artImgA: $('#art-img-a'),
    artImgB: $('#art-img-b'),
    visualizer: $('#visualizer'),
    queueList: $('#queue-list'),
    queue: $('#queue'),
    queueEmpty: $('#queue-empty'),
    queueSubtitle: $('#queue-subtitle'),
    queueTitle: $('#queue-title'),
    queueScroll: $('#queue-scroll'),
    queueSort: $('#queue-sort'),
    queueBack: $('#queue-back'),
    playlistGrid: $('#playlist-grid'),
    clearBtn: $('#clear-library'),
    playlistMore: $('#playlist-more'),
    playlistEdit: $('#playlist-edit'),
    playlistEmpty: $('#playlist-empty'),
    playlistEmptyAdd: $('#playlist-empty-add'),
    playlistMenu: $('#playlist-menu'),
    playlistModal: $('#playlist-modal'),
    modalTitle: $('#playlist-modal-title'),
    modalText: $('#playlist-modal-text'),
    nameField: $('#playlist-name-field'),
    nameInput: $('#playlist-name'),
    createOptions: $('#playlist-create-options'),
    createFilesHint: $('#create-files-hint'),
    createFolderHint: $('#create-folder-hint'),
    modalClose: $('#playlist-modal-close'),
    modalCancel: $('#playlist-modal-cancel'),
    modalConfirm: $('#playlist-modal-confirm'),
    trackPlaylistMenu: $('#track-playlist-menu'),
    resetSearch: $('#reset-search'),
    scanLine: $('#scan-line'),
    scanLineBar: $('#scan-line-bar'),
    scanBanner: $('#scan-banner'),
    scanText: $('#scan-text'),
    scanCount: $('#scan-count'),
    scanBar: $('#scan-bar'),
    dropOverlay: $('#drop-overlay'),
    contextMenu: $('#context-menu'),
    toasts: $('#toasts'),
    sortField: $('#sort-field'),
    sortTrigger: $('#sort-trigger'),
    sortValue: $('#sort-value'),
    sortMenu: $('#sort-menu')
  };

  const state = {
    tracks: [],
    filtered: [],
    currentId: null,
    playing: false,
    scanning: false,
    search: '',
    sortMode: 'file',
    sortAsc: true,
    playlists: [],
    activePlaylistId: null,
    playlistGrid: true,
    editingPlaylist: false,
    draggingTrackId: null,
    modalMode: null,
    modalPlaylistId: null,
    modalSource: 'empty',
    modalPaths: [],
    modalPathKind: 'files',
    playlistMenuId: null,
    trackMenuTrackId: null,
    seekDragging: false,
    seekPreview: 0,
    pendingRestore: 0,
    ready: false,
    shuffle: false,
    repeat: 'off',
    lastVolume: 0.78,
    contextTrackId: null,
    activeAmbient: 0,
    activeArt: 0,
    artToken: 0,
    accentRgb: [179, 157, 255],
    vizHeights: new Array(18).fill(0),
    lastPersistAt: 0,
    bootAt: performance.now(),
    scanPayload: null,
    mini: false,
    titleToken: 0,
    miniTitleToken: 0,
    miniSeeking: false
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = bridge?.platform === 'darwin';
  const artImages = [dom.artImgA, dom.artImgB];
  const ambientLayers = [dom.ambientA, dom.ambientB];
  let searchTimer = null;
  let settingsTimer = null;
  let settingsWriteTimer = null;
  let scanFinishTimer = null;
  let clearArmTimer = null;
  let visualizerFrame = null;
  let audioContext = null;
  let analyser = null;
  let sourceNode = null;
  let frequencyData = null;
  let visualizerCtx = null;
  let visualizerDpr = 1;
  let toastCount = 0;
  let mediaMetadataToken = 0;
  const mediaArtCache = new Map();

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function plural(count, forms) {
    const abs = Math.abs(count) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function hashHue(value) {
    let hash = 0;
    const text = String(value || 'simplex');
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 360;
  }

  function hexToRgb(hex) {
    const match = /^#?([a-f0-9]{6})$/i.exec(String(hex || ''));
    if (!match) return null;
    const value = parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`;
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    let hue = 0;
    let saturation = 0;
    if (max !== min) {
      const delta = max - min;
      saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue /= 6;
    }
    return { h: hue * 360, s: saturation, l: lightness };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);
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
    const toHex = (channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function shiftHex(hex, degrees, saturationBoost = 0, lightnessBoost = 0) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const hsl = rgbToHsl(...rgb);
    return hslToHex(hsl.h + degrees, clamp(hsl.s + saturationBoost, 0, 0.92), clamp(hsl.l + lightnessBoost, 0.35, 0.78));
  }

  function accentForTrack(track) {
    const direct = hexToRgb(track?.accent);
    if (direct) return rgbToHex(...direct);
    const hue = hashHue(`${track?.artist || ''}${track?.album || ''}${track?.title || ''}`);
    return hslToHex(hue, 0.62, 0.66);
  }

  function formatTime(value) {
    const total = Math.max(0, Number(value) || 0);
    if (!Number.isFinite(total)) return '0:00';
    const seconds = Math.floor(total % 60);
    const minutes = Math.floor((total / 60) % 60);
    const hours = Math.floor(total / 3600);
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function libraryDurationLabel(list = state.tracks) {
    const total = list.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
    if (!total) return '';
    const minutes = Math.round(total / 60);
    if (minutes < 60) return `${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
  }

  function getCurrentTrack() {
    if (!state.currentId) return null;
    return state.tracks.find((track) => track.id === state.currentId) || null;
  }

  function getActivePlaylist() {
    if (!state.activePlaylistId) return null;
    return state.playlists.find((playlist) => playlist.id === state.activePlaylistId) || null;
  }

  function getViewTracks() {
    const playlist = getActivePlaylist();
    if (!playlist) return state.tracks;
    const byId = new Map(state.tracks.map((track) => [track.id, track]));
    return playlist.trackIds.map((id) => byId.get(id)).filter(Boolean);
  }

  function setRangeFill(input, value, max = 1) {
    const percent = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
    input.style.setProperty('--value', `${percent}%`);
  }

  function setTooltip(element, text) {
    if (!element) return;
    if (text) element.setAttribute('data-tooltip', text);
    else element.removeAttribute('data-tooltip');
  }

  function setIcon(button, id) {
    const use = button?.querySelector('use');
    if (use) use.setAttribute('href', `#${id}`);
  }

  function setMarquee(mask, track, parts, text, tokenKey) {
    if (!mask || !track || !parts.length) return;
    parts.forEach((part) => { part.textContent = text; });
    const token = state[tokenKey] + 1;
    state[tokenKey] = token;
    mask.classList.remove('is-marquee');
    track.style.removeProperty('--marquee-shift');
    track.style.removeProperty('--marquee-duration');

    if (prefersReducedMotion) return;

    requestAnimationFrame(() => {
      if (token !== state[tokenKey]) return;
      const width = parts[0].getBoundingClientRect().width;
      const maskWidth = mask.clientWidth;
      if (!width || width <= maskWidth + 2) return;

      let gap = parseFloat(getComputedStyle(track).columnGap);
      if (!Number.isFinite(gap)) gap = 40;

      const shift = width + gap;
      track.style.setProperty('--marquee-shift', `-${shift}px`);
      track.style.setProperty('--marquee-duration', `${clamp(shift / 26, 7, 24)}s`);
      mask.classList.add('is-marquee');
    });
  }

  function refreshMarquees() {
    const track = getCurrentTrack();
    if (!track) return;
    setMarquee(dom.nowTitle, dom.nowTitleTrack, [dom.nowTitleText, dom.nowTitleGhost], track.title, 'titleToken');
    setMarquee(dom.miniTitleMask, dom.miniTitleTrack, [dom.miniTitle, dom.miniTitleGhost], track.title, 'miniTitleToken');
  }

  function applyPlatform() {
    if (!bridge) return;
    dom.body.dataset.platform = bridge.platform || 'win32';
    if (isMac) {
      $$('[data-mod]').forEach((element) => { element.textContent = '⌘'; });
      const shortcut = $('[data-folder-shortcut]');
      if (shortcut) shortcut.textContent = '⌘ O';
      const menuShortcuts = $$('.add-menu kbd');
      if (menuShortcuts[1]) menuShortcuts[1].textContent = '⌘ ⇧ O';
    }
  }

  function updateMaximizeUI(maximized) {
    if (!dom.winMaximize) return;
    setIcon(dom.winMaximize, maximized ? 'i-restore' : 'i-maximize');
    const label = maximized ? 'Восстановить' : 'Развернуть';
    dom.winMaximize.setAttribute('aria-label', label);
    setTooltip(dom.winMaximize, label);
  }

  function setMiniMode(enabled) {
    if (!dom.miniPlayer) return;
    state.mini = Boolean(enabled);
    dom.body.classList.toggle('is-mini', state.mini);
    dom.miniPlayer.hidden = !state.mini;
    if (state.mini) setAddMenu(false);

    if (state.mini) {
      updateMiniPlayer(getCurrentTrack());
      updateTimeline();
      updateVolumeUI();
      requestAnimationFrame(refreshMarquees);
      return;
    }

    requestAnimationFrame(() => {
      setupVisualizerCanvas();
      if (!state.playing) drawIdleVisualizer();
      refreshMarquees();
    });
  }

  function updateMiniOnTopUI(value) {
    if (!dom.miniOnTop) return;
    dom.miniOnTop.checked = Boolean(value);
  }

  async function toggleMiniMode() {
    if (!bridge?.windowControl) return;
    try {
      const result = await bridge.windowControl('toggle-mini');
      if (result && typeof result.miniOnTop === 'boolean') updateMiniOnTopUI(result.miniOnTop);
      setMiniMode(Boolean(result?.mini));
    } catch {
      // Window control is best-effort.
    }
  }

  function setupWindowControls() {
    if (!bridge) return;

    dom.winMinimize?.addEventListener('click', () => bridge.windowControl('minimize'));
    dom.winMaximize?.addEventListener('click', () => bridge.windowControl('maximize'));
    dom.winClose?.addEventListener('click', () => bridge.windowControl('close'));
    dom.winWidget?.addEventListener('click', toggleMiniMode);
    dom.miniRestore?.addEventListener('click', toggleMiniMode);
    dom.miniClose?.addEventListener('click', () => bridge.windowControl('close'));

    dom.miniPlay?.addEventListener('click', togglePlay);
    dom.miniPrev?.addEventListener('click', () => previousTrack(state.playing));
    dom.miniNext?.addEventListener('click', () => nextTrack(state.playing));
    dom.miniMute?.addEventListener('click', toggleMute);
    dom.miniOnTop?.addEventListener('change', async () => {
      const next = Boolean(dom.miniOnTop.checked);
      try {
        const result = await bridge.setMiniOnTop?.(next);
        updateMiniOnTopUI(result && typeof result.miniOnTop === 'boolean' ? result.miniOnTop : next);
      } catch {
        updateMiniOnTopUI(!next);
      }
    });
    dom.miniVolume?.addEventListener('input', () => {
      setVolume(Number(dom.miniVolume.value));
    });

    dom.miniProgress?.addEventListener('pointerdown', (event) => {
      const seekFromPointer = (pointerEvent) => {
        const rect = dom.miniProgress.getBoundingClientRect();
        if (!rect.width) return;
        const ratio = clamp((pointerEvent.clientX - rect.left) / rect.width, 0, 1);
        seekTo(getDuration() * ratio);
      };

      seekFromPointer(event);
      const move = (pointerEvent) => seekFromPointer(pointerEvent);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      event.preventDefault();
    });

    dom.miniProgress?.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      event.stopPropagation();
      seekBy(event.key === 'ArrowRight' ? 5 : -5);
    });

    bridge.getWindowState?.().then((windowState) => {
      if (!windowState) return;
      updateMaximizeUI(Boolean(windowState.maximized));
      if (typeof windowState.miniOnTop === 'boolean') updateMiniOnTopUI(windowState.miniOnTop);
      setMiniMode(Boolean(windowState.mini));
    }).catch(() => {});

    bridge.onWindowState?.((windowState) => {
      if (!windowState) return;
      updateMaximizeUI(Boolean(windowState.maximized));
      if (typeof windowState.miniOnTop === 'boolean') updateMiniOnTopUI(windowState.miniOnTop);
      setMiniMode(Boolean(windowState.mini));
    });

    window.addEventListener('resize', refreshMarquees);
  }

  function setBootVisible(visible) {
    if (!dom.boot) return;
    if (visible) {
      dom.boot.classList.remove('is-hidden');
      return;
    }
    const elapsed = performance.now() - state.bootAt;
    const delay = Math.max(0, 520 - elapsed);
    setTimeout(() => {
      dom.boot.classList.add('is-hidden');
      setTimeout(() => dom.boot?.remove(), 700);
    }, delay);
  }

  function showToast(message, options = {}) {
    if (!dom.toasts) return;
    const type = options.type || 'info';
    const duration = Number(options.duration) || 3400;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconId = type === 'error' ? 'i-alert' : type === 'success' ? 'i-check' : 'i-wave';
    toast.innerHTML = `
      <span class="toast-icon"><svg class="icon" aria-hidden="true"><use href="#${iconId}"></use></svg></span>
      <span class="toast-message"></span>
    `;
    $('.toast-message', toast).textContent = message;
    dom.toasts.appendChild(toast);
    toastCount += 1;

    while (toastCount > 3 && dom.toasts.firstElementChild) {
      dom.toasts.firstElementChild.remove();
      toastCount -= 1;
    }

    setTimeout(() => {
      toast.classList.add('is-leaving');
      setTimeout(() => {
        toast.remove();
        toastCount = Math.max(0, toastCount - 1);
      }, 260);
    }, duration);
  }

  function settingsSnapshot() {
    return {
      volume: Number(audio.volume),
      muted: Boolean(audio.muted),
      shuffle: Boolean(state.shuffle),
      repeat: state.repeat,
      sortMode: state.sortMode,
      sortAsc: state.sortAsc,
      lastTrackId: state.currentId,
      lastTime: Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0
    };
  }

  function persistSettings(delay = 350) {
    if (!state.ready || !bridge) return;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => {
      bridge.saveSettings(settingsSnapshot()).catch(() => {});
    }, delay);
  }

  function persistSettingsSoon() {
    persistSettings(120);
  }

  function setView() {
    const hasTracks = state.tracks.length > 0;
    dom.emptyView.hidden = hasTracks;
    dom.libraryView.hidden = !hasTracks;
    if (!hasTracks) {
      state.activePlaylistId = null;
      state.playlistGrid = true;
      resetClearButton();
      state.search = '';
      dom.searchInput.value = '';
      dom.searchClear.hidden = true;
    }
    updateQueueChrome();
  }

  function filterTracks(list) {
    const query = state.search.trim().toLowerCase();
    if (!query) return list.slice();
    return list.filter((track) => {
      const haystack = `${track.title}\n${track.artist}\n${track.album}\n${track.fileName}\n${track.format}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function eqMarkup() {
    return '<span class="eq" aria-hidden="true"><span></span><span></span><span></span></span>';
  }

  function sortTracks(list) {
    const mode = state.sortMode;
    const asc = state.sortAsc;
    const sorted = list.slice();

    if (mode === 'file') {
      // Keep as-is (file order / added order)
      return sorted;
    }

    sorted.sort((a, b) => {
      let cmp = 0;
      if (mode === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '', 'ru', { numeric: true, sensitivity: 'base' });
      } else if (mode === 'artist') {
        const artistA = a.artist || '';
        const artistB = b.artist || '';
        cmp = artistA.localeCompare(artistB, 'ru', { numeric: true, sensitivity: 'base' });
        if (cmp === 0) {
          cmp = (a.title || '').localeCompare(b.title || '', 'ru', { numeric: true, sensitivity: 'base' });
        }
      }
      return asc ? cmp : -cmp;
    });

    return sorted;
  }

  function renderQueue() {
    if (state.playlistGrid) {
      state.filtered = [];
      dom.queueList.hidden = true;
      dom.queueEmpty.hidden = true;
      dom.playlistEmpty.hidden = true;
      dom.playlistGrid.hidden = false;
      if (dom.queueSort) dom.queueSort.hidden = true;
      setSortMenu(false);
      renderPlaylistGrid();
      updateQueueSubtitle();
      updateQueueChrome();
      return;
    }

    dom.playlistGrid.hidden = true;
    dom.queueList.hidden = false;

    const source = getViewTracks();
    state.filtered = sortTracks(filterTracks(source));
    const query = state.search.trim();
    const playlistForDrag = getActivePlaylist();
    const editable = Boolean(playlistForDrag) && !state.search.trim() && (state.editingPlaylist || state.sortMode === 'file');
    const rows = state.filtered.map((track, visibleIndex) => {
      const index = visibleIndex;
      const active = track.id === state.currentId;
      const hue = hashHue(`${track.artist}${track.album}${track.title}`);
      const letter = String(track.album || track.title || '?').trim().charAt(0).toUpperCase() || '?';
      const duration = track.duration > 0 ? formatTime(track.duration) : '—:—';
      const number = String(index + 1).padStart(2, '0');
      const contentIndex = active ? eqMarkup() : escapeHtml(number);
      const cover = track.coverUrl
        ? `<img src="${escapeHtml(track.coverUrl)}" alt="" loading="lazy" decoding="async">`
        : '';

      return `
        <div
          class="queue-row${active ? ' is-active' : ''}"
          data-track-id="${escapeHtml(track.id)}"
          data-index="${index}"
          data-visible-index="${visibleIndex}"
          id="queue-track-${escapeHtml(track.id)}"
          role="option"
          aria-selected="${active ? 'true' : 'false'}"
          tabindex="0"
          draggable="${editable ? 'true' : 'false'}"
          style="--row-index:${Math.min(visibleIndex, 12)}"
        >
          <span class="q-handle" aria-hidden="true">
            <svg class="icon"><use href="#i-grip"></use></svg>
          </span>
          <span class="q-index">${contentIndex}</span>
          <span class="q-cover">
            <span class="q-cover-fallback" style="--hue:${hue}" aria-hidden="true">${escapeHtml(letter)}</span>
            ${cover}
          </span>
          <span class="q-text">
            <span class="q-title">${escapeHtml(track.title)}</span>
            <span class="q-artist">${escapeHtml(track.artist)}</span>
          </span>
          <span class="q-duration">${duration}</span>
          <button class="q-more" type="button" aria-label="Действия с треком" tabindex="-1">
            <svg class="icon" aria-hidden="true"><use href="#i-more"></use></svg>
          </button>
          <button class="q-remove" type="button" aria-label="Убрать из плейлиста" tabindex="-1">
            <svg class="icon" aria-hidden="true"><use href="#i-x"></use></svg>
          </button>
        </div>
      `;
    }).join('');

    dom.queueList.innerHTML = rows;
    const playlist = getActivePlaylist();
    dom.queueEmpty.hidden = !(source.length > 0 && state.filtered.length === 0);
    dom.playlistEmpty.hidden = !(playlist && source.length === 0);
    const hideSort = state.editingPlaylist || source.length === 0;
    if (dom.queueSort) dom.queueSort.hidden = hideSort;
    if (hideSort) setSortMenu(false);
    updateQueueSubtitle();
    updateQueueChrome();
    syncActiveRows();
    if (query) dom.queueScroll.scrollTop = 0;
  }

  function playlistPreviewTrack(playlist, byId) {
    let first = null;
    for (const id of playlist.trackIds) {
      const track = byId.get(id);
      if (!track) continue;
      if (!first) first = track;
      if (track.coverUrl) return track;
    }
    return first;
  }

  function renderPlaylistGrid() {
    if (!dom.playlistGrid) return;
    const query = state.search.trim().toLowerCase();
    const playlists = state.playlists.filter((playlist) => !query || playlist.name.toLowerCase().includes(query));
    const byId = new Map(state.tracks.map((track) => [track.id, track]));
    const tiles = [];

    playlists.forEach((playlist, index) => {
      const track = playlistPreviewTrack(playlist, byId);
      const letter = String((track ? track.album || track.title : playlist.name) || '?').trim().charAt(0).toUpperCase() || '?';
      const hue = track ? hashHue(`${track.artist}${track.album}${track.title}`) : hashHue(playlist.name);
      const cover = track?.coverUrl
        ? `<img src="${escapeHtml(track.coverUrl)}" alt="" loading="lazy" decoding="async">`
        : escapeHtml(letter);
      const count = playlist.trackIds.length;
      tiles.push(`
        <button
          class="playlist-tile"
          type="button"
          data-playlist-id="${escapeHtml(playlist.id)}"
          style="--tile-index:${Math.min(index, 12)}"
          title="${escapeHtml(playlist.name)}"
        >
          <span class="playlist-tile-art" style="--hue:${hue}">${cover}</span>
          <span class="playlist-tile-name">${escapeHtml(playlist.name)}</span>
          <span class="playlist-tile-meta">${count} ${plural(count, ['трек', 'трека', 'треков'])}</span>
        </button>
      `);
    });

    if (query && !playlists.length) {
      tiles.push('<div class="playlist-grid-empty">Плейлисты не найдены</div>');
    }

    if (!query) {
      tiles.push(`
        <button class="playlist-tile playlist-tile-add" type="button" data-open="create" style="--tile-index:${Math.min(state.playlists.length, 12)}">
          <span class="playlist-tile-art"><svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg></span>
          <span class="playlist-tile-name">Новый плейлист</span>
          <span class="playlist-tile-meta">Создать</span>
        </button>
      `);
    }

    dom.playlistGrid.innerHTML = tiles.join('');
  }

  const SORT_LABELS = {
    file: 'Без сортировки',
    title: 'Название',
    artist: 'Артист'
  };

  function updateSortUI() {
    const mode = ['file', 'title', 'artist'].includes(state.sortMode) ? state.sortMode : 'file';
    if (dom.sortValue) dom.sortValue.textContent = SORT_LABELS[mode];
    if (!dom.sortMenu) return;
    $$('.sort-option', dom.sortMenu).forEach((option) => {
      const active = option.dataset.sort === mode;
      option.classList.toggle('is-active', active);
      option.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function setSortMenu(open, options = {}) {
    if (!dom.sortMenu || !dom.sortTrigger) return;
    const expanded = Boolean(open);
    dom.sortMenu.hidden = !expanded;
    dom.sortTrigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');

    if (!expanded) {
      if (options.restoreFocus) dom.sortTrigger.focus();
      return;
    }

    if (options.focusOption) {
      const selected = $('.sort-option.is-active', dom.sortMenu) || $('.sort-option', dom.sortMenu);
      selected?.focus();
    }
  }

  function toggleSortMenu() {
    if (!dom.sortMenu) return;
    const open = dom.sortMenu.hidden;
    setSortMenu(open, { focusOption: open });
  }

  function setSort(mode) {
    const next = ['file', 'title', 'artist'].includes(mode) ? mode : 'file';
    state.sortMode = next;
    state.sortAsc = true;
    renderQueue();
    syncActiveRows();
    updateSortUI();
    if (state.currentId) scrollRowIntoView(state.currentId, true);
    persistSettingsSoon();
  }

  function updateQueueSubtitle() {
    if (state.playlistGrid) {
      const total = state.playlists.length;
      if (state.search.trim()) {
        const shown = state.playlists.filter((playlist) => playlist.name.toLowerCase().includes(state.search.trim().toLowerCase())).length;
        dom.queueSubtitle.textContent = `${shown} из ${total}`;
        return;
      }
      dom.queueSubtitle.textContent = `${total} ${plural(total, ['плейлист', 'плейлиста', 'плейлистов'])}`;
      return;
    }

    const source = getViewTracks();
    const total = source.length;
    if (!total) {
      dom.queueSubtitle.textContent = '0 треков';
      return;
    }
    if (state.editingPlaylist && getActivePlaylist()) {
      dom.queueSubtitle.textContent = `${total} ${plural(total, ['трек', 'трека', 'треков'])} · перетащите треки`;
      return;
    }
    if (state.search.trim()) {
      dom.queueSubtitle.textContent = `${state.filtered.length} из ${total}`;
      return;
    }
    const duration = libraryDurationLabel(source);
    dom.queueSubtitle.textContent = `${total} ${plural(total, ['трек', 'трека', 'треков'])}${duration ? ` · ${duration}` : ''}`;
  }

  function updateQueueChrome() {
    const grid = state.playlistGrid;
    const playlist = getActivePlaylist();
    const hasTracks = state.tracks.length > 0;
    const editing = state.editingPlaylist && Boolean(playlist) && !grid;
    if (dom.queueBack) dom.queueBack.hidden = grid;
    if (dom.queueTitle) dom.queueTitle.textContent = grid ? 'Плейлисты' : playlist ? playlist.name : 'Все треки';
    if (dom.addBtn) dom.addBtn.hidden = false;
    if (dom.playlistMore) dom.playlistMore.hidden = grid || !playlist;
    if (dom.playlistEdit) {
      dom.playlistEdit.hidden = grid || !playlist;
      dom.playlistEdit.classList.toggle('is-active', editing);
      dom.playlistEdit.setAttribute('aria-pressed', editing ? 'true' : 'false');
      const label = editing ? 'Готово' : 'Редактировать плейлист';
      dom.playlistEdit.setAttribute('aria-label', label);
      setIcon(dom.playlistEdit, editing ? 'i-check' : 'i-edit');
      setTooltip(dom.playlistEdit, editing ? 'Готово' : 'Редактировать');
    }
    if (dom.queue) {
      dom.queue.classList.toggle('is-editing', editing);
      dom.queue.classList.toggle('can-reorder', !grid && Boolean(playlist) && state.sortMode === 'file' && !state.search.trim());
    }
    if (dom.clearBtn) dom.clearBtn.hidden = grid || !hasTracks || Boolean(playlist);
    if (dom.searchInput) {
      dom.searchInput.placeholder = grid ? 'Поиск по плейлистам' : 'Поиск по трекам';
      dom.searchInput.disabled = (!hasTracks && state.playlists.length === 0) || editing;
    }
  }

  function resetSearchState() {
    state.search = '';
    dom.searchInput.value = '';
    dom.searchClear.hidden = true;
  }

  function openPlaylistView(id) {
    if (!state.playlists.some((playlist) => playlist.id === id)) return;
    closePlaylistMenu();
    state.playlistGrid = false;
    state.editingPlaylist = false;
    state.activePlaylistId = id;
    resetSearchState();
    renderQueue();
    dom.queueScroll.scrollTop = 0;
  }

  function showPlaylistsView() {
    closePlaylistMenu();
    state.playlistGrid = true;
    state.editingPlaylist = false;
    state.activePlaylistId = null;
    resetSearchState();
    renderQueue();
    dom.queueScroll.scrollTop = 0;
  }

  function setPlaylistEditing(enabled) {
    const playlist = getActivePlaylist();
    if (!playlist) return;
    const next = Boolean(enabled);
    if (state.editingPlaylist === next) return;
    state.editingPlaylist = next;
    if (next) {
      state.sortMode = 'file';
      state.sortAsc = true;
      updateSortUI();
      resetSearchState();
      closePlaylistMenu();
      closeContextMenu();
    }
    renderQueue();
  }

  function togglePlaylistEditing() {
    setPlaylistEditing(!state.editingPlaylist);
  }

  async function persistPlaylistOrder() {
    const playlist = getActivePlaylist();
    if (!playlist || !bridge) return;
    const ids = Array.from(dom.queueList.querySelectorAll('.queue-row'))
      .map((row) => row.dataset.trackId)
      .filter(Boolean);
    if (!ids.length) return;
    if (ids.join('\n') === playlist.trackIds.join('\n')) return;

    try {
      const result = await bridge.reorderPlaylist(playlist.id, ids);
      if (!result || result.error) throw new Error('reorder');
      applyPlaylistResult(result);
    } catch {
      showToast('Не удалось сохранить порядок треков', { type: 'error' });
    } finally {
      renderQueue();
    }
  }

  function applyPlaylistResult(result) {
    if (Array.isArray(result?.tracks)) {
      state.tracks = result.tracks;
    }
    if (Array.isArray(result?.playlists)) {
      state.playlists = result.playlists;
    } else if (result?.playlist) {
      const index = state.playlists.findIndex((playlist) => playlist.id === result.playlist.id);
      if (index === -1) state.playlists.push(result.playlist);
      else state.playlists[index] = result.playlist;
    }
    if (state.activePlaylistId && !state.playlists.some((playlist) => playlist.id === state.activePlaylistId)) {
      state.activePlaylistId = null;
    }
  }

  function openPlaylistMenu(id, point = {}) {
    if (!dom.playlistMenu || !id) return;
    const playlist = state.playlists.find((item) => item.id === id);
    if (!playlist) return;

    closeContextMenu();
    setAddMenu(false);
    state.playlistMenuId = id;

    dom.playlistMenu.hidden = false;
    dom.playlistMenu.style.left = '0px';
    dom.playlistMenu.style.top = '0px';
    const rect = dom.playlistMenu.getBoundingClientRect();
    const padding = 12;
    let left = Number.isFinite(point.x) ? point.x : padding;
    if (point.alignRight) left -= rect.width;
    dom.playlistMenu.style.left = `${clamp(left, padding, Math.max(padding, window.innerWidth - rect.width - padding))}px`;
    dom.playlistMenu.style.top = `${clamp(Number(point.y) || padding, padding, Math.max(padding, window.innerHeight - rect.height - padding))}px`;
    dom.playlistMore?.setAttribute('aria-expanded', 'true');
  }

  function closePlaylistMenu() {
    if (!dom.playlistMenu) return;
    dom.playlistMenu.hidden = true;
    state.playlistMenuId = null;
    dom.playlistMore?.setAttribute('aria-expanded', 'false');
  }

  function togglePlaylistMenu() {
    const playlist = getActivePlaylist();
    if (!playlist) return;
    if (!dom.playlistMenu.hidden) {
      closePlaylistMenu();
      return;
    }
    const anchor = dom.playlistMore.getBoundingClientRect();
    openPlaylistMenu(playlist.id, { x: anchor.right, y: anchor.bottom + 7, alignRight: true });
  }

  function openTrackPlaylistMenu(trackId, x, y) {
    if (!dom.trackPlaylistMenu || !trackId) return;
    const track = state.tracks.find((item) => item.id === trackId);
    if (!track) return;

    closePlaylistMenu();
    closeContextMenu();
    state.trackMenuTrackId = trackId;

    const items = state.playlists.map((playlist) => {
      const has = playlist.trackIds.includes(trackId);
      const count = playlist.trackIds.length;
      return `
        <button class="menu-item" type="button" data-target-playlist="${escapeHtml(playlist.id)}" ${has ? 'disabled' : ''}>
          <span class="menu-icon"><svg class="icon" aria-hidden="true"><use href="#i-music"></use></svg></span>
          <span class="menu-copy">
            <strong>${escapeHtml(playlist.name)}</strong>
            <small>${has ? 'Уже в плейлисте' : `${count} ${plural(count, ['трек', 'трека', 'треков'])}`}</small>
          </span>
        </button>
      `;
    }).join('');

    dom.trackPlaylistMenu.innerHTML = items || '<div class="menu-hint">Нет плейлистов</div>';
    dom.trackPlaylistMenu.hidden = false;
    dom.trackPlaylistMenu.style.left = '0px';
    dom.trackPlaylistMenu.style.top = '0px';
    const rect = dom.trackPlaylistMenu.getBoundingClientRect();
    const padding = 12;
    dom.trackPlaylistMenu.style.left = `${clamp(Number(x) || padding, padding, Math.max(padding, window.innerWidth - rect.width - padding))}px`;
    dom.trackPlaylistMenu.style.top = `${clamp(Number(y) || padding, padding, Math.max(padding, window.innerHeight - rect.height - padding))}px`;
  }

  function closeTrackPlaylistMenu() {
    if (!dom.trackPlaylistMenu) return;
    dom.trackPlaylistMenu.hidden = true;
    state.trackMenuTrackId = null;
  }

  function folderLabel(folderPath) {
    const parts = String(folderPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || 'Папка';
  }

  function fileLabel(filePath) {
    const name = folderLabel(filePath);
    return name.replace(/\.[a-z0-9]{1,6}$/i, '') || 'Плейлист';
  }

  function normalizeFolderPath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }

  function isPathInside(filePath, folder) {
    const normalized = normalizeFolderPath(filePath);
    return normalized === folder || normalized.startsWith(`${folder}/`);
  }

  function renderCreateOptions() {
    if (!dom.createOptions) return;
    dom.createOptions.querySelectorAll('[data-create-source]').forEach((option) => {
      option.classList.toggle('is-selected', state.modalSource === option.dataset.createSource);
    });

    if (dom.createFilesHint) {
      if (state.modalPathKind === 'files' && state.modalPaths.length) {
        dom.createFilesHint.textContent = state.modalPaths.length === 1
          ? folderLabel(state.modalPaths[0])
          : `${state.modalPaths.length} ${plural(state.modalPaths.length, ['файл', 'файла', 'файлов'])}`;
      } else {
        dom.createFilesHint.textContent = 'Открыть проводник';
      }
    }

    if (dom.createFolderHint) {
      if (state.modalPathKind === 'folder' && state.modalPaths.length) {
        dom.createFolderHint.textContent = state.modalPaths.length === 1
          ? folderLabel(state.modalPaths[0])
          : `${state.modalPaths.length} папки`;
      } else {
        dom.createFolderHint.textContent = 'Выбрать папку с музыкой';
      }
    }
  }

  function updatePickerState() {
    if (!dom.modalConfirm) return;
    const mode = state.modalMode;
    if (!mode) return;
    const nameRequired = mode === 'create' || mode === 'rename';
    const nameOk = !nameRequired || dom.nameInput.value.trim().length > 0;

    if (mode === 'create') {
      const needsPaths = state.modalSource === 'files' || state.modalSource === 'folder';
      const pathsOk = !needsPaths || state.modalPaths.length > 0;
      dom.modalConfirm.disabled = !(nameOk && pathsOk);
      return;
    }

    dom.modalConfirm.disabled = !nameOk;
  }

  function openPlaylistModal(mode, playlistId = null) {
    if (!dom.playlistModal) return;
    const playlist = playlistId ? state.playlists.find((item) => item.id === playlistId) : null;

    state.modalMode = mode;
    state.modalPlaylistId = playlist ? playlist.id : null;
    state.modalSource = 'empty';
    state.modalPaths = [];
    state.modalPathKind = 'files';

    dom.nameField.classList.remove('is-invalid');
    dom.modalText.hidden = true;
    dom.modalText.textContent = '';
    dom.nameField.hidden = false;
    if (dom.createOptions) dom.createOptions.hidden = true;
    dom.modalConfirm.classList.remove('danger');

    if (mode === 'create') {
      dom.modalTitle.textContent = 'Новый плейлист';
      dom.nameInput.value = '';
      dom.modalConfirm.textContent = 'Создать';
      if (dom.createOptions) dom.createOptions.hidden = false;
      renderCreateOptions();
    } else if (mode === 'rename') {
      dom.modalTitle.textContent = 'Переименовать плейлист';
      dom.nameInput.value = playlist?.name || '';
      dom.modalConfirm.textContent = 'Сохранить';
    } else if (mode === 'delete') {
      dom.modalTitle.textContent = 'Удалить плейлист?';
      dom.nameField.hidden = true;
      dom.modalText.hidden = false;
      dom.modalText.textContent = `Плейлист «${playlist?.name || ''}» будет удалён. Все его треки, если они больше нигде не используются, исчезнут из библиотеки.`;
      dom.modalConfirm.textContent = 'Удалить';
      dom.modalConfirm.classList.add('danger');
    } else {
      return;
    }

    dom.playlistModal.hidden = false;
    updatePickerState();
    if (mode === 'create' || mode === 'rename') {
      requestAnimationFrame(() => {
        dom.nameInput.focus();
        if (mode === 'rename') dom.nameInput.select();
      });
    } else {
      requestAnimationFrame(() => dom.modalConfirm.focus());
    }
  }

  function closePlaylistModal() {
    if (!dom.playlistModal) return;
    dom.playlistModal.hidden = true;
    state.modalMode = null;
    state.modalPlaylistId = null;
    state.modalSource = 'empty';
    state.modalPaths = [];
    state.modalPathKind = 'files';
  }

  async function submitPlaylistModal() {
    const mode = state.modalMode;
    if (!mode || !bridge || dom.modalConfirm.disabled) return;

    const name = dom.nameInput.value.trim();
    const playlistId = state.modalPlaylistId;

    if (mode === 'create' && (state.modalSource === 'files' || state.modalSource === 'folder')) {
      const paths = state.modalPaths.slice();
      closePlaylistModal();
      if (!paths.length) return;
      await createPlaylistFromPaths(name, paths);
      return;
    }

    dom.modalConfirm.disabled = true;

    try {
      let result = null;
      if (mode === 'create') {
        result = await bridge.createPlaylist(name, []);
      } else if (mode === 'rename') {
        result = await bridge.renamePlaylist(playlistId, name);
      } else if (mode === 'delete') {
        result = await bridge.deletePlaylist(playlistId);
      } else {
        return;
      }

      if (!result || result.error) {
        showToast('Не удалось сохранить плейлист', { type: 'error' });
        return;
      }

      applyPlaylistResult(result);

      if (mode === 'create' && result.playlist) {
        openPlaylistView(result.playlist.id);
        showToast(`Плейлист «${result.playlist.name}» создан`, { type: 'success' });
      } else if (mode === 'rename') {
        showToast('Плейлист переименован', { type: 'success', duration: 2200 });
      } else if (mode === 'delete') {
        if (state.currentId && !state.tracks.some((track) => track.id === state.currentId)) {
          clearCurrentUI();
        }
        closePlaylistModal();
        setView();
        showPlaylistsView();
        showToast('Плейлист удалён', { duration: 2200 });
        return;
      }

      closePlaylistModal();
      renderQueue();
    } catch {
      showToast('Не удалось сохранить изменения', { type: 'error' });
    } finally {
      if (dom.modalConfirm) dom.modalConfirm.disabled = false;
      if (state.modalMode) updatePickerState();
    }
  }

  async function createPlaylistFromPaths(name, paths) {
    if (!bridge) return;
    const summary = await addPaths(paths, { autoPlaylist: false, notify: false });
    if (!summary) {
      showToast('Не удалось добавить выбранные треки', { type: 'error' });
      return;
    }

    const keys = paths.map(normalizeFolderPath).filter(Boolean);
    const trackIds = state.tracks
      .filter((track) => keys.some((key) => isPathInside(track.path, key)))
      .map((track) => track.id);

    if (!trackIds.length) {
      showToast('В выбранных файлах не нашлось аудио', { type: 'error' });
      return;
    }

    const cleanup = async () => {
      let latestTracks = null;
      for (const track of summary.added || []) {
        try {
          const removed = await bridge.removeTrack(track.id);
          if (removed?.tracks) latestTracks = removed.tracks;
        } catch {
          // Best-effort cleanup.
        }
      }
      if (latestTracks) state.tracks = latestTracks;
    };

    try {
      const result = await bridge.createPlaylist(name, trackIds);
      if (!result || result.error) {
        await cleanup();
        showToast('Не удалось создать плейлист', { type: 'error' });
        return;
      }
      applyPlaylistResult(result);
      if (result.playlist) {
        openPlaylistView(result.playlist.id);
        showToast(
          `Плейлист «${result.playlist.name}» создан · ${trackIds.length} ${plural(trackIds.length, ['трек', 'трека', 'треков'])}`,
          { type: 'success' }
        );
      }
    } catch {
      await cleanup();
      showToast('Не удалось создать плейлист', { type: 'error' });
    }
  }

  async function importPathsToPlaylist(playlistId, paths) {
    if (!bridge || !playlistId || state.scanning) return;
    const playlist = state.playlists.find((item) => item.id === playlistId);
    if (!playlist) return;

    const summary = await addPaths(paths, { autoPlaylist: false, notify: false });
    if (!summary) {
      showToast('Не удалось добавить выбранные треки', { type: 'error' });
      return;
    }

    const keys = paths.map(normalizeFolderPath).filter(Boolean);
    const ids = state.tracks
      .filter((track) => keys.some((key) => isPathInside(track.path, key)))
      .map((track) => track.id);

    if (!ids.length) {
      showToast('В выбранных файлах не нашлось аудио', { type: 'error' });
      return;
    }

    const fresh = ids.filter((id) => !playlist.trackIds.includes(id));
    if (!fresh.length) {
      showToast('Эти треки уже есть в плейлисте', { duration: 2600 });
      return;
    }

    try {
      const result = await bridge.addPlaylistTracks(playlistId, ids);
      if (!result || result.error) {
        showToast('Не удалось добавить треки в плейлист', { type: 'error' });
        return;
      }
      applyPlaylistResult(result);
      renderQueue();
      showToast(
        `Добавлено ${fresh.length} ${plural(fresh.length, ['трек', 'трека', 'треков'])} в «${playlist.name}»`,
        { type: 'success' }
      );
    } catch {
      showToast('Не удалось добавить треки в плейлист', { type: 'error' });
    }
  }

  async function chooseFilesForPlaylist(playlistId) {
    if (!bridge || state.scanning) {
      if (state.scanning) showToast('Музыка уже добавляется, подождите немного');
      return;
    }
    try {
      const paths = await bridge.pickFiles();
      if (paths?.length) await importPathsToPlaylist(playlistId, paths);
    } catch {
      showToast('Не удалось открыть выбор файлов', { type: 'error' });
    }
  }

  async function removeFromPlaylist(trackId) {
    const playlist = getActivePlaylist();
    if (!bridge || !playlist || !trackId) return;
    try {
      const result = await bridge.removePlaylistTrack(playlist.id, trackId);
      if (result?.error) {
        showToast('Не удалось убрать трек из плейлиста', { type: 'error' });
        return;
      }
      applyPlaylistResult(result);
      if (state.currentId && !state.tracks.some((track) => track.id === state.currentId)) {
        clearCurrentUI();
      }
      setView();
      renderQueue();
      persistSettingsSoon();
      showToast('Трек убран из плейлиста', { duration: 2200 });
    } catch {
      showToast('Не удалось убрать трек из плейлиста', { type: 'error' });
    }
  }

  function syncActiveRows() {
    const rows = dom.queueList.querySelectorAll('.queue-row');
    let activeRow = null;

    rows.forEach((row) => {
      const active = row.dataset.trackId === state.currentId;
      row.classList.toggle('is-active', active);
      row.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) activeRow = row;

      const index = Number(row.dataset.index) || 0;
      const indexElement = row.querySelector('.q-index');
      if (indexElement) {
        if (active) indexElement.innerHTML = eqMarkup();
        else indexElement.textContent = String(index + 1).padStart(2, '0');
      }
    });

    if (activeRow) dom.queueList.setAttribute('aria-activedescendant', activeRow.id);
    else dom.queueList.removeAttribute('aria-activedescendant');
  }

  function scrollRowIntoView(trackId, smooth = false) {
    if (!trackId) return;
    const row = Array.from(dom.queueList.querySelectorAll('.queue-row'))
      .find((item) => item.dataset.trackId === trackId);
    if (!row) return;
    const scrollRect = dom.queueScroll.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const outside = rowRect.top < scrollRect.top || rowRect.bottom > scrollRect.bottom;
    if (!outside) return;
    row.scrollIntoView({
      block: 'nearest',
      behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto'
    });
  }

  function applyAccent(track) {
    const hex = track ? accentForTrack(track) : '#b39dff';
    const rgb = hexToRgb(hex) || [179, 157, 255];
    const alt = shiftHex(hex, 52, 0.04, 0.03);

    state.accentRgb = rgb;
    dom.root.style.setProperty('--accent', hex);
    dom.root.style.setProperty('--accent-rgb', rgb.join(' '));

    const nextLayer = ambientLayers[1 - state.activeAmbient];
    const previousLayer = ambientLayers[state.activeAmbient];
    const altRgb = hexToRgb(alt) || rgb;
    dom.root.style.setProperty('--accent-2', alt);
    dom.root.style.setProperty('--accent-2-rgb', altRgb.join(' '));
    dom.root.style.setProperty('--mini-tint-1', hex);
    dom.root.style.setProperty('--mini-tint-2', alt);
    nextLayer.style.setProperty('--glow-a', rgb.join(' '));
    nextLayer.style.setProperty('--glow-b', altRgb.join(' '));
    nextLayer.classList.add('is-visible');
    previousLayer.classList.remove('is-visible');
    state.activeAmbient = 1 - state.activeAmbient;

    const hue = track
      ? hashHue(`${track.album || ''}${track.title || ''}${track.artist || ''}`)
      : 266;
    dom.artFallback.style.setProperty('--hue', hue);

    if (!state.playing) drawIdleVisualizer();
  }

  function setMediaSessionMetadata(track, artworkUrl = null) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: artworkUrl
          ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
          : []
      });
    } catch {
      // Media Session is optional.
    }
  }

  function updateMediaMetadata(track) {
    if (!('mediaSession' in navigator)) return;
    const token = ++mediaMetadataToken;

    if (!track) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    setMediaSessionMetadata(track, null);
    const coverUrl = track.coverUrl;
    if (!coverUrl) return;

    if (mediaArtCache.has(coverUrl)) {
      setMediaSessionMetadata(track, mediaArtCache.get(coverUrl));
      return;
    }

    fetch(coverUrl)
      .then((response) => {
        if (!response.ok) throw new Error('cover');
        return response.blob();
      })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then((dataUrl) => {
        if (token !== mediaMetadataToken || state.currentId !== track.id) return;
        if (mediaArtCache.size > 40) {
          const firstKey = mediaArtCache.keys().next().value;
          mediaArtCache.delete(firstKey);
        }
        mediaArtCache.set(coverUrl, dataUrl);
        setMediaSessionMetadata(track, dataUrl);
      })
      .catch(() => {});
  }

  function updateNowPlaying(track) {
    if (!track) {
      setMarquee(dom.nowTitle, dom.nowTitleTrack, [dom.nowTitleText, dom.nowTitleGhost], '—', 'titleToken');
      dom.nowArtist.textContent = '—';
      dom.nowAlbum.textContent = '';
      dom.nowTitle.removeAttribute('title');
      dom.artFormat.textContent = 'AUDIO';
      dom.fallbackLetter.textContent = 'S';
      document.title = 'Simplex player';
      applyAccent(null);
      resetArtwork();
      updateMiniPlayer(null);
      updateMediaMetadata(null);
      updatePlaybackStateUI();
      updateTimeline();
      return;
    }

    setMarquee(dom.nowTitle, dom.nowTitleTrack, [dom.nowTitleText, dom.nowTitleGhost], track.title, 'titleToken');
    dom.nowTitle.title = track.title;
    dom.nowArtist.textContent = track.artist;
    dom.nowAlbum.textContent = track.album;
    dom.artFormat.textContent = track.format || 'AUDIO';
    dom.fallbackLetter.textContent = String(track.album || track.title || 'S').trim().charAt(0).toUpperCase() || 'S';
    document.title = `${track.title} · ${track.artist}`;

    applyAccent(track);
    setArtwork(track);
    updateMiniPlayer(track);
    updateMediaMetadata(track);
    updatePlaybackStateUI();
    updateTimeline();
  }

  function updateMiniPlayer(track) {
    if (!dom.miniPlayer) return;

    if (!track) {
      setMarquee(dom.miniTitleMask, dom.miniTitleTrack, [dom.miniTitle, dom.miniTitleGhost], 'Нет трека', 'miniTitleToken');
      dom.miniArtist.textContent = '—';
      dom.miniArtImg.classList.remove('is-visible');
      dom.miniArtImg.removeAttribute('src');
      dom.miniArtImg.removeAttribute('data-cover');
      dom.miniArtFallback.textContent = 'S';
      dom.miniProgressBar.style.width = '0%';
      dom.miniProgress.setAttribute('aria-valuenow', '0');
      return;
    }

    setMarquee(dom.miniTitleMask, dom.miniTitleTrack, [dom.miniTitle, dom.miniTitleGhost], track.title, 'miniTitleToken');
    dom.miniArtist.textContent = track.artist;

    const hue = hashHue(`${track.artist}${track.album}${track.title}`);
    dom.miniArtFallback.style.setProperty('--hue', hue);
    dom.miniArtFallback.textContent = String(track.album || track.title || '?').trim().charAt(0).toUpperCase() || '?';

    if (!track.coverUrl) {
      dom.miniArtImg.classList.remove('is-visible');
      dom.miniArtImg.removeAttribute('src');
      dom.miniArtImg.removeAttribute('data-cover');
      return;
    }

    if (dom.miniArtImg.dataset.cover === track.coverUrl) return;

    dom.miniArtImg.classList.remove('is-visible');
    dom.miniArtImg.dataset.cover = track.coverUrl;
    dom.miniArtImg.onload = () => dom.miniArtImg.classList.add('is-visible');
    dom.miniArtImg.onerror = () => dom.miniArtImg.classList.remove('is-visible');
    dom.miniArtImg.src = track.coverUrl;
    if (dom.miniArtImg.complete && dom.miniArtImg.naturalWidth > 0) dom.miniArtImg.onload();
  }

  function setArtwork(track) {
    const hue = hashHue(`${track.artist}${track.album}${track.title}`);
    dom.artFallback.style.setProperty('--hue', hue);

    if (!track.coverUrl) {
      state.artToken += 1;
      artImages.forEach((image) => {
        image.classList.remove('is-visible');
        image.removeAttribute('data-cover');
      });
      return;
    }

    const visible = artImages[state.activeArt];
    if (visible.dataset.cover === track.coverUrl && visible.classList.contains('is-visible')) return;

    const nextIndex = 1 - state.activeArt;
    const next = artImages[nextIndex];
    const previous = artImages[state.activeArt];
    const token = ++state.artToken;

    next.classList.remove('is-visible');
    next.dataset.cover = track.coverUrl;
    next.onload = () => {
      if (token !== state.artToken) return;
      next.classList.add('is-visible');
      previous.classList.remove('is-visible');
      state.activeArt = nextIndex;
    };
    next.onerror = () => {
      if (token !== state.artToken) return;
      next.classList.remove('is-visible');
    };
    next.src = track.coverUrl;
    if (next.complete && next.naturalWidth > 0) next.onload();
  }

  function resetArtwork() {
    state.artToken += 1;
    artImages.forEach((image) => {
      image.classList.remove('is-visible');
      image.removeAttribute('src');
      image.removeAttribute('data-cover');
    });
    state.activeArt = 0;
    dom.artFallback.style.setProperty('--hue', 266);
  }

  function getDuration() {
    const track = getCurrentTrack();
    const mediaDuration = Number(audio.duration);
    if (Number.isFinite(mediaDuration) && mediaDuration > 0) return mediaDuration;
    return Number(track?.duration) || 0;
  }

  function updateTimeline() {
    const track = getCurrentTrack();
    const duration = getDuration();
    const current = state.seekDragging
      ? state.seekPreview
      : clamp(Number(audio.currentTime) || 0, 0, duration || Number.MAX_SAFE_INTEGER);

    dom.seekSlider.max = String(duration > 0 ? duration : 1);
    if (!state.seekDragging) dom.seekSlider.value = String(current);
    setRangeFill(dom.seekSlider, current, duration > 0 ? duration : 1);
    dom.timeCurrent.textContent = formatTime(current);
    dom.timeTotal.textContent = duration > 0 ? formatTime(duration) : '0:00';
    dom.seekSlider.setAttribute('aria-valuetext', `${formatTime(current)} из ${formatTime(duration)}`);
    if (track) dom.seekSlider.removeAttribute('aria-disabled');
    else dom.seekSlider.setAttribute('aria-disabled', 'true');

    if (dom.miniProgressBar) {
      const percent = duration > 0 ? clamp((current / duration) * 100, 0, 100) : 0;
      dom.miniProgressBar.style.width = `${percent}%`;
      dom.miniProgress.setAttribute('aria-valuenow', String(Math.round(percent)));
    }
  }

  function updatePlaybackStateUI() {
    const track = getCurrentTrack();
    const playing = Boolean(track && state.playing);
    dom.body.classList.toggle('is-playing', playing);

    if (!track) {
      dom.nowStatusText.textContent = 'Нет трека';
    } else if (playing) {
      dom.nowStatusText.textContent = audio.readyState < 3 ? 'Загрузка' : 'Сейчас играет';
    } else if (audio.currentTime > 0.25) {
      dom.nowStatusText.textContent = 'Пауза';
    } else {
      dom.nowStatusText.textContent = 'Выбран трек';
    }

    dom.playBtn.setAttribute('aria-label', playing ? 'Пауза' : 'Играть');
    setTooltip(dom.playBtn, playing ? 'Пауза — Space' : 'Играть — Space');
    const viewCount = getViewTracks().length;
    dom.playBtn.disabled = !track && viewCount === 0;
    dom.prevBtn.disabled = viewCount === 0;
    dom.nextBtn.disabled = viewCount === 0;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = track ? (playing ? 'playing' : 'paused') : 'none';
    }
  }

  function updateVolumeUI() {
    const volume = clamp(Number(audio.volume) || 0, 0, 1);
    const muted = audio.muted || volume === 0;
    dom.volumeSlider.value = String(volume);
    setRangeFill(dom.volumeSlider, volume, 1);
    setIcon(dom.muteBtn, muted ? 'i-volume-mute' : volume < 0.48 ? 'i-volume-low' : 'i-volume');
    dom.muteBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    setTooltip(dom.muteBtn, muted ? 'Включить звук — M' : 'Выключить звук — M');
    if (dom.volumeValue) dom.volumeValue.textContent = muted ? '0' : String(Math.round(volume * 100));
    if (dom.miniVolume) {
      dom.miniVolume.value = String(volume);
      setRangeFill(dom.miniVolume, volume, 1);
    }
    if (dom.miniVolumeValue) dom.miniVolumeValue.textContent = muted ? '0' : String(Math.round(volume * 100));
    if (dom.miniMute) {
      setIcon(dom.miniMute, muted ? 'i-volume-mute' : volume < 0.48 ? 'i-volume-low' : 'i-volume');
      dom.miniMute.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    }
  }

  function updateShuffleRepeatUI() {
    dom.shuffleBtn.classList.toggle('is-active', state.shuffle);
    dom.shuffleBtn.setAttribute('aria-pressed', state.shuffle ? 'true' : 'false');
    setTooltip(dom.shuffleBtn, state.shuffle ? 'Перемешивание включено — S' : 'Перемешать — S');

    dom.repeatBtn.classList.toggle('is-active', state.repeat !== 'off');
    dom.repeatBtn.classList.toggle('is-one', state.repeat === 'one');
    dom.repeatBtn.setAttribute('aria-pressed', state.repeat !== 'off' ? 'true' : 'false');
    const label = state.repeat === 'one'
      ? 'Повтор одного трека'
      : state.repeat === 'all'
        ? 'Повтор всей очереди'
        : 'Повтор выключен';
    dom.repeatBtn.setAttribute('aria-label', label);
    setTooltip(dom.repeatBtn, `${label} — R`);
  }

  function applySettings(settings = {}) {
    const volume = Number.isFinite(Number(settings.volume)) ? clamp(Number(settings.volume), 0, 1) : 0.78;
    audio.volume = volume;
    audio.muted = Boolean(settings.muted);
    state.shuffle = Boolean(settings.shuffle);
    state.repeat = ['off', 'all', 'one'].includes(settings.repeat) ? settings.repeat : 'off';
    state.sortMode = ['file', 'title', 'artist'].includes(settings.sortMode) ? settings.sortMode : 'file';
    state.sortAsc = true;
    state.playlistGrid = true;
    state.activePlaylistId = null;
    state.lastVolume = volume > 0.01 ? volume : 0.78;
    updateVolumeUI();
    updateShuffleRepeatUI();
    updateSortUI();
  }

  function toggleMute() {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      if (audio.volume === 0) audio.volume = state.lastVolume || 0.6;
    } else {
      state.lastVolume = audio.volume;
      audio.muted = true;
    }
    updateVolumeUI();
    persistSettingsSoon();
  }

  function cycleRepeat() {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    updateShuffleRepeatUI();
    persistSettingsSoon();
  }

  function ensureAudioGraph() {
    if (audioContext) {
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      audioContext = new AudioContextClass();
      sourceNode = audioContext.createMediaElementSource(audio);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      sourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      setupVisualizerCanvas();
      audioContext.resume().catch(() => {});
    } catch {
      audioContext = null;
      analyser = null;
      sourceNode = null;
      frequencyData = null;
    }
  }

  function setupVisualizerCanvas() {
    const canvas = dom.visualizer;
    if (!canvas) return;
    const width = canvas.clientWidth || 98;
    const height = canvas.clientHeight || 22;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    visualizerDpr = dpr;
    visualizerCtx = canvas.getContext('2d');
    if (visualizerCtx) {
      visualizerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function drawVisualizerBars(values) {
    const canvas = dom.visualizer;
    if (!canvas) return;
    if (!visualizerCtx) setupVisualizerCanvas();
    const ctx = visualizerCtx;
    if (!ctx) return;

    const width = canvas.clientWidth || 98;
    const height = canvas.clientHeight || 22;
    ctx.clearRect(0, 0, width, height);

    const count = values.length;
    const gap = 2.25;
    const barWidth = Math.max(1.5, (width - gap * (count - 1)) / count);
    const [r, g, b] = state.accentRgb;

    for (let i = 0; i < count; i += 1) {
      const value = clamp(values[i], 0, 1);
      const barHeight = Math.max(2, value * height * 0.86);
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;
      const alpha = 0.18 + value * 0.7;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    }
  }

  function drawIdleVisualizer() {
    setupVisualizerCanvas();
    const idle = [0.1, 0.22, 0.12, 0.3, 0.16, 0.34, 0.2, 0.12, 0.25, 0.15, 0.3, 0.12, 0.2, 0.14, 0.26, 0.1, 0.18, 0.08];
    drawVisualizerBars(idle);
  }

  function startVisualizer() {
    if (visualizerFrame) cancelAnimationFrame(visualizerFrame);
    if (!analyser || !frequencyData) {
      drawIdleVisualizer();
      return;
    }
    setupVisualizerCanvas();

    const draw = () => {
      analyser.getByteFrequencyData(frequencyData);
      for (let i = 0; i < state.vizHeights.length; i += 1) {
        const normalized = i / (state.vizHeights.length - 1);
        const bin = Math.min(
          frequencyData.length - 1,
          Math.max(1, Math.floor(Math.pow(normalized, 1.55) * frequencyData.length * 0.72))
        );
        const target = Math.min(1, Math.pow(frequencyData[bin] / 255, 0.92) * 1.45);
        state.vizHeights[i] += (target - state.vizHeights[i]) * 0.38;
      }
      drawVisualizerBars(state.vizHeights);
      visualizerFrame = requestAnimationFrame(draw);
    };

    draw();
  }

  function stopVisualizer() {
    if (visualizerFrame) {
      cancelAnimationFrame(visualizerFrame);
      visualizerFrame = null;
    }
    state.vizHeights.fill(0);
    drawIdleVisualizer();
  }

  function handleAudioPlay() {
    state.playing = true;
    dom.body.classList.add('is-playing');
    updatePlaybackStateUI();
    updateMediaSessionPosition();
    startVisualizer();
    persistSettings(600);
  }

  function handleAudioPause() {
    state.playing = false;
    dom.body.classList.remove('is-playing');
    updatePlaybackStateUI();
    stopVisualizer();
    persistSettingsSoon();
  }

  function handleAudioError() {
    if (!state.currentId || !audio.src) return;
    const track = getCurrentTrack();
    state.playing = false;
    dom.body.classList.remove('is-playing');
    updatePlaybackStateUI();
    showToast(
      track
        ? `Не удалось воспроизвести «${track.title}». Возможно, формат не поддерживается.`
        : 'Не удалось воспроизвести трек',
      { type: 'error', duration: 4600 }
    );
  }

  function handleLoadedMetadata() {
    const track = getCurrentTrack();
    if (track && state.pendingRestore > 0) {
      const duration = Number(audio.duration);
      const target = Number.isFinite(duration) && duration > 0
        ? Math.min(state.pendingRestore, Math.max(0, duration - 0.15))
        : state.pendingRestore;
      try {
        audio.currentTime = target;
      } catch {
        // Ignore seek failures for unusual containers.
      }
      state.pendingRestore = 0;
    }

    if (track) {
      const mediaDuration = Number(audio.duration);
      if (Number.isFinite(mediaDuration) && mediaDuration > 0 && Math.abs((track.duration || 0) - mediaDuration) > 0.5) {
        track.duration = mediaDuration;
        renderQueue();
        syncActiveRows();
      }
    }

    updateTimeline();
    updateMediaSessionPosition();
  }

  function handleTimeUpdate() {
    if (!state.seekDragging) updateTimeline();

    if (Math.abs(audio.currentTime - state.lastPersistAt) >= 4) {
      state.lastPersistAt = audio.currentTime;
      persistSettings(900);
    }

    const now = performance.now();
    if (now - (handleTimeUpdate.lastMediaUpdate || 0) > 950) {
      handleTimeUpdate.lastMediaUpdate = now;
      updateMediaSessionPosition();
    }
  }

  function updateMediaSessionPosition() {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;
    const duration = getDuration();
    if (!duration || !getCurrentTrack()) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: audio.playbackRate || 1,
        position: clamp(audio.currentTime, 0, duration)
      });
    } catch {
      // Position state is best-effort.
    }
  }

  function loadTrack(track, options = {}) {
    if (!track) return;
    const changed = state.currentId !== track.id;
    const autoplay = Boolean(options.autoplay);
    const restoreTime = Math.max(0, Number(options.restoreTime) || 0);
    const initial = Boolean(options.initial);

    state.currentId = track.id;

    if (changed) {
      state.playing = false;
      dom.body.classList.remove('is-playing');
      audio.pause();
      state.pendingRestore = restoreTime;
      audio.src = track.audioUrl;
      audio.load();
      updateNowPlaying(track);
      syncActiveRows();
      scrollRowIntoView(track.id, true);
      if (!initial) persistSettingsSoon();
    } else {
      updateNowPlaying(track);
      syncActiveRows();
    }

    updatePlaybackStateUI();
    updateTimeline();

    if (autoplay) {
      ensureAudioGraph();
      requestPlay();
    }
  }

  function requestPlay() {
    const track = getCurrentTrack();
    if (!track) {
      const view = getViewTracks();
      if (view.length > 0) loadTrack(view[0], { autoplay: true });
      return;
    }

    if (!audio.src) {
      loadTrack(track, { autoplay: true });
      return;
    }

    const duration = getDuration();
    if (audio.ended || (duration > 0 && audio.currentTime >= duration - 0.05)) {
      audio.currentTime = 0;
    }

    ensureAudioGraph();
    const promise = audio.play();
    if (promise?.catch) {
      promise.catch((error) => {
        if (error?.name === 'AbortError') return;
        state.playing = false;
        dom.body.classList.remove('is-playing');
        updatePlaybackStateUI();
        showToast('Не удалось запустить воспроизведение. Попробуйте другой формат или файл.', { type: 'error' });
      });
    }
  }

  function togglePlay() {
    if (!state.tracks.length) return;
    if (!state.currentId) {
      loadTrack(state.filtered[0] || getViewTracks()[0], { autoplay: true });
      return;
    }
    if (audio.paused) requestPlay();
    else audio.pause();
  }

  function nextTrack(autoplay = state.playing) {
    const view = getViewTracks();
    if (!view.length) return;
    if (!state.currentId) {
      loadTrack(view[0], { autoplay: true });
      return;
    }

    const currentIndex = view.findIndex((track) => track.id === state.currentId);
    let nextIndex = 0;

    if (state.shuffle && view.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * view.length);
      } while (nextIndex === currentIndex);
    } else if (currentIndex === -1) {
      nextIndex = 0;
    } else {
      nextIndex = (currentIndex + 1) % view.length;
    }

    loadTrack(view[nextIndex], { autoplay });
  }

  function previousTrack(autoplay = state.playing) {
    const view = getViewTracks();
    if (!view.length) return;
    if (!state.currentId) {
      loadTrack(view[0], { autoplay: true });
      return;
    }

    if (audio.currentTime > 3) {
      seekTo(0);
      return;
    }

    const currentIndex = view.findIndex((track) => track.id === state.currentId);
    let previousIndex = view.length - 1;

    if (state.shuffle && view.length > 1) {
      do {
        previousIndex = Math.floor(Math.random() * view.length);
      } while (previousIndex === currentIndex);
    } else {
      const startIndex = currentIndex === -1 ? 0 : currentIndex;
      previousIndex = (startIndex - 1 + view.length) % view.length;
    }

    loadTrack(view[previousIndex], { autoplay });
  }

  function seekTo(seconds) {
    const duration = getDuration();
    if (!duration) return;
    const target = clamp(Number(seconds) || 0, 0, duration);
    try {
      audio.currentTime = target;
    } catch {
      return;
    }
    state.pendingRestore = 0;
    updateTimeline();
    updateMediaSessionPosition();
    persistSettingsSoon();
  }

  function handleAudioEnded() {
    state.playing = false;
    dom.body.classList.remove('is-playing');
    updatePlaybackStateUI();
    stopVisualizer();

    const view = getViewTracks();
    if (!state.currentId || !view.length) return;

    if (state.repeat === 'one') {
      seekTo(0);
      requestPlay();
      return;
    }

    const currentIndex = view.findIndex((track) => track.id === state.currentId);
    if (state.shuffle && view.length > 1) {
      let nextIndex = currentIndex;
      while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * view.length);
      loadTrack(view[nextIndex], { autoplay: true });
      return;
    }

    if (currentIndex >= 0 && currentIndex < view.length - 1) {
      loadTrack(view[currentIndex + 1], { autoplay: true });
      return;
    }

    if (state.repeat === 'all') {
      loadTrack(view[0], { autoplay: true });
      return;
    }

    try {
      audio.currentTime = 0;
    } catch {
      // Ignore.
    }
    updateTimeline();
    updateMediaSessionPosition();
  }

  function setScanUI(active, payload = {}) {
    clearTimeout(scanFinishTimer);
    dom.scanLine.classList.toggle('is-visible', active);
    dom.scanBanner.hidden = !active;
    dom.addBtn.disabled = active;
    dom.addBtn.classList.toggle('is-busy', active);

    if (!active) {
      dom.scanBar.parentElement.classList.remove('is-indeterminate');
      dom.scanBar.style.width = '0%';
      dom.scanCount.textContent = '';
      return;
    }

    if (payload.phase === 'scan') {
      dom.scanText.textContent = 'Сканируем папки';
      dom.scanCount.textContent = '';
      dom.scanBar.parentElement.classList.add('is-indeterminate');
      dom.scanBar.style.width = '34%';
      return;
    }

    dom.scanBar.parentElement.classList.remove('is-indeterminate');
    dom.scanText.textContent = 'Читаем метаданные';
    const total = Number(payload.total) || 0;
    const done = Number(payload.done) || 0;
    dom.scanCount.textContent = total ? `${done} / ${total}` : '';
    const percent = total ? clamp((done / total) * 100, 2, 100) : 0;
    dom.scanBar.style.width = `${percent}%`;
  }

  async function chooseFolder() {
    if (!bridge || state.scanning) {
      if (state.scanning) showToast('Музыка уже добавляется, подождите немного');
      return;
    }
    setAddMenu(false);
    try {
      const paths = await bridge.pickFolders();
      if (paths?.length) await addPaths(paths);
    } catch {
      showToast('Не удалось открыть выбор папки', { type: 'error' });
    }
  }

  async function chooseFiles() {
    if (!bridge || state.scanning) {
      if (state.scanning) showToast('Музыка уже добавляется, подождите немного');
      return;
    }
    setAddMenu(false);
    try {
      const paths = await bridge.pickFiles();
      if (paths?.length) await addPaths(paths);
    } catch {
      showToast('Не удалось открыть выбор файлов', { type: 'error' });
    }
  }

  async function ensureDefaultPlaylist(trackIds) {
    if (!bridge || !trackIds.length) return null;
    const existing = state.playlists.find((playlist) => playlist.name.trim().toLowerCase() === 'default');
    try {
      const result = existing
        ? await bridge.addPlaylistTracks(existing.id, trackIds)
        : await bridge.createPlaylist('Default', trackIds);
      if (result && !result.error) {
        applyPlaylistResult(result);
        return result.playlist || existing;
      }
    } catch {
      // Playlist sync is best-effort; the library still has the tracks.
    }
    return null;
  }

  async function addPaths(paths, options = {}) {
    const autoPlaylist = options.autoPlaylist !== false;
    const notify = options.notify !== false;
    if (!bridge || !Array.isArray(paths) || paths.length === 0) return null;
    if (state.scanning) {
      if (notify) showToast('Музыка уже добавляется, подождите немного');
      return null;
    }

    state.scanning = true;
    setScanUI(true, { phase: 'scan' });

    try {
      const result = await bridge.addPaths(paths);
      if (result?.error) {
        if (notify) {
          showToast(result.error === 'busy' ? 'Сканирование уже выполняется' : 'Не удалось добавить музыку', { type: 'error' });
        }
        return null;
      }

      const added = Array.isArray(result?.added) ? result.added : [];
      state.tracks = Array.isArray(result?.tracks) ? result.tracks : [];

      if (autoPlaylist && added.length) {
        const activePlaylist = getActivePlaylist();
        if (activePlaylist) {
          try {
            const appended = await bridge.addPlaylistTracks(activePlaylist.id, added.map((track) => track.id));
            if (appended && !appended.error) applyPlaylistResult(appended);
          } catch {
            // Playlist sync is best-effort; the library still has the tracks.
          }
        } else {
          await ensureDefaultPlaylist(added.map((track) => track.id));
        }
      }

      setView();
      renderQueue();

      if (!state.currentId && state.tracks.length) {
        loadTrack(added[0] || state.tracks[0], { autoplay: true });
      } else if (state.currentId && !state.tracks.some((track) => track.id === state.currentId)) {
        loadTrack(state.tracks[0] || null, { autoplay: false });
      } else {
        syncActiveRows();
      }

      if (notify) {
        if (added.length) {
          const skipped = Number(result.skippedCount) || 0;
          const message = `Добавлено ${added.length} ${plural(added.length, ['трек', 'трека', 'треков'])}${skipped ? ` · ${skipped} уже в очереди` : ''}`;
          showToast(message, { type: 'success', duration: 3000 });
          setTimeout(() => scrollRowIntoView(added[0].id, true), 90);
        } else if (!result.scannedCount) {
          showToast('В выбранных папках не нашлось аудиофайлов', { type: 'error' });
        } else {
          showToast('Эти треки уже есть в очереди');
        }
      }

      return {
        added,
        skippedCount: Number(result.skippedCount) || 0,
        scannedCount: Number(result.scannedCount) || 0
      };
    } catch {
      if (notify) showToast('Не удалось добавить музыку. Проверьте доступ к папке.', { type: 'error', duration: 4200 });
      return null;
    } finally {
      state.scanning = false;
      setScanUI(false);
    }
  }

  function clearCurrentUI() {
    state.currentId = null;
    state.playing = false;
    dom.body.classList.remove('is-playing');
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    updateNowPlaying(null);
    syncActiveRows();
  }

  function resetClearButton() {
    clearTimeout(clearArmTimer);
    clearArmTimer = null;
    if (!dom.clearBtn) return;
    dom.clearBtn.classList.remove('is-arming');
    dom.clearBtn.textContent = 'Очистить';
    dom.clearBtn.setAttribute('aria-label', 'Очистить очередь');
  }

  async function handleClearClick() {
    if (!bridge || !state.tracks.length) return;

    if (!dom.clearBtn.classList.contains('is-arming')) {
      dom.clearBtn.classList.add('is-arming');
      dom.clearBtn.textContent = 'Удалить всё?';
      dom.clearBtn.setAttribute('aria-label', 'Нажмите ещё раз, чтобы очистить очередь');
      clearTimeout(clearArmTimer);
      clearArmTimer = setTimeout(resetClearButton, 3200);
      return;
    }

    resetClearButton();
    dom.clearBtn.disabled = true;
    try {
      const result = await bridge.clearLibrary();
      state.tracks = Array.isArray(result?.tracks) ? result.tracks : [];
      applyPlaylistResult(result);
      setView();
      renderQueue();
      clearCurrentUI();
      persistSettingsSoon();
      showToast('Очередь очищена', { duration: 2400 });
    } catch {
      showToast('Не удалось очистить очередь', { type: 'error' });
    } finally {
      dom.clearBtn.disabled = false;
    }
  }

  async function removeTrack(trackId) {
    if (!bridge || !trackId) return;
    const index = state.tracks.findIndex((track) => track.id === trackId);
    if (index === -1) return;

    const wasCurrent = state.currentId === trackId;
    const wasPlaying = state.playing;

    if (wasCurrent) {
      state.playing = false;
      dom.body.classList.remove('is-playing');
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      state.currentId = null;
    }

    try {
      const result = await bridge.removeTrack(trackId);
      if (!result?.removed) {
        showToast('Не удалось убрать трек', { type: 'error' });
        return;
      }

      state.tracks = Array.isArray(result.tracks) ? result.tracks : [];
      applyPlaylistResult(result);
      setView();
      renderQueue();

      if (wasCurrent && state.tracks.length) {
        const next = state.tracks[Math.min(index, state.tracks.length - 1)];
        loadTrack(next, { autoplay: wasPlaying });
      } else if (!state.tracks.length) {
        clearCurrentUI();
      } else {
        syncActiveRows();
      }

      persistSettingsSoon();
      showToast('Трек убран из библиотеки', { duration: 2200 });
    } catch {
      showToast('Не удалось убрать трек из библиотеки', { type: 'error' });
    }
  }

  function setAddMenu(open) {
    if (open) {
      closeContextMenu();
      closePlaylistMenu();
      closeTrackPlaylistMenu();
      dom.addMenu.hidden = false;
      const anchor = dom.addBtn.getBoundingClientRect();
      const menuWidth = dom.addMenu.offsetWidth;
      const menuHeight = dom.addMenu.offsetHeight;
      const padding = 12;
      const left = clamp(anchor.right - menuWidth, padding, Math.max(padding, window.innerWidth - menuWidth - padding));
      let top = anchor.bottom + 9;
      if (top + menuHeight > window.innerHeight - padding) {
        top = Math.max(padding, anchor.top - menuHeight - 9);
      }
      dom.addMenu.style.left = `${left}px`;
      dom.addMenu.style.top = `${top}px`;
    } else {
      dom.addMenu.hidden = true;
    }
    dom.addBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeContextMenu() {
    dom.contextMenu.hidden = true;
    state.contextTrackId = null;
  }

  function openContextMenu(trackId, x, y) {
    const track = state.tracks.find((item) => item.id === trackId);
    if (!track) return;

    closeContextMenu();
    closeTrackPlaylistMenu();
    setAddMenu(false);
    state.contextTrackId = trackId;

    const playAction = dom.contextMenu.querySelector('[data-action="play"]');
    const isPlayingCurrent = state.currentId === trackId && state.playing;
    const label = playAction?.querySelector('span');
    if (label) label.textContent = isPlayingCurrent ? 'Пауза' : 'Играть';
    setIcon(playAction, isPlayingCurrent ? 'i-pause' : 'i-play');

    const removeLabel = dom.contextMenu.querySelector('[data-action="remove"] span');
    if (removeLabel) {
      removeLabel.textContent = getActivePlaylist() ? 'Убрать из плейлиста' : 'Убрать из библиотеки';
    }

    dom.contextMenu.hidden = false;
    dom.contextMenu.style.left = '0px';
    dom.contextMenu.style.top = '0px';
    const rect = dom.contextMenu.getBoundingClientRect();
    const padding = 12;
    const left = clamp(x, padding, window.innerWidth - rect.width - padding);
    const top = clamp(y, padding, window.innerHeight - rect.height - padding);
    dom.contextMenu.style.left = `${left}px`;
    dom.contextMenu.style.top = `${top}px`;
  }

  function clearSearch() {
    state.search = '';
    dom.searchInput.value = '';
    dom.searchClear.hidden = true;
    renderQueue();
    dom.searchInput.focus();
  }

  function handleQueueKeys(event) {
    if (state.editingPlaylist) return;
    const row = event.target.closest('.queue-row');
    if (!row) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    const track = state.tracks.find((item) => item.id === row.dataset.trackId);
    if (!track) return;
    if (state.currentId === track.id) togglePlay();
    else loadTrack(track, { autoplay: true });
  }

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
      play: () => requestPlay(),
      pause: () => audio.pause(),
      previoustrack: () => previousTrack(state.playing),
      nexttrack: () => nextTrack(state.playing),
      stop: () => {
        audio.pause();
        seekTo(0);
      },
      seekbackward: (details) => seekTo(audio.currentTime - (details?.seekOffset || 10)),
      seekforward: (details) => seekTo(audio.currentTime + (details?.seekOffset || 10)),
      seekto: (details) => {
        if (Number.isFinite(details?.seekTime)) seekTo(details.seekTime);
      }
    };

    Object.entries(handlers).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some actions are not supported on every platform.
      }
    });
  }

  function setVolume(value) {
    const volume = clamp(Number(value) || 0, 0, 1);
    audio.volume = volume;
    audio.muted = volume === 0;
    if (volume > 0) state.lastVolume = volume;
    updateVolumeUI();
    persistSettingsSoon();
  }

  function seekBy(seconds) {
    seekTo(audio.currentTime + seconds);
  }

  function bindStaticEvents() {
    dom.addBtn.addEventListener('click', () => {
      if (state.scanning) return;
      setAddMenu(dom.addMenu.hidden);
    });

    dom.queueBack?.addEventListener('click', showPlaylistsView);

    dom.playlistEmptyAdd?.addEventListener('click', () => {
      const playlist = getActivePlaylist();
      if (playlist) chooseFilesForPlaylist(playlist.id);
    });

    dom.playlistGrid?.addEventListener('click', (event) => {
      if (event.target.closest('.playlist-tile-add')) {
        openPlaylistModal('create');
        return;
      }
      const tile = event.target.closest('.playlist-tile');
      if (!tile) return;
      const playlistId = tile.dataset.playlistId;
      if (playlistId) openPlaylistView(playlistId);
    });

    dom.playlistGrid?.addEventListener('contextmenu', (event) => {
      const tile = event.target.closest('.playlist-tile');
      if (!tile || !tile.dataset.playlistId) return;
      event.preventDefault();
      openPlaylistMenu(tile.dataset.playlistId, { x: event.clientX, y: event.clientY });
    });

    dom.createOptions?.addEventListener('click', async (event) => {
      const option = event.target.closest('[data-create-source]');
      if (!option || option.classList.contains('is-disabled') || state.modalMode !== 'create') return;
      const source = option.dataset.createSource;

      if (source === 'files' || source === 'folder') {
        if (!bridge || state.scanning) return;
        try {
          const paths = source === 'folder' ? await bridge.pickFolders() : await bridge.pickFiles();
          if (!paths?.length) return;
          state.modalPaths = paths;
          state.modalPathKind = source;
          state.modalSource = source;
          if (!dom.nameInput.value.trim()) {
            dom.nameInput.value = source === 'folder' ? folderLabel(paths[0]) : fileLabel(paths[0]);
          }
          renderCreateOptions();
          updatePickerState();
          dom.nameInput.focus();
        } catch {
          showToast('Не удалось открыть проводник', { type: 'error' });
        }
        return;
      }

      state.modalSource = 'empty';
      state.modalPaths = [];
      renderCreateOptions();
      updatePickerState();
    });

    dom.playlistMore?.addEventListener('click', togglePlaylistMenu);
    dom.playlistEdit?.addEventListener('click', togglePlaylistEditing);

    dom.playlistMenu?.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-playlist-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.playlistAction;
      const playlistId = state.playlistMenuId;
      closePlaylistMenu();
      if (!playlistId) return;
      if (action === 'files') chooseFilesForPlaylist(playlistId);
      else if (action === 'rename') openPlaylistModal('rename', playlistId);
      else if (action === 'delete') openPlaylistModal('delete', playlistId);
      else if (action === 'edit') {
        if (state.activePlaylistId !== playlistId) openPlaylistView(playlistId);
        setPlaylistEditing(true);
      }
    });

    dom.modalClose?.addEventListener('click', closePlaylistModal);
    dom.modalCancel?.addEventListener('click', closePlaylistModal);
    dom.modalConfirm?.addEventListener('click', submitPlaylistModal);

    dom.playlistModal?.addEventListener('pointerdown', (event) => {
      if (event.target === dom.playlistModal) closePlaylistModal();
    });

    dom.nameInput?.addEventListener('input', () => {
      dom.nameField.classList.remove('is-invalid');
      updatePickerState();
    });

    dom.nameInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      submitPlaylistModal();
    });

    $$('[data-pick]').forEach((button) => {
      button.addEventListener('click', () => {
        const kind = button.dataset.pick;
        if (kind === 'folder') chooseFolder();
        else chooseFiles();
      });
    });

    $('#empty-drop')?.addEventListener('click', chooseFolder);

    document.addEventListener('pointerdown', (event) => {
      if (!dom.addMenu.hidden && !event.target.closest('#add-menu') && !event.target.closest('#add-btn')) setAddMenu(false);
      if (dom.sortMenu && !dom.sortMenu.hidden && !event.target.closest('#sort-field')) setSortMenu(false);
      if (!dom.contextMenu.hidden && !event.target.closest('#context-menu')) closeContextMenu();
      if (dom.playlistMenu && !dom.playlistMenu.hidden && !event.target.closest('#playlist-menu')) closePlaylistMenu();
      if (dom.trackPlaylistMenu && !dom.trackPlaylistMenu.hidden && !event.target.closest('#track-playlist-menu')) closeTrackPlaylistMenu();
      if (dom.clearBtn.classList.contains('is-arming') && !event.target.closest('#clear-library')) {
        resetClearButton();
      }
    });

    dom.searchInput.addEventListener('input', () => {
      state.search = dom.searchInput.value;
      dom.searchClear.hidden = !state.search;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderQueue, 70);
    });

    dom.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (dom.searchInput.value) clearSearch();
        else dom.searchInput.blur();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (state.playlistGrid) {
          const query = state.search.trim().toLowerCase();
          const match = state.playlists.find((playlist) => playlist.name.toLowerCase().includes(query));
          if (match) openPlaylistView(match.id);
          return;
        }
        const first = state.filtered[0] || getViewTracks()[0];
        if (first) loadTrack(first, { autoplay: true });
      }
    });

    dom.searchClear.addEventListener('click', clearSearch);
    dom.resetSearch.addEventListener('click', clearSearch);
    dom.sortTrigger?.addEventListener('click', toggleSortMenu);

    dom.sortTrigger?.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setSortMenu(true, { focusOption: true });
      } else if (event.key === 'Escape') {
        setSortMenu(false);
      }
    });

    dom.sortMenu?.addEventListener('click', (event) => {
      const option = event.target.closest('.sort-option');
      if (!option) return;
      setSort(option.dataset.sort);
      setSortMenu(false);
      dom.sortTrigger?.focus();
    });

    dom.sortMenu?.addEventListener('keydown', (event) => {
      const options = $$('.sort-option', dom.sortMenu);
      if (!options.length) return;
      const current = options.indexOf(document.activeElement);

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const next = current === -1 ? 0 : (current + step + options.length) % options.length;
        options[next].focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        options[event.key === 'Home' ? 0 : options.length - 1].focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setSortMenu(false, { restoreFocus: true });
      } else if (event.key === 'Tab') {
        setSortMenu(false);
      }
    });

    dom.clearBtn.addEventListener('click', handleClearClick);

    dom.playBtn.addEventListener('click', togglePlay);
    dom.nextBtn.addEventListener('click', () => nextTrack(state.playing));
    dom.prevBtn.addEventListener('click', () => previousTrack(state.playing));
    dom.shuffleBtn.addEventListener('click', () => {
      state.shuffle = !state.shuffle;
      updateShuffleRepeatUI();
      persistSettingsSoon();
    });
    dom.repeatBtn.addEventListener('click', cycleRepeat);
    dom.muteBtn.addEventListener('click', toggleMute);

    dom.volumeSlider.addEventListener('input', () => {
      setVolume(Number(dom.volumeSlider.value));
    });

    dom.seekSlider.addEventListener('pointerdown', () => {
      state.seekDragging = true;
      state.seekPreview = Number(dom.seekSlider.value) || 0;
      dom.seekSlider.classList.add('is-dragging');
    });

    dom.seekSlider.addEventListener('input', () => {
      const value = Number(dom.seekSlider.value) || 0;
      if (state.seekDragging) {
        state.seekPreview = value;
        updateTimeline();
      } else {
        seekTo(value);
      }
    });

    dom.seekSlider.addEventListener('change', () => {
      seekTo(Number(dom.seekSlider.value) || 0);
      state.seekDragging = false;
      dom.seekSlider.classList.remove('is-dragging');
      updateTimeline();
    });

    window.addEventListener('pointerup', () => {
      if (!state.seekDragging) return;
      seekTo(Number(dom.seekSlider.value) || 0);
      state.seekDragging = false;
      dom.seekSlider.classList.remove('is-dragging');
      updateTimeline();
    });

    dom.queueList.addEventListener('click', (event) => {
      const remove = event.target.closest('.q-remove');
      if (remove) {
        event.stopPropagation();
        const row = remove.closest('.queue-row');
        if (row) removeFromPlaylist(row.dataset.trackId);
        return;
      }

      const more = event.target.closest('.q-more');
      if (more) {
        event.stopPropagation();
        const row = more.closest('.queue-row');
        if (!row) return;
        const rect = more.getBoundingClientRect();
        openContextMenu(row.dataset.trackId, rect.right - 6, rect.bottom + 5);
        return;
      }

      if (state.editingPlaylist) return;

      const row = event.target.closest('.queue-row');
      if (!row) return;
      const track = state.tracks.find((item) => item.id === row.dataset.trackId);
      if (!track) return;
      if (state.currentId === track.id) togglePlay();
      else loadTrack(track, { autoplay: true });
    });

    dom.queueList.addEventListener('dragstart', (event) => {
      if (state.playlistGrid || !getActivePlaylist() || state.sortMode !== 'file' || state.search.trim()) {
        event.preventDefault();
        return;
      }
      const row = event.target.closest('.queue-row');
      if (!row || !row.dataset.trackId) return;
      state.draggingTrackId = row.dataset.trackId;
      row.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData('text/plain', state.draggingTrackId);
        } catch {
          // Data transfer is optional.
        }
      }
    });

    dom.queueList.addEventListener('dragover', (event) => {
      if (state.playlistGrid || !state.draggingTrackId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

      const dragging = Array.from(dom.queueList.querySelectorAll('.queue-row'))
        .find((item) => item.dataset.trackId === state.draggingTrackId);
      if (!dragging) return;

      const row = event.target.closest('.queue-row');
      if (!row) {
        if (dom.queueList.lastElementChild !== dragging) dom.queueList.appendChild(dragging);
        return;
      }
      if (row === dragging) return;

      const rect = row.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      if (before) row.before(dragging);
      else row.after(dragging);
    });

    dom.queueList.addEventListener('drop', (event) => {
      if (state.draggingTrackId) event.preventDefault();
    });

    dom.queueList.addEventListener('dragend', () => {
      const dragging = dom.queueList.querySelector('.queue-row.is-dragging');
      if (dragging) dragging.classList.remove('is-dragging');
      const trackId = state.draggingTrackId;
      state.draggingTrackId = null;
      if (!trackId) return;
      persistPlaylistOrder();
    });

    dom.queueList.addEventListener('keydown', handleQueueKeys);

    dom.queueList.addEventListener('contextmenu', (event) => {
      const row = event.target.closest('.queue-row');
      if (!row) return;
      event.preventDefault();
      openContextMenu(row.dataset.trackId, event.clientX, event.clientY);
    });

    dom.queueList.addEventListener('error', (event) => {
      if (event.target instanceof HTMLImageElement) event.target.remove();
    }, true);

    dom.queueScroll.addEventListener('scroll', () => {
      closeContextMenu();
      closePlaylistMenu();
      closeTrackPlaylistMenu();
    }, { passive: true });

    dom.contextMenu.addEventListener('click', async (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.action;
      const trackId = state.contextTrackId;
      const actionRect = actionButton.getBoundingClientRect();
      closeContextMenu();
      if (!trackId) return;

      const track = state.tracks.find((item) => item.id === trackId);
      if (!track) return;

      if (action === 'play') {
        if (state.currentId === trackId) togglePlay();
        else loadTrack(track, { autoplay: true });
      } else if (action === 'add-to-playlist') {
        openTrackPlaylistMenu(trackId, actionRect.left, actionRect.bottom + 3);
      } else if (action === 'reveal') {
        const revealed = await bridge.revealTrack(trackId);
        if (!revealed) showToast('Файл не найден на диске', { type: 'error' });
      } else if (action === 'remove') {
        if (getActivePlaylist()) removeFromPlaylist(trackId);
        else removeTrack(trackId);
      }
    });

    dom.trackPlaylistMenu?.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-target-playlist]');
      if (!target || target.disabled) return;
      const playlistId = target.dataset.targetPlaylist;
      const trackId = state.trackMenuTrackId;
      closeTrackPlaylistMenu();
      if (!playlistId || !trackId) return;
      try {
        const result = await bridge.addPlaylistTracks(playlistId, [trackId]);
        if (!result || result.error) {
          showToast('Не удалось добавить трек в плейлист', { type: 'error' });
          return;
        }
        applyPlaylistResult(result);
        const playlist = result.playlist || state.playlists.find((item) => item.id === playlistId);
        renderQueue();
        showToast(`Добавлено в «${playlist?.name || 'плейлист'}»`, { type: 'success', duration: 2400 });
      } catch {
        showToast('Не удалось добавить трек в плейлист', { type: 'error' });
      }
    });

    audio.addEventListener('play', handleAudioPlay);
    audio.addEventListener('pause', handleAudioPause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('ended', handleAudioEnded);
    audio.addEventListener('error', handleAudioError);
    audio.addEventListener('waiting', updatePlaybackStateUI);
    audio.addEventListener('playing', updatePlaybackStateUI);
    audio.addEventListener('volumechange', updateVolumeUI);

    dom.artArea.addEventListener('pointermove', (event) => {
      if (prefersReducedMotion || event.pointerType === 'touch') return;
      const rect = dom.artArea.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      dom.artArea.classList.add('is-tilting');
      dom.artTilt.style.setProperty('--rx', `${(0.5 - y) * 5.5}deg`);
      dom.artTilt.style.setProperty('--ry', `${(x - 0.5) * 5.5}deg`);
      dom.artTilt.style.setProperty('--mx', `${x * 100}%`);
      dom.artTilt.style.setProperty('--my', `${y * 100}%`);
    });

    dom.artArea.addEventListener('pointerleave', () => {
      dom.artArea.classList.remove('is-tilting');
      dom.artTilt.style.setProperty('--rx', '0deg');
      dom.artTilt.style.setProperty('--ry', '0deg');
      dom.artTilt.style.setProperty('--mx', '50%');
      dom.artTilt.style.setProperty('--my', '50%');
    });

    window.addEventListener('resize', () => {
      setupVisualizerCanvas();
      if (!state.playing) drawIdleVisualizer();
    });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => {
        setupVisualizerCanvas();
        if (!state.playing) drawIdleVisualizer();
      });
      observer.observe(dom.visualizer);
    }

    setupDragAndDrop();
    setupKeyboard();
    setupMediaSession();

    if (bridge?.onScanProgress) {
      bridge.onScanProgress((payload) => {
        if (!state.ready || !state.scanning) return;
        state.scanPayload = payload;
        setScanUI(true, payload);
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persistSettings(0);
    });

    window.addEventListener('beforeunload', () => {
      if (bridge) bridge.saveSettings(settingsSnapshot()).catch(() => {});
    });
  }

  function setupKeyboard() {
    window.addEventListener('keydown', (event) => {
      const target = event.target;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (state.modalMode) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closePlaylistModal();
        }
        return;
      }

      if (modifier && key === 'k') {
        event.preventDefault();
        if (!dom.searchInput.disabled) {
          dom.searchInput.focus();
          dom.searchInput.select();
        }
        return;
      }

      if (modifier && key === 'o') {
        event.preventDefault();
        if (event.shiftKey) chooseFiles();
        else chooseFolder();
        return;
      }

      if (event.key === 'Escape') {
        setAddMenu(false);
        closeContextMenu();
        closePlaylistMenu();
        closeTrackPlaylistMenu();
        resetClearButton();
        if (dom.dropOverlay.classList.contains('is-visible')) hideDropOverlay();
        return;
      }

      const typing = target instanceof HTMLElement
        && target.matches('input, textarea, select, [contenteditable="true"]');
      if (typing) return;

      const onButton = target instanceof HTMLElement && target.closest('button, a, [role="button"]');
      if (onButton && (event.key === ' ' || event.key === 'Enter')) return;
      if (target instanceof HTMLElement && target.closest('.queue-row') && (event.key === ' ' || event.key === 'Enter')) return;

      if (event.key === ' ') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekBy(event.shiftKey ? 30 : 5);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekBy(event.shiftKey ? -30 : -5);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setVolume(audio.volume + 0.05);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setVolume(audio.volume - 0.05);
      } else if (key === 'm') {
        event.preventDefault();
        toggleMute();
      } else if (key === 's') {
        event.preventDefault();
        state.shuffle = !state.shuffle;
        updateShuffleRepeatUI();
        persistSettingsSoon();
      } else if (key === 'r') {
        event.preventDefault();
        cycleRepeat();
      } else if (key === 'n') {
        event.preventDefault();
        nextTrack(state.playing);
      } else if (key === 'p') {
        event.preventDefault();
        previousTrack(state.playing);
      }
    });
  }

  function showDropOverlay() {
    dom.dropOverlay.classList.add('is-visible');
    dom.dropOverlay.setAttribute('aria-hidden', 'false');
  }

  function hideDropOverlay() {
    dom.dropOverlay.classList.remove('is-visible');
    dom.dropOverlay.setAttribute('aria-hidden', 'true');
  }

  function dragHasFiles(event) {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }

  function setupDragAndDrop() {
    let depth = 0;

    window.addEventListener('dragenter', (event) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      showDropOverlay();
    });

    window.addEventListener('dragover', (event) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('dragleave', () => {
      if (!depth) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) hideDropOverlay();
    });

    window.addEventListener('dragend', () => {
      depth = 0;
      hideDropOverlay();
    });

    window.addEventListener('blur', () => {
      depth = 0;
      hideDropOverlay();
    });

    window.addEventListener('drop', async (event) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      hideDropOverlay();

      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;

      const seen = new Set();
      const paths = files
        .map((file) => bridge?.pathForFile(file) || '')
        .filter((filePath) => {
          if (!filePath) return false;
          const key = filePath.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      if (!paths.length) {
        showToast('Не удалось прочитать путь к файлам', { type: 'error' });
        return;
      }

      await addPaths(paths);
    });
  }

  async function init() {
    applyPlatform();
    bindStaticEvents();
    setupWindowControls();
    applySettings({});
    setupVisualizerCanvas();
    drawIdleVisualizer();
    applyAccent(null);

    if (!bridge) {
      setBootVisible(false);
      showToast('Плеер нужно запустить через Electron: npm start', { type: 'error', duration: 6000 });
      return;
    }

    try {
      const data = await bridge.init();
      state.tracks = Array.isArray(data?.tracks) ? data.tracks : [];
      state.playlists = Array.isArray(data?.playlists) ? data.playlists : [];
      state.ready = true;
      applySettings(data?.settings || {});
      setView();
      renderQueue();

      if (state.tracks.length) {
        const saved = data?.settings || {};
        const savedTrack = state.tracks.find((track) => track.id === saved.lastTrackId);
        const target = savedTrack || state.tracks[0];
        let restore = savedTrack ? Math.max(0, Number(saved.lastTime) || 0) : 0;
        if (target.duration > 0 && restore >= target.duration - 1) restore = 0;
        loadTrack(target, { autoplay: false, restoreTime: restore, initial: true });
        requestAnimationFrame(() => scrollRowIntoView(target.id, false));
      } else {
        updatePlaybackStateUI();
        updateTimeline();
      }
    } catch (error) {
      state.ready = true;
      state.tracks = [];
      setView();
      renderQueue();
      updatePlaybackStateUI();
      updateTimeline();
      showToast('Не удалось загрузить музыкальную библиотеку', { type: 'error', duration: 5000 });
    } finally {
      setBootVisible(false);
    }
  }

  init();
})();
