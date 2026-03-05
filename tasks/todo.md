# Phase 5: Supabase Backend Migration - 개발 계획

**프로젝트**: AI 공감 다이어리 (Sentimind)
**단계**: Phase 5
**기간**: 2-3주 (2026-03-05 ~ 03-26)
**팀**: Backend Dev(2) + Database Architect(0.5) + QA Engineer(1)
**목표**: JSON → PostgreSQL 마이그레이션, 5개 테이블 생성, RLS 정책 구현, API 통합

---

## 📋 우선순위 순 개발 작업

### Sprint 1: 기반 인프라 구축 (Week 1)

#### 1. Supabase 프로젝트 생성 및 초기 설정
- **담당**: Backend Dev #1
- **예상 시간**: 1일 (4시간)
- **우선순위**: 🔴 **필수 (Blocker)**
- **상세 작업**:
  - [ ] Supabase.com 계정 가입 (또는 기존 계정 사용)
  - [ ] 새로운 프로젝트 생성 (PostgreSQL 자동 생성)
  - [ ] 프로젝트 설정
    - [ ] Region: 아시아-서울 (ap-southeast-1)
    - [ ] Authentication: Email/Password 활성화
  - [ ] 프로젝트 URL, Anon Key, Service Key 저장
  - [ ] `.env` 파일 업데이트
    ```
    SUPABASE_URL=your_project_url
    SUPABASE_ANON_KEY=your_anon_key
    SUPABASE_SERVICE_KEY=your_service_key
    ```
  - [ ] Supabase CLI 설치 (선택사항)
  - [ ] GitHub에 `.env` 커밋 금지 확인 (`.gitignore` 확인)

**수용 기준**:
- [ ] Supabase 콘솔에서 프로젝트 정상 접속 가능
- [ ] API URL 및 키 로컬 환경에서 확인 가능
- [ ] `npm install @supabase/supabase-js` 완료

---

#### 2. 데이터베이스 스키마 설계 & 생성
- **담당**: Database Architect (0.5) + Backend Dev #1
- **예상 시간**: 2일 (8시간)
- **우선순위**: 🔴 **필수 (Blocker)**
- **의존성**: 작업 1 완료 후
- **상세 작업**:
  - [ ] PRD Schema 검토 및 조정
  - [ ] Supabase SQL 에디터에서 스키마 실행:
    ```sql
    -- 1. Users 테이블
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT auth.uid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      user_name VARCHAR(100),
      bio TEXT,
      profile_image_url VARCHAR(500),
      theme VARCHAR(10) CHECK (theme IN ('light', 'dark')) DEFAULT 'light',
      notification_enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- 2. Entries 테이블
    CREATE TABLE entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      text VARCHAR(500) NOT NULL,
      emotion VARCHAR(100) NOT NULL,
      emoji VARCHAR(10),
      message TEXT,
      advice TEXT,
      emotion_hierarchy JSONB,
      situation_context JSONB,
      confidence_score INT DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
      related_emotions VARCHAR(255)[],
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );

    -- 3. User Stats 테이블
    CREATE TABLE user_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
      total_entries INT DEFAULT 0,
      top_emotion VARCHAR(100),
      avg_confidence INT DEFAULT 0,
      last_calculated TIMESTAMP DEFAULT NOW()
    );

    -- 4. Activity Logs 테이블
    CREATE TABLE activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      action VARCHAR(100),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ```
  - [ ] 4개 테이블 생성 확인
  - [ ] 각 테이블 구조 검증

**수용 기준**:
- [ ] Supabase 콘솔에서 4개 테이블 확인 가능
- [ ] 각 테이블의 컬럼 타입 정확함
- [ ] Foreign Key 관계 정상
- [ ] 스키마 정의서 작성 (`docs/schema.md`)

---

#### 3. RLS (Row Level Security) 정책 설정
- **담당**: Backend Dev #1
- **예상 시간**: 1일 (4시간)
- **우선순위**: 🔴 **필수**
- **의존성**: 작업 2 완료 후
- **상세 작업**:
  - [ ] `users` 테이블 RLS 활성화
  - [ ] `entries` 테이블 RLS 정책 생성:
    - [ ] SELECT: 자신의 entries만 조회
    - [ ] INSERT: 자신의 entries만 생성
    - [ ] UPDATE: 자신의 entries만 수정
    - [ ] DELETE: 자신의 entries만 삭제
  - [ ] `user_stats` 테이블 RLS 정책 생성
  - [ ] `activity_logs` 테이블 RLS 정책 생성
  - [ ] RLS 정책 테스트 (다른 사용자 접근 차단 확인)

