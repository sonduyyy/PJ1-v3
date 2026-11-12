/**
 * Shorts v4 Clean - State & Storage Module
 * Manages window.MODES, window.APP_STATE, localStorage, safeFetch, logDebug
 */

// 1. Definition of MODES
window.MODES = {
  video: {
    id: 'video',
    name: 'Video',
    icon: '🎬',
    defaultSource: 'idolcomplex',
    sources: ['idolcomplex', 'xbooru', 'r34video', 'hypnohub', 'r34cosplay', 'xbooru_cosplay', 'xbooru_safe']
  },
  photo: {
    id: 'photo',
    name: 'Ảnh',
    icon: '📸',
    defaultSource: 'cosplaytele',
    sources: ['cosplaytele', 'idolphoto', 'safebooru', 'konachan_sfw']
  }
};

// 2. Safe LocalStorage Managers
function loadSettingsFromStorage() {
  try {
    const saved = localStorage.getItem('shorts_settings');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

function saveSettingsToStorage() {
  try {
    if (window.APP_STATE && window.APP_STATE.settings) {
      window.APP_STATE.settings.lastMode = window.APP_STATE.currentMode;
      window.APP_STATE.settings.lastSource = window.APP_STATE.currentSource;
      localStorage.setItem('shorts_settings', JSON.stringify(window.APP_STATE.settings));
    }
  } catch (e) {}
}

const savedSettings = loadSettingsFromStorage() || {};
const initialMode = (savedSettings.lastMode && window.MODES[savedSettings.lastMode])
  ? savedSettings.lastMode
  : 'video';
const modeObj = window.MODES[initialMode];
const initialSource = (savedSettings.lastSource && modeObj.sources.includes(savedSettings.lastSource))
  ? savedSettings.lastSource
  : modeObj.defaultSource;

function loadFavoritesFromStorage() {
  try {
    const saved = localStorage.getItem('shorts_favs');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

function saveFavoritesToStorage() {
  try {
    localStorage.setItem('shorts_favs', JSON.stringify(window.APP_STATE.favorites || {}));
  } catch (e) {}
}

function parseBlacklistInput(raw) {
  if (!raw) return [];
  const tokens = raw.split(/[\r\n,]+/);
  const cleaned = [];
  tokens.forEach(t => {
    let c = t.trim().toLowerCase().replace(/^[#\-]+/, '').trim();
    if (c) {
      cleaned.push(c);
      if (c.includes(' ')) cleaned.push(c.replace(/\s+/g, '_'));
      if (c.includes('_')) cleaned.push(c.replace(/_+/g, ' '));
    }
  });
  return Array.from(new Set(cleaned));
}

function loadBlacklistFromStorage() {
  try {
    const saved = localStorage.getItem('shorts_blacklist');
    if (saved) return parseBlacklistInput(saved);
    return ['scat', 'guro', 'gore', 'loli', 'shota'];
  } catch (e) {
    return ['scat', 'guro', 'gore'];
  }
}

function saveBlacklistToStorage() {
  try {
    localStorage.setItem('shorts_blacklist', (window.APP_STATE.blacklist || []).join(', '));
  } catch (e) {}
}

window.loadSettingsFromStorage = loadSettingsFromStorage;
window.saveSettingsToStorage = saveSettingsToStorage;
window.loadFavoritesFromStorage = loadFavoritesFromStorage;
window.saveFavoritesToStorage = saveFavoritesToStorage;
window.parseBlacklistInput = parseBlacklistInput;
window.loadBlacklistFromStorage = loadBlacklistFromStorage;
window.saveBlacklistToStorage = saveBlacklistToStorage;

window.isItemBlacklisted = function(item) {
  if (!item || !window.APP_STATE || !window.APP_STATE.blacklist || window.APP_STATE.blacklist.length === 0) return false;
  const blacklist = window.APP_STATE.blacklist;
  const tagStr = (item.tagString || '').toLowerCase();
  const titleStr = (item.title || '').toLowerCase();
  return blacklist.some(term => {
    if (!term) return false;
    return tagStr.includes(term) || titleStr.includes(term);
  });
};

// 3. Central Application State
window.APP_STATE = {
  currentMode: initialMode,
  currentSource: initialSource,
  sortMode: 'recent', // 'recent' | 'hot' | 'random'
  activeTag: '',
  page: 1,
  nextCursor: null,
  isLoading: false,
  hasMore: true,
  items: [],
  currentIndex: 0,
  slideMap: new Map(),
  seenIds: new Set(),
  favorites: loadFavoritesFromStorage(),
  blacklist: loadBlacklistFromStorage(),
  settings: Object.assign({
    quality: 'sample',
    rating: 'all',
    stableAudio: true,
    autoUnmute: true,
    passcodeEnabled: false,
    passcode: '777777',
    lastMode: initialMode,
    lastSource: initialSource
  }, savedSettings, { lastMode: initialMode, lastSource: initialSource }),
  isGlobalMuted: false,
  globalVolume: 0.85,
  autoSlideTimer: null,
  logs: []
};

// 4. Diagnostic Logging
window.logDebug = function(msg) {
  const timestamp = new Date().toTimeString().split(' ')[0];
  const entry = `[${timestamp}] ${msg}`;
  console.log(entry);
  if (window.APP_STATE && Array.isArray(window.APP_STATE.logs)) {
    window.APP_STATE.logs.unshift(entry);
    if (window.APP_STATE.logs.length > 100) window.APP_STATE.logs.pop();
    const box = document.getElementById('debug-log-box');
    if (box) box.textContent = window.APP_STATE.logs.join('\n');
  }
};

window.onerror = function(message, source, lineno, colno, error) {
  window.logDebug(`ERR: ${message} (${source}:${lineno}:${colno})`);
  return false;
};

window.onunhandledrejection = function(event) {
  window.logDebug(`PROMISE REJECT: ${event.reason?.message || event.reason}`);
};

// 5. Resilient Network Fetcher (CapacitorHttp native + browser fallback)
window.safeFetch = async function(url, options = {}) {
  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  };
  const mergedHeaders = Object.assign({}, defaultHeaders, options.headers || {});

  // 1. Try Capacitor Native Http
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) {
    try {
      const res = await window.Capacitor.Plugins.CapacitorHttp.request({
        url: url,
        method: options.method || 'GET',
        headers: mergedHeaders,
        data: options.body
      });
      const isOk = res.status >= 200 && res.status < 300;
      return {
        ok: isOk,
        status: res.status,
        json: async () => (typeof res.data === 'string' ? JSON.parse(res.data) : res.data),
        text: async () => (typeof res.data === 'string' ? res.data : JSON.stringify(res.data))
      };
    } catch (capErr) {
      window.logDebug(`CapacitorHttp error on ${url}: ${capErr.message || capErr}`);
    }
  }

  // 2. Browser Fetch fallback (PC / local preview)
  const cleanBrowserHeaders = {};
  for (const [k, v] of Object.entries(mergedHeaders)) {
    const lk = k.toLowerCase();
    if (lk !== 'user-agent' && lk !== 'referer' && lk !== 'origin') {
      cleanBrowserHeaders[k] = v;
    }
  }

  return window.fetch(url, Object.assign({}, options, { headers: cleanBrowserHeaders }));
};
