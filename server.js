require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Supabase 클라이언트 초기화
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const USE_SUPABASE = SUPABASE_URL && SUPABASE_ANON_KEY; // Supabase 활성화 여부
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 환경에 따라 데이터 디렉토리 결정 (로컬/Vercel 호환성)
const IS_PRODUCTION = process.env.VERCEL || process.env.NODE_ENV === 'production';
const DATA_DIR = IS_PRODUCTION ? '/tmp/sentimind-data' : path.join(__dirname, 'data');
const ENTRIES_FILE = path.join(DATA_DIR, 'entries.json');
const EMOTION_ONTOLOGY_FILE = IS_PRODUCTION
  ? path.join(__dirname, 'data', 'emotion-ontology.json')
  : path.join(DATA_DIR, 'emotion-ontology.json');
const SITUATION_ONTOLOGY_FILE = IS_PRODUCTION
  ? path.join(__dirname, 'data', 'situation-ontology.json')
  : path.join(DATA_DIR, 'situation-ontology.json');

// Data directory and file initialization
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ENTRIES_FILE)) {
  fs.writeFileSync(ENTRIES_FILE, '[]', 'utf-8');
}

// ---------------------------------------------------------------------------
// Logger (로깅 시스템)
// ---------------------------------------------------------------------------

const LOGS_DIR = IS_PRODUCTION ? '/tmp/sentimind-logs' : path.join(__dirname, 'logs');

class Logger {
  constructor() {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    this.currentLogFile = null;
    this._cleanOldLogs(); // 시작 시 오래된 로그 삭제
  }

  _getLogFile() {
    return path.join(LOGS_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  _formatTime() {
    return new Date().toISOString();
  }

  _shouldLog(level) {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  _cleanOldLogs() {
    try {
      const files = fs.readdirSync(LOGS_DIR);
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      files.forEach(file => {
        if (file.startsWith('app-') && file.endsWith('.log')) {
          const filePath = path.join(LOGS_DIR, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > sevenDaysMs) {
            fs.unlinkSync(filePath);
            console.log(`[LOG] 오래된 로그 삭제: ${file}`);
          }
        }
      });
    } catch (err) {
      console.error(`로그 정리 오류: ${err.message}`);
    }
  }

  _log(level, message, data = null) {
    if (!this._shouldLog(level)) return;

    const timestamp = this._formatTime();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data }),
      environment: IS_PRODUCTION ? 'production' : 'development',
    };

    // 콘솔 출력 (포맷: [LEVEL] message)
    const consoleMsg = `[${level}] ${message}`;
    const consoleColor = {
      DEBUG: '\x1b[36m', // cyan
      INFO: '\x1b[32m',  // green
      WARN: '\x1b[33m',  // yellow
      ERROR: '\x1b[31m', // red
    };
    const resetColor = '\x1b[0m';
    console.log(`${consoleColor[level]}${consoleMsg}${resetColor}${data ? ` | ${JSON.stringify(data)}` : ''}`);

    // 파일 저장 (JSON 포맷)
    try {
      const logFile = this._getLogFile();
      const logLine = JSON.stringify(logEntry);
      fs.appendFileSync(logFile, logLine + '\n', 'utf-8');
    } catch (err) {
      console.error(`로그 파일 저장 실패: ${err.message}`);
    }
  }

  debug(message, data) {
    this._log('DEBUG', message, data);
  }

  info(message, data) {
    this._log('INFO', message, data);
  }

  warn(message, data) {
    this._log('WARN', message, data);
  }

  error(message, data) {
    this._log('ERROR', message, data);
  }
}

const logger = new Logger();
logger.info('🚀 Sentimind 서버 시작', { environment: IS_PRODUCTION ? 'production' : 'development' });

// ---------------------------------------------------------------------------
// Ontology Engine
// ---------------------------------------------------------------------------

class OntologyEngine {
  constructor(emotionOntology, situationOntology) {
    this.emotionOntology = emotionOntology;
    this.situationOntology = situationOntology;
  }

  /**
   * Enrich emotion analysis with ontology metadata
   */
  enrichEmotion(primaryEmotion, text, geminiResult) {
    const ontologyMetadata = {
      emotion_hierarchy: this.findEmotionHierarchy(primaryEmotion),
      situation_context: this.inferSituationContext(text),
      confidence: this.calculateConfidence(text, primaryEmotion),
      related_emotions: this.findRelatedEmotions(primaryEmotion),
    };

    return {
      ...geminiResult,
      ontology: ontologyMetadata,
    };
  }

