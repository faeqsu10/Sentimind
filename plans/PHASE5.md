# Phase 5: Supabase 백엔드 마이그레이션

## 개요

**기간**: 2026-03-05 ~ 2026-03-26 (2-3주, 12.5일)
**목표**: JSON 파일 기반 데이터 저장소를 PostgreSQL(Supabase)로 마이그레이션
**팀**: 4명 (Backend 2 + DB Architect 0.5 + QA 1 + PM 0.5)
**상태**: 🔴 준비 중 (Supabase 프로젝트 생성 대기)

---

## 목표

### 주요 목표 (MoSCoW)

**Must Have (필수)**
- [ ] Supabase PostgreSQL 연동
- [ ] entries, emotion_ontology, situation_ontology 테이블 생성
- [ ] RLS (Row Level Security) 정책 설정
- [ ] 기존 entries.json 데이터 마이그레이션
- [ ] 로컬/Vercel 하이브리드 운영

**Should Have (권장)**
- [ ] 자동화 마이그레이션 스크립트
- [ ] 데이터 검증 및 백업
- [ ] API 성능 최적화 (인덱스)
- [ ] 상세 모니터링

**Could Have (선택)**
- [ ] 사용자 인증 (Auth 테이블)
- [ ] 실시간 구독 (Realtime)
- [ ] 벡터 데이터베이스 (Embedding)

**Won't Have (제외)**
- [ ] 사용자 계정 시스템
- [ ] 데이터 암호화 (기본 HTTPS 사용)

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| **프론트엔드** | 단일 HTML (CSS/JS 인라인) |
| **백엔드** | Node.js + Express |
| **데이터베이스** | Supabase PostgreSQL |
| **인증** | RLS 정책 (향후 Auth 추가) |
| **모니터링** | Supabase 대시보드 + 커스텀 로깅 |
| **배포** | Vercel (Serverless) |

---

## 개발 계획 (우선순위순)

### 1. Supabase 프로젝트 설정 (Day 1-2)

**담당**: DB Architect
**예상 시간**: 4시간

**작업 항목**
- [ ] Supabase 프로젝트 생성 (Seoul 리전)
- [ ] 프로젝트 URL, API 키 확인
- [ ] .env 환경 변수 설정
- [ ] 로컬 연결 테스트

**산출물**
- Supabase 프로젝트 ID: `srupvepoinyobbjcbamz`
- 연결 문자열 (.env에 저장)
- 연결 테스트 로그

**기술 상세**
```bash
# Supabase CLI (선택)
npm install -g @supabase/cli
supabase projects list
supabase db start
```

---

### 2. 데이터베이스 스키마 생성 (Day 1-3)

**담당**: DB Architect
**예상 시간**: 6시간

**작업 항목**
- [ ] entries 테이블 생성 (TIMESTAMPTZ, TEXT[] 등)
- [ ] emotion_ontology 테이블 생성 (3단계 계층)
- [ ] situation_ontology 테이블 생성 (키워드 배열)
- [ ] 인덱스 생성 (date, emotion, user_id)
- [ ] 제약 조건 추가 (text 길이, NOT NULL)

**산출물**
```sql
-- docs/DATABASE.md에 전체 스키마 정의됨

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  text TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 500),
  emotion TEXT,
  emoji TEXT,
  message TEXT,
  advice TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID DEFAULT NULL
);

CREATE INDEX idx_entries_date ON entries (date DESC);
CREATE INDEX idx_entries_emotion ON entries (emotion);
CREATE INDEX idx_entries_user_id ON entries (user_id);
```

**기술 상세**
- **TIMESTAMPTZ**: UTC 타임스탬프 (로컬 시간 자동 변환)
- **TEXT[]**: PostgreSQL 배열 타입 (키워드)
- **DEFAULT NOW()**: 서버 시간 자동 설정

---

### 3. RLS 정책 설정 (Day 2-3)

**담당**: DB Architect
**예상 시간**: 4시간

**작업 항목**
- [ ] entries 테이블 RLS 활성화
- [ ] SELECT 정책 (누구나 읽기)
- [ ] INSERT 정책 (누구나 삽입)
- [ ] UPDATE 정책 (누구나 수정)
- [ ] DELETE 정책 (누구나 삭제)
- [ ] ontology 테이블 RLS (읽기 전용)

