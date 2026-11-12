/**
 * Shorts v4 Clean - Main Controller & Navigation Module
 * App initialization, top-bar/bottom-nav controllers, modals, settings & favorites
 */

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  window.logDebug('Starting Shorts v4 Clean...');

  // 1. Initialize Player / Feed Engine
  if (window.FeedEngine) {
    window.FeedEngine.init();
  }

  // 2. Setup Top Bar & Mode Toggles
  setupTopBar();

  // 3. Setup Bottom Navigation
  setupBottomNav();

  // 4. Setup Modals (Source, Search)
  setupModals();

  // 5. Setup Settings / Profile Controls
  setupProfileSettings();

  // 6. Setup Passcode Lock (if enabled)
  setupPasscodeLock();

  // 7. Initial Feed Load
  updateTopBarUI();
  await loadInitialFeed();
  window.logDebug('App initialized successfully.');
}

// -----------------------------------------------------------------------------
// TOP BAR & MODE CONTROLLER
// -----------------------------------------------------------------------------
function setupTopBar() {
  const btnVideo = document.getElementById('mode-btn-video');
  const btnPhoto = document.getElementById('mode-btn-photo');
  const btnOpenSource = document.getElementById('btn-open-source');
  const btnCycleSort = document.getElementById('btn-cycle-sort');
  const btnOpenSearch = document.getElementById('btn-open-search');

  if (btnVideo) {
    btnVideo.addEventListener('click', () => {
      window.switchMode('video');
    });
  }

  if (btnPhoto) {
    btnPhoto.addEventListener('click', () => {
      window.switchMode('photo');
    });
  }

  if (btnOpenSource) {
    btnOpenSource.addEventListener('click', () => {
      openSourceModal();
    });
  }

  if (btnCycleSort) {
    btnCycleSort.addEventListener('click', () => {
      window.cycleSortMode();
    });
  }

  if (btnOpenSearch) {
    btnOpenSearch.addEventListener('click', () => {
      openSearchModal();
    });
  }
}

window.switchMode = async function(modeKey) {
  if (!window.MODES[modeKey]) return;
  if (window.APP_STATE.currentMode === modeKey) return;

  window.APP_STATE.currentMode = modeKey;
  const modeCfg = window.MODES[modeKey];
  window.APP_STATE.currentSource = modeCfg.defaultSource;
  window.APP_STATE.page = 1;
  window.APP_STATE.nextCursor = null;
  window.APP_STATE.hasMore = true;
  window.APP_STATE.activeTag = '';

  window.saveSettingsToStorage();
  updateTopBarUI();
  await loadInitialFeed();
};

window.switchSource = async function(sourceKey) {
  if (!window.PROVIDERS[sourceKey]) return;
  window.APP_STATE.currentSource = sourceKey;
  window.APP_STATE.page = 1;
  window.APP_STATE.nextCursor = null;
  window.APP_STATE.hasMore = true;
  window.APP_STATE.activeTag = '';

  window.saveSettingsToStorage();
  updateTopBarUI();
  await loadInitialFeed();
};

window.cycleSortMode = async function() {
  const modes = ['recent', 'hot', 'random'];
  const curIdx = modes.indexOf(window.APP_STATE.sortMode);
  const nextMode = modes[(curIdx + 1) % modes.length];
  window.APP_STATE.sortMode = nextMode;
  window.APP_STATE.page = 1;
  window.APP_STATE.nextCursor = null;
  window.APP_STATE.hasMore = true;

  updateTopBarUI();
  const label = nextMode === 'recent' ? 'Mới nhất' : (nextMode === 'hot' ? 'Hot nhất' : 'Ngẫu nhiên');
  window.showToast(`Sắp xếp: ${label}`);
  await loadInitialFeed();
};

function updateTopBarUI() {
  const currentMode = window.APP_STATE.currentMode;
  const currentSource = window.APP_STATE.currentSource;
  const sortMode = window.APP_STATE.sortMode;

  const btnVideo = document.getElementById('mode-btn-video');
  const btnPhoto = document.getElementById('mode-btn-photo');
  if (btnVideo) btnVideo.classList.toggle('active', currentMode === 'video');
  if (btnPhoto) btnPhoto.classList.toggle('active', currentMode === 'photo');

  const provider = window.PROVIDERS[currentSource] || {};
  const badgeIcon = document.getElementById('source-badge-icon');
  const badgeName = document.getElementById('source-badge-name');
  if (badgeIcon) badgeIcon.textContent = provider.badgeIcon || '✨';
  if (badgeName) badgeName.textContent = provider.badgeName || provider.name || currentSource;

  const sortLabel = document.getElementById('label-sort-mode');
  if (sortLabel) {
    sortLabel.textContent = sortMode === 'recent' ? '🕒 Mới' : (sortMode === 'hot' ? '🔥 Hot' : '🎲 Ngẫu nhiên');
  }
}

