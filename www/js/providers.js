/**
 * Shorts v4 Clean - Providers Module
 * 11 content providers with resilient parsing & normalization
 */

window.PROVIDERS = {
  // 1. XBOORU PROVIDER (Anime & 3D Video)
  xbooru: {
    name: 'Xbooru',
    category: 'anime',
    badgeIcon: '🌸',
    badgeName: 'Xbooru',
    defaultTag: 'video',
    hotTags: ['video', 'animated', 'genshin_impact', 'blue_archive', 'hololive', 'honkai_star_rail', '3d', 'sound'],
    searchPlaceholder: 'Tìm tag Xbooru (vd: video, genshin_impact, 3d...)',
    hintText: 'Kho Anime & 3D lớn nhất, trực tiếp MP4',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const tagTokens = [];
      const rawTag = (tag || '').trim();
      if (rawTag) {
        rawTag.split(/\s+/).forEach(t => {
          const c = t.replace(/^[#@]+/, '').trim();
          if (c && !tagTokens.includes(c)) tagTokens.push(c);
        });
      }
      if (!tagTokens.some(t => t === 'video' || t === 'animated')) {
        tagTokens.push('video');
      }

      if (sortMode === 'hot') {
        if (!tagTokens.some(t => t.startsWith('sort:'))) tagTokens.push('sort:views:desc');
      } else if (sortMode === 'random') {
        if (!tagTokens.some(t => t.startsWith('sort:'))) tagTokens.push('sort:random');
      } else {
        if (!tagTokens.some(t => t.startsWith('sort:'))) tagTokens.push('sort:id:desc');
      }

      if (window.APP_STATE.settings.rating === 'safe') {
        if (!tagTokens.some(t => t.startsWith('rating:'))) tagTokens.push('rating:safe');
      } else if (window.APP_STATE.settings.rating === 'explicit') {
        if (!tagTokens.some(t => t.startsWith('rating:'))) tagTokens.push('rating:explicit');
      }

      const pid = Math.max(0, page - 1);
      const url = `https://xbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=20&pid=${pid}&tags=${encodeURIComponent(tagTokens.join(' '))}`;

      const res = await window.safeFetch(url);
      if (!res.ok) throw new Error(`Xbooru API status: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map(p => {
        const fileUrl = p.file_url || (p.directory && p.image ? `https://mp4.xbooru.com/images/${p.directory}/${p.image}` : '');
        const sampleUrl = p.sample_url || (p.directory && p.image ? `https://img.xbooru.com/images/${p.directory}/${p.image}` : fileUrl);
        const previewUrl = p.preview_url || sampleUrl;
        const isVideo = (p.image && (p.image.endsWith('.mp4') || p.image.endsWith('.webm'))) || (p.tags && (p.tags.includes('video') || p.tags.includes('animated')));

        const tagList = (p.tags || '').split(/\s+/).filter(Boolean);
        const charTags = tagList.filter(t => t.includes('(') || t.includes('miku') || t.includes('tifa') || t.includes('genshin'));
        const charName = charTags.slice(0, 2).map(t => t.replace(/_/g, ' ')).join(', ');

        return {
          id: String(p.id),
          sourceKey: 'xbooru',
          parentId: p.parent_id ? String(p.parent_id) : null,
          hasChildren: false,
          title: `Post #${p.id}`,
          artist: p.owner || 'Xbooru Creator',
          character: charName,
          copyright: 'Xbooru',
          mediaType: isVideo ? 'video' : 'image',
          fileExt: isVideo ? 'mp4' : 'jpg',
          width: p.width || 720,
          height: p.height || 720,
          aspectRatio: (p.width && p.height) ? (p.width / p.height) : 0.5625,
          poster: previewUrl,
          sampleUrl: sampleUrl,
          originalUrl: fileUrl,
          currentUrl: fileUrl,
          tagString: (p.tags || '').toLowerCase(),
          tagList: {
            artist: [p.owner].filter(Boolean),
            copyright: ['xbooru'],
            character: charTags,
            general: tagList.slice(0, 20),
            meta: []
          },
          favCount: p.score || 0,
          webUrl: `https://xbooru.com/index.php?page=post&s=view&id=${p.id}`
        };
      }).filter(item => item.currentUrl);
    }
  },

  // 2. RULE34VIDEO PROVIDER (3D & Animation HTML Scraper)
  r34video: {
    name: 'Rule34Video',
    category: 'anime',
    badgeIcon: '🔞',
    badgeName: 'Rule34Video',
    defaultTag: '',
    hotTags: ['genshin-impact', 'overwatch', '3d', 'animation', 'resident-evil', 'honkai-star-rail', 'league-of-legends', 'tifa', 'cyberpunk', 'blender'],
    searchPlaceholder: 'Tìm từ khóa Rule34Video (vd: genshin, 3d...)',
    hintText: 'Kho 3D & Animation phương Tây Full HD',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const query = (tag || '').trim().replace(/\s+/g, '-').toLowerCase();
      let targetUrl = '';
      const isRandom = sortMode === 'random';

      if (query) {
        targetUrl = `https://rule34video.com/search/${encodeURIComponent(query)}/${page > 1 ? page + '/' : ''}`;
      } else if (sortMode === 'hot') {
        targetUrl = `https://rule34video.com/most-popular/${page > 1 ? page + '/' : ''}`;
      } else if (isRandom) {
        const randomPage = Math.floor(Math.random() * 150) + 1;
        targetUrl = `https://rule34video.com/latest-updates/${randomPage}/?_t=${Date.now()}`;
      } else {
        targetUrl = `https://rule34video.com/latest-updates/${page > 1 ? page + '/' : ''}`;
      }

      const res = await window.safeFetch(targetUrl, {
        headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      });

      if (!res.ok) throw new Error(`Rule34Video error: ${res.status}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const items = [];
      const itemMap = new Map();
      const cards = doc.querySelectorAll('.item.thumb, [data-video-card-id]');

      cards.forEach(card => {
        const cardId = card.getAttribute('data-video-card-id');
        const a = card.querySelector('a.th, a[href*="/video/"]');
        const rawHref = a ? a.getAttribute('href') : '';

        let videoId = cardId;
        if (!videoId && rawHref) {
          const m = rawHref.match(/\/video\/(\d+)\//);
          if (m) videoId = m[1];
        }
        if (!videoId || itemMap.has(videoId)) return;
        itemMap.set(videoId, true);

        let absUrl = '';
        if (rawHref) {
          try { absUrl = new URL(rawHref, 'https://rule34video.com').href; } catch (e) {}
        }

        const previewWrap = card.querySelector('[data-preview]');
        const previewVideoUrl = (previewWrap ? previewWrap.getAttribute('data-preview') : '').replace(/\/+$/, '');

        const img = card.querySelector('img.thumb, img');
        let poster = '';
        if (img) {
          poster = img.getAttribute('data-rd-jpg') || img.getAttribute('src') || img.getAttribute('data-src') || '';
          if (poster && poster.startsWith('//')) poster = 'https:' + poster;
          else if (poster && poster.startsWith('/')) poster = 'https://rule34video.com' + poster;
        }

        let title = card.querySelector('.thumb_title')?.textContent.trim() ||
                    a?.getAttribute('title') || img?.getAttribute('alt') || `Video #${videoId}`;
        title = (title || '').replace(/\s+/g, ' ').trim();

        const tagTokens = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(t => t.length > 2);

        items.push({
          id: videoId,
          sourceKey: 'r34video',
          parentId: null,
          hasChildren: false,
          title: title,
          artist: 'R34 Creator',
          character: '',
          copyright: 'Rule34Video',
          mediaType: 'video',
          fileExt: 'mp4',
          width: 1080,
          height: 1920,
          aspectRatio: 0.5625,
          poster: poster,
          sampleUrl: previewVideoUrl,
          originalUrl: previewVideoUrl,
          currentUrl: previewVideoUrl,
          videoPageUrl: absUrl,
          tagString: tagTokens.join(' '),
          tagList: {
            artist: ['R34 Creator'],
            copyright: ['rule34video'],
            character: [],
            general: tagTokens,
            meta: ['sound']
          },
          favCount: 0,
          webUrl: absUrl
        });
      });

      return items;
    },

    async resolveMedia(item) {
      if (!item.videoPageUrl) return item.currentUrl || '';
      if (item._resolved && item.currentUrl) return item.currentUrl;
      try {
        const res = await window.safeFetch(item.videoPageUrl);
        if (!res.ok) return item.currentUrl;
        const html = await res.text();

        const videoUrlMatch = html.match(/video_url\s*[:=]\s*['"]([^'"]+)['"]/);
        if (videoUrlMatch && videoUrlMatch[1]) {
          const clean = videoUrlMatch[1].replace(/&amp;/g, '&');
          item.originalUrl = clean;
          item.sampleUrl = clean;
          item.currentUrl = clean;
          item._resolved = true;
          return clean;
        }

        const mp4Matches = html.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/g) || [];
        for (const m of mp4Matches) {
          const clean = m.replace(/&amp;/g, '&');
          if (clean.includes('_preview.mp4')) continue;
          item.originalUrl = clean;
          item.sampleUrl = clean;
          item.currentUrl = clean;
          item._resolved = true;
          return clean;
        }
      } catch (e) {
        window.logDebug('R34Video resolveMedia error: ' + e.message);
      }
      return item.currentUrl;
    }
  },

  // 3. HYPNOHUB PROVIDER (Anime Animation Loops)
  hypnohub: {
    name: 'Hypnohub',
    category: 'anime',
    badgeIcon: '💫',
    badgeName: 'Hypnohub',
    defaultTag: 'video',
    hotTags: ['video', 'animated', 'loop', 'audio', 'sound', '3d'],
    searchPlaceholder: 'Tìm tag Hypnohub (vd: video, animated, loop...)',
    hintText: 'Kho Animation & Loops ngắn phong cách anime',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const tagTokens = [];
      const rawTag = (tag || '').trim();
      if (rawTag) {
        rawTag.split(/\s+/).forEach(t => {
          const c = t.replace(/^[#@]+/, '').trim();
          if (c && !tagTokens.includes(c)) tagTokens.push(c);
        });
      }
      if (!tagTokens.some(t => t === 'video' || t === 'animated')) {
        tagTokens.push('video');
      }

      const pid = Math.max(0, page - 1);
      const url = `https://hypnohub.net/index.php?page=dapi&s=post&q=index&json=1&limit=20&pid=${pid}&tags=${encodeURIComponent(tagTokens.join(' '))}`;

      const res = await window.safeFetch(url);
      if (!res.ok) throw new Error(`Hypnohub API error: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map(p => {
        const fileUrl = p.file_url || '';
        const previewUrl = p.preview_url || fileUrl;
        const tagList = (p.tags || '').split(/\s+/).filter(Boolean);
        const isVideo = fileUrl.endsWith('.mp4') || fileUrl.endsWith('.webm') || tagList.includes('video') || tagList.includes('animated');

        return {
          id: String(p.id),
          sourceKey: 'hypnohub',
          parentId: null,
          hasChildren: false,
          title: `Loop #${p.id}`,
          artist: p.author || 'Hypnohub Creator',
          character: '',
          copyright: 'Hypnohub',
          mediaType: isVideo ? 'video' : 'image',
          fileExt: isVideo ? 'mp4' : 'jpg',
          width: p.width || 720,
          height: p.height || 1280,
          aspectRatio: (p.width && p.height) ? (p.width / p.height) : 0.5625,
          poster: previewUrl,
          sampleUrl: fileUrl,
          originalUrl: fileUrl,
          currentUrl: fileUrl,
          tagString: (p.tags || '').toLowerCase(),
          tagList: {
            artist: [p.author].filter(Boolean),
            copyright: ['hypnohub'],
            character: [],
            general: tagList.slice(0, 15),
            meta: []
          },
          favCount: p.score || 0,
          webUrl: `https://hypnohub.net/post/show/${p.id}`
        };
      }).filter(item => item.currentUrl);
    }
  },

  // 4. COSPLAYTELE PROVIDER (Album ảnh Cosplay dọc HD trọn bộ)
  cosplaytele: {
    name: 'CosplayTele',
    category: 'real',
    badgeIcon: '👘',
    badgeName: 'CosplayTele',
    defaultTag: '',
    hotTags: ['genshin', 'honkai', 'star rail', 'nikke', 'azur lane', 'tifa', 'nier', 'bunny', 'swimsuit', 'maid'],
    searchPlaceholder: 'Tìm theo nhân vật/model (vd: genshin, nahida, tifa...)',
    hintText: 'Album Cosplay người thật HD trọn bộ',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const query = (tag || '').trim();
      const targetPage = sortMode === 'random' ? (Math.floor(Math.random() * 50) + 1) : page;
      let url = `https://cosplaytele.com/wp-json/wp/v2/posts?per_page=8&page=${targetPage}`;
      if (query) {
        url += `&search=${encodeURIComponent(query)}`;
      }

      const res = await window.safeFetch(url);
      if (!res.ok) throw new Error(`CosplayTele error: ${res.status}`);
      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) return [];

      const items = [];
      posts.forEach(p => {
        const rawTitle = p.title?.rendered || `Album #${p.id}`;
        const cleanTitle = rawTitle.replace(/&#\d+;/g, '').replace(/&amp;/g, '&').replace(/&#8211;/g, '-').replace(/&#8220;|&#8221;/g, '"');
        const content = p.content?.rendered || '';

        const imgMatches = content.match(/<img[^>]+src=["']([^"']+)["']/g) || [];
        const images = [];
        imgMatches.forEach(m => {
          const uMatch = m.match(/src=["']([^"']+)["']/);
          if (uMatch && uMatch[1] && !images.includes(uMatch[1])) {
            images.push(uMatch[1]);
          }
        });

        if (images.length === 0) return;

        let cosplayer = 'Cosplay Creator';
        let character = '';
        const parts = cleanTitle.split(/cosplay|–|-/i);
        if (parts.length > 0) cosplayer = parts[0].trim();
        if (parts.length > 1) character = parts[1].replace(/"[^"]*photos.*"/i, '').trim();

        const poster = images[0] || '';

        items.push({
          id: String(p.id),
          sourceKey: 'cosplaytele',
          parentId: null,
          hasChildren: images.length > 1,
          title: cleanTitle,
          artist: cosplayer,
          character: character,
          copyright: 'CosplayTele',
          mediaType: images.length > 1 ? 'image_album' : 'image',
          fileExt: 'webp',
          width: 1200,
          height: 1600,
          aspectRatio: 0.75,
          poster: poster,
          sampleUrl: poster,
          originalUrl: poster,
          currentUrl: poster,
          albumImages: images,
          albumIndex: 0,
          tagString: cleanTitle.toLowerCase(),
          tagList: {
            artist: [cosplayer],
            copyright: ['cosplaytele'],
            character: [character].filter(Boolean),
            general: ['cosplay', 'album', 'photos'],
            meta: []
          },
          favCount: images.length,
          webUrl: p.link || `https://cosplaytele.com/?p=${p.id}`
        });
      });

      return items;
    }
  },

  // 5. IDOL PHOTO GALLERY (1.9M+ ảnh Cosplay & Gravure HD)
  idolphoto: {
    name: 'Idol Photos',
    category: 'real',
    badgeIcon: '📸',
    badgeName: 'Idol Photos',
    defaultTag: 'cosplay',
    hotTags: ['cosplay', 'gravure', 'bikini', 'japanese', 'korean', 'dance', 'genshin_impact', 'honkai:_star_rail', 'nier:_automata'],
    searchPlaceholder: 'Tìm ảnh Cosplay/Gravure (vd: cosplay, gravure, bikini...)',
    hintText: 'Kho 1.900.000+ ảnh người thật sắc nét',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const isRandom = sortMode === 'random';
      let tagTokens = (tag || '').trim().split(/\s+/).filter(Boolean);
      tagTokens = tagTokens.map(t => t.replace(/^[#@]+/, '').trim()).filter(Boolean);

      if (tagTokens.length === 0) {
        tagTokens.push('cosplay');
      }

      if (sortMode === 'hot') {
        if (!tagTokens.some(t => t.startsWith('order:'))) tagTokens.push('order:popularity');
      } else if (sortMode === 'random') {
        if (!tagTokens.some(t => t.startsWith('order:'))) tagTokens.push('order:random');
      }

      const url = new URL('https://i.sankakuapi.com/v2/posts/keyset');
      url.searchParams.set('limit', '30');
      url.searchParams.set('tags', tagTokens.join(' '));

      if (isRandom) {
        url.searchParams.set('_rnd', `${Date.now()}_${Math.random()}`);
      } else if (window.APP_STATE.nextCursor && page > 1) {
        url.searchParams.set('next', window.APP_STATE.nextCursor);
      }

      const res = await window.safeFetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://www.idolcomplex.com'
        }
      });

      if (!res.ok) throw new Error(`Idol Photos API error: ${res.status}`);
      const json = await res.json();
      const rawPosts = json.data || (Array.isArray(json) ? json : []);
      const meta = json.meta || {};

      if (meta.next) window.APP_STATE.nextCursor = meta.next;
      else if (rawPosts.length > 0) window.APP_STATE.nextCursor = rawPosts[rawPosts.length - 1].id;

      const items = [];
      rawPosts.forEach(post => {
        if (post.is_deleted || post.is_banned || post.redirect_to_signup) return;
        const originalUrl = post.file_url;
        const sampleUrl = post.sample_url || originalUrl;
        if (!originalUrl && !sampleUrl) return;

        const fileExt = (post.file_type || '').split('/')[1] || 'jpg';
        const isVideo = fileExt === 'mp4' || fileExt === 'webm';
        if (isVideo) return;

        const tagNames = (post.tags || []).map(t => (t.name || t.tagName || '').toLowerCase());
        const tagStr = tagNames.join(' ');

        let postTitle = '';
        if (tagNames.length > 0) {
          postTitle = tagNames.slice(0, 3).map(t => t.replace(/_/g, ' ')).join(', ');
        }

        items.push({
          id: post.id.toString(),
          sourceKey: 'idolphoto',
          parentId: null,
          hasChildren: false,
          title: postTitle || `Idol Photo #${post.id}`,
          artist: 'Idol Creator',
          character: '',
          copyright: 'Idol Complex',
          mediaType: 'image',
          fileExt: fileExt,
          width: post.width || 1080,
          height: post.height || 1920,
          aspectRatio: (post.width && post.height) ? (post.width / post.height) : 0.5625,
          poster: post.preview_url || sampleUrl || originalUrl,
          sampleUrl: sampleUrl,
          originalUrl: originalUrl,
          currentUrl: sampleUrl || originalUrl,
          tagString: tagStr,
          tagList: {
            artist: [],
            copyright: ['idolcomplex'],
            character: [],
            general: tagNames.slice(0, 20),
            meta: []
          },
          favCount: post.fav_count || post.vote_count || 0,
          webUrl: `https://idol.sankakucomplex.com/post/show/${post.id}`
        });
      });

      return items;
    }
  },

  // 6. IDOL COMPLEX VIDEO (63K+ clip Fancam, Dance, TikTok)
  idolcomplex: {
    name: 'Idol Video',
    category: 'real',
    badgeIcon: '✨',
    badgeName: 'Idol Video',
    defaultTag: 'video',
    hotTags: ['video', 'cosplay', 'dance', 'idol', 'gravure', 'bikini', 'uniform', 'japanese', 'korean'],
    searchPlaceholder: 'Tìm clip Idol/Fancam (vd: cosplay, dance, bikini...)',
    hintText: 'Kho clip nhảy TikTok & Idol có nhạc',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      let finalTags = (tag || '').trim();
      if (!finalTags) finalTags = 'video';
      else if (!finalTags.includes('video')) finalTags += ' video';

      if (sortMode === 'hot' && !finalTags.includes('order:')) {
        finalTags += ' order:quality';
      } else if (sortMode === 'random' && !finalTags.includes('order:')) {
        finalTags += ' order:random';
      }

      const url = new URL('https://i.sankakuapi.com/v2/posts/keyset');
      url.searchParams.set('limit', '30');
      url.searchParams.set('tags', finalTags);

      if (page > 1 && window.APP_STATE.nextCursor && sortMode !== 'random') {
        url.searchParams.set('next', window.APP_STATE.nextCursor);
      }

      const res = await window.safeFetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://www.idolcomplex.com'
        }
      });

      if (!res.ok) throw new Error(`Idol Complex API error: ${res.status}`);
      const data = await res.json();
      window.APP_STATE.nextCursor = data.meta?.next || null;

      const rawPosts = data.data || [];
      if (!Array.isArray(rawPosts) || rawPosts.length === 0) return [];

      const items = [];
      rawPosts.forEach(post => {
        if (post.redirect_to_signup || post.status === 'deleted' || post.status === 'removed') return;

        const fileType = (post.file_type || '').toLowerCase();
        const fileUrl = post.file_url || '';
        const sampleUrl = post.sample_url || fileUrl;
        let previewUrl = post.preview_url || sampleUrl;

        if (!fileUrl && !sampleUrl) return;

        const isVideo = fileType.includes('video') || fileUrl.includes('.mp4') || fileUrl.includes('.webm') || !!post.video_duration;
        if (!isVideo) return;

        const authorName = post.author?.name || 'Idol Complex';
        const authorAvatar = post.author?.avatar || '';

        const tagNames = post.tag_names || (post.tags || []).map(t => typeof t === 'string' ? t : t.name).filter(Boolean);
        const tagStr = tagNames.join(' ').toLowerCase();

        let postTitle = post.source ? post.source.replace(/^https?:\/\//, '').split('/')[0] : '';
        if (!postTitle && tagNames.length > 0) {
          postTitle = tagNames.slice(0, 3).map(t => t.replace(/_/g, ' ')).join(', ');
        }
        if (!postTitle) postTitle = `Idol #${post.id}`;

        items.push({
          id: post.id.toString(),
          sourceKey: 'idolcomplex',
          parentId: post.parent_id ? post.parent_id.toString() : null,
          hasChildren: !!post.has_children,
          title: postTitle,
          artist: authorName,
          authorAvatar: authorAvatar,
          character: '',
          copyright: 'Idol Complex',
          mediaType: 'video',
          fileExt: 'mp4',
          width: post.width || 1080,
          height: post.height || 1920,
          aspectRatio: (post.width && post.height) ? (post.width / post.height) : 0.5625,
          poster: previewUrl,
          sampleUrl: sampleUrl,
          originalUrl: fileUrl,
          currentUrl: fileUrl || sampleUrl,
          tagString: tagStr,
          tagList: {
            artist: [authorName],
            copyright: ['idolcomplex'],
            character: [],
            general: tagNames.slice(0, 20),
            meta: ['video', post.rating || 'q']
          },
          favCount: post.fav_count || 0,
          webUrl: `https://www.idolcomplex.com/post/show/${post.id}`
        });
      });

      return items;
    }
  },

  // 7. R34 COSPLAY LIVE-ACTION PROVIDER
  r34cosplay: {
    name: 'R34 Cosplay',
    category: 'real',
    badgeIcon: '🎭',
    badgeName: 'R34 Cosplay',
    defaultTag: 'cosplay',
    hotTags: ['cosplay', 'live-action', 'tifa', '2b', 'overwatch', 'genshin', 'resident-evil', 'nier'],
    searchPlaceholder: 'Tìm clip cosplay người thật...',
    hintText: 'Video Cosplay người thật Full HD có âm thanh',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const query = (tag || 'cosplay').trim().replace(/\s+/g, '-').toLowerCase();
      let targetUrl = `https://rule34video.com/search/${encodeURIComponent(query)}/${page > 1 ? page + '/' : ''}`;

      if (sortMode === 'hot') {
        targetUrl = `https://rule34video.com/search/${encodeURIComponent(query)}/${page > 1 ? page + '/' : ''}?sort=views`;
      }

      const res = await window.safeFetch(targetUrl, {
        headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      });

      if (!res.ok) throw new Error(`R34 Cosplay error: ${res.status}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const items = [];
      const itemMap = new Map();
      const cards = doc.querySelectorAll('.item.thumb, [data-video-card-id]');

      cards.forEach(card => {
        const cardId = card.getAttribute('data-video-card-id');
        const a = card.querySelector('a.th, a[href*="/video/"]');
        const rawHref = a ? a.getAttribute('href') : '';

        let videoId = cardId;
        if (!videoId && rawHref) {
          const m = rawHref.match(/\/video\/(\d+)\//);
          if (m) videoId = m[1];
        }
        if (!videoId || itemMap.has(videoId)) return;
        itemMap.set(videoId, true);

        let absUrl = '';
        if (rawHref) {
          try { absUrl = new URL(rawHref, 'https://rule34video.com').href; } catch (e) {}
        }

        const previewWrap = card.querySelector('[data-preview]');
        const previewVideoUrl = (previewWrap ? previewWrap.getAttribute('data-preview') : '').replace(/\/+$/, '');

        const img = card.querySelector('img.thumb, img');
        let poster = '';
        if (img) {
          poster = img.getAttribute('data-rd-jpg') || img.getAttribute('src') || img.getAttribute('data-src') || '';
          if (poster && poster.startsWith('//')) poster = 'https:' + poster;
          else if (poster && poster.startsWith('/')) poster = 'https://rule34video.com' + poster;
        }

        let title = card.querySelector('.thumb_title')?.textContent.trim() ||
                    a?.getAttribute('title') || img?.getAttribute('alt') || `Cosplay #${videoId}`;
        title = (title || '').replace(/\s+/g, ' ').trim();

        const tagTokens = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(t => t.length > 2);

        items.push({
          id: videoId,
          sourceKey: 'r34cosplay',
          parentId: null,
          hasChildren: false,
          title: title,
          artist: 'Cosplay Creator',
          character: '',
          copyright: 'Rule34Video',
          mediaType: 'video',
          fileExt: 'mp4',
          width: 1080,
          height: 1920,
          aspectRatio: 0.5625,
          poster: poster,
          sampleUrl: previewVideoUrl,
          originalUrl: previewVideoUrl,
          currentUrl: previewVideoUrl,
          videoPageUrl: absUrl,
          tagString: tagTokens.join(' '),
          tagList: {
            artist: ['Cosplay Creator'],
            copyright: ['r34cosplay'],
            character: [],
            general: tagTokens,
            meta: ['sound']
          },
          favCount: 0,
          webUrl: absUrl
        });
      });

      return items;
    },

    async resolveMedia(item) {
      return window.PROVIDERS.r34video.resolveMedia(item);
    }
  },

  // 8. XBOORU COSPLAY PROVIDER
  xbooru_cosplay: {
    name: 'Xbooru Cosplay',
    category: 'real',
    badgeIcon: '🌸',
    badgeName: 'X-Cosplay',
    defaultTag: 'cosplay video',
    hotTags: ['cosplay', 'video', '3d', 'genshin_impact', 'tifa', 'nier', 'hatsune_miku'],
    searchPlaceholder: 'Tìm cosplay trên Xbooru...',
    hintText: 'Video & ảnh Cosplay từ kho Xbooru',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const queryTag = tag ? `${tag} cosplay` : 'cosplay video';
      const list = await window.PROVIDERS.xbooru.fetchFeed(page, queryTag, sortMode);
      return list.map(item => Object.assign({}, item, { sourceKey: 'xbooru_cosplay' }));
    }
  },

  // 9. SAFEBOORU PROVIDER (4.2M+ bài SFW Anime)
  safebooru: {
    name: 'Safebooru',
    category: 'sfw',
    badgeIcon: '🍃',
    badgeName: 'Safebooru',
    defaultTag: '',
    hotTags: ['genshin_impact', 'blue_archive', 'scenery', 'original', 'cute', 'pixel_art', 'cat', 'hololive'],
    searchPlaceholder: 'Tìm ảnh anime an toàn (vd: genshin_impact, cute...)',
    hintText: 'Kho Ảnh & Gifs Anime an toàn 100%',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const tagTokens = [];
      const rawTag = (tag || '').trim();
      if (rawTag) {
        rawTag.split(/\s+/).forEach(t => {
          const c = t.replace(/^[#@]+/, '').trim();
          if (c && !tagTokens.includes(c)) tagTokens.push(c);
        });
      }

      const pid = sortMode === 'random' ? Math.floor(Math.random() * 100) : Math.max(0, page - 1);
      const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=20&pid=${pid}&tags=${encodeURIComponent(tagTokens.join(' '))}`;

      const res = await window.safeFetch(url);
      if (!res.ok) throw new Error(`Safebooru error: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map(p => {
        const fileUrl = p.file_url || (p.directory && p.image ? `https://safebooru.org/images/${p.directory}/${p.image}` : '');
        const sampleUrl = p.sample_url || fileUrl;
        const previewUrl = p.preview_url || sampleUrl;
        const tagList = (p.tags || '').split(/\s+/).filter(Boolean);

        return {
          id: String(p.id),
          sourceKey: 'safebooru',
          parentId: null,
          hasChildren: false,
          title: `Safe Anime #${p.id}`,
          artist: p.owner || 'Anime Artist',
          character: '',
          copyright: 'Safebooru',
          mediaType: 'image',
          fileExt: 'jpg',
          width: p.width || 720,
          height: p.height || 720,
          aspectRatio: (p.width && p.height) ? (p.width / p.height) : 0.5625,
          poster: previewUrl,
          sampleUrl: sampleUrl,
          originalUrl: fileUrl,
          currentUrl: sampleUrl || fileUrl,
          tagString: (p.tags || '').toLowerCase(),
          tagList: {
            artist: [p.owner].filter(Boolean),
            copyright: ['safebooru'],
            character: [],
            general: tagList.slice(0, 15),
            meta: []
          },
          favCount: p.score || 0,
          webUrl: `https://safebooru.org/index.php?page=post&s=view&id=${p.id}`
        };
      }).filter(item => item.currentUrl);
    }
  },

  // 10. XBOORU SAFE VIDEO PROVIDER
  xbooru_safe: {
    name: 'Xbooru Safe',
    category: 'sfw',
    badgeIcon: '🌸',
    badgeName: 'X-Safe',
    defaultTag: 'video rating:safe',
    hotTags: ['video', 'rating:safe', 'animated', 'scenery', 'game', 'cute', 'genshin_impact'],
    searchPlaceholder: 'Tìm video anime an toàn...',
    hintText: 'Video Anime chuẩn an toàn (rating:safe)',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const queryTag = tag ? `${tag} rating:safe` : 'video rating:safe';
      const list = await window.PROVIDERS.xbooru.fetchFeed(page, queryTag, sortMode);
      return list.map(item => Object.assign({}, item, { sourceKey: 'xbooru_safe' }));
    }
  },

  // 11. KONACHAN SFW PROVIDER
  konachan_sfw: {
    name: 'Konachan SFW',
    category: 'sfw',
    badgeIcon: '✨',
    badgeName: 'Konachan',
    defaultTag: '',
    hotTags: ['scenery', 'original', 'sky', 'clouds', 'animal', 'city', 'genshin_impact', 'wallpaper'],
    searchPlaceholder: 'Tìm ảnh Wallpaper HD Konachan...',
    hintText: 'Wallpaper Anime phong cảnh & nghệ thuật Safe',

    async fetchFeed(page = 1, tag = '', sortMode = 'recent') {
      const tagTokens = [];
      const rawTag = (tag || '').trim();
      if (rawTag) {
        rawTag.split(/\s+/).forEach(t => {
          const c = t.replace(/^[#@]+/, '').trim();
          if (c && !tagTokens.includes(c)) tagTokens.push(c);
        });
      }

      const targetPage = sortMode === 'random' ? (Math.floor(Math.random() * 50) + 1) : page;
      const url = `https://konachan.net/post.json?limit=20&page=${targetPage}&tags=${encodeURIComponent(tagTokens.join(' '))}`;

      const res = await window.safeFetch(url);
      if (!res.ok) throw new Error(`Konachan SFW error: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map(p => {
        const fileUrl = p.file_url || p.sample_url || p.preview_url || '';
        const tagList = (p.tags || '').split(/\s+/).filter(Boolean);

        return {
          id: String(p.id),
          sourceKey: 'konachan_sfw',
          parentId: null,
          hasChildren: false,
          title: `Konachan #${p.id}`,
          artist: p.author || 'Anime Artist',
          character: '',
          copyright: 'Konachan',
          mediaType: 'image',
          fileExt: 'jpg',
          width: p.width || 1280,
          height: p.height || 720,
          aspectRatio: (p.width && p.height) ? (p.width / p.height) : 0.5625,
          poster: p.preview_url || fileUrl,
          sampleUrl: p.sample_url || fileUrl,
          originalUrl: fileUrl,
          currentUrl: p.sample_url || fileUrl,
          tagString: (p.tags || '').toLowerCase(),
          tagList: {
            artist: [p.author].filter(Boolean),
            copyright: ['konachan'],
            character: [],
            general: tagList.slice(0, 15),
            meta: []
          },
          favCount: p.score || 0,
          webUrl: `https://konachan.net/post/show/${p.id}`
        };
      }).filter(item => item.currentUrl);
    }
  }
};