**산출물**
```sql
-- entries 테이블
CREATE POLICY "Enable read for all" ON entries FOR SELECT USING (true);
CREATE POLICY "Enable insert for all" ON entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all" ON entries FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all" ON entries FOR DELETE USING (true);

-- ontology 테이블 (읽기 전용)
CREATE POLICY "Enable read" ON emotion_ontology FOR SELECT USING (true);
CREATE POLICY "Enable read" ON situation_ontology FOR SELECT USING (true);
```

**향후 인증 추가 시**
```sql
-- user_id 기반 정책 (나중에)
CREATE POLICY "User can read own entries" ON entries
  FOR SELECT USING (auth.uid() = user_id);
```

---

### 4. server.js Supabase 연동 (Day 2-4)

**담당**: Backend Developer 1
**예상 시간**: 6시간

**작업 항목**
- [ ] @supabase/supabase-js 라이브러리 연동
- [ ] Supabase 클라이언트 초기화
- [ ] readEntries() 함수 수정 (SQL 쿼리)
- [ ] writeEntries() 함수 수정 (INSERT/UPDATE)
- [ ] deleteEntries() 함수 수정 (DELETE)
- [ ] 오류 처리 및 로깅 추가

**산출물**
```javascript
// server.js 예시
const { createClient } = require('@supabase/supabase-js');

const USE_SUPABASE = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function readEntries() {
  if (USE_SUPABASE) {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  } else {
    return require('./data/entries.json');
  }
}
```

**기술 상세**
- **Hybrid 패턴**: Supabase 우선, JSON 폴백
- **에러 처리**: 연결 실패 시 자동으로 JSON 사용
- **성능**: Supabase에서 정렬, 필터링 (DB 레벨)

---

### 5. 데이터 마이그레이션 (Day 3-4)

**담당**: Backend Developer 1 + DB Architect
**예상 시간**: 4시간

**작업 항목**
- [ ] entries.json 데이터 읽기
- [ ] 각 entry를 Supabase entries 테이블에 INSERT
- [ ] 온톨로지 데이터 마이그레이션
- [ ] 데이터 무결성 검증 (행 수, 내용)
- [ ] 백업 생성 (원본 JSON 보존)

**마이그레이션 스크립트**
```bash
# scripts/migrate-to-supabase.js
node scripts/migrate-to-supabase.js

# 출력:
# ✅ Migrating entries.json (42 entries)
# ✅ Checking Supabase connection
# ✅ Inserting 42 entries
# ✅ Validating data
# ✅ Migration complete
```

**데이터 검증**
```sql
-- 마이그레이션 후 확인
SELECT COUNT(*) FROM entries;           -- 42개 예상
SELECT COUNT(DISTINCT emotion) FROM entries;  -- 감정 개수 확인
SELECT * FROM entries LIMIT 5;          -- 샘플 데이터 확인
```

---

### 6. 로컬 개발 환경 최적화 (Day 4-5)

**담당**: Backend Developer 2
**예상 시간**: 4시간

**작업 항목**
- [ ] 로컬에서 JSON 폴백 동작 확인
- [ ] Vercel에서 Supabase 연동 확인
- [ ] 데이터 동기화 테스트 (로컬 → 클라우드)
- [ ] 환경 변수 문서화 (.env.example 수정)
- [ ] 성능 테스트 (<100ms API 응답)

**테스트 체크리스트**
- [ ] `npm run dev` 실행 → JSON 사용
- [ ] SUPABASE_URL 설정 → Supabase 사용
- [ ] API 응답 시간 측정
- [ ] 로그 확인 (info, warn, error)

---

### 7. 모니터링 및 백업 설정 (Day 5-6)

**담당**: DB Architect + QA
**예상 시간**: 4시간

**작업 항목**
- [ ] Supabase 자동 백업 활성화
- [ ] 수동 백업 스크립트 작성 (`pg_dump`)
- [ ] 커스텀 로깅 설정 (Supabase 쿼리)
- [ ] Vercel 모니터링 설정
- [ ] 성능 메트릭 추적