// -----------------------------------------------------------------------------
// FEED FETCH ENGINE
// -----------------------------------------------------------------------------
async function loadInitialFeed() {
  window.showLoadingSpinner(true);
  try {
    const items = await window.fetchFeedBatch(1, window.APP_STATE.activeTag, window.APP_STATE.sortMode);
    if (window.FeedEngine) {
      window.FeedEngine.renderFeed(items, false);
    }
  } catch (err) {
    window.logDebug('loadInitialFeed error: ' + err.message);
    window.showToast('Lỗi tải dữ liệu. Đang thử lại...');
  } finally {
    window.showLoadingSpinner(false);
  }
}

window.loadMoreFeed = async function() {
  if (window.APP_STATE.isLoading || !window.APP_STATE.hasMore) return;
  window.APP_STATE.page++;
  try {
    const items = await window.fetchFeedBatch(window.APP_STATE.page, window.APP_STATE.activeTag, window.APP_STATE.sortMode);
    if (items.length > 0 && window.FeedEngine) {
      window.FeedEngine.renderFeed(items, true);
    }
  } catch (e) {
    window.logDebug('loadMoreFeed error: ' + e.message);
  }
};

window.fetchFeedBatch = async function(page = 1, tag = '', sortMode = 'recent') {
  if (window.APP_STATE.isLoading) return [];
  window.APP_STATE.isLoading = true;

  const sourceKey = window.APP_STATE.currentSource;
  const provider = window.PROVIDERS[sourceKey] || window.PROVIDERS.xbooru;
  const validItems = [];

  try {
    const rawItems = await provider.fetchFeed(page, tag, sortMode);
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      window.APP_STATE.hasMore = false;
      window.APP_STATE.isLoading = false;
      return [];
    }

    rawItems.forEach(item => {
      const uniqueId = `${item.sourceKey}_${item.id}`;
      if (window.APP_STATE.seenIds.has(uniqueId)) return;
      if (window.isItemBlacklisted(item)) return;

      window.APP_STATE.seenIds.add(uniqueId);
      validItems.push(item);
    });

    window.APP_STATE.isLoading = false;
    return validItems;
  } catch (err) {
    window.APP_STATE.isLoading = false;
    throw err;
  }
};

window.executeSearchTag = async function(tag) {
  window.APP_STATE.activeTag = tag;
  window.APP_STATE.page = 1;
  window.APP_STATE.nextCursor = null;
  window.APP_STATE.hasMore = true;
  window.showToast(`Tìm kiếm tag: ${tag || 'Tất cả'}`);
  await loadInitialFeed();
};

// -----------------------------------------------------------------------------
// BOTTOM NAVIGATION
// -----------------------------------------------------------------------------
function setupBottomNav() {
  const navFeed = document.getElementById('nav-btn-feed');
  const navFav = document.getElementById('nav-btn-fav');
  const navProfile = document.getElementById('nav-btn-profile');

  const viewFeed = document.getElementById('view-feed');
  const viewFav = document.getElementById('view-favorites');
  const viewProfile = document.getElementById('view-profile');

  function switchTab(activeBtn, targetView) {
    [navFeed, navFav, navProfile].forEach(b => b?.classList.remove('active'));
    [viewFeed, viewFav, viewProfile].forEach(v => v?.classList.remove('active'));

    activeBtn?.classList.add('active');
    targetView?.classList.add('active');

    // Auto pause video when leaving feed view
    if (targetView !== viewFeed) {
      const curEntry = window.APP_STATE.slideMap.get(window.APP_STATE.currentIndex);
      if (curEntry && curEntry.videoEl) {
        curEntry.videoEl.pause();
      }
    } else {
      const curEntry = window.APP_STATE.slideMap.get(window.APP_STATE.currentIndex);
      if (curEntry && curEntry.videoEl) {
        curEntry.videoEl.play().catch(() => {});
      }
    }

    if (targetView === viewFav) {
      window.renderFavoritesGrid('all');
    }
  }

  if (navFeed) navFeed.addEventListener('click', () => switchTab(navFeed, viewFeed));
  if (navFav) navFav.addEventListener('click', () => switchTab(navFav, viewFav));
  if (navProfile) navProfile.addEventListener('click', () => switchTab(navProfile, viewProfile));

  // Favorites Filter Buttons
  const filterAll = document.getElementById('fav-filter-all');
  const filterVideo = document.getElementById('fav-filter-video');
  const filterPhoto = document.getElementById('fav-filter-photo');

  if (filterAll) filterAll.addEventListener('click', () => {
    [filterAll, filterVideo, filterPhoto].forEach(b => b?.classList.remove('active'));
    filterAll.classList.add('active');
    window.renderFavoritesGrid('all');
  });

  if (filterVideo) filterVideo.addEventListener('click', () => {
    [filterAll, filterVideo, filterPhoto].forEach(b => b?.classList.remove('active'));
    filterVideo.classList.add('active');
    window.renderFavoritesGrid('video');
  });

  if (filterPhoto) filterPhoto.addEventListener('click', () => {
    [filterAll, filterVideo, filterPhoto].forEach(b => b?.classList.remove('active'));
    filterPhoto.classList.add('active');
    window.renderFavoritesGrid('photo');
  });
}