**RLS 정책 SQL**:
```sql
-- entries 테이블 RLS 활성화
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- SELECT 정책
CREATE POLICY "Users see only their entries"
  ON entries FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT 정책
CREATE POLICY "Users can insert their own entries"
  ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE 정책
CREATE POLICY "Users can update their own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE 정책
CREATE POLICY "Users can delete their own entries"
  ON entries FOR DELETE
  USING (auth.uid() = user_id);
```

**수용 기준**:
- [ ] RLS 정책 4개 모두 활성화됨
- [ ] 테스트 결과: 다른 사용자 데이터 접근 불가
- [ ] 테스트 결과: 자신의 데이터만 접근 가능

---

#### 4. 데이터베이스 인덱스 생성 (성능 최적화)
- **담당**: Database Architect (0.5)
- **예상 시간**: 0.5일 (2시간)
- **우선순위**: 🟡 **필수 (성능)**
- **의존성**: 작업 2 완료 후 (병행 가능)
- **상세 작업**:
  - [ ] 인덱스 생성 (PRD 참조):
    ```sql
    CREATE INDEX idx_entries_user_id ON entries(user_id);
    CREATE INDEX idx_entries_created_at ON entries(created_at DESC);
    CREATE INDEX idx_entries_user_emotion ON entries(user_id, emotion);
    CREATE INDEX idx_entries_deleted_at ON entries(deleted_at) WHERE deleted_at IS NULL;
    CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
    CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
    ```
  - [ ] 인덱스 생성 확인
  - [ ] 쿼리 성능 테스트

**수용 기준**:
- [ ] 6개 인덱스 모두 생성 완료
- [ ] 쿼리 실행 시간 < 100ms (entries 테이블 1000개 기준)

---

### Sprint 2: 데이터 마이그레이션 (Week 1-2)

#### 5. 마이그레이션 스크립트 작성
- **담당**: Backend Dev #2
- **예상 시간**: 2일 (8시간)
- **우선순위**: 🔴 **필수**
- **의존성**: 작업 2, 3 완료 후 (병행 가능)
- **상세 작업**:
  - [ ] `migrate.js` 파일 생성
  - [ ] 기능:
    - [ ] `data/entries.json` 읽기
    - [ ] 온톨로지 메타데이터 유지
    - [ ] 기본 사용자 생성 (legacy_user)
    - [ ] 각 entry를 PostgreSQL로 삽입
    - [ ] 데이터 무결성 검증
    - [ ] 롤백 전략 구현
  - [ ] 마이그레이션 스크립트 테스트
    - [ ] 로컬 Supabase 또는 테스트 프로젝트에서 실행
    - [ ] 데이터 검증:
      - [ ] Entry 개수 일치 확인
      - [ ] JSON 메타데이터 보존 확인
      - [ ] Timestamp 정상 저장 확인

**마이그레이션 스크립트 예제** (`migrate.js`):
```javascript
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrateData() {
  try {
    // 1. entries.json 읽기
    const data = await fs.readFile('./data/entries.json', 'utf-8');
    const entries = JSON.parse(data);

    // 2. 기본 사용자 생성
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        id: 'legacy-user-id',
        email: 'legacy@sentimind.local',
        user_name: 'Legacy User'
      }])
      .select();

    if (userError) console.error('User creation failed:', userError);

    // 3. Entries 마이그레이션
    for (const entry of entries) {
      const { error } = await supabase
        .from('entries')
        .insert([{
          user_id: user[0].id,
          text: entry.text,
          emotion: entry.emotion,
          emoji: entry.emoji,
          message: entry.message,
          advice: entry.advice,
          emotion_hierarchy: entry.emotion_hierarchy,
          situation_context: entry.situation_context,
          confidence_score: entry.confidence_score || 0,
          created_at: entry.created_at
        }]);

      if (error) console.error('Entry insert failed:', error);
    }

    console.log(`✅ ${entries.length}개 entry 마이그레이션 완료`);
  } catch (error) {
    console.error('마이그레이션 실패:', error);
  }
}

migrateData();
```

