// Lightweight client-side event tracking module
// Sends events to /api/analytics with batching + navigator.sendBeacon fallback

const SESSION_ID = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
const BATCH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 20;

let eventQueue = [];
let flushTimer = null;

function getCommonProps() {
  const token = localStorage.getItem('sb-access-token');
  return {
    session_id: SESSION_ID,
    is_guest: !token,
    timestamp: new Date().toISOString(),
    platform: 'web',
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
  };
}

export function track(eventName, properties = {}) {
  const event = {
    event: eventName,
    ...getCommonProps(),
    ...properties,
  };
  eventQueue.push(event);

  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, BATCH_INTERVAL_MS);
  }
}

function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
  const body = JSON.stringify({ events: batch });
  const token = localStorage.getItem('sb-access-token');

  if (token) {
    // Authenticated user: fetch with auth header for user_id extraction
    fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } else if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  // Flush remaining events if queue isn't empty
  if (eventQueue.length > 0) {
    flushTimer = setTimeout(flush, BATCH_INTERVAL_MS);
  }
}

// Flush on page unload
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
window.addEventListener('pagehide', flush);