  findEmotionHierarchy(emotion) {
    // Navigate 3-level hierarchy: positive/negative/neutral -> category -> specific
    for (const level1 of Object.values(this.emotionOntology.emotions)) {
      if (level1.subcategories) {
        for (const [level2Key, level2] of Object.entries(level1.subcategories)) {
          // Check if emotion matches level 2
          if (
            level2.korean === emotion ||
            level2.korean.includes(emotion)
          ) {
            return {
              level1: level1.korean,
              level2: level2.korean,
              emoji: level2.emoji,
            };
          }
          // Check if emotion matches level 3
          if (level2.specific_emotions) {
            for (const level3 of Object.values(level2.specific_emotions)) {
              if (
                level3.korean === emotion ||
                emotion.includes(level3.korean)
              ) {
                return {
                  level1: level1.korean,
                  level2: level2.korean,
                  level3: level3.korean,
                  emoji: level3.emoji,
                };
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

    for (const [domain, info] of Object.entries(
      this.situationOntology.domains
    )) {
      for (const [context, ctxInfo] of Object.entries(info.contexts)) {
        if (
          ctxInfo.keywords &&
          ctxInfo.keywords.some((kw) => lowerText.includes(kw))
        ) {
          contexts.push({
            domain: info.korean,
            context: ctxInfo.korean,
          });
        }
      }
    }

    return contexts.length > 0 ? contexts : [{ domain: '기타', context: '일상' }];
  }

  calculateConfidence(text, emotion) {
    // Simple confidence: text length + keyword matches
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
let writeLock = Promise.resolve();

// Load ontologies at startup
let ontologyEngine = null;

async function loadOntologies() {
  try {
    const emotionData = await fsPromises.readFile(EMOTION_ONTOLOGY_FILE, 'utf-8');
    const situationData = await fsPromises.readFile(SITUATION_ONTOLOGY_FILE, 'utf-8');

    const emotionOntology = JSON.parse(emotionData);
    const situationOntology = JSON.parse(situationData);

    ontologyEngine = new OntologyEngine(emotionOntology, situationOntology);
    console.log('✓ Ontologies loaded successfully');
  } catch (err) {
    console.warn('⚠ Failed to load ontologies:', err.message);
    // Continue without ontology enrichment
  }
}

async function readEntries() {
  try {
    // Supabase 사용 (활성화된 경우)
    if (USE_SUPABASE) {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    }

    // Fallback: JSON 파일 (Supabase 미활성화)
    const raw = await fsPromises.readFile(ENTRIES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('readEntries 실패', { error: err.message, useSupabase: USE_SUPABASE });
    return [];
  }
}

async function writeEntries(entries) {
  // Supabase 사용 (활성화된 경우)
  if (USE_SUPABASE) {
    try {
      for (const entry of entries) {
        // id 기준 upsert (insert or update)
        await supabase
          .from('entries')
          .upsert({ ...entry }, { onConflict: 'id' });
      }
      logger.info('Supabase에 저장 완료', { count: entries.length });
      return;
    } catch (err) {
      logger.error('Supabase 저장 실패', { error: err.message });
      throw err;
    }
  }

  // Fallback: JSON 파일 저장
  writeLock = writeLock.then(() =>
    fsPromises.writeFile(ENTRIES_FILE, JSON.stringify(entries, null, 2), 'utf-8')
  );
  return writeLock;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Parse Gemini response text into structured JSON.
 * Handles code-block-wrapped responses and plain JSON.
 */
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

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
}));

app.use(express.json({ limit: '10kb' }));

// Serve static files (public/ directory only)
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /api/analyze - Analyze diary text via Gemini API
app.post('/api/analyze', async (req, res) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  logger.info('POST /api/analyze 요청 수신', {
    requestId,
    bodySize: JSON.stringify(req.body).length,
    ip: req.ip
  });

  if (!req.body) {
    logger.warn('요청 본문 없음', { requestId });
    return res.status(400).json({ error: 'JSON 형식의 요청 본문이 필요합니다.' });
  }
  const { text } = req.body;

  // Input validation
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    logger.warn('유효하지 않은 입력', { requestId, textLength: text?.length });
    return res.status(400).json({ error: '일기 내용을 입력해주세요.' });
  }
  if (text.length > 500) {
    logger.warn('텍스트 길이 초과', { requestId, textLength: text.length });
    return res.status(400).json({ error: '일기는 500자 이내로 작성해주세요.' });
  }

  if (!GEMINI_API_KEY) {
    logger.error('Gemini API 키가 설정되지 않음', { requestId });
    return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.' });
  }

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  // Retry up to 2 times for JSON parse failures
  const MAX_RETRIES = 2;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.debug(`Gemini API 요청 시도 (${attempt + 1}/${MAX_RETRIES + 1})`, { requestId });

      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const status = response.status;
        let geminiError = null;
        try {
          geminiError = await response.json();
        } catch (e) {
          geminiError = { message: response.statusText };
        }

        logger.error('Gemini API 오류', {
          requestId,
          attempt: attempt + 1,
          status,
          error: geminiError,
          textLength: text.length
        });

        if (status === 429) {
          logger.warn('API 요청 한도 초과', { requestId });
          return res.status(429).json({
            error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          });
        }
        if (status === 400 || status === 403) {
          logger.error('API 인증 실패', { requestId, message: geminiError?.error?.message });
          return res.status(502).json({
            error: 'API 인증에 실패했습니다. 서버 관리자에게 문의하세요.',
          });
        }
        logger.error(`AI 서비스 오류 (${status})`, { requestId });
        return res.status(502).json({
          error: `AI 서비스 오류가 발생했습니다. (${status})`,
        });
      }

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        lastError = new Error('Empty response from Gemini');
        logger.warn('Gemini 응답 비어있음, 재시도', { requestId, attempt: attempt + 1 });
        continue; // retry
      }

      logger.debug('Gemini 응답 수신', { requestId, contentLength: content.length });
      const result = parseGeminiResponse(content);

      // Enrich with ontology metadata if available
      const enrichedResult = ontologyEngine
        ? ontologyEngine.enrichEmotion(result.emotion, text.trim(), result)
        : result;

      const duration = Date.now() - startTime;
      logger.info('감정 분석 완료', {
        requestId,
        emotion: enrichedResult.emotion,
        confidence: enrichedResult.ontology?.confidence,
        duration: `${duration}ms`
      });

      return res.json(enrichedResult);
    } catch (err) {
      lastError = err;

      logger.error('API 처리 중 오류', {
        requestId,
        attempt: attempt + 1,
        errorName: err.name,
        errorMessage: err.message,
        stack: err.stack
      });

      // If it's a JSON parse error, retry
      if (err instanceof SyntaxError) {
        logger.warn('JSON 파싱 오류, 재시도', { requestId, attempt: attempt + 1 });
        continue;
      }
      // For network/timeout errors, don't retry
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        logger.error('요청 타임아웃', { requestId });
        return res.status(504).json({
          error: '요청 시간이 초과되었습니다. 다시 시도해주세요.',
        });
      }
      break;
    }
  }

  const duration = Date.now() - startTime;
  logger.error('Gemini API 최종 실패', {
    requestId,
    attempts: MAX_RETRIES + 1,
    lastError: lastError?.message,
    duration: `${duration}ms`
  });

  return res.status(500).json({
    error: '응답을 해석하지 못했습니다. 다시 시도해주세요.',
  });
});

