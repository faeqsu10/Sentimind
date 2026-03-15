-- 027: error_logs 테이블 생성
-- 프론트엔드/백엔드/외부API 에러를 통합 저장하는 에러 로그 테이블

CREATE TABLE IF NOT EXISTS error_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- 에러 식별
  fingerprint TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT 'error'
              CHECK (level IN ('warn', 'error', 'fatal')),
  source      TEXT NOT NULL
              CHECK (source IN ('frontend', 'backend', 'api_external')),

  -- 에러 내용
  message     TEXT NOT NULL,
  stack       TEXT,
  code        TEXT,

  -- 요청 컨텍스트
  request_id  TEXT,
  method      TEXT,
  path        TEXT,
  status_code SMALLINT,
  duration_ms INTEGER,

  -- 사용자 컨텍스트
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  TEXT,

  -- 환경 컨텍스트
  environment TEXT DEFAULT 'production',
  user_agent  TEXT,

  -- 추가 메타데이터
  metadata    JSONB DEFAULT '{}'::jsonb,

  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_error_logs_fingerprint ON error_logs(fingerprint);
CREATE INDEX idx_error_logs_created_at  ON error_logs(created_at);
CREATE INDEX idx_error_logs_source      ON error_logs(source);
CREATE INDEX idx_error_logs_level       ON error_logs(level);
CREATE INDEX idx_error_logs_user        ON error_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_error_logs_request_id  ON error_logs(request_id) WHERE request_id IS NOT NULL;

-- RLS: service_role만 읽기/쓰기
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY error_logs_service_role ON error_logs
  FOR ALL USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );
