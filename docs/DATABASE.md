# Supabase 데이터베이스 가이드

## 프로젝트 정보

- **프로젝트명**: Sentimind
- **지역**: Asia Pacific (Seoul) - ap-northeast-2
- **URL**: https://srupvepoinyobbjcbamz.supabase.co
- **상태**: ✅ 활성화

## 테이블 스키마

### 1. entries (일기 저장소)

```sql
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  text TEXT NOT NULL,
  emotion TEXT,
  emoji TEXT,
  message TEXT,
  advice TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID DEFAULT NULL,

  -- 제약 조건
  CONSTRAINT text_not_empty CHECK (length(text) > 0 AND length(text) <= 500)
);
```

**인덱스**:
- `idx_entries_date`: 날짜 역순 (최신순 조회)
- `idx_entries_emotion`: 감정별 필터
- `idx_entries_user_id`: 사용자별 필터 (향후 인증)

**용도**:
- 사용자 일기 저장
- Gemini 감정 분석 결과 저장
- AI 공감 메시지 및 조언 저장

---

### 2. emotion_ontology (감정 분류)

```sql
CREATE TABLE emotion_ontology (
  id TEXT PRIMARY KEY,
  korean TEXT NOT NULL,
  english TEXT,
  level INTEGER NOT NULL,           -- 1: positive/negative, 2: category, 3: specific
  parent_id TEXT REFERENCES emotion_ontology(id),
  emoji TEXT,
  confidence_threshold FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**구조 예시**:
```
긍정 (level=1, emoji=✨)
├─ 기쁨 (level=2, parent=긍정, emoji=😊)
│  ├─ 기뻐 (level=3, parent=기쁨, emoji=😄)
│  ├─ 신나 (level=3, parent=기쁨, emoji=🎉)
│  └─ 들뜬 (level=3, parent=기쁨, emoji=🚀)
├─ 만족감 (level=2, parent=긍정, emoji=😌)
│  ├─ 만족해 (level=3)
│  └─ 뿌듯해 (level=3)
└─ ...
```

**용도**:
- 감정 메타데이터 저장
- 계층적 분류 (3단계)
- 신뢰도 임계값 설정

---

### 3. situation_ontology (상황 도메인)

```sql
CREATE TABLE situation_ontology (
  id TEXT PRIMARY KEY,
  korean TEXT NOT NULL,
  english TEXT,
  emoji TEXT,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**도메인 목록**:
```
1. work (업무/학업)
   - Keywords: 프로젝트, 발표, 시험, 회의, 마감, 팀, 동료

2. relationship (인간관계)
   - Keywords: 친구, 가족, 연인, 팀, 사람, 사귀, 만남

3. health (건강)
   - Keywords: 운동, 식사, 수면, 병, 피로, 체력

4. daily (일상/경험)
   - Keywords: 날씨, 이동, 쇼핑, 여행, 외출, 집

5. growth (개인성장)
   - Keywords: 공부, 배우, 기술, 습관, 목표, 도전
```

**용도**:
- 상황 문맥 파악
- 키워드 기반 도메인 추론
- 감정 분석 강화

---

## RLS (Row Level Security) 정책

### entries 테이블

```sql
-- 누구나 읽기 가능 (향후 인증 추가 시 수정)
CREATE POLICY "Enable read access for all users" ON entries
  FOR SELECT USING (true);

-- 누구나 삽입 가능
CREATE POLICY "Enable insert for all users" ON entries
  FOR INSERT WITH CHECK (true);

-- 누구나 수정 가능
CREATE POLICY "Enable update for all users" ON entries
  FOR UPDATE USING (true);

-- 누구나 삭제 가능
CREATE POLICY "Enable delete for all users" ON entries
  FOR DELETE USING (true);
```

### ontology 테이블

```sql
-- 읽기만 허용 (관리자 전용)
CREATE POLICY "Enable read access" ON emotion_ontology
  FOR SELECT USING (true);

CREATE POLICY "Enable read access" ON situation_ontology
  FOR SELECT USING (true);
```

---

## 마이그레이션 전략

### Phase 1: 하이브리드 운영

```javascript
// server.js에서 자동 선택
const USE_SUPABASE = SUPABASE_URL && SUPABASE_ANON_KEY;

if (USE_SUPABASE) {
  // PostgreSQL 사용
  await supabase.from('entries').select('*');
} else {
  // JSON 파일 사용 (Fallback)
  await readEntriesFromJSON();
}
```

**장점**:
- 무중단 전환 가능
- 원본 데이터 안전
- 언제든지 롤백 가능

### Phase 2: 전체 마이그레이션

```bash
# 1. 기존 entries.json 데이터 Supabase로 INSERT
# 2. 모든 env에서 USE_SUPABASE = true로 설정
# 3. JSON 파일 Deprecated 처리
# 4. 문서 업데이트
```

---

## 성능 최적화

### 쿼리 최적화

```sql
-- 최신 일기 10개 조회 (인덱스 활용)
SELECT * FROM entries
  ORDER BY date DESC
  LIMIT 10;

-- 감정별 통계 (인덱스 활용)
SELECT emotion, COUNT(*) as count
  FROM entries
  GROUP BY emotion;

-- 사용자별 일기 (향후 인증 추가)
SELECT * FROM entries
  WHERE user_id = $1
  ORDER BY date DESC;
```

### 인덱스 전략

- `date DESC`: 시간순 조회
- `emotion`: 감정 필터
- `user_id`: 사용자 구분 (향후)

---

## 백업 및 복구

### Supabase 백업

```bash
# 자동 백업: Supabase 대시보드 > Backups
# 빈도: 일일 (무료), 시간별 (Pro)

# 수동 백업
pg_dump -h db.xxx.supabase.co -U postgres dbname > backup.sql
```

### 복구 절차

```bash
# 1. Supabase 대시보드에서 백업 선택
# 2. "Restore" 클릭
# 3. 확인 및 완료
```

---

## 환경 변수 설정

```bash
# .env (로컬)
SUPABASE_URL="https://srupvepoinyobbjcbamz.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIs..." # 공개 키

# GitHub Secrets (Vercel 배포)
SUPABASE_URL="..."
SUPABASE_ANON_KEY="..."
```

---

## 모니터링

### Supabase 대시보드

- **Realtime**: 실시간 수정 감시
- **SQL Editor**: 쿼리 실행 및 테스트
- **Logs**: API 및 데이터베이스 로그
- **Network**: 대역폭 모니터링

### Node.js 로깅

```javascript
logger.info('Supabase 쿼리 성공', { count: 10, time: 45 });
logger.error('Supabase 쿼리 실패', { error: 'Network timeout' });
```

---

**마지막 업데이트**: 2026-03-05
