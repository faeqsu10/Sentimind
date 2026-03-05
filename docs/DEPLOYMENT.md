# 배포 가이드

## 개요

Sentimind는 로컬 개발(Node.js) 및 클라우드 배포(Vercel)를 모두 지원합니다.

---

## 로컬 개발 환경

### 사전 요구사항

- Node.js 18.0+ (Supabase SDK는 Node 20+ 권장)
- npm 또는 yarn
- Google AI (Gemini) API 키
- Supabase 계정 (선택사항, JSON 폴백 가능)

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/faeqsu10/Sentimind.git
cd study-04

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일에 다음을 추가:
# - GOOGLE_API_KEY: Google AI Console에서 생성
# - SUPABASE_URL: Supabase 대시보드에서 확인 (선택)
# - SUPABASE_ANON_KEY: Supabase 대시보드에서 확인 (선택)

# 4. 서버 실행
npm run dev
# 또는: node server.js

# 5. 브라우저에서 접속
# http://localhost:3000
```

### 디렉토리 구조 (로컬)

```
/home/faeqsu10/projects/vibe-coding/study-04/
├── public/
│   └── index.html          (프론트엔드, CSS/JS 인라인)
├── data/
│   ├── entries.json        (일기 저장소)
│   ├── emotion-ontology.json
│   └── situation-ontology.json
├── logs/
│   └── app-YYYY-MM-DD.log  (서버 로그)
├── server.js               (Express 백엔드)
├── .env                    (환경 변수, .gitignore)
└── package.json
```

### 로그 확인

```bash
# 실시간 로그 보기
tail -f logs/app-*.log

# 특정 날짜 로그
cat logs/app-2026-03-05.log | grep ERROR
```

---

## Vercel 배포 (클라우드)

### 사전 요구사항

- Vercel 계정 (https://vercel.com)
- GitHub 저장소
- Google API 키 + Supabase 자격증명 (GitHub Secrets)

### 배포 단계

#### 1단계: GitHub Secrets 설정

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables

추가할 변수:
```
GOOGLE_API_KEY       = "AIza..."
SUPABASE_URL         = "https://srupve....supabase.co"
SUPABASE_ANON_KEY    = "eyJhbGc..."
NODE_ENV             = "production"
```

#### 2단계: vercel.json 확인

프로젝트 루트에 `vercel.json`이 있어야 합니다:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

#### 3단계: package.json 스크립트 확인

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  }
}
```

#### 4단계: Vercel CLI로 배포

```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel --prod

# 또는 GitHub 연동 후 push하면 자동 배포
git push origin main
```

#### 5단계: 배포 확인

```bash
# Vercel 대시보드에서 배포 상태 확인
# https://vercel.com/dashboard

# 또는 CLI로 확인
vercel status

# 배포된 앱 URL
# https://sentimind-delta.vercel.app
```

### 환경 제약사항

Vercel의 serverless 환경에서는 다음 제약사항이 있습니다:

| 항목 | 로컬 | Vercel |
|------|------|--------|
| 작업 디렉토리 | `/data/` | `/tmp/` |
| 로그 | 파일(`logs/`) | 콘솔 (Vercel Log) |
| 실행 제한 | 무제한 | 요청당 30초 |
| 메모리 | 시스템 메모리 | 3GB (Pro: 15GB) |
| 영구 저장소 | ✅ 파일시스템 | ❌ `/tmp`만 가능 |

따라서 Vercel에서는 **반드시 Supabase PostgreSQL을 사용**해야 데이터가 유지됩니다.

### 문제 해결

**배포 실패 - 404 에러**

```
vercel.json이 없거나 routes가 잘못됨
→ vercel.json 확인 및 수정

{
  "routes": [
    { "src": "/(.*)", "dest": "server.js" }
  ]
}
```

**배포 실패 - 의존성 에러**

```bash
# npm install 재실행
npm ci

# 또는 package-lock.json 재생성
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push origin main
```

**데이터가 저장되지 않음**

```
Supabase가 연결되지 않았을 가능성
→ Environment Variables 확인
→ SUPABASE_URL, SUPABASE_ANON_KEY 설정 확인
```

**느린 첫 요청**

```
Vercel cold start 현상 (일반적)
→ Pro 플랜으로 업그레이드하거나
→ 요청당 <1s로 제한된 함수 최적화
```

---

## 하이브리드 운영 (JSON ↔ Supabase)

### 자동 선택 로직

server.js에서 자동으로 사용 가능한 저장소를 선택합니다:

```javascript
const USE_SUPABASE = SUPABASE_URL && SUPABASE_ANON_KEY;

if (USE_SUPABASE) {
  // PostgreSQL 사용
  const entries = await supabase.from('entries').select('*');
} else {
  // JSON 파일 폴백
  const entries = await readEntriesFromJSON();
}
```

### Phase 1: 하이브리드 운영

- **로컬**: JSON 파일 사용 (개발 편의성)
- **Vercel**: Supabase PostgreSQL 사용 (영속성)
- **전환 가능**: 언제든지 로컬에서 Supabase로 전환 가능

### Phase 2: 완전 마이그레이션 (향후)

- 모든 환경에서 Supabase 사용
- JSON 파일 deprecated
- 데이터 마이그레이션 스크립트 실행

---

## 모니터링 및 로깅

### 로컬 로깅

```bash
# 로그 파일 위치
logs/app-2026-03-05.log

# 실시간 모니터링
tail -f logs/app-*.log | grep ERROR
```

### Vercel 로깅

Vercel 대시보드 → Logs → Function Logs

또는 CLI:
```bash
vercel logs https://sentimind-delta.vercel.app
```

### 성능 모니터링

**Vercel Analytics**
- Vercel 대시보드 → Analytics
- 요청 수, 응답 시간, 에러율 확인

**로컬 성능 테스트**
```bash
# 부하 테스트 (Apache Bench)
ab -n 100 -c 10 http://localhost:3000/api/entries

# 응답 시간 측정
curl -w "Response time: %{time_total}s\n" http://localhost:3000/api/analyze
```

---

## 백업 및 복구

### Supabase 백업

**자동 백업**
- Supabase 대시보드 → Backups
- 무료: 일일 1회
- Pro: 시간별

**수동 백업**
```bash
pg_dump -h db.srupvepoinyobbjcbamz.supabase.co \
        -U postgres \
        -d postgres \
        > backup-2026-03-05.sql
```

**복구**
```bash
psql -h db.srupvepoinyobbjcbamz.supabase.co \
     -U postgres \
     -d postgres \
     < backup-2026-03-05.sql
```

### JSON 파일 백업

```bash
# 수동 백업
cp data/entries.json data/entries-backup-2026-03-05.json

# Git에서 복구
git checkout HEAD -- data/entries.json
```

---

## 성능 최적화 팁

### Vercel

1. **콜드 스타트 최소화**: 의존성 수 제한
2. **함수 크기**: server.js 코드 최소화
3. **요청 최적화**: API 응답 JSON 크기 줄이기

### Express

1. **캐싱**: `/api/stats` 응답 캐싱
2. **인덱싱**: Supabase `idx_entries_date` 활용
3. **쿼리 최적화**: SELECT 필드 명시

### 프론트엔드

1. **단일 HTML**: 추가 요청 없음 ✅
2. **CSS/JS 인라인**: 병렬 로딩 불필요 ✅
3. **반응형**: 모든 기기 지원 ✅

---

**마지막 업데이트**: 2026-03-05
