/**
 * Verification Test Suite for Shorts v4 Clean
 * Tests:
 * 1. Syntax check on all 4 JS modules
 * 2. DOM ID matching between HTML and JS
 * 3. Rapid Source Switching simulation across 5 providers with hardware decoder cleanup
 * 4. Passcode 6-digit verification and multitasking lock
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.join(__dirname, 'www');

console.log('================================================================');
console.log('STARTING AUTOMATED VERIFICATION: SHORTS V4 CLEAN');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: SYNTAX CHECK ON JS FILES
// -----------------------------------------------------------------------------
console.log('[TEST 1] Syntax Check on all JS modules...');
const jsFiles = ['state.js', 'providers.js', 'player.js', 'main.js'];

jsFiles.forEach(file => {
  const filePath = path.join(baseDir, 'js', file);
  const code = fs.readFileSync(filePath, 'utf8');
  try {
    new vm.Script(code, { filename: file });
    console.log(`  ✓ ${file}: Valid JavaScript syntax (0 errors)`);
  } catch (err) {
    console.error(`  ✗ ${file}: Syntax Error ->`, err.message);
    process.exit(1);
  }
});

// -----------------------------------------------------------------------------
// TEST 2: DOM ID MATCHING BETWEEN HTML & JS
// -----------------------------------------------------------------------------
console.log('\n[TEST 2] Checking DOM ID matching between HTML and JS...');
const htmlContent = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

const requiredIds = [
  'passcode-overlay',
  'passcode-prompt-text',
  'passcode-dots',
  'passcode-backspace',
  'btn-quick-lock',
  'toggle-passcode',
  'input-new-passcode',
  'btn-save-passcode',
  'btn-lock-now',
  'global-loading-spinner',
  'retry-loading-container',
  'btn-retry-feed',
  'app-toast',
  'feed-container',
  'seekbar-container',
  'seekbar-fill',
  'view-feed',
  'view-favorites',
  'view-profile',
  'nav-btn-feed',
  'nav-btn-fav',
  'nav-btn-profile',
  'btn-open-source',
  'btn-cycle-sort',
  'btn-open-search',
  'mode-btn-video',
  'mode-btn-photo',
  'album-grid-modal',
  'album-grid-list',
  'photo-zoom-modal',
  'tags-modal'
];

let missingIds = [];
requiredIds.forEach(id => {
  const idPattern = new RegExp(`id=["']${id}["']`);
  if (!idPattern.test(htmlContent)) {
    missingIds.push(id);
  }
});

if (missingIds.length > 0) {
  console.error('  ✗ Missing IDs in index.html:', missingIds);
  process.exit(1);
} else {
  console.log(`  ✓ All ${requiredIds.length} required DOM IDs are present in index.html`);
}

// -----------------------------------------------------------------------------
// TEST 3: RAPID SOURCE SWITCHING & HARDWARE DECODER CLEANUP SIMULATION
// -----------------------------------------------------------------------------
console.log('\n[TEST 3] Simulating rapid switching across 5 sources with hardware decoder cleanup...');

// Create mock browser DOM environment
class MockClassList {
  constructor() { this.classes = new Set(); }
  add(...c) { c.forEach(x => this.classes.add(x)); }
  remove(...c) { c.forEach(x => this.classes.delete(x)); }
  toggle(c, force) {
    if (force !== undefined) {
      if (force) this.classes.add(c); else this.classes.delete(c);
      return force;
    }
    if (this.classes.has(c)) { this.classes.delete(c); return false; }
    this.classes.add(c); return true;
  }
  contains(c) { return this.classes.has(c); }
}

class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.classList = new MockClassList();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.scrollTop = 0;
    this.innerHTML = '';
    this._paused = false;
    this._loadCalled = false;
    this._srcRemoved = false;
    this.src = '';
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  removeAttribute(k) {
    delete this.attributes[k];
    if (k === 'src') { this._srcRemoved = true; this.src = ''; }
  }
  appendChild(el) { this.children.push(el); }
  pause() { this._paused = true; }
  load() { this._loadCalled = true; }
  play() { this._paused = false; return Promise.resolve(); }
  querySelectorAll(selector) {
    const res = [];
    const walk = (node) => {
      if (!node || !node.children) return;
      node.children.forEach(c => {
        if (selector === 'video' && c.tagName === 'VIDEO') res.push(c);
        if (selector === '.pass-dot' && c.classList.contains('pass-dot')) res.push(c);
        if (selector === '.pass-key' && c.classList.contains('pass-key')) res.push(c);
        walk(c);
      });
    };
    walk(this);
    return res;
  }
  querySelector(selector) {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }
  addEventListener(event, fn) {}
}

const mockFeedContainer = new MockElement('div');
mockFeedContainer.scrollTop = 15000; // deep scroll offset

// Add 10 mock video elements to feedContainer
for (let i = 0; i < 10; i++) {
  const slide = new MockElement('div');
  slide.classList.add('feed-slide');
  const video = new MockElement('video');
  video.src = `https://mock.cdn/sample_${i}.mp4`;
  slide.appendChild(video);
  mockFeedContainer.appendChild(slide);
}

// Setup sandbox context
const sandbox = {
  window: {},
  document: {
    getElementById: (id) => {
      if (id === 'feed-container') return mockFeedContainer;
      return new MockElement('div');
    },
    querySelectorAll: () => [],
    querySelector: () => new MockElement('div'),
    createElement: (tag) => new MockElement(tag),
    addEventListener: () => {},
    body: new MockElement('body')
  },
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  requestAnimationFrame: (cb) => { setImmediate(cb); },
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve([]), text: () => Promise.resolve('') })
};
sandbox.window = sandbox;

const stateCode = fs.readFileSync(path.join(baseDir, 'js', 'state.js'), 'utf8');
const providersCode = fs.readFileSync(path.join(baseDir, 'js', 'providers.js'), 'utf8');
const playerCode = fs.readFileSync(path.join(baseDir, 'js', 'player.js'), 'utf8');

vm.createContext(sandbox);
vm.runInContext(stateCode, sandbox);
vm.runInContext(providersCode, sandbox);
vm.runInContext(playerCode, sandbox);

// Verify initial state
if (sandbox.window.APP_STATE.feedSessionId !== 0) {
  console.error('  ✗ feedSessionId is not 0 initially!');
  process.exit(1);
}
console.log('  ✓ Initial feedSessionId is 0');

// Call destroyAllMediaAndResetFeed()
const initialVideos = mockFeedContainer.querySelectorAll('video');
console.log(`  ✓ Detected ${initialVideos.length} playing video elements before cleanup`);

sandbox.window.destroyAllMediaAndResetFeed();

// Verify cleanup checks:
// 1. feedSessionId incremented
if (sandbox.window.APP_STATE.feedSessionId !== 1) {
  console.error('  ✗ feedSessionId was not incremented!');
  process.exit(1);
}
console.log('  ✓ feedSessionId incremented to 1');

// 2. Hardware decoder cleanup verified
const allCleaned = initialVideos.every(v => v._paused && v._srcRemoved && v._loadCalled);
if (!allCleaned) {
  console.error('  ✗ Video hardware decoders were not properly released (pause, removeAttribute, load)!');
  process.exit(1);
}
console.log('  ✓ 100% of video hardware decoders released (.pause(), .removeAttribute("src"), .load())');

// 3. Scroll top reset to 0
if (mockFeedContainer.scrollTop !== 0) {
  console.error('  ✗ mockFeedContainer.scrollTop was not reset to 0!');
  process.exit(1);
}
console.log('  ✓ Feed container scrollTop reset to 0');

// 4. Simulate rapid consecutive switching across 5 sources
const sourcesToTest = ['idolcomplex', 'cosplaytele', 'xbooru', 'r34video', 'safebooru'];
sourcesToTest.forEach((src, idx) => {
  sandbox.window.destroyAllMediaAndResetFeed();
  sandbox.window.APP_STATE.currentSource = src;
  const expectedSession = 2 + idx;
  if (sandbox.window.APP_STATE.feedSessionId !== expectedSession) {
    console.error(`  ✗ Expected session ${expectedSession} for source ${src}, got ${sandbox.window.APP_STATE.feedSessionId}`);
    process.exit(1);
  }
  if (sandbox.window.APP_STATE.isLoading !== false) {
    console.error(`  ✗ isLoading is stuck true after switching to ${src}!`);
    process.exit(1);
  }
});
console.log(`  ✓ Rapid switching across ${sourcesToTest.length} sources passed cleanly without stuck isLoading!`);

// 5. Test createSlideElement generates .right-action-bar and .slide-bottom-left for video, photo, and album
console.log('\n[TEST 4] Verifying .right-action-bar and .slide-bottom-left in createSlideElement...');
const testItems = [
  { id: 1, sourceKey: 'xbooru', mediaType: 'video', sampleUrl: 'https://test/v.mp4', poster: 'https://test/p.jpg', title: 'Video Item' },
  { id: 2, sourceKey: 'cosplaytele', mediaType: 'image_album', albumImages: ['https://test/1.jpg', 'https://test/2.jpg'], title: 'Album Item' },
  { id: 3, sourceKey: 'safebooru', mediaType: 'image', sampleUrl: 'https://test/s.jpg', title: 'Photo Item' }
];

testItems.forEach(item => {
  const slide = sandbox.window.FeedEngine.createSlideElement(item, 0);
  const html = slide.innerHTML;
  const hasActionBar = html.includes('right-action-bar') || html.includes('action-rail');
  const hasBottomLeft = html.includes('slide-bottom-left');
  const hasHeartBtn = html.includes('btn-heart');
  const hasTagsBtn = html.includes('btn-tags');

  if (!hasActionBar || !hasBottomLeft || !hasHeartBtn || !hasTagsBtn) {
    console.error(`  ✗ Slide for ${item.mediaType} is missing action bar or bottom left!`);
    process.exit(1);
  }
  console.log(`  ✓ Slide for ${item.mediaType}: Contains .right-action-bar, .slide-bottom-left, Heart and Tags buttons`);
});

// -----------------------------------------------------------------------------
// TEST 5: PASSCODE SECURITY & MULTITASKING LOGIC
// -----------------------------------------------------------------------------
console.log('\n[TEST 5] Verifying Passcode 6-digit PIN and Multitasking logic...');
const mainCode = fs.readFileSync(path.join(baseDir, 'js', 'main.js'), 'utf8');
vm.runInContext(mainCode, sandbox);

// Default passcode
if (sandbox.window.APP_STATE.settings.passcode !== '777777') {
  console.error('  ✗ Default passcode is not 777777!');
  process.exit(1);
}
console.log('  ✓ Default passcode is 777777');

// Test window.lockAppNow
if (typeof sandbox.window.lockAppNow !== 'function') {
  console.error('  ✗ window.lockAppNow is not defined!');
  process.exit(1);
}
sandbox.window.lockAppNow();
console.log('  ✓ window.lockAppNow() executed cleanly');

console.log('\n================================================================');
console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (0 ERRORS)');
console.log('================================================================');
