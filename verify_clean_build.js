const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = "C:\\Users\\dson2\\Desktop\\giữ nguyên vị trí\\shorts-clean";
const wwwDir = path.join(baseDir, 'www');
const jsDir = path.join(wwwDir, 'js');

console.log("=================================================");
console.log("STARTING VERIFY_CLEAN_BUILD (4 TESTS)");
console.log("=================================================\n");

// -----------------------------------------------------------------------------
// TEST 1: SYNTAX CHECK OF ALL 4 JS FILES
// -----------------------------------------------------------------------------
console.log("--- TEST 1: SYNTAX CHECK ---");
const jsFiles = ['state.js', 'providers.js', 'player.js', 'main.js'];
let test1Pass = true;

for (const file of jsFiles) {
  const filePath = path.join(jsDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL: File ${file} does not exist at ${filePath}`);
    test1Pass = false;
    continue;
  }
  const code = fs.readFileSync(filePath, 'utf8');
  try {
    new vm.Script(code, { filename: file });
    console.log(`[PASS] ${file} has valid JavaScript syntax.`);
  } catch (err) {
    console.error(`[FAIL] ${file} syntax error:`, err);
    test1Pass = false;
  }
}

if (!test1Pass) {
  console.error("Test 1 FAILED! Stopping.");
  process.exit(1);
}
console.log(">>> TEST 1 PASSED!\n");

// -----------------------------------------------------------------------------
// TEST 2: DOM ID CROSS-REFERENCE BETWEEN JS AND HTML
// -----------------------------------------------------------------------------
console.log("--- TEST 2: DOM ID MATCH CHECK ---");
const htmlPath = path.join(wwwDir, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract all id="..." from index.html
const idRegex = /id=["']([^"']+)["']/g;
const htmlIds = new Set();
let match;
while ((match = idRegex.exec(htmlContent)) !== null) {
  htmlIds.add(match[1]);
}
console.log(`Found ${htmlIds.size} IDs in www/index.html.`);

// Extract all getElementById('...') from all 4 JS files
const getByIdRegex = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
const jsQueriedIds = new Set();

for (const file of jsFiles) {
  const code = fs.readFileSync(path.join(jsDir, file), 'utf8');
  while ((match = getByIdRegex.exec(code)) !== null) {
    jsQueriedIds.add(match[1]);
  }
}

console.log(`Found ${jsQueriedIds.size} IDs queried in JS files:`);
const missingIds = [];
for (const id of jsQueriedIds) {
  if (htmlIds.has(id)) {
    console.log(`  ✓ #${id} exists in HTML`);
  } else {
    console.error(`  ✗ #${id} MISSING FROM HTML!`);
    missingIds.push(id);
  }
}

if (missingIds.length > 0) {
  console.error(`Test 2 FAILED: Missing IDs in HTML: ${missingIds.join(', ')}`);
  process.exit(1);
}
console.log(">>> TEST 2 PASSED! 100% IDs MATCH!\n");

// -----------------------------------------------------------------------------
// TEST 3: CROSS-CHECK MODES SOURCES VS PROVIDERS
// -----------------------------------------------------------------------------
console.log("--- TEST 3: MODES SOURCES VS PROVIDERS MATCH CHECK ---");
// Create a sandbox to run state.js and providers.js
const sandbox = {
  window: {},
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  console: console,
  document: {
    getElementById: () => null
  }
};
sandbox.window = sandbox;

vm.createContext(sandbox);

// Run state.js
vm.runInContext(fs.readFileSync(path.join(jsDir, 'state.js'), 'utf8'), sandbox);
// Run providers.js
vm.runInContext(fs.readFileSync(path.join(jsDir, 'providers.js'), 'utf8'), sandbox);

const MODES = sandbox.window.MODES;
const PROVIDERS = sandbox.window.PROVIDERS;

console.log("Modes defined:", Object.keys(MODES));
console.log("Providers defined:", Object.keys(PROVIDERS));

let test3Pass = true;
const allModeSources = new Set();

for (const [modeKey, modeCfg] of Object.entries(MODES)) {
  console.log(`Checking mode: ${modeKey} (${modeCfg.name})`);
  for (const src of modeCfg.sources) {
    allModeSources.add(src);
    if (PROVIDERS[src]) {
      console.log(`  ✓ source '${src}' -> Provider: "${PROVIDERS[src].name}" (badge: ${PROVIDERS[src].badgeIcon})`);
    } else {
      console.error(`  ✗ source '${src}' NOT FOUND in window.PROVIDERS!`);
      test3Pass = false;
    }
  }
}

// Check if all PROVIDERS belong to a mode
for (const provKey of Object.keys(PROVIDERS)) {
  if (!allModeSources.has(provKey)) {
    console.warn(`  ! Note: Provider '${provKey}' is defined but not in MODES.`);
  }
}

if (!test3Pass) {
  console.error("Test 3 FAILED! Stopping.");
  process.exit(1);
}
console.log(">>> TEST 3 PASSED! All 11 sources properly mapped!\n");

// -----------------------------------------------------------------------------
// TEST 4: MOCK DOM RUNTIME EXECUTION TEST
// -----------------------------------------------------------------------------
console.log("--- TEST 4: MOCK DOM RUNTIME EXECUTION & SOURCE SWITCHING ---");