// GET /api/entries - List all diary entries
app.get('/api/entries', async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime = Date.now();

  logger.info('GET /api/entries 요청 수신', { requestId });

  try {
    const entries = await readEntries();
    const duration = Date.now() - startTime;

    logger.info('일기 목록 조회 성공', {
      requestId,
      count: entries.length,
      duration: `${duration}ms`
    });

    res.json(entries);
  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error('일기 목록 조회 실패', {
      requestId,
      error: err.message,
      stack: err.stack,
      duration: `${duration}ms`
    });

    res.status(500).json({ error: '일기 목록 조회 실패' });
  }
});

// POST /api/entries - Save a new diary entry
app.post('/api/entries', async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime = Date.now();

  logger.info('POST /api/entries 요청 수신', { requestId });

  try {
    if (!req.body) {
      logger.warn('요청 본문 없음', { requestId });
      return res.status(400).json({ error: 'JSON 형식의 요청 본문이 필요합니다.' });
    }
    const { text, emotion, emoji, message, advice } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      logger.warn('유효하지 않은 입력 (POST 저장)', { requestId, textLength: text?.length });
      return res.status(400).json({ error: '일기 내용을 입력해주세요.' });
    }
    if (text.length > 500) {
      logger.warn('텍스트 길이 초과', { requestId, textLength: text.length });
      return res.status(400).json({ error: '일기는 500자 이내로 작성해주세요.' });
    }

    const entry = {
      id: generateId(),
      date: new Date().toISOString(),
      text: text.trim(),
      emotion: emotion || '알 수 없음',
      emoji: emoji || '💭',
      message: message || '',
      advice: advice || '',
    };

    const entries = await readEntries();
    entries.unshift(entry);
    await writeEntries(entries);

    const duration = Date.now() - startTime;
    logger.info('일기 저장 완료', {
      requestId,
      entryId: entry.id,
      emotion: entry.emotion,
      duration: `${duration}ms`
    });

    res.status(201).json(entry);
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('일기 저장 실패', {
      requestId,
      error: err.message,
      stack: err.stack,
      duration: `${duration}ms`
    });
    res.status(500).json({ error: '일기 저장에 실패했습니다.' });
  }
});

