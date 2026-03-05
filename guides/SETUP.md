# 로컬 개발 환경 설정

## 빠른 시작 (5분)

### 1단계: 저장소 클론

```bash
git clone https://github.com/faeqsu10/Sentimind.git
cd study-04
```

### 2단계: 환경 변수 설정

```bash
# .env.example을 .env로 복사
cp .env.example .env

# .env 파일 편집 (API 키 추가)
nano .env  # 또는 VS Code에서 열기
```

`.env` 파일에 다음을 추가:

```bash
# Google AI (Gemini) API 키 - 필수
GOOGLE_API_KEY="AIza..."

# Supabase 자격증명 (선택, JSON 폴백 가능)
SUPABASE_URL="https://srupve....supabase.co"
SUPABASE_ANON_KEY="eyJhbGc..."
```

**API 키 발급**

- **Google AI 키**: https://aistudio.google.com/apikey
  1. "Create API key" 클릭
  2. 프로젝트 선택
  3. 키 복사 후 `.env`에 붙여넣기

- **Supabase 키**: https://app.supabase.com
  1. 프로젝트 → Settings → API
  2. `anon public` 키 복사

### 3단계: 의존성 설치

```bash
npm install
```

필수 패키지:
- `express`: 웹 서버
- `@supabase/supabase-js`: PostgreSQL 데이터베이스
- `dotenv`: 환경 변수 관리
- `cors`: CORS 미들웨어

### 4단계: 서버 실행

```bash
npm run dev
```

또는:
```bash
node server.js
```

**출력 예시**
```
[INFO] 2026-03-05 10:30:00 - Server is running at http://localhost:3000
[INFO] 2026-03-05 10:30:00 - Using JSON file storage (Supabase not configured)
```

### 5단계: 브라우저에서 접속

```
http://localhost:3000
```

일기를 작성해보면 Gemini AI가 감정 분석을 시작합니다!

---

## 상세 설정

### Node.js 버전 확인

```bash
node --version  # v18.0.0 이상 필요

# 버전이 낮으면 nvm으로 업그레이드
nvm install 20
nvm use 20
```

### 환경 변수 옵션

#### 필수
- `GOOGLE_API_KEY`: Google AI API 키

#### 선택 (Supabase PostgreSQL)
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase 공개 키

#### 자동 감지
```javascript
// server.js에서 자동으로 감지
const USE_SUPABASE = SUPABASE_URL && SUPABASE_ANON_KEY;
```

**동작**:
- 두 변수 모두 설정 → Supabase 사용
- 하나라도 누락 → JSON 파일 사용

### 디렉토리 구조

```
study-04/
├── public/
│   └── index.html              # 단일 HTML 페이지
├── data/
│   ├── entries.json            # 일기 저장소
│   ├── emotion-ontology.json   # 감정 분류 메타데이터
│   └── situation-ontology.json # 상황 도메인 메타데이터
├── logs/
│   └── app-YYYY-MM-DD.log      # 자동 생성됨
├── server.js                   # Express 백엔드
├── .env                        # 환경 변수 (git 제외)
├── .env.example                # 템플릿 (git 포함)
├── package.json
└── vercel.json                 # Vercel 배포 설정
```

### 포트 변경

기본 포트는 3000입니다. 다른 포트를 사용하려면:

```bash
# 환경 변수로 설정
PORT=5000 npm run dev

# 또는 server.js에서 hardcode (비권장)
```

---

## 개발 도구 설정

### VS Code

권장 확장:
- `REST Client`: API 테스트 (.http 파일)
- `Thunder Client`: Postman 대체
- `ESLint`: 코드 품질
- `Prettier`: 코드 포맷

**launch.json 설정** (디버깅)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}/server.js",
      "restart": true,
      "runtimeArgs": ["--env-file=.env"]
    }
  ]
}
```

### REST API 테스트

`test.http` 파일 생성:

```http
### 감정 분석
POST http://localhost:3000/api/analyze
Content-Type: application/json

{
  "text": "오늘 정말 기쁜 날이었어"
}

### 일기 조회
GET http://localhost:3000/api/entries

### 통계
GET http://localhost:3000/api/stats
```

VS Code REST Client로 실행:
- 각 요청 위에서 "Send Request" 클릭

### Git 설정

```bash
# 글로벌 사용자 설정
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# 프로젝트 레벨 설정 (선택)
git config user.name "Your Name"
git config user.email "your@email.com"
```

---

## 문제 해결

### "Cannot find module 'express'"

```bash
npm install
```

npm_modules가 없으면 먼저 설치합니다.

### "GOOGLE_API_KEY is not defined"

```bash
# .env 파일이 있는지 확인
ls -la .env

# .env 파일 내용 확인
cat .env | grep GOOGLE_API_KEY

# 없으면 추가
echo 'GOOGLE_API_KEY="..."' >> .env
```

### "EADDRINUSE: address already in use :::3000"

포트 3000이 이미 사용 중입니다:

```bash
# 프로세스 찾기
lsof -i :3000

# 프로세스 종료
kill -9 <PID>

# 또는 다른 포트 사용
PORT=5000 npm run dev
```

### Supabase 연결 실패

```bash
# 1. .env 파일 확인
cat .env | grep SUPABASE

# 2. 환경 변수 유효성 확인
node -e "console.log(process.env.SUPABASE_URL)"

# 3. 네트워크 확인
curl https://srupvepoinyobbjcbamz.supabase.co

# 4. 로그 확인
tail -f logs/app-*.log | grep -i supabase
```

### "SyntaxError: Unexpected token"

JSON 파일 형식 오류:

```bash
# JSON 유효성 검사
python3 -m json.tool data/entries.json

# 또는 Node.js
node -e "console.log(JSON.parse(require('fs').readFileSync('data/entries.json', 'utf8')))"
```

---

## 다음 단계

개발 환경 설정이 완료되었습니다!

- **API 개발**: [docs/API.md](../docs/API.md) 참조
- **아키텍처**: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) 참조
- **팀 협업**: [guides/TEAM_WORKFLOW.md](TEAM_WORKFLOW.md) 참조
- **배포**: [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) 참조

---

**마지막 업데이트**: 2026-03-05