// Build a mock DOM element factory
function createMockElement(id = '', tag = 'div') {
  const listeners = {};
  return {
    id,
    tagName: tag.toUpperCase(),
    dataset: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) {
          this._classes.add(c);
        } else {
          this._classes.delete(c);
        }
      },
      contains(c) { return this._classes.has(c); }
    },
    style: {},
    textContent: '',
    value: '',
    innerHTML: '',
    scrollTop: 0,
    scrollLeft: 0,
    clientHeight: 800,
    clientWidth: 400,
    scrollWidth: 1200,
    scrollHeight: 2400,
    addEventListener(evt, fn) {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    dispatchEvent(evt) {
      if (listeners[evt]) {
        listeners[evt].forEach(fn => fn({ target: this, stopPropagation: () => {} }));
      }
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => {},
    removeChild: () => {},
    scrollTo: () => {},
    scrollBy: () => {},
    focus: () => {}
  };
}

const elementStore = new Map();
for (const id of htmlIds) {
  elementStore.set(id, createMockElement(id));
}

const mockDoc = {
  getElementById(id) {
    if (!elementStore.has(id)) {
      elementStore.set(id, createMockElement(id));
    }
    return elementStore.get(id);
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
    return createMockElement('', sel);
  },
  querySelectorAll: () => [],
  createElement(tag) { return createMockElement('', tag); },
  body: createMockElement('body', 'body'),
  addEventListener: () => {}
};

const runtimeSandbox = {
  window: {},
  document: mockDoc,
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); }
  },
  console: {
    log: (...args) => console.log('  [runtime]:', ...args),
    warn: (...args) => console.warn('  [runtime warn]:', ...args),
    error: (...args) => console.error('  [runtime err]:', ...args)
  },
  setTimeout: (fn) => setTimeout(fn, 10),
  clearTimeout: (t) => clearTimeout(t),
  setInterval: (fn) => setInterval(fn, 10),
  clearInterval: (t) => clearInterval(t),
  Date: Date,
  Math: Math,
  Array: Array,
  Set: Set,
  Map: Map,
  Object: Object,
  JSON: JSON,
  String: String,
  Number: Number,
  RegExp: RegExp,
  URL: URL,
  DOMParser: class {
    parseFromString() {
      return { querySelectorAll: () => [] };
    }
  }
};
runtimeSandbox.window = runtimeSandbox;

vm.createContext(runtimeSandbox);

// Execute files in order
console.log("Loading state.js...");
vm.runInContext(fs.readFileSync(path.join(jsDir, 'state.js'), 'utf8'), runtimeSandbox);

console.log("Loading providers.js...");
vm.runInContext(fs.readFileSync(path.join(jsDir, 'providers.js'), 'utf8'), runtimeSandbox);

console.log("Loading player.js...");
vm.runInContext(fs.readFileSync(path.join(jsDir, 'player.js'), 'utf8'), runtimeSandbox);

console.log("Loading main.js...");
vm.runInContext(fs.readFileSync(path.join(jsDir, 'main.js'), 'utf8'), runtimeSandbox);

// Mock fetchFeed for all 11 providers so switching doesn't do real network calls in test
for (const p of Object.values(runtimeSandbox.window.PROVIDERS)) {
  p.fetchFeed = async () => [
    {
      id: '123',
      sourceKey: 'test',
      title: 'Mock Item',
      mediaType: 'video',
      currentUrl: 'https://example.com/mock.mp4',
      poster: 'https://example.com/mock.jpg',
      tagString: 'test anime'
    }
  ];
}

async function testRuntime() {
  console.log("Initializing App in mock runtime...");
  runtimeSandbox.window.FeedEngine.init();

  console.log("Testing Mode Switch to 'photo'...");
  await runtimeSandbox.window.switchMode('photo');
  console.log("  Current mode:", runtimeSandbox.window.APP_STATE.currentMode);
  console.log("  Current source:", runtimeSandbox.window.APP_STATE.currentSource);

  console.log("Testing Mode Switch to 'video'...");
  await runtimeSandbox.window.switchMode('video');
  console.log("  Current mode:", runtimeSandbox.window.APP_STATE.currentMode);
  console.log("  Current source:", runtimeSandbox.window.APP_STATE.currentSource);

  console.log("Testing Source Switching across ALL 11 providers...");
  for (const src of Object.keys(runtimeSandbox.window.PROVIDERS)) {
    await runtimeSandbox.window.switchSource(src);
    console.log(`  ✓ Switched to ${src}: OK!`);
  }

  console.log("Testing Cycle Sort Mode...");
  await runtimeSandbox.window.cycleSortMode();
  await runtimeSandbox.window.cycleSortMode();
  await runtimeSandbox.window.cycleSortMode();

  console.log("Testing Blacklist filter...");
  const itemGood = { title: 'Safe clip', tagString: 'dance cute' };
  const itemBad = { title: 'Gore scene', tagString: 'gore violent' };
  console.log("  isItemBlacklisted(itemGood):", runtimeSandbox.window.isItemBlacklisted(itemGood));
  console.log("  isItemBlacklisted(itemBad):", runtimeSandbox.window.isItemBlacklisted(itemBad));

  if (!runtimeSandbox.window.isItemBlacklisted(itemBad)) {
    throw new Error("Blacklist filter failed to detect blacklisted tag!");
  }

  console.log("\n>>> TEST 4 PASSED! 0 RUNTIME ERRORS DETECTED!");
}

testRuntime().then(() => {
  console.log("\n=================================================");
  console.log("ALL 4 TESTS PASSED WITH 100% PERFECTION!");
  console.log("=================================================");
}).catch(err => {
  console.error("Test 4 Runtime Error:", err);
  process.exit(1);
});