// DELETE /api/entries/:id - Delete a diary entry
app.delete('/api/entries/:id', async (req, res) => {
  const { id } = req.params;
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime = Date.now();

  logger.info('DELETE /api/entries/:id 요청 수신', { requestId, id });

  try {
    const entries = await readEntries();
    const index = entries.findIndex((e) => e.id === id);

    if (index === -1) {
      const duration = Date.now() - startTime;
      logger.warn('삭제할 일기를 찾을 수 없음', {
        requestId,
        id,
        duration: `${duration}ms`
      });
      return res.status(404).json({ error: '해당 일기를 찾을 수 없습니다.' });
    }

    entries.splice(index, 1);
    await writeEntries(entries);

    const duration = Date.now() - startTime;
    logger.info('일기 삭제 성공', {
      requestId,
      id,
      remainCount: entries.length,
      duration: `${duration}ms`
    });

    res.json({ success: true });
  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error('일기 삭제 실패', {
      requestId,
      id,
      error: err.message,
      stack: err.stack,
      duration: `${duration}ms`
    });

    res.status(500).json({ error: '일기 삭제 실패' });
  }
});

// GET /api/stats - Analytics and insights (Phase 3)
app.get('/api/stats', async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime = Date.now();

  logger.info('GET /api/stats 요청 수신', { requestId });

  try {
    const entries = await readEntries();

    // Emotion frequency
    const emotionFreq = {};
    const situationFreq = {};
    const hourlyEmotions = {};

    entries.forEach(entry => {
      // Emotion frequency
      const emotion = entry.emotion || '알 수 없음';
      emotionFreq[emotion] = (emotionFreq[emotion] || 0) + 1;

      // Situation context frequency
      if (entry.ontology?.situation_context) {
        entry.ontology.situation_context.forEach(ctx => {
          const key = `${ctx.domain}/${ctx.context}`;
          situationFreq[key] = (situationFreq[key] || 0) + 1;
        });
      }

      // Hourly distribution
      const date = new Date(entry.date);
      const hour = date.getHours();
      const hourKey = `${hour}:00`;
      if (!hourlyEmotions[hourKey]) hourlyEmotions[hourKey] = {};
      hourlyEmotions[hourKey][emotion] = (hourlyEmotions[hourKey][emotion] || 0) + 1;
    });

    // Calculate total and confidence stats
    const avgConfidence = entries.reduce((sum, e) => {
      return sum + (e.ontology?.confidence || 0);
    }, 0) / Math.max(entries.length, 1);

    // Top emotions (top 5)
    const topEmotions = Object.entries(emotionFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emotion, count]) => ({ emotion, count }));

    // Top situations (top 5)
    const topSituations = Object.entries(situationFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([situation, count]) => ({ situation, count }));

    const stats = {
      total_entries: entries.length,
      avg_confidence: Math.round(avgConfidence),
      emotion_distribution: emotionFreq,
      top_emotions: topEmotions,
      top_situations: topSituations,
      hourly_distribution: hourlyEmotions,
      latest_entries: entries.slice(0, 5),
    };

    const duration = Date.now() - startTime;
    logger.info('통계 조회 성공', {
      requestId,
      totalEntries: entries.length,
      topEmotionCount: topEmotions.length,
      duration: `${duration}ms`
    });

    res.json(stats);
  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error('통계 조회 실패', {
      requestId,
      error: err.message,
      stack: err.stack,
      duration: `${duration}ms`
    });

    res.status(500).json({ error: '통계 조회에 실패했습니다.' });
  }
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  try {
    await loadOntologies();
    app.listen(PORT, () => {
      logger.info('✅ 서버 시작 완료', {
        port: PORT,
        url: `http://localhost:${PORT}`,
        environment: IS_PRODUCTION ? 'production' : 'development',
        dataDir: DATA_DIR
      });
    });
  } catch (err) {
    logger.error('서버 시작 실패', { error: err.message });
    process.exit(1);
  }
}

start().catch((err) => {
  logger.error('예상치 못한 에러', { error: err.message });
  process.exit(1);
});