window.renderFavoritesGrid = function(filterType = 'all') {
  const grid = document.getElementById('favorites-grid');
  const countLabel = document.getElementById('fav-count-label');
  if (!grid) return;

  grid.innerHTML = '';
  const allFavs = Object.values(window.APP_STATE.favorites || {});
  const filtered = allFavs.filter(item => {
    if (filterType === 'video') return item.mediaType === 'video';
    if (filterType === 'photo') return item.mediaType !== 'video';
    return true;
  });

  if (countLabel) countLabel.textContent = `${filtered.length} mục`;

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="favorites-empty">Chưa có bài yêu thích nào trong mục này.</div>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'fav-card';
    const isVid = item.mediaType === 'video';

    card.innerHTML = `
      <img src="${item.poster || item.sampleUrl || ''}" referrerpolicy="no-referrer" loading="lazy" alt="fav">
      <div class="fav-badge">${isVid ? '🎬' : '📸'}</div>
      <button class="btn-remove-fav" title="Bỏ thích">✕</button>
      <div class="fav-card-title">${item.title || ''}</div>
    `;

    card.querySelector('.btn-remove-fav').addEventListener('click', (e) => {
      e.stopPropagation();
      delete window.APP_STATE.favorites[`${item.sourceKey}_${item.id}`];
      window.saveFavoritesToStorage();
      window.renderFavoritesGrid(filterType);
    });

    card.addEventListener('click', () => {
      // Tap favorite to view directly in Feed
      window.APP_STATE.items = [item];
      window.FeedEngine.renderFeed([item], false);
      const navFeed = document.getElementById('nav-btn-feed');
      const viewFeed = document.getElementById('view-feed');
      [document.getElementById('nav-btn-fav'), document.getElementById('nav-btn-profile')].forEach(b => b?.classList.remove('active'));
      [document.getElementById('view-favorites'), document.getElementById('view-profile')].forEach(v => v?.classList.remove('active'));
      navFeed?.classList.add('active');
      viewFeed?.classList.add('active');
    });

    grid.appendChild(card);
  });
};

// -----------------------------------------------------------------------------
// MODALS CONTROLLER (Source Modal, Search Modal)
// -----------------------------------------------------------------------------
function setupModals() {
  // 1. Source Modal
  const sourceModal = document.getElementById('source-modal');
  const btnCloseSource = document.getElementById('btn-close-source');
  const sourceBackdrop = document.getElementById('source-modal-backdrop');

  if (btnCloseSource) btnCloseSource.addEventListener('click', closeSourceModal);
  if (sourceBackdrop) sourceBackdrop.addEventListener('click', closeSourceModal);

  // 2. Search Modal
  const searchModal = document.getElementById('search-modal');
  const btnCloseSearch = document.getElementById('btn-close-search');
  const searchBackdrop = document.getElementById('search-modal-backdrop');
  const btnSubmitSearch = document.getElementById('btn-submit-search');
  const btnClearTag = document.getElementById('btn-clear-tag');
  const searchInput = document.getElementById('search-input');

  if (btnCloseSearch) btnCloseSearch.addEventListener('click', closeSearchModal);
  if (searchBackdrop) searchBackdrop.addEventListener('click', closeSearchModal);

  if (btnSubmitSearch && searchInput) {
    btnSubmitSearch.addEventListener('click', () => {
      const q = searchInput.value.trim();
      closeSearchModal();
      window.executeSearchTag(q);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        closeSearchModal();
        window.executeSearchTag(q);
      }
    });
  }

  if (btnClearTag) {
    btnClearTag.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      closeSearchModal();
      window.executeSearchTag('');
    });
  }
}

