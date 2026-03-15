// ---------------------------------------------------------------------------
// Sentimind Server v2 - Supabase + Auth Integration
// ---------------------------------------------------------------------------
// Phase 5-6: JSON -> Supabase PostgreSQL, 사용자 인증 시스템
//
// 변경사항 (v1 -> v2):
//   - Supabase 클라이언트 외부 모듈화 (config/supabase-config.js)
//   - JWT 인증 미들웨어 (lib/auth-middleware.js)
//   - 입력 검증 모듈화 (lib/validators.js)
//   - Auth 엔드포인트 추가 (/api/auth/*)
//   - Profile 엔드포인트 추가 (/api/profile)
//   - Entries/Stats에 user_id 필터링 적용
//   - Soft delete (deleted_at) 적용
//   - Pagination 지원 (limit/offset)
//   - Streak 계산 로직
//   - JSON fallback 유지 (Supabase 미활성화 시)
//
// 보안 강화 (v2.1):
//   - 환경변수 검증 (서버 시작 시)
//   - CORS 프로덕션 설정 (CORS_ORIGINS 환경변수)
//   - 보안 이벤트 로깅 (로그인 실패, 인증 실패)
//   - Rate limiter 세분화 (signup, login, analyze)
//   - Health check 개선 (Gemini 상태 포함)
// ---------------------------------------------------------------------------

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('./config/llm-config');
const { supabase, supabaseAdmin, USE_SUPABASE, createUserClient } = require('./config/supabase-config');
const { authMiddleware, optionalAuth } = require('./lib/auth-middleware');
const { collectError } = require('./lib/error-collector');
const {
  validateEmail,
  validatePassword,
  validateEntryText,
  validateConfidenceScore,
  validateNickname,
  validateBio,
  validateTheme,
  validateNotificationTime,
  validateResponseLength,
  validateAdviceStyle,
  validatePersonaPreset,
  validatePagination,
} = require('./lib/validators');

// ---------------------------------------------------------------------------
// Environment Variable Validation
// ---------------------------------------------------------------------------

function validateEnvironment() {
  const required = ['GOOGLE_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[FATAL] 필수 환경변수 누락: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Supabase 부분 설정 경고
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_ANON_KEY) {
    console.warn('[WARN] SUPABASE_URL 설정됨, SUPABASE_ANON_KEY 누락 -> JSON fallback 사용');
  }
  if (!process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    console.warn('[WARN] SUPABASE_ANON_KEY 설정됨, SUPABASE_URL 누락 -> JSON fallback 사용');
  }

  // service_role 키 부재 경고 (auth_events, analytics 등 admin 기능 비활성화)
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[WARN] SUPABASE_SERVICE_ROLE_KEY 누락 -> auth_events 기록, analytics 저장 등 admin 기능 비활성화');
  }

  // SITE_URL 미설정 경고 (이메일 확인 리다이렉트 문제)
  if (!process.env.SITE_URL) {
    console.warn('[WARN] SITE_URL 미설정 -> 이메일 확인/OAuth 리다이렉트가 기본값(localhost) 사용');
  }
}

validateEnvironment();

// ---------------------------------------------------------------------------
// App Setup
// ---------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = config.gemini.model;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const IS_PRODUCTION = process.env.VERCEL || process.env.NODE_ENV === 'production';

// 프로덕션 환경에서 Supabase 없이 실행 방지
if (IS_PRODUCTION && !USE_SUPABASE) {
  console.error('[FATAL] 프로덕션 환경에서 USE_SUPABASE=false는 허용되지 않습니다. SUPABASE_URL과 SUPABASE_ANON_KEY를 설정해주세요.');
  process.exit(1);
}

const EMOTION_ONTOLOGY_FILE = path.join(__dirname, 'data', 'emotion-ontology.json');
const SITUATION_ONTOLOGY_FILE = path.join(__dirname, 'data', 'situation-ontology.json');

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const LOGS_DIR = IS_PRODUCTION ? null : path.join(__dirname, 'logs');
const SLOW_REQUEST_MS = parseInt(process.env.SLOW_REQUEST_MS, 10) || 3000;

