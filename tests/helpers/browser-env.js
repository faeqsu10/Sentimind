import { vi } from 'vitest';

function createClassList() {
  return {
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
    contains: vi.fn(() => false),
  };
}

export function createElementStub(overrides = {}) {
  const attrs = new Map();
  const listeners = new Map();
  const el = {
    hidden: false,
    textContent: '',
    innerHTML: '',
    className: '',
    value: '',
    style: {},
    children: [],
    dataset: {},
    parentNode: null,
    firstElementChild: null,
    offsetWidth: 120,
    offsetHeight: 60,
    classList: createClassList(),
    appendChild: vi.fn(function appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      if (!this.firstElementChild) this.firstElementChild = child;
      return child;
    }),
    replaceWith: vi.fn(),
    cloneNode: vi.fn(function cloneNode() {
      return createElementStub({ ...overrides });
    }),
    remove: vi.fn(),
    addEventListener: vi.fn((type, callback) => {
      const arr = listeners.get(type) || [];
      arr.push(callback);
      listeners.set(type, arr);
    }),
    removeEventListener: vi.fn((type, callback) => {
      const arr = listeners.get(type) || [];
      listeners.set(type, arr.filter((fn) => fn !== callback));
    }),
    dispatchEvent: vi.fn((event) => {
      const arr = listeners.get(event.type) || [];
      for (const callback of arr) callback(event);
      return true;
    }),
    setAttribute: vi.fn((name, value) => attrs.set(name, value)),
    getAttribute: vi.fn((name) => attrs.get(name) ?? null),
    removeAttribute: vi.fn((name) => attrs.delete(name)),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    closest: vi.fn(() => null),
    focus: vi.fn(),
    click: vi.fn(),
    scrollIntoView: vi.fn(),
    offsetParent: {},
    getBoundingClientRect: vi.fn(() => ({
      top: 0,
      left: 0,
      right: 120,
      bottom: 60,
      width: 120,
      height: 60,
    })),
    ...overrides,
  };
  return el;
}

export function installBrowserEnv({ pathname = '/', origin = 'http://localhost', innerWidth = 1280 } = {}) {
  const elements = new Map();
  const listeners = new Map();
  const documentListeners = new Map();

  const ensureElement = (id) => {
    if (!elements.has(id)) {
      elements.set(id, createElementStub({ id }));
    }
    return elements.get(id);
  };

  const document = {
    visibilityState: 'visible',
    referrer: '',
    activeElement: createElementStub({ id: 'active-element' }),
    body: createElementStub({ tagName: 'BODY' }),
    documentElement: {
      getAttribute: vi.fn(() => null),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      classList: createClassList(),
    },
    getElementById: vi.fn((id) => ensureElement(id)),
    createElement: vi.fn((tag) => createElementStub({ tagName: String(tag).toUpperCase() })),
    createElementNS: vi.fn((_, tag) => createElementStub({ tagName: String(tag).toUpperCase() })),
    createTextNode: vi.fn((text) => ({ nodeType: 3, textContent: String(text) })),
    addEventListener: vi.fn((type, callback) => {
      const arr = documentListeners.get(type) || [];
      arr.push(callback);
      documentListeners.set(type, arr);
    }),
    removeEventListener: vi.fn((type, callback) => {
      const arr = documentListeners.get(type) || [];
      documentListeners.set(type, arr.filter((fn) => fn !== callback));
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
  };

  const window = {
    location: {
      hash: '',
      pathname,
      origin,
      search: '',
      href: `${origin}${pathname}`,
      reload: vi.fn(),
    },
    innerWidth,
    onerror: null,
    onunhandledrejection: null,
    addEventListener: vi.fn((type, callback) => {
      const arr = listeners.get(type) || [];
      arr.push(callback);
      listeners.set(type, arr);
    }),
    removeEventListener: vi.fn((type, callback) => {
      const arr = listeners.get(type) || [];
      listeners.set(type, arr.filter((fn) => fn !== callback));
    }),
    focus: vi.fn(),
    matchMedia: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  };

  const storage = new Map();
  const localStorage = {
    getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
    setItem: vi.fn((key, value) => {
      storage.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  };

  const navigator = {
    userAgent: 'vitest-browser',
    platform: 'Linux',
    sendBeacon: vi.fn(() => true),
    serviceWorker: {
      register: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      controller: { postMessage: vi.fn() },
    },
  };

  const history = {
    state: null,
    replaceState: vi.fn((state) => {
      history.state = state;
    }),
    pushState: vi.fn((state) => {
      history.state = state;
    }),
  };

  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'history', { value: history, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'self', { value: window, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'confirm', { value: vi.fn(() => true), configurable: true, writable: true });
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: vi.fn((callback) => {
      callback();
      return 1;
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: vi.fn(function MockIntersectionObserver(callback) {
      this.observe = vi.fn();
      this.unobserve = vi.fn();
      this.disconnect = vi.fn();
      this._callback = callback;
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'performance', {
    value: { now: vi.fn(() => Date.now()) },
    configurable: true,
    writable: true,
  });

  if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  }
  if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = vi.fn();
  }

  return {
    window,
    document,
    navigator,
    history,
    localStorage,
    elements,
    listeners,
    documentListeners,
    dispatchWindowEvent(type, event = {}) {
      for (const callback of listeners.get(type) || []) {
        callback(event);
      }
    },
    dispatchDocumentEvent(type, event = {}) {
      for (const callback of documentListeners.get(type) || []) {
        callback(event);
      }
    },
  };
}

export function createFetchResponse({ status = 200, jsonData = null, headers = {}, blobData = 'blob' } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: vi.fn((name) => normalizedHeaders[String(name).toLowerCase()] ?? null),
    },
    json: vi.fn().mockResolvedValue(jsonData),
    blob: vi.fn().mockResolvedValue(new Blob([blobData], { type: 'application/octet-stream' })),
    text: vi.fn().mockResolvedValue(
      typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData)
    ),
  };
}

export async function importFresh(path) {
  vi.resetModules();
  const base = new URL('../', import.meta.url);
  const resolved = new URL(path, base);
  resolved.searchParams.set('t', `${Date.now()}-${Math.random()}`);
  return import(resolved.href);
}

export async function flushPromises(times = 3) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}
