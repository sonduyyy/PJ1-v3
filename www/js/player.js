/**
 * Shorts v4 Clean - Player & Feed Engine
 * Video playback, photo/album carousels, memory cleaner, gestures & seekbar
 */

window.FeedEngine = {
  feedContainer: null,
  seekbarContainer: null,
  seekbarFill: null,
  albumGridModal: null,
  albumGridContainer: null,
  albumGridTitle: null,
  photoZoomModal: null,
  photoZoomImg: null,
  tagsModal: null,
  tagsContainer: null,
  tagsModalTitle: null,

  init() {
    this.feedContainer = document.getElementById('feed-container');
    this.seekbarContainer = document.getElementById('seekbar-container');
    this.seekbarFill = document.getElementById('seekbar-fill');
    this.albumGridModal = document.getElementById('album-grid-modal');
    this.albumGridContainer = document.getElementById('album-grid-container');
    this.albumGridTitle = document.getElementById('album-grid-title');
    this.photoZoomModal = document.getElementById('photo-zoom-modal');
    this.photoZoomImg = document.getElementById('photo-zoom-img');
    this.tagsModal = document.getElementById('tags-modal');
    this.tagsContainer = document.getElementById('tags-container');
    this.tagsModalTitle = document.getElementById('tags-modal-title');

    this.bindGlobalScroll();
    this.bindSeekbarEvents();
    this.bindModalCloseEvents();
  },

  bindGlobalScroll() {
    if (!this.feedContainer) return;
    let scrollTimeout = null;
    this.feedContainer.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const height = this.feedContainer.clientHeight || window.innerHeight;
        if (height <= 0) return;
        const newIdx = Math.round(this.feedContainer.scrollTop / height);
        if (newIdx !== window.APP_STATE.currentIndex) {
          this.activateSlide(newIdx);
        }
      }, 50);
    }, { passive: true });
  },

  bindSeekbarEvents() {
    if (!this.seekbarContainer) return;

    const handleSeek = (e) => {
      const entry = window.APP_STATE.slideMap.get(window.APP_STATE.currentIndex);
      if (!entry || !entry.videoEl || !entry.videoEl.duration) return;
      const rect = this.seekbarContainer.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      entry.videoEl.currentTime = pos * entry.videoEl.duration;
      if (this.seekbarFill) {
        this.seekbarFill.style.width = `${pos * 100}%`;
      }
    };

    let isSeeking = false;
    this.seekbarContainer.addEventListener('touchstart', (e) => {
      isSeeking = true;
      handleSeek(e);
    }, { passive: true });

    this.seekbarContainer.addEventListener('touchmove', (e) => {
      if (isSeeking) handleSeek(e);
    }, { passive: true });

    this.seekbarContainer.addEventListener('touchend', () => {
      isSeeking = false;
    });

    this.seekbarContainer.addEventListener('click', (e) => {
      handleSeek(e);
    });
  },

  bindModalCloseEvents() {
    const btnCloseAlbum = document.getElementById('btn-close-album-grid');
    if (btnCloseAlbum) btnCloseAlbum.addEventListener('click', () => this.closeAlbumGridModal());
    const albumBackdrop = document.getElementById('album-grid-backdrop');
    if (albumBackdrop) albumBackdrop.addEventListener('click', () => this.closeAlbumGridModal());

    const btnCloseZoom = document.getElementById('btn-close-photo-zoom');
    if (btnCloseZoom) btnCloseZoom.addEventListener('click', () => this.closePhotoZoomModal());
    const zoomBackdrop = document.getElementById('photo-zoom-backdrop');
    if (zoomBackdrop) zoomBackdrop.addEventListener('click', () => this.closePhotoZoomModal());

    const btnCloseTags = document.getElementById('btn-close-tags');
    if (btnCloseTags) btnCloseTags.addEventListener('click', () => this.closeTagsModal());
    const tagsBackdrop = document.getElementById('tags-backdrop');
    if (tagsBackdrop) tagsBackdrop.addEventListener('click', () => this.closeTagsModal());
  },

  renderFeed(items, append = false) {
    if (!this.feedContainer) return;
    if (!append) {
      this.feedContainer.innerHTML = '';
      window.APP_STATE.slideMap.clear();
      window.APP_STATE.items = [];
      window.APP_STATE.currentIndex = 0;
      this.feedContainer.scrollTop = 0;
    }

    const startIndex = window.APP_STATE.items.length;
    items.forEach((item, i) => {
      const slideIndex = startIndex + i;
      window.APP_STATE.items.push(item);
      const slideEl = this.createSlideElement(item, slideIndex);
      this.feedContainer.appendChild(slideEl);
    });

    if (!append && window.APP_STATE.items.length > 0) {
      this.activateSlide(0);
    }
  },

  createSlideElement(item, index) {
    const slide = document.createElement('div');
    slide.className = 'feed-slide';
    slide.dataset.index = index;

    const isVideo = item.mediaType === 'video' || window.APP_STATE.currentMode === 'video';

    // 1. Media Section
    let mediaHtml = '';
    if (isVideo) {
      mediaHtml = `
        <div class="media-wrapper video-mode">
          <video class="slide-video" playsinline webkit-playsinline loop preload="none" referrerpolicy="no-referrer"></video>
          <img class="slide-poster" src="${item.poster || ''}" referrerpolicy="no-referrer" alt="poster" onerror="this.style.opacity='0'">
          <div class="slide-spinner"></div>
          <div class="play-pause-indicator">▶️</div>
          <div class="speed-badge hidden">⏩ 2x Speed</div>
        </div>
      `;
    } else {
      const isAlbum = item.mediaType === 'image_album' && item.albumImages && item.albumImages.length > 1;
      if (isAlbum) {
        const slidesHtml = item.albumImages.map((u, idx) => `
          <div class="album-slide" data-idx="${idx}">
            <img src="${u}" loading="lazy" referrerpolicy="no-referrer" alt="slide ${idx + 1}">
          </div>
        `).join('');

        mediaHtml = `
          <div class="media-wrapper photo-mode photo-album-wrapper">
            <div class="album-counter-pill">📸 <span class="cur-album-idx">1</span> / ${item.albumImages.length}</div>
            <div class="album-carousel">
              ${slidesHtml}
            </div>
            <div class="album-action-row">
              <button class="album-grid-btn">⊞ Xem lưới (${item.albumImages.length} ảnh)</button>
              <button class="album-autoslide-btn">▶️ Tự lướt</button>
            </div>
          </div>
        `;
      } else {
        mediaHtml = `
          <div class="media-wrapper photo-mode single-photo-wrapper">
            <img class="slide-single-photo" src="${item.sampleUrl || item.currentUrl}" referrerpolicy="no-referrer" alt="${item.title || 'photo'}">
          </div>
        `;
      }
    }

    // 2. Action Rail (Right side)
    const isFav = !!window.APP_STATE.favorites[`${item.sourceKey}_${item.id}`];
    const favCountDisplay = item.favCount > 0 ? (item.favCount > 999 ? (item.favCount/1000).toFixed(1)+'k' : item.favCount) : 'Thích';

    const actionRailHtml = `
      <div class="action-rail">
        <button class="action-btn btn-heart ${isFav ? 'active' : ''}" data-index="${index}" title="Thích">
          <svg class="heart-svg" viewBox="0 0 24 24" fill="${isFav ? '#fe2c55' : 'currentColor'}">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span class="action-count fav-count-label">${favCountDisplay}</span>
        </button>

        <button class="action-btn btn-tags" data-index="${index}" title="Xem tags">
          <span class="action-icon">🏷️</span>
          <span class="action-count">Tags</span>
        </button>

        ${isVideo ? `
          <button class="action-btn btn-mute-toggle" data-index="${index}" title="Bật/Tắt âm">
            <span class="action-icon mute-icon">${window.APP_STATE.isGlobalMuted ? '🔇' : '🔊'}</span>
            <span class="action-count mute-label">${window.APP_STATE.isGlobalMuted ? 'Tắt' : 'Bật'}</span>
          </button>
        ` : ''}

        <button class="action-btn btn-open-web" data-index="${index}" title="Mở trang gốc">
          <span class="action-icon">↗️</span>
          <span class="action-count">Gốc</span>
        </button>
      </div>
    `;

    // 3. Bottom Left Info
    const providerObj = window.PROVIDERS[item.sourceKey] || {};
    const tagsSnippet = (item.tagString || '').split(/\s+/).slice(0, 4).map(t => `#${t}`).join(' ');

    const bottomInfoHtml = `
      <div class="bottom-left-info">
        <div class="creator-badge">
          <span class="creator-icon">${providerObj.badgeIcon || '✨'}</span>
          <span class="creator-name">${item.artist || providerObj.name || 'Creator'}</span>
        </div>
        <div class="slide-title">${item.title || ''}</div>
        <div class="slide-tags-snippet">${tagsSnippet}</div>
      </div>
    `;

    slide.innerHTML = mediaHtml + actionRailHtml + bottomInfoHtml;

    // Cache references in slideMap
    const mediaWrapper = slide.querySelector('.media-wrapper');
    const videoEl = slide.querySelector('.slide-video');
    const carouselEl = slide.querySelector('.album-carousel');
    const curAlbumIdxEl = slide.querySelector('.cur-album-idx');
    const singleImgEl = slide.querySelector('.slide-single-photo');

    window.APP_STATE.slideMap.set(index, {
      item,
      slideEl: slide,
      mediaWrapper,
      videoEl,
      carouselEl,
      curAlbumIdxEl,
      singleImgEl
    });

    this.attachSlideEvents(slide, item, index);
    return slide;
  },

  attachSlideEvents(slide, item, index) {
    const entry = window.APP_STATE.slideMap.get(index);
    if (!entry) return;

    // 1. Gesture on Video: Single tap Play/Pause, Double tap Heart, Long press 2x
    if (entry.videoEl && entry.mediaWrapper) {
      let lastTapTime = 0;
      let tapTimer = null;
      let longPressTimer = null;

      const mediaWrap = entry.mediaWrapper;

      const handlePressStart = (e) => {
        if (e.target.closest('.action-rail') || e.target.closest('.bottom-left-info')) return;
        longPressTimer = setTimeout(() => {
          if (entry.videoEl) {
            entry.videoEl.playbackRate = 2.0;
            const badge = mediaWrap.querySelector('.speed-badge');
            if (badge) badge.classList.remove('hidden');
          }
        }, 400);
      };

      const handlePressEnd = () => {
        clearTimeout(longPressTimer);
        if (entry.videoEl) {
          entry.videoEl.playbackRate = 1.0;
          const badge = mediaWrap.querySelector('.speed-badge');
          if (badge) badge.classList.add('hidden');
        }
      };

      mediaWrap.addEventListener('touchstart', (e) => {
        handlePressStart(e);
      }, { passive: true });

      mediaWrap.addEventListener('touchend', (e) => {
        handlePressEnd();
        if (e.target.closest('.action-rail') || e.target.closest('.bottom-left-info')) return;
        const now = Date.now();
        if (now - lastTapTime < 280) {
          // Double Tap
          clearTimeout(tapTimer);
          const touch = e.changedTouches ? e.changedTouches[0] : e;
          this.triggerDoubleTapHeart(item, index, touch.clientX, touch.clientY);
          lastTapTime = 0;
        } else {
          // Single Tap
          lastTapTime = now;
          tapTimer = setTimeout(() => {
            this.togglePlayPause(entry.videoEl, mediaWrap);
          }, 280);
        }
      });

      mediaWrap.addEventListener('touchcancel', handlePressEnd);
      mediaWrap.addEventListener('mousedown', handlePressStart);
      mediaWrap.addEventListener('mouseup', handlePressEnd);

      // Seekbar update on video timeupdate
      entry.videoEl.addEventListener('timeupdate', () => {
        if (window.APP_STATE.currentIndex === index && this.seekbarFill && entry.videoEl.duration) {
          const pct = (entry.videoEl.currentTime / entry.videoEl.duration) * 100;
          this.seekbarFill.style.width = `${pct}%`;
        }
        if (entry.videoEl.currentTime > 0.05 && !mediaWrap.classList.contains('is-playing')) {
          mediaWrap.classList.add('is-playing');
        }
      });

      entry.videoEl.addEventListener('playing', () => {
        mediaWrap.classList.add('is-playing');
      });
    }

    // 2. Gesture on Photo Album
    if (entry.carouselEl) {
      let scrollTimer = null;
      entry.carouselEl.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const width = entry.carouselEl.clientWidth || window.innerWidth;
          if (width > 0 && entry.curAlbumIdxEl) {
            const pageIdx = Math.round(entry.carouselEl.scrollLeft / width);
            entry.curAlbumIdxEl.textContent = pageIdx + 1;
            item.albumIndex = pageIdx;
          }
        }, 40);
      }, { passive: true });

      // Grid modal button
      const gridBtn = slide.querySelector('.album-grid-btn');
      if (gridBtn) {
        gridBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openAlbumGridModal(item, entry.carouselEl);
        });
      }

      // Counter pill button
      const counterPill = slide.querySelector('.album-counter-pill');
      if (counterPill) {
        counterPill.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openAlbumGridModal(item, entry.carouselEl);
        });
      }

      // Auto slide button
      const autoBtn = slide.querySelector('.album-autoslide-btn');
      if (autoBtn) {
        let isAuto = false;
        let autoTimer = null;
        autoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          isAuto = !isAuto;
          if (isAuto) {
            autoBtn.textContent = '⏸ Dừng';
            autoBtn.classList.add('active');
            autoTimer = setInterval(() => {
              const width = entry.carouselEl.clientWidth || window.innerWidth;
              const maxLeft = entry.carouselEl.scrollWidth - width;
              if (entry.carouselEl.scrollLeft >= maxLeft - 5) {
                entry.carouselEl.scrollTo({ left: 0, behavior: 'smooth' });
              } else {
                entry.carouselEl.scrollBy({ left: width, behavior: 'smooth' });
              }
            }, 2500);
          } else {
            autoBtn.textContent = '▶️ Tự lướt';
            autoBtn.classList.remove('active');
            clearInterval(autoTimer);
          }
        });
      }
    }

    // 3. Single Photo tap to Zoom
    if (entry.singleImgEl) {
      entry.singleImgEl.addEventListener('click', () => {
        this.openPhotoZoomModal(item.originalUrl || item.sampleUrl || item.currentUrl);
      });
    }

    // 4. Action Rail Buttons
    const btnHeart = slide.querySelector('.btn-heart');
    if (btnHeart) {
      btnHeart.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(item, index);
      });
    }

    const btnTags = slide.querySelector('.btn-tags');
    if (btnTags) {
      btnTags.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openTagsModal(item);
      });
    }

    const btnMute = slide.querySelector('.btn-mute-toggle');
    if (btnMute) {
      btnMute.addEventListener('click', (e) => {
        e.stopPropagation();
        window.APP_STATE.isGlobalMuted = !window.APP_STATE.isGlobalMuted;
        this.updateGlobalMuteState();
      });
    }

    const btnOpenWeb = slide.querySelector('.btn-open-web');
    if (btnOpenWeb) {
      btnOpenWeb.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.webUrl) window.open(item.webUrl, '_blank');
      });
    }
  },

  async activateSlide(index) {
    window.APP_STATE.currentIndex = index;

    // 1. Cleanup distant slides to free MediaCodec memory on Android
    this.cleanupDistantSlides(index);

    // 2. Activate current slide
    const entry = window.APP_STATE.slideMap.get(index);
    if (!entry) return;

    if (entry.videoEl) {
      const item = entry.item;
      // Resolve high quality video if required (r34video / r34cosplay)
      if (item.sourceKey && window.PROVIDERS[item.sourceKey]?.resolveMedia && !item._resolved) {
        try {
          await window.PROVIDERS[item.sourceKey].resolveMedia(item);
        } catch (e) {
          window.logDebug('resolveMedia err: ' + e.message);
        }
      }

      const quality = window.APP_STATE.settings.quality;
      const targetSrc = (quality === 'original' && item.originalUrl) ? item.originalUrl : (item.sampleUrl || item.currentUrl);

      if (entry.videoEl.src !== targetSrc) {
        entry.videoEl.src = targetSrc;
      }

      this.playVideoSafely(entry.videoEl, entry.mediaWrapper);
    }

    // 3. Preload next feed batch if near end
    if (index >= window.APP_STATE.items.length - 3 && !window.APP_STATE.isLoading && window.APP_STATE.hasMore) {
      if (typeof window.loadMoreFeed === 'function') {
        window.loadMoreFeed();
      }
    }
  },

  cleanupDistantSlides(currentIndex) {
    for (const [idx, entry] of window.APP_STATE.slideMap.entries()) {
      if (Math.abs(idx - currentIndex) > 1) {
        if (entry.videoEl) {
          entry.videoEl.pause();
          entry.videoEl.removeAttribute('src');
          entry.videoEl.load();
        }
        if (entry.mediaWrapper) {
          entry.mediaWrapper.classList.remove('is-playing');
        }
      }
    }
  },

  playVideoSafely(videoEl, mediaWrapper) {
    if (!videoEl) return;
    videoEl.muted = window.APP_STATE.isGlobalMuted;

    if (window.APP_STATE.settings.stableAudio) {
      videoEl.volume = Math.min(1.0, Math.max(0.2, window.APP_STATE.globalVolume));
    } else {
      videoEl.volume = window.APP_STATE.globalVolume;
    }

    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        window.logDebug(`Autoplay error: ${err.name} - ${err.message}`);
        if (err.name === 'NotAllowedError') {
          // Autoplay blocked: mute and retry
          videoEl.muted = true;
          window.APP_STATE.isGlobalMuted = true;
          this.updateGlobalMuteState();
          videoEl.play().catch(() => {});
        }
      });
    }
  },

  togglePlayPause(videoEl, mediaWrapper) {
    if (!videoEl) return;
    const indicator = mediaWrapper.querySelector('.play-pause-indicator');
    if (videoEl.paused) {
      videoEl.play().catch(() => {});
      if (indicator) {
        indicator.textContent = '▶️';
        indicator.classList.add('flash');
        setTimeout(() => indicator.classList.remove('flash'), 500);
      }
    } else {
      videoEl.pause();
      if (indicator) {
        indicator.textContent = '⏸';
        indicator.classList.add('flash');
        setTimeout(() => indicator.classList.remove('flash'), 500);
      }
    }
  },

  updateGlobalMuteState() {
    const isMuted = window.APP_STATE.isGlobalMuted;
    const currentEntry = window.APP_STATE.slideMap.get(window.APP_STATE.currentIndex);
    if (currentEntry && currentEntry.videoEl) {
      currentEntry.videoEl.muted = isMuted;
    }

    document.querySelectorAll('.btn-mute-toggle').forEach(btn => {
      const icon = btn.querySelector('.mute-icon');
      const label = btn.querySelector('.mute-label');
      if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
      if (label) label.textContent = isMuted ? 'Tắt' : 'Bật';
    });
  },

  toggleFavorite(item, index) {
    const favKey = `${item.sourceKey}_${item.id}`;
    const exists = !!window.APP_STATE.favorites[favKey];

    if (exists) {
      delete window.APP_STATE.favorites[favKey];
    } else {
      window.APP_STATE.favorites[favKey] = Object.assign({}, item, { savedAt: Date.now() });
    }
    window.saveFavoritesToStorage();

    // Update UI for slide
    const slide = document.querySelector(`.feed-slide[data-index="${index}"]`);
    if (slide) {
      const btnHeart = slide.querySelector('.btn-heart');
      const svg = slide.querySelector('.heart-svg');
      if (btnHeart && svg) {
        if (!exists) {
          btnHeart.classList.add('active');
          svg.setAttribute('fill', '#fe2c55');
        } else {
          btnHeart.classList.remove('active');
          svg.setAttribute('fill', 'currentColor');
        }
      }
    }

    if (typeof window.renderFavoritesGrid === 'function') {
      window.renderFavoritesGrid();
    }
  },

  triggerDoubleTapHeart(item, index, clientX, clientY) {
    const favKey = `${item.sourceKey}_${item.id}`;
    if (!window.APP_STATE.favorites[favKey]) {
      this.toggleFavorite(item, index);
    }

    // Create floating heart animation
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.innerHTML = '❤️';
    heart.style.left = `${clientX - 25}px`;
    heart.style.top = `${clientY - 25}px`;
    document.body.appendChild(heart);

    setTimeout(() => {
      if (heart.parentNode) heart.parentNode.removeChild(heart);
    }, 900);
  },

  // Modal: Album Grid
  openAlbumGridModal(item, carouselEl) {
    if (!this.albumGridModal || !this.albumGridContainer) return;
    if (this.albumGridTitle) {
      this.albumGridTitle.textContent = `Bộ ảnh (${item.albumImages.length} ảnh)`;
    }

    this.albumGridContainer.innerHTML = '';
    const activeIdx = item.albumIndex || 0;

    item.albumImages.forEach((url, i) => {
      const thumb = document.createElement('div');
      thumb.className = `album-grid-thumb ${i === activeIdx ? 'active' : ''}`;
      thumb.innerHTML = `
        <img src="${url}" loading="lazy" referrerpolicy="no-referrer" alt="thumb ${i + 1}">
        <span class="album-thumb-idx">${i + 1}</span>
      `;

      thumb.addEventListener('click', () => {
        if (carouselEl) {
          const width = carouselEl.clientWidth || window.innerWidth;
          carouselEl.scrollTo({ left: i * width, behavior: 'smooth' });
        }
        item.albumIndex = i;
        this.closeAlbumGridModal();
      });

      this.albumGridContainer.appendChild(thumb);
    });

    this.albumGridModal.classList.add('active');
  },

  closeAlbumGridModal() {
    if (this.albumGridModal) this.albumGridModal.classList.remove('active');
  },

  // Modal: Photo Zoom
  openPhotoZoomModal(imgUrl) {
    if (!this.photoZoomModal || !this.photoZoomImg) return;
    this.photoZoomImg.src = imgUrl;
    this.photoZoomImg.style.transform = 'scale(1)';
    let isZoomed = false;

    this.photoZoomImg.onclick = () => {
      isZoomed = !isZoomed;
      this.photoZoomImg.style.transform = isZoomed ? 'scale(2.2)' : 'scale(1)';
    };

    this.photoZoomModal.classList.add('active');
  },

  closePhotoZoomModal() {
    if (this.photoZoomModal) {
      this.photoZoomModal.classList.remove('active');
      if (this.photoZoomImg) this.photoZoomImg.src = '';
    }
  },

  // Modal: Tags Viewer
  openTagsModal(item) {
    if (!this.tagsModal || !this.tagsContainer) return;
    if (this.tagsModalTitle) {
      this.tagsModalTitle.textContent = item.title || 'Danh sách Tags';
    }

    this.tagsContainer.innerHTML = '';
    const tagList = (item.tagString || '').split(/\s+/).filter(Boolean);

    if (tagList.length === 0) {
      this.tagsContainer.innerHTML = '<div class="tags-empty-hint">Không có thông tin tag chi tiết.</div>';
    } else {
      tagList.forEach(tag => {
        const tagChip = document.createElement('div');
        tagChip.className = 'tag-chip-row';
        tagChip.innerHTML = `
          <span class="tag-chip-name">#${tag}</span>
          <button class="btn-block-tag" title="Chặn tag này">🚫 Chặn</button>
        `;

        // Click tag to search
        tagChip.querySelector('.tag-chip-name').addEventListener('click', () => {
          this.closeTagsModal();
          if (typeof window.executeSearchTag === 'function') {
            window.executeSearchTag(tag);
          }
        });

        // Click block to add to blacklist
        tagChip.querySelector('.btn-block-tag').addEventListener('click', (e) => {
          e.stopPropagation();
          if (!window.APP_STATE.blacklist.includes(tag.toLowerCase())) {
            window.APP_STATE.blacklist.push(tag.toLowerCase());
            window.saveBlacklistToStorage();
            if (typeof window.showToast === 'function') {
              window.showToast(`Đã chặn tag: ${tag}`);
            }
          }
        });

        this.tagsContainer.appendChild(tagChip);
      });
    }

    this.tagsModal.classList.add('active');
  },

  closeTagsModal() {
    if (this.tagsModal) this.tagsModal.classList.remove('active');
  }
};
