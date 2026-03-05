// ---------------------------------------------------------------------------
// LLM & Application Configuration
// ---------------------------------------------------------------------------
// 모든 설정값은 환경변수로 오버라이드 가능합니다.
// .env.example 참조.
// ---------------------------------------------------------------------------

module.exports = {
  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.5'),
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '512', 10),
    thinkingBudget: parseInt(process.env.GEMINI_THINKING_BUDGET || '0', 10),
  },
  retry: {
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10),
    baseDelay: parseInt(process.env.GEMINI_BASE_DELAY || '1000', 10), // ms
  },
  timeout: parseInt(process.env.GEMINI_TIMEOUT || '30000', 10), // ms
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1분
    max: parseInt(process.env.RATE_LIMIT_MAX || '8', 10), // 8 req/min (Free Tier 10 RPM 이하)
  },
  logs: {
    retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '7', 10),
  },
};