function openSourceModal() {
  const modal = document.getElementById('source-modal');
  const list = document.getElementById('source-options-list');
  const title = document.getElementById('source-modal-title');
  if (!modal || !list) return;

  const curMode = window.APP_STATE.currentMode;
  const modeCfg = window.MODES[curMode];
  if (title) title.textContent = `${modeCfg.icon} Chọn nguồn ${modeCfg.name}`;

  list.innerHTML = '';
  modeCfg.sources.forEach(srcKey => {
    const prov = window.PROVIDERS[srcKey];
    if (!prov) return;
    const isActive = srcKey === window.APP_STATE.currentSource;

    const opt = document.createElement('div');
    opt.className = `source-option-item ${isActive ? 'active' : ''}`;
    opt.innerHTML = `
      <div class="source-opt-icon">${prov.badgeIcon}</div>
      <div class="source-opt-text">
        <div class="source-opt-name">${prov.name}</div>
        <div class="source-opt-desc">${prov.hintText || ''}</div>
      </div>
      ${isActive ? '<span class="source-opt-check">✓</span>' : ''}
    `;

    opt.addEventListener('click', () => {
      closeSourceModal();
      window.switchSource(srcKey);
    });

    list.appendChild(opt);
  });

  modal.classList.add('active');
}

function closeSourceModal() {
  const modal = document.getElementById('source-modal');
  if (modal) modal.classList.remove('active');
}

function openSearchModal() {
  const modal = document.getElementById('search-modal');
  const hotList = document.getElementById('hot-tags-list');
  const input = document.getElementById('search-input');
  if (!modal) return;

  if (input) input.value = window.APP_STATE.activeTag || '';

  const curSource = window.APP_STATE.currentSource;
  const prov = window.PROVIDERS[curSource] || {};
  const hotTags = prov.hotTags || ['video', 'animated', 'cosplay'];

  if (hotList) {
    hotList.innerHTML = '';
    hotTags.forEach(tag => {
      const chip = document.createElement('button');
      chip.className = 'hot-tag-chip';
      chip.textContent = `#${tag}`;
      chip.addEventListener('click', () => {
        closeSearchModal();
        window.executeSearchTag(tag);
      });
      hotList.appendChild(chip);
    });
  }

  modal.classList.add('active');
  if (input) setTimeout(() => input.focus(), 150);
}

function closeSearchModal() {
  const modal = document.getElementById('search-modal');
  if (modal) modal.classList.remove('active');
}