**수용 기준**:
- [ ] 마이그레이션 스크립트 실행 완료
- [ ] 모든 entries 성공적으로 삽입됨
- [ ] 데이터 무결성 검증 통과 (개수, 메타데이터, timestamp)

---

### Sprint 3: API 업데이트 (Week 2)

#### 6. Express API 엔드포인트 Supabase 통합
- **담당**: Backend Dev #1
- **예상 시간**: 3일 (12시간)
- **우선순위**: 🔴 **필수**
- **의존성**: 작업 5 완료 후
- **상세 작업**:
  - [ ] `npm install @supabase/supabase-js` 추가
  - [ ] `server.js` 수정:
    - [ ] Supabase 클라이언트 초기화
    - [ ] POST `/api/analyze` - Gemini 통합 유지
    - [ ] GET `/api/entries` - Supabase 쿼리로 변경
    - [ ] POST `/api/entries` - Supabase 삽입으로 변경
    - [ ] PUT `/api/entries/:id` - 수정 기능 추가
    - [ ] DELETE `/api/entries/:id` - Supabase 삭제로 변경
    - [ ] GET `/api/stats` - PostgreSQL 쿼리로 최적화
  - [ ] 인증 미들웨어 추가 (준비용, Phase 6에서 활성화)
  - [ ] 에러 처리 강화

**API 엔드포인트 수정 예제**:
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET /api/entries
app.get('/api/entries', async (req, res) => {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error });
  res.json(data);
});

// POST /api/entries
app.post('/api/entries', async (req, res) => {
  const { text, emotion, emoji, message, advice, emotion_hierarchy, situation_context, confidence_score } = req.body;

  const { data, error } = await supabase
    .from('entries')
    .insert([{
      user_id: 'legacy-user-id', // Phase 6: auth.uid()로 변경
      text,
      emotion,
      emoji,
      message,
      advice,
      emotion_hierarchy,
      situation_context,
      confidence_score
    }])
    .select();

  if (error) return res.status(500).json({ error });
  res.status(201).json(data[0]);
});

// DELETE /api/entries/:id
app.delete('/api/entries/:id', async (req, res) => {
  const { error } = await supabase
    .from('entries')
    .update({ deleted_at: new Date() })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error });
  res.json({ success: true });
});
```

**수용 기준**:
- [ ] 모든 CRUD 엔드포인트 Supabase 연동
- [ ] API 응답 형식 변경 없음 (호환성 유지)
- [ ] Gemini 연동 정상 작동
- [ ] 온톨로지 메타데이터 정상 저장/조회

---

### Sprint 4: 테스트 & 최적화 (Week 2-3)

#### 7. 통합 테스트 및 버그 수정
- **담당**: Backend Dev #1 + QA Engineer
- **예상 시간**: 3일 (12시간)
- **우선순위**: 🔴 **필수**
- **의존성**: 작업 6 완료 후
- **상세 작업**:
  - [ ] **API 엔드포인트 테스트**:
    - [ ] GET `/api/entries` - 데이터 조회 정상
    - [ ] POST `/api/entries` - 데이터 저장 정상
    - [ ] DELETE `/api/entries/:id` - 소프트 삭제 정상
    - [ ] GET `/api/stats` - 통계 계산 정상
  - [ ] **RLS 정책 테스트**:
    - [ ] 다른 사용자 데이터 접근 차단 확인
    - [ ] 자신의 데이터만 접근 가능 확인
  - [ ] **데이터 무결성 테스트**:
    - [ ] Entry 개수 검증
    - [ ] 온톨로지 메타데이터 검증
    - [ ] Timestamp 검증
  - [ ] **성능 테스트**:
    - [ ] 응답 시간 측정 (목표: < 100ms)
    - [ ] 동시 요청 테스트 (10명 동시)
  - [ ] **프론트엔드 호환성 테스트**:
    - [ ] 현재 HTML 프론트엔드와 정상 작동 확인
  - [ ] **버그 수정**:
    - [ ] 발견된 모든 버그 수정
    - [ ] 에러 메시지 개선

**테스트 체크리스트**:
```bash
# 1. 서버 시작
npm start

