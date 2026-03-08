// ---------------------------------------------------------------------------
// LLM & Application Configuration (Gemini API 설정)
// ---------------------------------------------------------------------------
// 이 파일은 Google Gemini API 사용 시 필요한 모든 설정값을 관리합니다.
// 모든 값은 .env 파일의 환경변수로 오버라이드 가능합니다.
//
// 예: .env에서 GEMINI_MODEL=gemini-2.5-flash-lite 설정하면
//     이 파일의 기본값('gemini-2.5-flash')을 무시하고 'gemini-2.5-flash-lite' 사용
// ---------------------------------------------------------------------------

module.exports = {
  // ═══════════════════════════════════════════════════════════════════
  // Gemini 모델 설정
  // ═══════════════════════════════════════════════════════════════════
  gemini: {
    // [모델 선택] 사용할 Gemini 모델 버전
    // - gemini-2.5-flash: 현재 권장 (가장 빠르고 비용 효율적)
    // - gemini-2.5-pro: 최고 품질 (더 정확하지만 느리고 비쌈)
    // - gemini-2.5-flash-lite: 초저가 모델 (프리 티어 한도 많음)
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

    // [창의성 수준] 0~1 범위 (낮을수록 일관적, 높을수록 창의적)
    // - 0.5: 추천값 (감정 분석에 최적 - 일관성과 창의성 균형)
    // - 0.7: 더 창의적 (소설 작성 같은 창의적 작업용)
    // - 0.2: 더 보수적 (숫자/팩트 중심 작업용)
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.5'),

    // [응답 길이 제한] AI가 최대로 생성할 수 있는 단어 수 (토큰)
    // - 512: 추천값 (감정 분석 JSON 응답에 충분)
    // - 1024: 더 긴 응답 필요 시
    // - 256: 아주 짧은 응답만 필요 시
    // 참고: 1 토큰 ≈ 3-4글자
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '512', 10),

    // [사고 과정 예산] Gemini 2.5가 "생각"하는데 쓸 토큰 수
    // - 0: 비활성화 (빠른 응답, 우리 프로젝트용)
    // - 5000: 활성화 (복잡한 문제 해결에 깊은 사고 사용)
    // 주의: thinking 토큰이 많으면 비용이 매우 늘어남
    thinkingBudget: parseInt(process.env.GEMINI_THINKING_BUDGET || '0', 10),
  },

  // ═══════════════════════════════════════════════════════════════════
  // 재시도 설정 (429 "너무 많은 요청" 오류 처리)
  // ═══════════════════════════════════════════════════════════════════
  retry: {
    // [최대 재시도 횟수] API 호출이 실패하면 최대 몇 번까지 다시 시도할지
    // - 3: 추천값 (지수 백오프로 1초 → 2초 → 4초 대기)
    // - 5: 더 끈질기게 (느린 네트워크 환경에서 효과적)
    // - 1: 빠른 포기 (신뢰할 수 있는 네트워크 환경)
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10),

    // [기본 대기 시간] 첫 번째 재시도 전 몇 밀리초 대기할지
    // - 1000: 1초 (추천값)
    // - 500: 0.5초 (빠른 실패 필요 시)
    // - 2000: 2초 (느린 네트워크)
    // 실제 대기 = 1초 → 2초 → 4초 (지수적으로 증가)
    baseDelay: parseInt(process.env.GEMINI_BASE_DELAY || '1000', 10), // ms
  },

  // [전체 요청 타임아웃] API 응답을 최대 몇 밀리초까지 기다릴지
  // - 30000: 30초 (추천값 - Gemini 기본 타임아웃)
  // - 60000: 1분 (매우 느린 네트워크)
  // - 10000: 10초 (빠른 실패 필요)
  // 초과하면 "시간 초과" 오류 발생
  timeout: parseInt(process.env.GEMINI_TIMEOUT || '30000', 10), // ms

  // ═══════════════════════════════════════════════════════════════════
  // 클라이언트 레이트 제한 (Google API 과부하 방지)
  // ═══════════════════════════════════════════════════════════════════
  // 사용자가 API를 너무 자주 호출하지 못하도록 제한
  // (서버 자체의 과부하 방지, 구글 API 요청 제한 준수)
  rateLimit: {
    // [제한 시간] 몇 밀리초 동안의 요청을 세울지
    // - 60000: 1분 (추천값)
    // 예: 60초마다 최대 200개 요청만 허용
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1분

    // [최대 요청 수] 위 시간 동안 최대 몇 개의 요청을 허락할지
    // ★ Free Tier (10 RPM): RATE_LIMIT_MAX=8
    // ★ Tier 1 (300 RPM): RATE_LIMIT_MAX=200 ← 현재 설정값
    // 예: 1분에 최대 200개 요청만 처리, 초과 시 429 오류 반환
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10), // Tier 1 API Key: 300 RPM (65% 안전선)
  },

  // ═══════════════════════════════════════════════════════════════════
  // 로깅 설정 (에러/정보 기록)
  // ═══════════════════════════════════════════════════════════════════
  logs: {
    // [로그 보관 기간] 며칠 이상 된 로그 파일을 자동 삭제할지
    // - 7: 7일 이상 된 로그 자동 삭제 (추천값)
    // - 30: 한 달간 보관 (더 오래 분석 필요 시)
    // - 1: 어제 로그만 삭제 (스토리지 제약 시)
    retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '7', 10),
  },

  // ═══════════════════════════════════════════════════════════════════
  // 리포트 설정
  // ═══════════════════════════════════════════════════════════════════
  report: {
    // [캐시 유효 시간] 리포트 캐시가 유지되는 시간 (밀리초)
    cacheTtl: parseInt(process.env.REPORT_CACHE_TTL || '3600000', 10), // 1시간
    // [캐시 최대 크기] 메모리에 보관할 최대 캐시 항목 수
    cacheMaxSize: parseInt(process.env.REPORT_CACHE_MAX_SIZE || '100', 10),
    // [최소 일기 수] 리포트 생성에 필요한 최소 일기 수
    minEntries: parseInt(process.env.REPORT_MIN_ENTRIES || '3', 10),
    // [응답 토큰 제한] 리포트 생성 시 최대 출력 토큰 수
    maxOutputTokens: parseInt(process.env.REPORT_MAX_OUTPUT_TOKENS || '1024', 10),
  },

  // ═══════════════════════════════════════════════════════════════════
  // Follow-up 설정
  // ═══════════════════════════════════════════════════════════════════
  followup: {
    maxOutputTokens: parseInt(process.env.FOLLOWUP_MAX_TOKENS || '256', 10),
    temperature: parseFloat(process.env.FOLLOWUP_TEMPERATURE || '0.8'),
  },

  // ═══════════════════════════════════════════════════════════════════
  // Analytics 설정
  // ═══════════════════════════════════════════════════════════════════
  analytics: {
    // [배치 최대 크기] 한 번에 수집 가능한 최대 이벤트 수
    batchMaxSize: parseInt(process.env.ANALYTICS_BATCH_MAX_SIZE || '50', 10),
  },

  // ═══════════════════════════════════════════════════════════════════
  // 마이그레이션 설정
  // ═══════════════════════════════════════════════════════════════════
  migration: {
    // [최대 항목 수] 게스트→회원 마이그레이션 시 최대 항목 수
    maxEntries: parseInt(process.env.MIGRATION_MAX_ENTRIES || '10', 10),
  },

  // ═══════════════════════════════════════════════════════════════════
  // 타임존 설정
  // ═══════════════════════════════════════════════════════════════════
  timezone: {
    // [UTC 오프셋] 시간 (KST = 9, JST = 9, EST = -5)
    utcOffsetHours: parseInt(process.env.TIMEZONE_UTC_OFFSET || '9', 10),
  },

  // ═══════════════════════════════════════════════════════════════════
  // Rate Limiter 설정 (엔드포인트별)
  // ═══════════════════════════════════════════════════════════════════
  rateLimits: {
    signup: {
      windowMs: parseInt(process.env.SIGNUP_RATE_WINDOW || String(15 * 60 * 1000), 10), // 15분
      max: parseInt(process.env.SIGNUP_RATE_LIMIT || '3', 10),
    },
    login: {
      windowMs: parseInt(process.env.LOGIN_RATE_WINDOW || '60000', 10), // 1분
      max: parseInt(process.env.LOGIN_RATE_LIMIT || '5', 10),
    },
    analytics: {
      windowMs: parseInt(process.env.ANALYTICS_RATE_WINDOW || '60000', 10), // 1분
      max: parseInt(process.env.ANALYTICS_RATE_LIMIT || '30', 10),
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // Gemini API 가격 (USD per 1M tokens)
  // ═══════════════════════════════════════════════════════════════════
  // 각 가격은 .env에서 환경변수로 오버라이드 가능
  // 가격 변동 시 여기서 수정 (코드 재배포 불필요)
  pricing: {
    inputPerMillion:    parseFloat(process.env.GEMINI_PRICE_INPUT    || '0.15'),  // $0.15/1M
    outputPerMillion:   parseFloat(process.env.GEMINI_PRICE_OUTPUT   || '0.60'),  // $0.60/1M
    thinkingPerMillion: parseFloat(process.env.GEMINI_PRICE_THINKING || '3.50'),  // $3.50/1M
  },
};
