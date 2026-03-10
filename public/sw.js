const CACHE_VERSION = 'sentimind-v28';
const STATIC_ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/css/base.css', '/css/layout.css', '/css/components.css', '/css/landing.css',
  '/js/app.js', '/js/state.js', '/js/utils.js', '/js/api.js',
  '/js/auth.js', '/js/guest.js', '/js/diary.js', '/js/history.js',
  '/js/calendar.js', '/js/stats.js', '/js/profile.js', '/js/sidebar.js',
  '/js/analytics.js', '/js/reminder.js', '/js/emotion-graph.js',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Offline entry queue (IndexedDB)
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sentimind-offline', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueOfflineEntry(request) {
  try {
    const body = await request.clone().json();
    const authHeader = request.headers.get('Authorization') || '';
    const db = await openOfflineDB();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({ url: request.url, body, authHeader, timestamp: Date.now() });
    await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; });
    return new Response(JSON.stringify({
      data: { ...body, offline: true },
      message: '오프라인 저장됨. 온라인 복귀 시 자동 동기화됩니다.',
    }), { headers: { 'Content-Type': 'application/json' }, status: 202 });
  } catch {
    return new Response(JSON.stringify({ error: '오프라인 저장에 실패했습니다.' }), {
      headers: { 'Content-Type': 'application/json' }, status: 503,
    });
  }
}

async function syncOfflineEntries() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');

    const [keys, entries] = await Promise.all([
      new Promise((r) => { const req = store.getAllKeys(); req.onsuccess = () => r(req.result); }),
      new Promise((r) => { const req = store.getAll();    req.onsuccess = () => r(req.result); }),
    ]);

    if (!entries.length) return;

    let syncedCount = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const key   = keys[i];
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (entry.authHeader) headers['Authorization'] = entry.authHeader;
        await fetch(entry.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(entry.body),
        });
        // 성공한 항목만 개별 삭제
        const delTx = db.transaction('queue', 'readwrite');
        delTx.objectStore('queue').delete(key);
        await new Promise((r, j) => { delTx.oncomplete = r; delTx.onerror = j; });
        syncedCount++;
      } catch {
        // 이 항목 실패 — 다음 항목은 계속 시도
      }
    }

    if (syncedCount > 0) {
      // Notify client
      const clients = await self.clients.matchAll();
      clients.forEach(c => c.postMessage({ type: 'OFFLINE_SYNC_COMPLETE', count: syncedCount }));
    }
  } catch {
    // Will retry on next online event
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Auth, migrate, analyze requests: always network-only, never intercept
  if (request.url.includes('/api/auth/') || request.url.includes('/api/migrate/') || request.url.includes('/api/analyze')) {
    return;
  }

  // API POST requests: network-first with offline queue for entries
  if (request.url.includes('/api/') && request.method === 'POST') {
    event.respondWith(
      fetch(request).catch(() => {
        if (request.url.includes('/api/entries')) {
          return queueOfflineEntry(request);
        }
        return new Response(JSON.stringify({ error: '인터넷 연결을 확인해주세요.' }), {
          headers: { 'Content-Type': 'application/json' }, status: 503,
        });
      })
    );
    return;
  }

  // API GET requests: network-first
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: '인터넷 연결을 확인해주세요.' }), {
        headers: { 'Content-Type': 'application/json' }, status: 503,
      }))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Sync offline entries when back online
self.addEventListener('message', (event) => {
  if (event.data === 'SYNC_OFFLINE') {
    syncOfflineEntries();
  }
});
