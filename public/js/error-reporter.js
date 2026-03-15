// ---------------------------------------------------------------------------
// Error Reporter — 프론트엔드 에러를 /api/error-logs로 전송
// ---------------------------------------------------------------------------
// - fingerprint 기반 중복 억제 (같은 에러 5분 내 1회만)
// - 배치 큐잉 (3초 간격, 최대 10개/배치)
// - sendBeacon fallback (페이지 이탈 시)
// ---------------------------------------------------------------------------

const SESSION_ID = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
const BATCH_INTERVAL_MS = 3000;
const MAX_BATCH_SIZE = 10;
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5분

let errorQueue = [];
let flushTimer = null;
const recentFingerprints = new Map(); // fingerprint -> timestamp

/**
 * fingerprint 생성 (클라이언트측)
 */
function generateFingerprint(sourceFile, lineno, message) {
  const normalized = (message || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/\d+/g, '<N>');
  const input = `frontend:${sourceFile || ''}:${lineno || 0}:${normalized}`;
  // 간단한 해시 (브라우저 crypto 비동기 방지)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return 'fe' + Math.abs(hash).toString(36);
}

/**
 * 에러를 큐에 추가
 */
export function reportError({ message, stack, source, lineno, colno, code, metadata }) {
  if (!message) return;

  const sourceFile = extractFileName(source || '');
  const fingerprint = generateFingerprint(sourceFile, lineno, message);

  // 중복 억제: 같은 fingerprint는 5분 내 1회만
  const now = Date.now();
  const lastSeen = recentFingerprints.get(fingerprint);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) return;
  recentFingerprints.set(fingerprint, now);

  // 오래된 fingerprint 정리
  if (recentFingerprints.size > 100) {
    for (const [fp, ts] of recentFingerprints) {
      if (now - ts > DEDUP_WINDOW_MS) recentFingerprints.delete(fp);
    }
  }

  errorQueue.push({
    message: String(message).slice(0, 1000),
    stack: (stack || '').slice(0, 4000) || null,
    source_file: sourceFile || null,
    lineno: typeof lineno === 'number' ? lineno : null,
    colno: typeof colno === 'number' ? colno : null,
    code: code || null,
    fingerprint,
    metadata: metadata || {},
  });

  if (errorQueue.length >= MAX_BATCH_SIZE) {
    flushErrors();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushErrors, BATCH_INTERVAL_MS);
  }
}

/**
 * 소스 URL에서 파일명만 추출
 */
function extractFileName(source) {
  if (!source) return '';
  try {
    const url = new URL(source, window.location.origin);
    return url.pathname.split('/').pop() || '';
  } catch {
    return source.split('/').pop() || '';
  }
}

/**
 * 큐에 쌓인 에러를 서버로 전송
 */
function flushErrors() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (errorQueue.length === 0) return;

  const batch = errorQueue.splice(0, MAX_BATCH_SIZE);
  const payload = JSON.stringify({
    errors: batch,
    session_id: SESSION_ID,
    user_agent: navigator.userAgent,
  });

  const token = localStorage.getItem('sb-access-token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  // fetch with keepalive 우선, 실패 시 sendBeacon
  try {
    fetch('/api/error-logs', {
      method: 'POST',
      headers,
      body: payload,
      keepalive: true,
    }).catch(() => {
      // fetch 실패 시 sendBeacon fallback (auth 헤더 없음)
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/error-logs', new Blob([payload], { type: 'application/json' }));
      }
    });
  } catch {
    // 완전히 무시 — 에러 리포터가 에러를 내면 안 됨
  }

  if (errorQueue.length > 0) {
    flushTimer = setTimeout(flushErrors, BATCH_INTERVAL_MS);
  }
}

/**
 * 글로벌 에러 핸들러 설정
 */
export function setupErrorHandlers({ showToast }) {
  window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', { message, source, lineno, colno, error });
    reportError({
      message: String(message),
      stack: error?.stack || '',
      source,
      lineno,
      colno,
    });
    if (showToast) showToast('예기치 않은 오류가 발생했습니다. 페이지를 새로고침해주세요.', 'error');
    return true;
  };

  window.onunhandledrejection = function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    reportError({
      message: String(event.reason?.message || event.reason || ''),
      stack: event.reason?.stack || '',
      code: 'UNHANDLED_REJECTION',
    });
    const msg = (event.reason && event.reason.userMessage)
      ? event.reason.userMessage
      : '요청을 처리하는 중 오류가 발생했습니다.';
    if (showToast) showToast(msg, 'error');
    event.preventDefault();
  };
}

/**
 * API 5xx 응답 에러 리포트 (api.js에서 호출)
 */
export function reportApiError(response, url) {
  if (!response || response.status < 500) return;
  reportError({
    message: `API ${response.status}: ${url}`,
    code: 'API_SERVER_ERROR',
    metadata: {
      request_id: response.headers?.get?.('X-Request-Id') || null,
      status: response.status,
      url: (url || '').slice(0, 200),
    },
  });
}

// 페이지 이탈 시 남은 에러 전송
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushErrors();
});
window.addEventListener('pagehide', flushErrors);