**모니터링 대시보드**
- Supabase 대시보드: 연결 수, 쿼리 수, 저장소 사용량
- Vercel 대시보드: 요청 수, 응답 시간, 에러율
- 커스텀 로그: `logs/app-YYYY-MM-DD.log`

---

### 8. 문서화 및 가이드 작성 (Day 6-7)

**담당**: PM + Backend Developer
**예상 시간**: 4시간

**산출물**
- [ ] docs/DATABASE.md (스키마, RLS, 마이그레이션)
- [ ] docs/DEPLOYMENT.md (배포 가이드)
- [ ] guides/SETUP.md (로컬 개발 환경)
- [ ] guides/TEAM_WORKFLOW.md (팀 협업)
- [ ] guides/TROUBLESHOOTING.md (문제 해결)

**문서 기준**
- 코드 예시 포함
- 스크린샷 (선택)
- 링크 및 참고 자료

---

## 타임라인

| 주차 | 일 | 작업 | 담당자 | 상태 |
|------|----|----|---------|------|
| 주 1 | 1-2 | Supabase 프로젝트 설정 | DB Arch | 예정 |
| 주 1 | 1-3 | 데이터베이스 스키마 생성 | DB Arch | 예정 |
| 주 1 | 2-3 | RLS 정책 설정 | DB Arch | 예정 |
| 주 1-2 | 2-4 | server.js 연동 | BE Dev 1 | 예정 |
| 주 2 | 3-4 | 데이터 마이그레이션 | BE Dev 1 + DB | 예정 |
| 주 2 | 4-5 | 로컬/클라우드 테스트 | BE Dev 2 | 예정 |
| 주 2 | 5-6 | 모니터링 설정 | DB + QA | 예정 |
| 주 2-3 | 6-7 | 문서화 | PM + BE | 예정 |

---

## 리스크 및 완화 전략

| 리스크 | 영향도 | 확률 | 완화 전략 |
|--------|--------|------|----------|
| Supabase 비용 초과 | 중간 | 낮음 | Free 플랜 확인, Pro 플랜 비용 협의 |
| 데이터 손실 | 높음 | 낮음 | 마이그레이션 전 백업 3개 (로컬, Git, Supabase) |
| 마이그레이션 지연 | 중간 | 중간 | 사전 준비, 병렬 작업 |
| 성능 저하 | 중간 | 낮음 | 인덱스 설계, 쿼리 최적화 |
| 팀원 부재 | 높음 | 낮음 | 문서화, 페어 프로그래밍 |

---

## 성공 기준

✅ 모든 단계 완료:

- [ ] Supabase 프로젝트 생성 및 연동 완료
- [ ] 데이터베이스 스키마 100% 구현
- [ ] RLS 정책 설정 완료
- [ ] 데이터 마이그레이션 성공 (검증 포함)
- [ ] 로컬/클라우드 모두 정상 동작
- [ ] API 응답 시간 <100ms 유지
- [ ] 전체 테스트 통과
- [ ] 모든 문서 작성 완료
- [ ] Main 브랜치 배포 완료

---

## 다음 Phase (6-10)

이후 개선 사항:

### Phase 6: 사용자 인증 (2주)
- [ ] Supabase Auth 연동
- [ ] JWT 토큰 관리
- [ ] 사용자 가입/로그인 UI

### Phase 7: 실시간 기능 (1주)
- [ ] Supabase Realtime
- [ ] 일기 실시간 동기화
- [ ] WebSocket 연결

### Phase 8: AI 고급 기능 (2주)
- [ ] 감정 트렌드 분석
- [ ] 벡터 데이터베이스 (pgvector)
- [ ] 유사 일기 추천

### Phase 9: 모바일 앱 (3주)
- [ ] React Native 앱 개발
- [ ] iOS/Android 배포

### Phase 10: 사회 기능 (2주)
- [ ] 친구 추가
- [ ] 공유 다이어리
- [ ] 댓글/반응

---

## 참고 자료

- **Supabase 문서**: https://supabase.com/docs
- **PostgreSQL 튜토리얼**: https://www.postgresql.org/docs/
- **RLS 정책**: https://supabase.com/docs/guides/auth/row-level-security
- **마이그레이션 도구**: https://dbnow.io

---

**마지막 업데이트**: 2026-03-05
