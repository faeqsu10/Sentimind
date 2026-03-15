// ---------------------------------------------------------------------------
// Error Collector — 에러 로그를 Supabase error_logs 테이블에 저장
// ---------------------------------------------------------------------------
// fire-and-forget 패턴: 에러 수집 실패가 앱 동작에 영향을 주지 않음
//
// 사용법:
//   const { collectError } = require('./lib/error-collector');
//   collectError({ level: 'error', source: 'backend', message: '...', ... });
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const { supabaseAdmin, USE_SUPABASE } = require('../config/supabase-config');

const IS_PRODUCTION = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');

// fingerprint별 rate limiting (분당 최대 10건)
const _fingerprintCounts = new Map();
const FINGERPRINT_RATE_LIMIT = parseInt(process.env.ERROR_RATE_LIMIT_PER_MIN, 10) || 10;

setInterval(() => _fingerprintCounts.clear(), 60_000);

/**
 * 에러 메시지 정규화 — 동일 에러의 다른 인스턴스를 같은 fingerprint로 묶기 위해
 * 숫자, UUID, 타임스탬프를 플레이스홀더로 치환
 */
function normalizeMessage(msg) {
  if (!msg) return '';
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<TS>')
    .replace(/\d{10,13}/g, '<N>')
    .replace(/\d+/g, '<N>');
}

/**
 * fingerprint 생성
 */
function generateFingerprint({ source, path, code, message }) {
  const normalized = normalizeMessage(message);
  const input = `${source || ''}:${path || ''}:${code || ''}:${normalized}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * 민감 정보 마스킹 — 스택/메시지에서 이메일, 토큰, API 키 패턴 제거
 */
function maskSensitive(str) {
  if (!str) return str;
  return str
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '<EMAIL>')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer <TOKEN>')
    .replace(/(?:api[_-]?key|token|secret|password)[=:]\s*\S+/gi, '$1=<REDACTED>');
}

/**
 * 에러를 error_logs 테이블에 저장
 *
 * @param {Object} opts
 * @param {'warn'|'error'|'fatal'} opts.level
 * @param {'frontend'|'backend'|'api_external'} opts.source
 * @param {string} opts.message
 * @param {string} [opts.stack]
 * @param {string} [opts.code]
 * @param {string} [opts.requestId]
 * @param {string} [opts.method]
 * @param {string} [opts.path]
 * @param {number} [opts.statusCode]
 * @param {number} [opts.durationMs]
 * @param {string} [opts.userId]
 * @param {string} [opts.sessionId]
 * @param {string} [opts.userAgent]
 * @param {Object} [opts.metadata]
 */
async function collectError(opts) {
  try {
    const fingerprint = opts.fingerprint || generateFingerprint(opts);

    // fingerprint별 rate limiting
    const count = _fingerprintCounts.get(fingerprint) || 0;
    if (count >= FINGERPRINT_RATE_LIMIT) return;
    _fingerprintCounts.set(fingerprint, count + 1);

    const row = {
      fingerprint,
      level: ['warn', 'error', 'fatal'].includes(opts.level) ? opts.level : 'error',
      source: ['frontend', 'backend', 'api_external'].includes(opts.source) ? opts.source : 'backend',
      message: maskSensitive((opts.message || 'Unknown error').slice(0, 1000)),
      stack: maskSensitive((opts.stack || '').slice(0, 4000)) || null,
      code: (opts.code || '').slice(0, 100) || null,
      request_id: (opts.requestId || '').slice(0, 100) || null,
      method: (opts.method || '').slice(0, 10) || null,
      path: (opts.path || '').replace(/\?.*$/, '').slice(0, 500) || null,
      status_code: typeof opts.statusCode === 'number' ? opts.statusCode : null,
      duration_ms: typeof opts.durationMs === 'number' ? opts.durationMs : null,
      user_id: opts.userId || null,
      session_id: (opts.sessionId || '').slice(0, 100) || null,
      environment: IS_PRODUCTION ? 'production' : 'development',
      user_agent: (opts.userAgent || '').slice(0, 500) || null,
      metadata: opts.metadata && typeof opts.metadata === 'object' ? opts.metadata : {},
    };

    if (USE_SUPABASE && supabaseAdmin) {
      // 500ms 타임아웃으로 Supabase 장애 시 API 응답 지연 방지
      const insertPromise = supabaseAdmin.from('error_logs').insert(row);
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 500));
      await Promise.race([insertPromise, timeoutPromise]);
    } else {
      // Supabase 미사용 시 콘솔 fallback
      console.log(JSON.stringify({ type: 'error_log', ...row }));
    }
  } catch {
    // 에러 수집기 자체의 에러는 절대 앱에 영향을 주지 않음
    try {
      console.error('[error-collector] 에러 로그 저장 실패:', opts?.message?.slice(0, 200));
    } catch {
      // 완전히 무시
    }
  }
}

module.exports = { collectError, generateFingerprint };
