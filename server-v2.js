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
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const IS_PRODUCTION = process.env.VERCEL || process.env.NODE_ENV === 'production';
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

  _cleanOldLogs() {
    try {
      const files = fs.readdirSync(LOGS_DIR);
      const now = Date.now();
      const retentionMs = config.logs.retentionDays * 24 * 60 * 60 * 1000;
      files.forEach(file => {
        if (file.startsWith('app-') && file.endsWith('.log')) {
          const filePath = path.join(LOGS_DIR, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > retentionMs) {
            fs.unlinkSync(filePath);
          }
        }
      });
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

    try {
      fs.appendFileSync(this._getLogFile(), JSON.stringify(logEntry) + '\n', 'utf-8');
    } catch (err) {
      console.error(`Log write error: ${err.message}`);
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

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length <= 2
    ? '*'.repeat(local.length)
    : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

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

// Generate a request ID for tracing
function requestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : []),
];

app.use(helmet({
  contentSecurityPolicy: false, // Inline scripts/styles in single HTML file
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

  res.json({
    status: 'ok',
    version: '2.1.0',
    supabase: supabaseStatus,
    gemini: geminiStatus,
    timestamp: new Date().toISOString(),
  });
});

// ===========================================================================
// AUTH ROUTES (/api/auth/*)
// ===========================================================================

// POST /api/auth/signup - 회원가입
app.post('/api/auth/signup', signupLimiter, async (req, res) => {
  const rid = requestId();
  logger.info('POST /api/auth/signup', { requestId: rid });

  if (!USE_SUPABASE) {
    return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
  }

  const emailV = validateEmail(req.body?.email);
  if (!emailV.valid) return res.status(400).json({ error: emailV.error, code: 'VALIDATION_ERROR' });

  const passV = validatePassword(req.body?.password);
  if (!passV.valid) return res.status(400).json({ error: passV.error, code: 'VALIDATION_ERROR' });

  try {
    const { data, error } = await supabase.auth.signUp({
      email: emailV.value,
      password: req.body.password,
      options: {
        data: {
          nickname: req.body.nickname || null,
        },
      },
    });

    if (error) {
      logSecurityEvent('SIGNUP_FAILED', {
        requestId: rid,
        email: maskEmail(emailV.value),
        ip: req.ip,
        reason: error.message,
      });

      if (error.message.includes('already registered') || error.status === 422) {
        return res.status(409).json({ error: '이미 등록된 이메일입니다.', code: 'CONFLICT' });
      }
      return res.status(400).json({ error: error.message, code: 'SIGNUP_ERROR' });
    }

    // Supabase returns user without identities for repeated signup (already registered)
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      logSecurityEvent('SIGNUP_REPEATED', {
        requestId: rid,
        email: maskEmail(emailV.value),
        ip: req.ip,
      });
      return res.status(409).json({ error: '이미 등록된 이메일입니다.', code: 'CONFLICT' });
    }

    logger.info('회원가입 성공', { requestId: rid, userId: data.user?.id });

    res.status(201).json({
      data: {
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
        session: data.session,
      },
      message: data.session ? '회원가입 완료' : '인증 이메일이 발송되었습니다. 메일함을 확인해주세요.',
    });
  } catch (err) {
    logger.error('회원가입 처리 중 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// POST /api/auth/login - 로그인
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const rid = requestId();
  logger.info('POST /api/auth/login', { requestId: rid });

  if (!USE_SUPABASE) {
    return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
  }

  const emailV = validateEmail(req.body?.email);
  if (!emailV.valid) return res.status(400).json({ error: emailV.error, code: 'VALIDATION_ERROR' });

  if (!req.body?.password) {
    return res.status(400).json({ error: '비밀번호를 입력해주세요.', code: 'VALIDATION_ERROR' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailV.value,
      password: req.body.password,
    });

    if (error) {
      logSecurityEvent('LOGIN_FAILED', {
        requestId: rid,
        email: maskEmail(emailV.value),
        ip: req.ip,
        reason: error.message,
      });
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.', code: 'UNAUTHORIZED' });
    }

    logger.info('로그인 성공', { requestId: rid, userId: data.user?.id });

    res.json({
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type,
        },
      },
    });
  } catch (err) {
    logger.error('로그인 처리 중 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// POST /api/auth/logout - 로그아웃
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  const rid = requestId();

  if (!USE_SUPABASE) {
    return res.json({ data: { success: true } });
  }

  try {
    if (supabaseAdmin) {
      const userId = req.user?.id;
      if (userId) {
        await supabaseAdmin.auth.admin.signOut(userId, 'global');
      }
    }
    logger.info('로그아웃 성공', { requestId: rid, userId: req.user?.id });
    res.json({ data: { success: true } });
  } catch (err) {
    logger.warn('로그아웃 처리 중 오류', { requestId: rid, error: err.message });
    res.json({ data: { success: true } }); // Always succeed for client
  }
});

// POST /api/auth/reset-password - 비밀번호 재설정 이메일 발송
app.post('/api/auth/reset-password', loginLimiter, async (req, res) => {
  const rid = requestId();

  if (!USE_SUPABASE) {
    return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
  }

  const emailV = validateEmail(req.body?.email);
  if (!emailV.valid) return res.status(400).json({ error: emailV.error, code: 'VALIDATION_ERROR' });

  try {
    // Always return success to prevent email enumeration
    await supabase.auth.resetPasswordForEmail(emailV.value);
    logger.info('비밀번호 재설정 요청', { requestId: rid });
  } catch (err) {
    logger.warn('비밀번호 재설정 오류', { requestId: rid, error: err.message });
  }

  res.json({ data: { message: '해당 이메일이 존재하면 재설정 링크가 발송됩니다.' } });
});

// POST /api/auth/refresh - 토큰 갱신
app.post('/api/auth/refresh', loginLimiter, async (req, res) => {
  const rid = requestId();

  if (!USE_SUPABASE) {
    return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
  }

  const refreshToken = req.body?.refresh_token;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refresh_token이 필요합니다.', code: 'VALIDATION_ERROR' });
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      logSecurityEvent('TOKEN_REFRESH_FAILED', {
        requestId: rid,
        ip: req.ip,
        reason: error?.message || 'session is null',
      });
      return res.status(401).json({ error: '토큰 갱신에 실패했습니다. 다시 로그인해주세요.', code: 'UNAUTHORIZED' });
    }

    logger.info('토큰 갱신 성공', { requestId: rid, userId: data.user?.id });

    res.json({
      data: {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type,
        },
      },
    });
  } catch (err) {
    logger.error('토큰 갱신 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// GET /api/auth/me - 현재 사용자 정보
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.json({ data: null });
  }

  res.json({
    data: {
      id: req.user.id,
      email: req.user.email,
    },
  });
});

// DELETE /api/auth/account - 회원탈퇴
app.delete('/api/auth/account', authMiddleware, async (req, res) => {
  const rid = requestId();
  const userId = req.user?.id;

  logger.info('DELETE /api/auth/account', { requestId: rid, userId });

  if (!USE_SUPABASE || !supabaseAdmin) {
    return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
  }

  try {
    // 1. Soft-delete all user entries
    await req.supabaseClient
      .from('entries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('deleted_at', null);

    // 2. Delete user profile
    await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    // 3. Delete auth user (requires admin client)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      logger.error('회원탈퇴 실패', { requestId: rid, error: error.message });
      return res.status(500).json({ error: '회원탈퇴 처리에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }

    logSecurityEvent('ACCOUNT_DELETED', { requestId: rid, userId, ip: req.ip });
    logger.info('회원탈퇴 완료', { requestId: rid, userId });
    res.json({ data: { success: true }, message: '회원탈퇴가 완료되었습니다.' });
  } catch (err) {
    logger.error('회원탈퇴 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// PUT /api/auth/password - 비밀번호 변경
app.put('/api/auth/password', authMiddleware, async (req, res) => {
  const rid = requestId();

  if (!USE_SUPABASE) {
    return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
  }

  const passV = validatePassword(req.body?.newPassword);
  if (!passV.valid) return res.status(400).json({ error: passV.error, code: 'VALIDATION_ERROR' });

  try {
    const { error } = await req.supabaseClient.auth.updateUser({
      password: req.body.newPassword,
    });

    if (error) {
      logger.warn('비밀번호 변경 실패', { requestId: rid, error: error.message });
      return res.status(400).json({ error: error.message, code: 'PASSWORD_CHANGE_ERROR' });
    }

    logSecurityEvent('PASSWORD_CHANGED', { requestId: rid, userId: req.user?.id, ip: req.ip });
    logger.info('비밀번호 변경 완료', { requestId: rid, userId: req.user?.id });
    res.json({ data: { success: true }, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    logger.error('비밀번호 변경 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// ===========================================================================
// PROFILE ROUTES (/api/profile)
// ===========================================================================

// GET /api/profile - 프로필 조회
app.get('/api/profile', authMiddleware, async (req, res) => {
  const rid = requestId();

  if (!USE_SUPABASE || !req.supabaseClient) {
    return res.json({ data: { id: null, email: null } });
  }

  try {
    const { data: profile, error } = await req.supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      logger.warn('프로필 조회 실패', { requestId: rid, error: error.message });
      return res.status(404).json({ error: '프로필을 찾을 수 없습니다.', code: 'NOT_FOUND' });
    }

    // Get total entries count (exclude soft-deleted)
    const { count } = await req.supabaseClient
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .is('deleted_at', null);

    res.json({
      data: {
        ...profile,
        email: req.user.email,
        total_entries: count || 0,
      },
    });
  } catch (err) {
    logger.error('프로필 조회 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// PATCH /api/profile - 프로필 수정
app.patch('/api/profile', authMiddleware, async (req, res) => {
  const rid = requestId();

  if (!USE_SUPABASE || !req.supabaseClient) {
    return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
  }

  // Build update object from validated fields
  const updates = {};
  const validations = [
    ['nickname', validateNickname],
    ['bio', validateBio],
    ['theme', validateTheme],
    ['notification_time', validateNotificationTime],
  ];

  for (const [field, validator] of validations) {
    if (req.body[field] !== undefined) {
      const result = validator(req.body[field]);
      if (!result.valid) {
        return res.status(400).json({ error: result.error, code: 'VALIDATION_ERROR' });
      }
      if (result.value !== undefined) {
        updates[field] = result.value;
      }
    }
  }

  // Boolean fields (no complex validation needed)
  if (req.body.notification_enabled !== undefined) {
    updates.notification_enabled = !!req.body.notification_enabled;
  }
  if (req.body.onboarding_completed !== undefined) {
    updates.onboarding_completed = !!req.body.onboarding_completed;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: '수정할 항목이 없습니다.', code: 'VALIDATION_ERROR' });
  }

  try {
    const { data, error } = await req.supabaseClient
      .from('user_profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      logger.warn('프로필 수정 실패', { requestId: rid, error: error.message });
      return res.status(500).json({ error: '프로필 수정에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }

    logger.info('프로필 수정 완료', { requestId: rid, userId: req.user.id, fields: Object.keys(updates) });

    res.json({ data });
  } catch (err) {
    logger.error('프로필 수정 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// ===========================================================================
// ANALYZE ROUTE (/api/analyze)
// ===========================================================================

app.post('/api/analyze', authMiddleware, analyzeLimiter, async (req, res) => {
  const rid = requestId();
  const startTime = Date.now();

  logger.info('POST /api/analyze 요청 수신', { requestId: rid, userId: req.user?.id });

  if (!req.body) {
    return res.status(400).json({ error: 'JSON 형식의 요청 본문이 필요합니다.', code: 'VALIDATION_ERROR' });
  }

  const textV = validateEntryText(req.body.text);
  if (!textV.valid) return res.status(400).json({ error: textV.error, code: 'VALIDATION_ERROR' });

  if (!GEMINI_API_KEY) {
    logger.error('Gemini API 키 미설정', { requestId: rid });
    return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.', code: 'INTERNAL_ERROR' });
  }

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: textV.value }] }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      maxOutputTokens: config.gemini.maxOutputTokens,
      temperature: config.gemini.temperature,
      thinkingConfig: { thinkingBudget: config.gemini.thinkingBudget },
    },
  };

  const MAX_RETRIES = config.retry.maxRetries;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.debug(`Gemini API 시도 (${attempt + 1}/${MAX_RETRIES + 1})`, { requestId: rid });

      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(config.timeout),
      });

      if (!response.ok) {
        const status = response.status;
        let geminiError;
        try { geminiError = await response.json(); } catch { geminiError = { message: response.statusText }; }

        logger.error('Gemini API 오류', { requestId: rid, attempt: attempt + 1, status, error: geminiError });

        if (status === 429 && attempt < MAX_RETRIES) {
          const delay = calculateBackoffDelay(attempt);
          logger.warn('API 한도 초과, 백오프 재시도', { requestId: rid, delayMs: Math.round(delay) });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        if (status === 429) {
          return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' });
        }
        if (status === 400 || status === 403) {
          return res.status(502).json({ error: 'API 인증에 실패했습니다.', code: 'AI_SERVICE_ERROR' });
        }
        return res.status(502).json({ error: `AI 서비스 오류 (${status})`, code: 'AI_SERVICE_ERROR' });
      }

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const tokenCost = calculateTokenCost(data.usageMetadata);

      if (!content) {
        lastError = new Error('Empty Gemini response');
        continue;
      }

      const result = parseGeminiResponse(content);
      const enrichedResult = ontologyEngine
        ? ontologyEngine.enrichEmotion(result.emotion, textV.value, result)
        : result;

      const duration = Date.now() - startTime;
      logger.info('감정 분석 완료', {
        requestId: rid,
        emotion: enrichedResult.emotion,
        confidence: enrichedResult.ontology?.confidence,
        duration: `${duration}ms`,
        ...(tokenCost && {
          tokens: {
            input: tokenCost.input,
            output: tokenCost.output,
            thinking: tokenCost.thinking,
            cached: tokenCost.cached,
            total: tokenCost.total,
          },
          costUsd: {
            input: tokenCost.inputCost,
            output: tokenCost.outputCost,
            thinking: tokenCost.thinkingCost,
            total: tokenCost.totalCost,
          },
          model: config.gemini.model,
        }),
      });

      return res.json(enrichedResult);
    } catch (err) {
      lastError = err;
      logger.error('API 처리 중 오류', {
        requestId: rid,
        attempt: attempt + 1,
        errorName: err.name,
        errorMessage: err.message,
        stack: err.stack,
      });
      if (err instanceof SyntaxError) continue;
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return res.status(504).json({ error: '요청 시간이 초과되었습니다.', code: 'TIMEOUT' });
      }
      break;
    }
  }

  const duration = Date.now() - startTime;
  logger.error('Gemini API 최종 실패', {
    requestId: rid,
    attempts: MAX_RETRIES + 1,
    lastError: lastError?.message,
    duration: `${duration}ms`,
  });
  return res.status(500).json({ error: '응답을 해석하지 못했습니다. 다시 시도해주세요.', code: 'INTERNAL_ERROR' });
});

// ===========================================================================
// ENTRIES ROUTES (/api/entries)
// ===========================================================================

// GET /api/entries - 일기 목록 조회
app.get('/api/entries', authMiddleware, async (req, res) => {
  const rid = requestId();
  const startTime = Date.now();

  logger.info('GET /api/entries', { requestId: rid, userId: req.user?.id });

  try {
    // Supabase path
    if (USE_SUPABASE && req.supabaseClient) {
      const { limit, offset } = validatePagination(req.query);

      let query = req.supabaseClient
        .from('entries')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Optional emotion filter
      if (req.query.emotion) {
        query = query.eq('emotion', req.query.emotion);
      }

      // Optional text search (escape LIKE wildcards to prevent injection)
      if (req.query.search) {
        const safeSearch = req.query.search.replace(/[%_\\]/g, '\\$&');
        query = query.ilike('text', `%${safeSearch}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('일기 조회 실패 (Supabase)', { requestId: rid, error: error.message });
        return res.status(500).json({ error: '일기 목록 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
      }

      // Map created_at -> date for backward compatibility
      const entries = (data || []).map(e => ({ ...e, date: e.created_at }));

      res.set('X-Total-Count', String(count || 0));

      const duration = Date.now() - startTime;
      logger.info('일기 목록 조회 성공', { requestId: rid, count: entries.length, duration: `${duration}ms` });

      return res.json(entries);
    }

    // JSON fallback
    const entries = await readEntriesFromFile();
    const duration = Date.now() - startTime;
    logger.info('일기 목록 조회 성공 (JSON)', { requestId: rid, count: entries.length, duration: `${duration}ms` });
    res.json(entries);
  } catch (err) {
    logger.error('일기 목록 조회 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '일기 목록 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// POST /api/entries - 일기 저장
app.post('/api/entries', authMiddleware, async (req, res) => {
  const rid = requestId();
  const startTime = Date.now();

  logger.info('POST /api/entries', { requestId: rid, userId: req.user?.id });

  if (!req.body) {
    return res.status(400).json({ error: 'JSON 형식의 요청 본문이 필요합니다.', code: 'VALIDATION_ERROR' });
  }

  const textV = validateEntryText(req.body.text);
  if (!textV.valid) return res.status(400).json({ error: textV.error, code: 'VALIDATION_ERROR' });

  const confV = validateConfidenceScore(req.body.confidence_score);
  if (!confV.valid) return res.status(400).json({ error: confV.error, code: 'VALIDATION_ERROR' });

  try {
    // Supabase path
    if (USE_SUPABASE && req.supabaseClient) {
      const entryData = {
        id: generateId(),
        user_id: req.user.id,
        text: textV.value,
        emotion: req.body.emotion || '알 수 없음',
        emoji: req.body.emoji || '💭',
        message: req.body.message || '',
        advice: req.body.advice || '',
        emotion_hierarchy: req.body.emotion_hierarchy || {},
        situation_context: req.body.situation_context || [],
        confidence_score: confV.value,
        related_emotions: req.body.related_emotions || [],
      };

      const { data, error } = await req.supabaseClient
        .from('entries')
        .insert(entryData)
        .select()
        .single();

      if (error) {
        logger.error('일기 저장 실패 (Supabase)', { requestId: rid, error: error.message });
        return res.status(500).json({ error: '일기 저장에 실패했습니다.', code: 'INTERNAL_ERROR' });
      }

      // Update streak
      await updateStreak(req.supabaseClient, req.user.id);

      const duration = Date.now() - startTime;
      logger.info('일기 저장 완료', { requestId: rid, entryId: data.id, duration: `${duration}ms` });

      // Backward compatible: add date field
      return res.status(201).json({ ...data, date: data.created_at });
    }

    // JSON fallback
    const entry = {
      id: generateId(),
      date: new Date().toISOString(),
      text: textV.value,
      emotion: req.body.emotion || '알 수 없음',
      emoji: req.body.emoji || '💭',
      message: req.body.message || '',
      advice: req.body.advice || '',
    };

    const entries = await readEntriesFromFile();
    entries.unshift(entry);
    await writeEntriesToFile(entries);

    const duration = Date.now() - startTime;
    logger.info('일기 저장 완료 (JSON)', { requestId: rid, entryId: entry.id, duration: `${duration}ms` });
    res.status(201).json(entry);
  } catch (err) {
    logger.error('일기 저장 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '일기 저장에 실패했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// PATCH /api/entries/:id - 일기 수정 (24시간 이내만 가능)
app.patch('/api/entries/:id', authMiddleware, async (req, res) => {
  const rid = requestId();
  const { id } = req.params;

  if (!USE_SUPABASE || !req.supabaseClient) {
    return res.status(501).json({ error: 'Supabase가 설정되지 않았습니다.', code: 'NOT_IMPLEMENTED' });
  }

  try {
    // Fetch the entry first to check ownership and edit window
    const { data: existing, error: fetchErr } = await req.supabaseClient
      .from('entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: '해당 일기를 찾을 수 없습니다.', code: 'NOT_FOUND' });
    }

    // Check 24-hour edit window
    const createdAt = new Date(existing.created_at);
    const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      return res.status(403).json({
        error: '작성 후 24시간이 지나 수정할 수 없습니다.',
        code: 'EDIT_WINDOW_EXPIRED',
      });
    }

    const updates = {};
    if (req.body.text !== undefined) {
      const textV = validateEntryText(req.body.text);
      if (!textV.valid) return res.status(400).json({ error: textV.error, code: 'VALIDATION_ERROR' });
      updates.text = textV.value;
    }

    // If reanalyze is requested, re-run through Gemini (handled by client calling /api/analyze)
    // Server just stores the updated fields
    if (req.body.emotion !== undefined) updates.emotion = req.body.emotion;
    if (req.body.emoji !== undefined) updates.emoji = req.body.emoji;
    if (req.body.message !== undefined) updates.message = req.body.message;
    if (req.body.advice !== undefined) updates.advice = req.body.advice;
    if (req.body.emotion_hierarchy !== undefined) updates.emotion_hierarchy = req.body.emotion_hierarchy;
    if (req.body.situation_context !== undefined) updates.situation_context = req.body.situation_context;
    if (req.body.confidence_score !== undefined) {
      const confV = validateConfidenceScore(req.body.confidence_score);
      if (!confV.valid) return res.status(400).json({ error: confV.error, code: 'VALIDATION_ERROR' });
      updates.confidence_score = confV.value;
    }
    if (req.body.related_emotions !== undefined) updates.related_emotions = req.body.related_emotions;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '수정할 항목이 없습니다.', code: 'VALIDATION_ERROR' });
    }

    const { data, error } = await req.supabaseClient
      .from('entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('일기 수정 실패', { requestId: rid, error: error.message });
      return res.status(500).json({ error: '일기 수정에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }

    logger.info('일기 수정 완료', { requestId: rid, entryId: id });
    res.json({ ...data, date: data.created_at });
  } catch (err) {
    logger.error('일기 수정 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// DELETE /api/entries/:id - 일기 삭제 (소프트 삭제)
app.delete('/api/entries/:id', authMiddleware, async (req, res) => {
  const rid = requestId();
  const { id } = req.params;

  logger.info('DELETE /api/entries/:id', { requestId: rid, id, userId: req.user?.id });

  try {
    // Supabase path: soft delete
    if (USE_SUPABASE && req.supabaseClient) {
      // Check entry exists and belongs to user
      const { data: existing, error: fetchErr } = await req.supabaseClient
        .from('entries')
        .select('id')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ error: '해당 일기를 찾을 수 없습니다.', code: 'NOT_FOUND' });
      }

      // Soft delete: set deleted_at
      const { error } = await req.supabaseClient
        .from('entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        logger.error('일기 삭제 실패 (Supabase)', { requestId: rid, error: error.message });
        return res.status(500).json({ error: '일기 삭제에 실패했습니다.', code: 'INTERNAL_ERROR' });
      }

      logger.info('일기 삭제 성공 (소프트 삭제)', { requestId: rid, id });
      return res.json({ success: true });
    }

    // JSON fallback: hard delete
    const entries = await readEntriesFromFile();
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) {
      return res.status(404).json({ error: '해당 일기를 찾을 수 없습니다.', code: 'NOT_FOUND' });
    }

    entries.splice(index, 1);
    await writeEntriesToFile(entries);

    logger.info('일기 삭제 성공 (JSON)', { requestId: rid, id, remainCount: entries.length });
    res.json({ success: true });
  } catch (err) {
    logger.error('일기 삭제 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '일기 삭제에 실패했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// ===========================================================================
// STATS ROUTE (/api/stats)
// ===========================================================================

app.get('/api/stats', authMiddleware, async (req, res) => {
  const rid = requestId();
  const startTime = Date.now();

  logger.info('GET /api/stats', { requestId: rid, userId: req.user?.id });

  try {
    // Supabase path: SQL-based stats
    if (USE_SUPABASE && req.supabaseClient) {
      // Parallel queries for performance
      const [entriesResult, profileResult] = await Promise.all([
        req.supabaseClient
          .from('entries')
          .select('id, text, emotion, emoji, confidence_score, situation_context, created_at')
          .eq('user_id', req.user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        req.supabaseClient
          .from('user_profiles')
          .select('current_streak, max_streak, last_entry_date')
          .eq('id', req.user.id)
          .single(),
      ]);

      if (entriesResult.error) {
        logger.error('통계 조회 실패', { requestId: rid, error: entriesResult.error.message });
        return res.status(500).json({ error: '통계 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
      }

      const entries = entriesResult.data || [];
      const profile = profileResult.data;

      // Compute stats in memory (same logic as v1 but from Supabase data)
      const emotionFreq = {};
      const situationFreq = {};
      const hourlyEmotions = {};

      entries.forEach(entry => {
        const emotion = entry.emotion || '알 수 없음';
        emotionFreq[emotion] = (emotionFreq[emotion] || 0) + 1;

        if (Array.isArray(entry.situation_context)) {
          entry.situation_context.forEach(ctx => {
            const key = `${ctx.domain}/${ctx.context}`;
            situationFreq[key] = (situationFreq[key] || 0) + 1;
          });
        }

        const date = new Date(entry.created_at);
        const hour = date.getHours();
        const hourKey = `${hour}:00`;
        if (!hourlyEmotions[hourKey]) hourlyEmotions[hourKey] = {};
        hourlyEmotions[hourKey][emotion] = (hourlyEmotions[hourKey][emotion] || 0) + 1;
      });

      const avgConfidence = entries.reduce((sum, e) => sum + (e.confidence_score || 0), 0) / Math.max(entries.length, 1);

      const topEmotions = Object.entries(emotionFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([emotion, count]) => ({ emotion, count }));

      const topSituations = Object.entries(situationFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([situation, count]) => ({ situation, count }));

      // Determine if user wrote today
      const today = new Date().toISOString().split('T')[0];
      const todayCompleted = profile?.last_entry_date === today;

      const stats = {
        total_entries: entries.length,
        avg_confidence: Math.round(avgConfidence),
        emotion_distribution: emotionFreq,
        top_emotions: topEmotions,
        top_situations: topSituations,
        hourly_distribution: hourlyEmotions,
        latest_entries: entries.slice(0, 5).map(e => ({ ...e, date: e.created_at })),
        streak: {
          current: profile?.current_streak || 0,
          max: profile?.max_streak || 0,
          today_completed: todayCompleted,
        },
      };

      const duration = Date.now() - startTime;
      logger.info('통계 조회 성공', { requestId: rid, totalEntries: entries.length, duration: `${duration}ms` });

      res.set('Cache-Control', 'private, max-age=60');
      return res.json(stats);
    }

    // JSON fallback (identical to v1)
    const entries = await readEntriesFromFile();
    const emotionFreq = {};
    const situationFreq = {};
    const hourlyEmotions = {};

    entries.forEach(entry => {
      const emotion = entry.emotion || '알 수 없음';
      emotionFreq[emotion] = (emotionFreq[emotion] || 0) + 1;

      if (entry.ontology?.situation_context) {
        entry.ontology.situation_context.forEach(ctx => {
          const key = `${ctx.domain}/${ctx.context}`;
          situationFreq[key] = (situationFreq[key] || 0) + 1;
        });
      }

      const date = new Date(entry.date);
      const hour = date.getHours();
      const hourKey = `${hour}:00`;
      if (!hourlyEmotions[hourKey]) hourlyEmotions[hourKey] = {};
      hourlyEmotions[hourKey][emotion] = (hourlyEmotions[hourKey][emotion] || 0) + 1;
    });

    const avgConfidence = entries.reduce((sum, e) => sum + (e.ontology?.confidence || 0), 0) / Math.max(entries.length, 1);

    const stats = {
      total_entries: entries.length,
      avg_confidence: Math.round(avgConfidence),
      emotion_distribution: emotionFreq,
      top_emotions: Object.entries(emotionFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([emotion, count]) => ({ emotion, count })),
      top_situations: Object.entries(situationFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([situation, count]) => ({ situation, count })),
      hourly_distribution: hourlyEmotions,
      latest_entries: entries.slice(0, 5),
    };

    const duration = Date.now() - startTime;
    logger.info('통계 조회 성공 (JSON)', { requestId: rid, totalEntries: entries.length, duration: `${duration}ms` });
    res.json(stats);
  } catch (err) {
    logger.error('통계 조회 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '통계 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/export - 데이터 내보내기 (CSV)
app.get('/api/export', authMiddleware, async (req, res) => {
  const rid = requestId();
  logger.info('GET /api/export', { requestId: rid, userId: req.user?.id });

  try {
    let entries = [];
    if (USE_SUPABASE && req.supabaseClient) {
      const { data, error } = await req.supabaseClient
        .from('entries')
        .select('text, emotion, emoji, message, advice, confidence_score, created_at')
        .eq('user_id', req.user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      entries = data || [];
    } else {
      entries = await readEntriesFromFile();
    }

    const format = req.query.format || 'csv';

    if (format === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename="sentimind-export.json"');
      return res.json(entries);
    }

    // CSV format
    const csvHeader = '날짜,감정,이모지,텍스트,공감메시지,조언,신뢰도';
    const csvRows = entries.map(e => {
      const date = e.created_at || e.date || '';
      const text = (e.text || '').replace(/"/g, '""');
      const msg = (e.message || '').replace(/"/g, '""');
      const advice = (e.advice || '').replace(/"/g, '""');
      return `"${date}","${e.emotion || ''}","${e.emoji || ''}","${text}","${msg}","${advice}",${e.confidence_score || 0}`;
    });
    const csv = '\uFEFF' + csvHeader + '\n' + csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sentimind-export.csv"');
    res.send(csv);
  } catch (err) {
    logger.error('데이터 내보내기 오류', { requestId: rid, error: err.message });
    res.status(500).json({ error: '데이터 내보내기에 실패했습니다.', code: 'INTERNAL_ERROR' });
  }
});

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

    app.listen(PORT, () => {
      logger.info('서버 시작 완료', {
        port: PORT,
        url: `http://localhost:${PORT}`,
        version: '2.1.0',
        supabase: USE_SUPABASE ? 'enabled' : 'disabled',
        corsOrigins,
      });
    });
  } catch (err) {
    logger.error('서버 시작 실패', { error: err.message });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { error: reason?.message || String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

start().catch(err => {
  logger.error('예상치 못한 에러', { error: err.message });
  process.exit(1);
});