// -----------------------------------------------------------------------------
// SETTINGS / PROFILE CONTROLS
// -----------------------------------------------------------------------------
function setupProfileSettings() {
  const settings = window.APP_STATE.settings;

  // Passcode Settings
  const togglePasscode = document.getElementById('toggle-passcode');
  const inputNewPasscode = document.getElementById('input-new-passcode');
  const btnSavePasscode = document.getElementById('btn-save-passcode');

  if (togglePasscode) {
    togglePasscode.checked = !!settings.passcodeEnabled;
    togglePasscode.addEventListener('change', () => {
      settings.passcodeEnabled = togglePasscode.checked;
      window.saveSettingsToStorage();
      window.showToast(`Khóa bảo vệ: ${settings.passcodeEnabled ? 'BẬT' : 'TẮT'}`);
    });
  }

  if (btnSavePasscode && inputNewPasscode) {
    btnSavePasscode.addEventListener('click', () => {
      const code = inputNewPasscode.value.trim();
      if (code.length === 6 && /^\d+$/.test(code)) {
        settings.passcode = code;
        window.saveSettingsToStorage();
        window.showToast('Đã lưu mật mã mới!');
        inputNewPasscode.value = '';
      } else {
        window.showToast('Mật mã phải đúng 6 chữ số!');
      }
    });
  }

  // Blacklist Settings
  const inputBlacklist = document.getElementById('input-blacklist');
  const btnSaveBlacklist = document.getElementById('btn-save-blacklist');

  if (inputBlacklist) {
    inputBlacklist.value = (window.APP_STATE.blacklist || []).join(', ');
  }

  if (btnSaveBlacklist && inputBlacklist) {
    btnSaveBlacklist.addEventListener('click', () => {
      window.APP_STATE.blacklist = window.parseBlacklistInput(inputBlacklist.value);
      window.saveBlacklistToStorage();
      window.showToast('Đã lưu danh sách chặn!');
    });
  }

  // Quality & Rating
  const selectQuality = document.getElementById('select-quality');
  if (selectQuality) {
    selectQuality.value = settings.quality || 'sample';
    selectQuality.addEventListener('change', () => {
      settings.quality = selectQuality.value;
      window.saveSettingsToStorage();
      window.showToast(`Chất lượng: ${settings.quality}`);
    });
  }

  const selectRating = document.getElementById('select-rating');
  if (selectRating) {
    selectRating.value = settings.rating || 'all';
    selectRating.addEventListener('change', () => {
      settings.rating = selectRating.value;
      window.saveSettingsToStorage();
      window.showToast(`Bộ lọc rating: ${settings.rating}`);
      loadInitialFeed();
    });
  }

  // Audio toggles
  const toggleStableAudio = document.getElementById('toggle-stable-audio');
  if (toggleStableAudio) {
    toggleStableAudio.checked = !!settings.stableAudio;
    toggleStableAudio.addEventListener('change', () => {
      settings.stableAudio = toggleStableAudio.checked;
      window.saveSettingsToStorage();
    });
  }

  const toggleAutoUnmute = document.getElementById('toggle-auto-unmute');
  if (toggleAutoUnmute) {
    toggleAutoUnmute.checked = !!settings.autoUnmute;
    toggleAutoUnmute.addEventListener('change', () => {
      settings.autoUnmute = toggleAutoUnmute.checked;
      window.saveSettingsToStorage();
    });
  }

  // Export / Import Backup
  const btnExport = document.getElementById('btn-export-backup');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const backupData = {
        settings: window.APP_STATE.settings,
        favorites: window.APP_STATE.favorites,
        blacklist: window.APP_STATE.blacklist
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      navigator.clipboard.writeText(jsonStr).then(() => {
        window.showToast('Đã sao chép dữ liệu JSON vào Clipboard!');
      }).catch(() => {
        prompt('Sao chép dữ liệu JSON bên dưới:', jsonStr);
      });
    });
  }

  const btnImport = document.getElementById('btn-import-backup');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      const jsonStr = prompt('Dán chuỗi JSON sao lưu vào đây:');
      if (!jsonStr) return;
      try {
        const data = JSON.parse(jsonStr);
        if (data.settings) window.APP_STATE.settings = Object.assign(window.APP_STATE.settings, data.settings);
        if (data.favorites) window.APP_STATE.favorites = data.favorites;
        if (data.blacklist) window.APP_STATE.blacklist = data.blacklist;

        window.saveSettingsToStorage();
        window.saveFavoritesToStorage();
        window.saveBlacklistToStorage();
        window.showToast('Khôi phục dữ liệu thành công!');
        location.reload();
      } catch (e) {
        window.showToast('Lỗi parse JSON dữ liệu!');
      }
    });
  }

  // Clear Cache
  const btnClearCache = document.getElementById('btn-clear-cache');
  if (btnClearCache) {
    btnClearCache.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn xóa toàn bộ cache và lịch sử lướt?')) {
        window.APP_STATE.seenIds.clear();
        window.showToast('Đã dọn dẹp cache!');
        loadInitialFeed();
      }
    });
  }
}

// -----------------------------------------------------------------------------
// PASSCODE SECURITY LOCK
// -----------------------------------------------------------------------------
function setupPasscodeLock() {
  const overlay = document.getElementById('passcode-overlay');
  if (!overlay) return;

  const isEnabled = !!window.APP_STATE.settings.passcodeEnabled;
  if (!isEnabled) {
    overlay.classList.add('hidden');
    return;
  }

  overlay.classList.remove('hidden');
  let enteredPin = '';
  const dots = document.querySelectorAll('.passcode-dot');

  function updateDots() {
    dots.forEach((dot, idx) => {
      dot.classList.toggle('filled', idx < enteredPin.length);
    });
  }

  const keypadButtons = overlay.querySelectorAll('.keypad-btn');
  keypadButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.key;
      if (val === 'del') {
        enteredPin = enteredPin.slice(0, -1);
      } else if (val === 'cancel') {
        enteredPin = '';
      } else if (enteredPin.length < 6) {
        enteredPin += val;
      }
      updateDots();

      if (enteredPin.length === 6) {
        const correctPin = window.APP_STATE.settings.passcode || '777777';
        if (enteredPin === correctPin) {
          overlay.classList.add('hidden');
          enteredPin = '';
          updateDots();
        } else {
          window.showToast('Sai mật mã!');
          setTimeout(() => {
            enteredPin = '';
            updateDots();
          }, 300);
        }
      }
    });
  });
}

// -----------------------------------------------------------------------------
// TOAST & SPINNER HELPERS
// -----------------------------------------------------------------------------
window.showToast = function(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
};

window.showLoadingSpinner = function(show) {
  const spinner = document.getElementById('global-loading-spinner');
  if (spinner) {
    spinner.classList.toggle('active', show);
  }
};
