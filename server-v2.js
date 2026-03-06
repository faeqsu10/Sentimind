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
const {
  validateEmail,
  validatePassword,
  validateEntryText,
  validateConfidenceScore,
  validateNickname,
  validateBio,
  validateTheme,
  validateNotificationTime,
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

const DATA_DIR = IS_PRODUCTION ? '/tmp/sentimind-data' : path.join(__dirname, 'data');
const ENTRIES_FILE = path.join(DATA_DIR, 'entries.json');
const EMOTION_ONTOLOGY_FILE = IS_PRODUCTION
  ? path.join(__dirname, 'data', 'emotion-ontology.json')
  : path.join(DATA_DIR, 'emotion-ontology.json');
const SITUATION_ONTOLOGY_FILE = IS_PRODUCTION
  ? path.join(__dirname, 'data', 'situation-ontology.json')
  : path.join(DATA_DIR, 'situation-ontology.json');

// Data directory initialization (JSON fallback)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ENTRIES_FILE)) {
  fs.writeFileSync(ENTRIES_FILE, '[]', 'utf-8');
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const LOGS_DIR = IS_PRODUCTION ? '/tmp/sentimind-logs' : path.join(__dirname, 'logs');

class Logger {
  constructor() {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    this._cleanOldLogs();
  }

  _getLogFile() {
    return path.join(LOGS_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  _shouldLog(level) {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  async _cleanOldLogs() {
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
      environment: IS_PRODUCTION ? 'production' : 'development',
    };

    const colors = { DEBUG: '\x1b[36m', INFO: '\x1b[32m', WARN: '\x1b[33m', ERROR: '\x1b[31m' };
    let dataStr = '';
    try { dataStr = data ? JSON.stringify(data) : ''; } catch { dataStr = '[circular]'; }
    console.log(`${colors[level]}[${level}] ${message}\x1b[0m${dataStr ? ` | ${dataStr}` : ''}`);

    fs.promises.appendFile(this._getLogFile(), JSON.stringify(logEntry) + '\n', 'utf-8')
      .catch(err => console.error(`Log write error: ${err.message}`));
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

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요:
{
  "emotion": "감정 이름 (예: 만족감, 기쁨, 불안, 긴장, 설렘 등)",
  "emoji": "감정을 나타내는 이모지 1개",
  "message": "2~3문장의 공감 및 위로 메시지",
  "advice": "1문장의 간단한 행동 제안"
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
let writeLock = Promise.resolve();
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

// nanoid-compatible ID generation
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
function generateId(size = 21) {
  const bytes = crypto.randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}

// JSON fallback: read entries from file
async function readEntriesFromFile() {
  try {
    const raw = await fsPromises.readFile(ENTRIES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// JSON fallback: write entries to file
async function writeEntriesToFile(entries) {
  writeLock = writeLock.then(() =>
    fsPromises.writeFile(ENTRIES_FILE, JSON.stringify(entries, null, 2), 'utf-8')
  );
  return writeLock;
}

function parseGeminiResponse(text) {
  let jsonStr = text.trim();
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  const parsed = JSON.parse(jsonStr);
  return {
    emotion: typeof parsed.emotion === 'string' ? parsed.emotion : '알 수 없음',
    emoji: typeof parsed.emoji === 'string' ? parsed.emoji : '💭',
    message: typeof parsed.message === 'string' ? parsed.message : '',
    advice: typeof parsed.advice === 'string' ? parsed.advice : '',
  };
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

// Sanitize string fields to prevent stored XSS
// 서버 측에서 HTML 특수문자를 이스케이프하여 저장
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

// ---------------------------------------------------------------------------
// Streak Calculator
// ---------------------------------------------------------------------------

async function updateStreak(supabaseClient, userId) {
  if (!USE_SUPABASE || !supabaseClient) return;

  try {
    // Get current profile
    const { data: profile, error: profileErr } = await supabaseClient
      .from('user_profiles')
      .select('current_streak, max_streak, last_entry_date')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) return;

    // KST 기준 오늘 날짜 (ISO format)
    const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const today = kstNow.toISOString().split('T')[0];
    const todayDate = new Date(today + "T00:00:00Z");

    // Already wrote today
    if (profile.last_entry_date) {
      const lastDate = new Date(profile.last_entry_date);
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Already counted today
        return;
      } else if (diffDays === 1) {
        // Consecutive day: increment streak
        const newStreak = profile.current_streak + 1;
        await supabaseClient
          .from('user_profiles')
          .update({
            current_streak: newStreak,
            max_streak: Math.max(profile.max_streak, newStreak),
            last_entry_date: todayDate.toISOString().split('T')[0],
          })
          .eq('id', userId);
      } else {
        // Streak broken: reset to 1
        await supabaseClient
          .from('user_profiles')
          .update({
            current_streak: 1,
            max_streak: Math.max(profile.max_streak, 1),
            last_entry_date: todayDate.toISOString().split('T')[0],
          })
          .eq('id', userId);
      }
    } else {
      // First entry ever
      await supabaseClient
        .from('user_profiles')
        .update({
          current_streak: 1,
          max_streak: Math.max(profile.max_streak, 1),
          last_entry_date: todayDate.toISOString().split('T')[0],
        })
        .eq('id', userId);
    }
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
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.SIGNUP_RATE_LIMIT || '3', 10),
  keyGenerator: (req) => ipKeyGenerator(req),
  message: { error: '회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
  standardHeaders: 'draft-6',
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT || '5', 10),
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
      scriptSrc: ["'self'", "'unsafe-inline'"],  // 단일 HTML 인라인 스크립트 허용
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
}));
app.use(cors({ origin: corsOrigins }));

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
  callGeminiAPI, GeminiAPIError, calculateTokenCost,
  parseGeminiResponse,
  validateEmail, validatePassword, validateEntryText, validateConfidenceScore,
  validateNickname, validateBio, validateTheme, validateNotificationTime, validatePagination,
  sanitizeString, isPlainObject,
  updateStreak,
  signupLimiter, loginLimiter, analyzeLimiter,
  readEntries: readEntriesFromFile, writeEntries: writeEntriesToFile,
  generateId,
  logSecurityEvent,
  ENTRIES_FILE, DATA_DIR,
};

app.use('/api/auth', require('./routes/auth')(routeDeps));
app.use('/api', require('./routes/profile')(routeDeps));
app.use('/api', require('./routes/analyze')(routeDeps));
app.use('/api', require('./routes/entries')(routeDeps));
app.use('/api', require('./routes/stats')(routeDeps));
app.use('/api', require('./routes/report')(routeDeps));
app.use('/api', require('./routes/migrate')(routeDeps));
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: ipKeyGenerator,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
});
app.use('/api/analytics', analyticsLimiter, require('./routes/analytics')(routeDeps));

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
    error: err.message,
    stack: IS_PRODUCTION ? undefined : err.stack,
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
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, ...(IS_PRODUCTION ? {} : { stack: err.stack }) });
  process.exit(1);
});

start().catch(err => {
  logger.error('예상치 못한 에러', { error: err.message });
  process.exit(1);
});