# 2. API 테스트
curl -X GET http://localhost:3000/api/entries
curl -X POST http://localhost:3000/api/analyze -d '{"text": "테스트"}'
curl -X GET http://localhost:3000/api/stats

# 3. 프론트엔드 테스트
# 브라우저에서 http://localhost:3000 접속
# - 일기 작성 → 분석 → 저장 → 조회 → 삭제 → 통계 확인
```

**수용 기준**:
- [ ] 모든 API 엔드포인트 200 OK 응답
- [ ] RLS 정책 정상 작동
- [ ] 데이터 무결성 100% 검증됨
- [ ] 응답 시간 < 100ms
- [ ] 프론트엔드 정상 작동
- [ ] 0개의 미해결 버그

---

#### 8. GitHub 커밋 & 문서화
- **담당**: Backend Dev #1
- **예상 시간**: 0.5일 (2시간)
- **우선순위**: 🟡 **권장**
- **의존성**: 작업 7 완료 후
- **상세 작업**:
  - [ ] 모든 변경사항 커밋:
    ```bash
    git add .
    git commit -m "Phase 5: Supabase Backend Migration - 완료
    - Supabase 프로젝트 생성 및 초기화
    - 4개 테이블 생성 (users, entries, user_stats, activity_logs)
    - RLS 정책 설정 (사용자별 데이터 격리)
    - 6개 성능 인덱스 생성
    - entries.json → PostgreSQL 마이그레이션 완료
    - Express API 엔드포인트 Supabase 통합
    - 통합 테스트 및 버그 수정 완료"
    git push origin main
    ```
  - [ ] `docs/PHASE5_NOTES.md` 작성:
    - [ ] Supabase 설정 가이드
    - [ ] 마이그레이션 과정 기록
    - [ ] 알려진 이슈 및 해결 방법
    - [ ] Phase 6 준비사항

**수용 기준**:
- [ ] GitHub에 모든 변경사항 푸시됨
- [ ] 커밋 메시지 명확함
- [ ] `docs/PHASE5_NOTES.md` 작성됨

---

## 📊 진행 상황 추적

| 작업 | 담당 | 상태 | 예상 | 실제 | 비고 |
|------|------|------|------|------|------|
| 1. Supabase 프로젝트 생성 | Backend #1 | ⏳ | 1일 | - | 필수 선행작업 |
| 2. 스키마 설계 & 생성 | DB Arch | ⏳ | 2일 | - | 작업 1 후 |
| 3. RLS 정책 설정 | Backend #1 | ⏳ | 1일 | - | 작업 2 후 |
| 4. 인덱스 생성 | DB Arch | ⏳ | 0.5일 | - | 병행 가능 |
| 5. 마이그레이션 스크립트 | Backend #2 | ⏳ | 2일 | - | 병행 가능 |
| 6. API 통합 | Backend #1 | ⏳ | 3일 | - | 작업 5 후 |
| 7. 통합 테스트 | Dev + QA | ⏳ | 3일 | - | 작업 6 후 |
| 8. 문서화 & 커밋 | Backend #1 | ⏳ | 0.5일 | - | 최종 |
| **총 소요 시간** | | | **12.5일** | | |

---

## 🎯 완료 기준 (Definition of Done)

✅ Phase 5 완료 시:
- [ ] Supabase 프로젝트 완전히 설정됨
- [ ] 4개 테이블 생성 및 테스트됨
- [ ] RLS 정책 3/3 설정 완료
- [ ] 모든 entries.json 데이터 PostgreSQL로 마이그레이션됨
- [ ] Express API 모든 엔드포인트 Supabase 연동됨
- [ ] 통합 테스트 100% 통과
- [ ] 0개 미해결 버그
- [ ] GitHub에 모든 변경사항 푸시됨
- [ ] 마이그레이션 과정 문서화됨

---

## 🚀 다음 단계 (Phase 6)

Phase 5 완료 후:
- **Phase 6: 인증 & 사용자 시스템** (1-2주)
  - Supabase Auth 설정
  - 회원가입/로그인 엔드포인트
  - httpOnly Cookie 관리
  - 권한 검증 및 RLS 적용

---

**작성일**: 2026-03-05
**최종 업데이트**: 2026-03-05
**상태**: 🔴 준비 완료, 시작 대기 중