class Logger {
  constructor() {
    if (LOGS_DIR && !fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    if (LOGS_DIR) this._cleanOldLogs();
  }

  _getLogFile() {
    return path.join(LOGS_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  _shouldLog(level) {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  async _cleanOldLogs() {
    if (!LOGS_DIR) return;
    try {
      const files = await fs.promises.readdir(LOGS_DIR);
      const now = Date.now();
      const retentionMs = config.logs.retentionDays * 24 * 60 * 60 * 1000;
      for (const file of files) {
        if (file.startsWith('app-') && file.endsWith('.log')) {
          const filePath = path.join(LOGS_DIR, file);
          const stats = await fs.promises.stat(filePath);
          if (now - stats.mtimeMs > retentionMs) {
            await fs.promises.unlink(filePath);
          }
        }
      }
    } catch (err) {
      console.error(`Log cleanup error: ${err.message}`);
    }
  }

  _log(level, message, data = null) {
    if (!this._shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data }),
    };

    if (IS_PRODUCTION) {
      // Vercel: 구조화된 JSON만 출력 (ANSI 코드 없음)
      console.log(JSON.stringify(logEntry));
    } else {
      // 로컬: 컬러 콘솔 출력
      const colors = { DEBUG: '\x1b[36m', INFO: '\x1b[32m', WARN: '\x1b[33m', ERROR: '\x1b[31m' };
      let dataStr = '';
      try { dataStr = data ? JSON.stringify(data) : ''; } catch { dataStr = '[circular]'; }
      console.log(`${colors[level]}[${level}] ${message}\x1b[0m${dataStr ? ` | ${dataStr}` : ''}`);

      // 로컬: 파일 로그도 기록
      if (LOGS_DIR) {
        fs.promises.appendFile(this._getLogFile(), JSON.stringify(logEntry) + '\n', 'utf-8')
          .catch(err => console.error(`Log write error: ${err.message}`));
      }
    }
  }

  debug(msg, data) { this._log('DEBUG', msg, data); }
  info(msg, data) { this._log('INFO', msg, data); }
  warn(msg, data) { this._log('WARN', msg, data); }
  error(msg, data) { this._log('ERROR', msg, data); }
}

const logger = new Logger();
logger.info('Sentimind v2 서버 시작', {
  environment: IS_PRODUCTION ? 'production' : 'development',
  supabase: USE_SUPABASE ? 'enabled' : 'disabled (JSON fallback)',
});

// ---------------------------------------------------------------------------
// Security Event Logger
// ---------------------------------------------------------------------------

function logSecurityEvent(event, details) {
  logger.warn(`[SECURITY] ${event}`, {
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Ontology Engine
// ---------------------------------------------------------------------------

class OntologyEngine {
  constructor(emotionOntology, situationOntology) {
    this.emotionOntology = emotionOntology;
    this.situationOntology = situationOntology;
  }

  enrichEmotion(primaryEmotion, text, geminiResult) {
    return {
      ...geminiResult,
      ontology: {
        emotion_hierarchy: this.findEmotionHierarchy(primaryEmotion),
        situation_context: this.inferSituationContext(text),
        confidence: this.calculateConfidence(text, primaryEmotion),
        related_emotions: this.findRelatedEmotions(primaryEmotion),
      },
    };
  }

  findEmotionHierarchy(emotion) {
    for (const level1 of Object.values(this.emotionOntology.emotions)) {
      if (level1.subcategories) {
        for (const level2 of Object.values(level1.subcategories)) {
          if (level2.korean === emotion || level2.korean.includes(emotion)) {
            return { level1: level1.korean, level2: level2.korean, emoji: level2.emoji };
          }
          if (level2.specific_emotions) {
            for (const level3 of Object.values(level2.specific_emotions)) {
              if (level3.korean === emotion || emotion.includes(level3.korean)) {
                return { level1: level1.korean, level2: level2.korean, level3: level3.korean, emoji: level3.emoji };
              }
            }
          }
        }
      }
    }
    return { level1: '중립', emoji: '💭' };
  }

  inferSituationContext(text) {
    const lowerText = text.toLowerCase();
    const contexts = [];
    for (const [, info] of Object.entries(this.situationOntology.domains)) {
      for (const [, ctxInfo] of Object.entries(info.contexts)) {
        if (ctxInfo.keywords && ctxInfo.keywords.some(kw => lowerText.includes(kw))) {
          contexts.push({ domain: info.korean, context: ctxInfo.korean });
        }
      }
    }
    return contexts.length > 0 ? contexts : [{ domain: '기타', context: '일상' }];
  }

  calculateConfidence(text) {
    const baseConfidence = Math.min(text.length / 100, 0.8);
    return Math.round((baseConfidence * 100 + 10) / 10) * 10;
  }

  findRelatedEmotions(primaryEmotion) {
    const emotionMap = this.emotionOntology.emotion_correlations || {};
    return emotionMap[primaryEmotion] || [];
  }
}

// System prompt for Gemini
const SYSTEM_PROMPT = `당신은 따뜻하고 공감 능력이 뛰어난 감정 상담사입니다.
사용자가 하루를 기록한 한 줄 일기를 보내면, 다음을 수행하세요:

1. 일기에서 느껴지는 주요 감정을 분석합니다.
2. 그 감정에 어울리는 이모지를 선택합니다.
3. 사용자의 마음에 공감하는 따뜻한 위로 메시지를 작성합니다.
4. 간단한 행동 제안을 하나 덧붙입니다.
5. 일기에서 언급된 활동을 추론합니다.

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요:
{
  "emotion": "감정 이름 (예: 만족감, 기쁨, 불안, 긴장, 설렘 등)",
  "emoji": "감정을 나타내는 유니코드 이모지 문자 1개 (예: 😊, 😢, 😤, 😰). 반드시 실제 이모지 문자만 사용하고 영어 단어(happy, sad, perplexed 등)는 절대 금지",
  "message": "2~3문장의 공감 및 위로 메시지",
  "advice": "1문장의 간단한 행동 제안",
  "activity_tags": ["일기에서 추론된 활동 태그 배열. 다음 중 해당하는 것만: 운동, 독서, 산책, 음악, 요리, 친구, 가족, 공부, 업무, 쇼핑, 여행, 취미, 휴식, 명상. 해당 없으면 빈 배열"]
}

규칙:
- 모든 응답은 한국어로 작성합니다.
- 판단하거나 훈계하지 않습니다.
- 사용자의 감정을 있는 그대로 인정합니다.
- 따뜻하고 부드러운 말투를 사용합니다.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fsPromises = require('fs/promises');
const crypto = require('crypto');
let ontologyEngine = null;

async function loadOntologies() {
  try {
    const [emotionData, situationData] = await Promise.all([
      fsPromises.readFile(EMOTION_ONTOLOGY_FILE, 'utf-8'),
      fsPromises.readFile(SITUATION_ONTOLOGY_FILE, 'utf-8'),
    ]);
    ontologyEngine = new OntologyEngine(JSON.parse(emotionData), JSON.parse(situationData));
    logger.info('Ontology 로드 완료');
  } catch (err) {
    logger.warn('Ontology 로드 실패 (온톨로지 없이 진행)', { error: err.message });
  }
}

// nanoid-compatible ID generation (ALPHABET must be exactly 64 chars to avoid modulo bias)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
function generateId(size = 21) {
  const bytes = crypto.randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}

// Emotion → emoji fallback map (Gemini가 텍스트를 반환할 때 사용)
const EMOTION_EMOJI_FALLBACK = {
  '기쁨': '😊', '행복': '😄', '만족': '😌', '만족감': '😌', '감사': '🙏', '뿌듯': '🥰',
  '설렘': '💓', '사랑': '❤️', '희망': '🌟', '자신감': '💪', '즐거움': '😆',
  '평온': '😌', '편안': '☺️', '안도': '😮‍💨', '여유': '🍃',
  '슬픔': '😢', '우울': '😞', '외로움': '🥺', '그리움': '💫', '허전': '🫥',
  '불안': '😰', '걱정': '😟', '긴장': '😬', '두려움': '😨', '초조': '😥',
  '분노': '😤', '짜증': '😠', '답답': '😩', '실망': '😔', '화남': '🔥',
  '놀라움': '😲', '당황': '😳', '혼란': '🤔', '당황감': '😳', '황당': '😦',
  '피곤': '😫', '지침': '😴', '무기력': '😶', '지루함': '🥱',
  '질투': '😒', '수치심': '😣', '죄책감': '😞', '공허': '🫥',
  '절망': '😭', '자기혐오': '😖', '극심한 우울': '😭',
};

function isActualEmoji(str) {
  if (!str || str.length === 0) return false;
  // ASCII 영문자/숫자/공백만으로 이루어져 있으면 이모지가 아님
  if (/^[a-zA-Z0-9\s]+$/.test(str)) return false;
  // 한글만으로 이루어져 있으면 이모지가 아님
  if (/^[\uAC00-\uD7AF\s]+$/.test(str)) return false;
  return true;
}

function parseGeminiResponse(text) {
  let jsonStr = text.trim();
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  const parsed = JSON.parse(jsonStr);

  const emotion = typeof parsed.emotion === 'string' ? parsed.emotion : '알 수 없음';
  let emoji = typeof parsed.emoji === 'string' ? parsed.emoji : '';

  // Gemini가 이모지 대신 텍스트를 반환한 경우 fallback
  if (!isActualEmoji(emoji)) {
    emoji = EMOTION_EMOJI_FALLBACK[emotion] || '💭';
  }

  // activity_tags: 유효한 태그만 필터링
  const VALID_ACTIVITY_TAGS = ['운동','독서','산책','음악','요리','친구','가족','공부','업무','쇼핑','여행','취미','휴식','명상'];
  const activityTags = Array.isArray(parsed.activity_tags)
    ? parsed.activity_tags.filter(t => typeof t === 'string' && VALID_ACTIVITY_TAGS.includes(t))
    : [];

  return { emotion, emoji, message: typeof parsed.message === 'string' ? parsed.message : '', advice: typeof parsed.advice === 'string' ? parsed.advice : '', activity_tags: activityTags };
}

function calculateBackoffDelay(attempt) {
  const exponentialDelay = config.retry.baseDelay * Math.pow(2, attempt);
  return exponentialDelay + Math.random() * exponentialDelay * 0.1;
}

function calculateTokenCost(usageMetadata) {
  if (!usageMetadata) return null;
  const input = usageMetadata.promptTokenCount ?? 0;
  const output = usageMetadata.candidatesTokenCount ?? 0;
  const thinking = usageMetadata.thoughtsTokenCount ?? 0;
  const cached = usageMetadata.cachedContentTokenCount ?? 0;
  const total = usageMetadata.totalTokenCount ?? (input + output);
  const p = config.pricing;
  const inputCost = parseFloat(((input / 1_000_000) * p.inputPerMillion).toFixed(8));
  const outputCost = parseFloat(((output / 1_000_000) * p.outputPerMillion).toFixed(8));
  const thinkingCost = parseFloat(((thinking / 1_000_000) * p.thinkingPerMillion).toFixed(8));
  const totalCost = parseFloat((inputCost + outputCost + thinkingCost).toFixed(8));
  return { input, output, thinking, cached, total, inputCost, outputCost, thinkingCost, totalCost };
}

// Sanitize string fields — truncate only, no HTML escaping
// XSS 방지는 프론트엔드 escapeHtml()에서 표시 시점에 처리
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  // Unicode-safe truncation (서로게이트 쌍 보호)
  const chars = [...str];
  return chars.length <= maxLength ? str : chars.slice(0, maxLength).join('');
}

// Validate that a value is a plain object (not array, not null)
function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

// Generate a request ID for tracing
function requestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Gemini API Fetch with Retry
// ---------------------------------------------------------------------------

class GeminiAPIError extends Error {
  constructor(status, error, code) {
    super(error);
    this.status = status;
    this.code = code;
  }
}

async function callGeminiAPI(requestBody, { rid, label = 'Gemini' } = {}) {
  const MAX_RETRIES = config.retry.maxRetries;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.debug(`${label} API 시도 (${attempt + 1}/${MAX_RETRIES + 1})`, { requestId: rid });

      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(config.timeout),
      });

      if (!response.ok) {
        const status = response.status;
        let geminiError;
        try { geminiError = await response.json(); } catch { geminiError = { message: response.statusText }; }
        logger.error(`${label} API 오류`, { requestId: rid, attempt: attempt + 1, status, error: geminiError });
        collectError({
          level: 'error',
          source: 'api_external',
          message: `Gemini API ${status}: ${geminiError?.message || geminiError?.error?.message || 'Unknown'}`,
          code: 'GEMINI_API_ERROR',
          requestId: rid,
          statusCode: status,
          metadata: { attempt: attempt + 1, label },
        });

        if (status === 429 && attempt < MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          logger.warn('API 한도 초과, 백오프 재시도', { requestId: rid, delayMs: Math.round(delay) });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        if (status === 429) throw new GeminiAPIError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 'RATE_LIMITED');
        if (status === 400 || status === 403) throw new GeminiAPIError(502, 'API 인증에 실패했습니다.', 'AI_SERVICE_ERROR');
        throw new GeminiAPIError(502, `AI 서비스 오류 (${status})`, 'AI_SERVICE_ERROR');
      }

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const tokenCost = calculateTokenCost(data.usageMetadata);

      if (!content) {
        lastError = new Error('Empty Gemini response');
        continue;
      }

      return { content, tokenCost };
    } catch (err) {
      if (err instanceof GeminiAPIError) throw err;
      lastError = err;
      logger.error(`${label} API 처리 중 오류`, { requestId: rid, attempt: attempt + 1, errorName: err.name, errorMessage: err.message });
      if (err instanceof SyntaxError) continue;
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new GeminiAPIError(504, '요청 시간이 초과되었습니다.', 'TIMEOUT');
      }
      break;
    }
  }

  throw new GeminiAPIError(502, '분석에 실패했습니다. 다시 시도해주세요.', 'AI_SERVICE_ERROR');
}

async function logAiUsage({ userId, endpoint, tokenCost, durationMs }) {
  if (!supabaseAdmin || !tokenCost) return;
  try {
    await supabaseAdmin.from('ai_usage_logs').insert({
      user_id: userId || null,
      endpoint,
      model: config.gemini.model,
      input_tokens: tokenCost.input || 0,
      output_tokens: tokenCost.output || 0,
      thinking_tokens: tokenCost.thinking || 0,
      cached_tokens: tokenCost.cached || 0,
      total_tokens: tokenCost.total || 0,
      cost_usd: tokenCost.totalCost || 0,
      duration_ms: durationMs || null,
    });
  } catch (err) {
    logger.warn('AI 사용량 로그 저장 실패', { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Streak Calculator
// ---------------------------------------------------------------------------

async function updateStreak(supabaseClient, userId, tzOffsetMinutes) {
  if (!USE_SUPABASE || !supabaseClient) return;

  try {
    // Get current profile
    const { data: profile, error: profileErr } = await supabaseClient
      .from('user_profiles')
      .select('current_streak, max_streak, last_entry_date')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) return;

    // 클라이언트 타임존 기준 오늘 날짜 (폴백: 서버 설정 KST)
    const offsetMs = (typeof tzOffsetMinutes === 'number' && tzOffsetMinutes >= -720 && tzOffsetMinutes <= 840)
      ? -tzOffsetMinutes * 60 * 1000
      : config.timezone.utcOffsetHours * 60 * 60 * 1000;
    const localNow = new Date(Date.now() + offsetMs);
    const today = localNow.toISOString().split('T')[0];
    const todayDate = new Date(today + "T00:00:00Z");

    // Determine new streak value
    let newStreak = 1;
    if (profile.last_entry_date) {
      const lastDate = new Date(profile.last_entry_date);
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return; // Already counted today
      if (diffDays === 1) newStreak = profile.current_streak + 1; // Consecutive
      // diffDays > 1: streak broken, newStreak stays 1
    }

    await supabaseClient
      .from('user_profiles')
      .update({
        current_streak: newStreak,
        max_streak: Math.max(profile.max_streak, newStreak),
        last_entry_date: todayDate.toISOString().split('T')[0],
      })
      .eq('id', userId);
  } catch (err) {
    logger.warn('Streak 업데이트 실패', { error: err.message, userId });
  }
}

// ---------------------------------------------------------------------------
// Rate Limiters
// ---------------------------------------------------------------------------

const analyzeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
  standardHeaders: 'draft-6',
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: config.rateLimits.signup.windowMs,
  max: config.rateLimits.signup.max,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: { error: '회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
  standardHeaders: 'draft-6',
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: config.rateLimits.login.windowMs,
  max: config.rateLimits.login.max,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
  standardHeaders: 'draft-6',
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

const corsOrigins = [
  ...(IS_PRODUCTION ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']),
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : []),
];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com", ...(process.env.SUPABASE_URL ? [process.env.SUPABASE_URL] : [])],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
    },
  },
}));
app.use(cors({ origin: corsOrigins }));

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: IS_PRODUCTION ? '1d' : 0,
  etag: true,
}));

// ---------------------------------------------------------------------------
// API Request Logging Middleware
// ---------------------------------------------------------------------------

app.use('/api', (req, res, next) => {
  const rid = requestId();
  req.rid = rid;
  res.set('X-Request-Id', rid);
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: rid,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || null,
    };

    if (res.statusCode >= 500) {
      collectError({
        level: 'error',
        source: 'backend',
        message: `API ${res.statusCode}: ${req.method} ${req.originalUrl}`,
        code: 'API_SERVER_ERROR',
        requestId: rid,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        userId: req.user?.id || null,
        userAgent: req.headers['user-agent'],
      });
    }

    if (duration >= SLOW_REQUEST_MS) {
      logger.warn('느린 API 요청', logData);
    } else if (res.statusCode >= 500) {
      logger.error('API 서버 에러', logData);
    } else if (res.statusCode >= 400) {
      logger.info('API 요청', logData);
    } else {
      logger.info('API 요청', logData);
    }
  });

  next();
});

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

app.get('/api/health', async (req, res) => {
  let supabaseStatus = false;
  let geminiStatus = false;

  // Check Supabase connectivity
  if (USE_SUPABASE && supabase) {
    try {
      const { error } = await supabase.from('entries').select('id', { count: 'exact', head: true });
      supabaseStatus = !error;
    } catch {
      supabaseStatus = false;
    }
  }

  // Check Gemini API key presence (not actual API call to avoid cost)
  geminiStatus = !!GEMINI_API_KEY;

  const pkg = require('./package.json');
  res.json({
    status: 'ok',
    version: pkg.version,
    supabase: supabaseStatus,
    gemini: geminiStatus,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ===========================================================================
// ROUTE MODULES
// ===========================================================================

const routeDeps = {
  logger, requestId, IS_PRODUCTION,
  supabase, supabaseAdmin, USE_SUPABASE, createUserClient,
  authMiddleware, optionalAuth,
  config, GEMINI_URL, GEMINI_API_KEY,
  ontologyEngine: () => ontologyEngine, SYSTEM_PROMPT,
  callGeminiAPI, GeminiAPIError, calculateTokenCost, logAiUsage,
  parseGeminiResponse,
  validateEmail, validatePassword, validateEntryText, validateConfidenceScore,
  validateNickname, validateBio, validateTheme, validateNotificationTime, validateResponseLength, validateAdviceStyle, validatePersonaPreset, validatePagination,
  sanitizeString, isPlainObject,
  updateStreak,
  signupLimiter, loginLimiter, analyzeLimiter,
  generateId,
  logSecurityEvent,
  collectError,
};

app.use('/api/auth', require('./routes/auth')(routeDeps));
app.use('/api', require('./routes/profile')(routeDeps));
app.use('/api', require('./routes/analyze')(routeDeps));
app.use('/api', require('./routes/entries')(routeDeps));
app.use('/api', require('./routes/stats')(routeDeps));
app.use('/api', require('./routes/report')(routeDeps));
app.use('/api', require('./routes/migrate')(routeDeps));
app.use('/api', require('./routes/followup')(routeDeps));
app.use('/api', require('./routes/emotion-graph')(routeDeps));
app.use('/api', require('./routes/illustrated-diary')(routeDeps));
const analyticsLimiter = rateLimit({
  windowMs: config.rateLimits.analytics.windowMs,
  max: config.rateLimits.analytics.max,
  keyGenerator: ipKeyGenerator,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
});
app.use('/api/analytics', analyticsLimiter, require('./routes/analytics')(routeDeps));
app.use('/api', require('./routes/error-logs')(routeDeps));

// 404 Handler (API routes only)
// ---------------------------------------------------------------------------

app.use('/api', (req, res) => {
  res.status(404).json({ error: '요청한 API를 찾을 수 없습니다.', code: 'NOT_FOUND' });
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '잘못된 요청 형식입니다.', code: 'INVALID_JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: '요청 본문이 너무 큽니다.', code: 'PAYLOAD_TOO_LARGE' });
  }
  logger.error('Unhandled error', {
    requestId: req.rid || null,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id || null,
    error: err.message,
    stack: IS_PRODUCTION ? undefined : err.stack,
  });
  collectError({
    level: 'error',
    source: 'backend',
    message: err.message,
    stack: err.stack,
    code: err.code || 'INTERNAL_ERROR',
    requestId: req.rid || null,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id || null,
    userAgent: req.headers['user-agent'],
  });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: '서버 내부 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  try {
    await loadOntologies();

    // Verify Supabase connection if enabled
    if (USE_SUPABASE && supabase) {
      try {
        const { error } = await supabase.from('entries').select('id', { count: 'exact', head: true });
        if (error) throw error;
        logger.info('Supabase 연결 확인 완료');
      } catch (err) {
        logger.warn('Supabase 연결 실패 (JSON fallback으로 동작)', { error: err.message });
      }
    }

    const server = app.listen(PORT, () => {
      logger.info('서버 시작 완료', {
        port: PORT,
        url: `http://localhost:${PORT}`,
        version: require('./package.json').version,
        supabase: USE_SUPABASE ? 'enabled' : 'disabled',
        corsOrigins,
      });
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      logger.info(`${signal} 수신, 서버 종료 중...`);
      server.close(() => {
        logger.info('서버 정상 종료 완료');
        process.exit(0);
      });
      setTimeout(() => {
        logger.warn('강제 종료 (타임아웃 10초 초과)');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('서버 시작 실패', { error: err.message });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { error: reason?.message || String(reason) });
  collectError({
    level: 'error',
    source: 'backend',
    message: reason?.message || String(reason),
    stack: reason?.stack,
    code: 'UNHANDLED_REJECTION',
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, ...(IS_PRODUCTION ? {} : { stack: err.stack }) });
  collectError({
    level: 'fatal',
    source: 'backend',
    message: err.message,
    stack: err.stack,
    code: 'UNCAUGHT_EXCEPTION',
  });
  process.exit(1);
});

start().catch(err => {
  logger.error('예상치 못한 에러', { error: err.message });
  process.exit(1);
});
