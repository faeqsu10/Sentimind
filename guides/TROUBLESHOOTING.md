# 문제 해결 가이드

## 로컬 개발 문제

### 포트 이미 사용 중

**증상**
```
EADDRINUSE: address already in use :::3000
```

**해결책**

```bash
# 포트 3000을 사용하는 프로세스 찾기
lsof -i :3000

# PID로 프로세스 종료
kill -9 <PID>

# 또는 다른 포트 사용
PORT=5000 npm run dev
```

---

### "Cannot find module" 에러

**증상**
```
Error: Cannot find module 'express'
Error: Cannot find module '@supabase/supabase-js'
```

**해결책**

```bash
# npm_modules 재설치
rm -rf node_modules package-lock.json
npm install

# 또는 깨끗한 설치
npm ci
```

---

### 환경 변수 로드 실패

**증상**
```
GOOGLE_API_KEY is undefined
SUPABASE_URL is undefined
```

**확인**

```bash
# 1. .env 파일 존재 확인
ls -la .env

# 2. .env 파일 내용 확인
cat .env

# 3. 환경 변수 로드 확인
node -e "require('dotenv').config(); console.log(process.env.GOOGLE_API_KEY)"
```

**해결책**

```bash
# .env.example 복사
cp .env.example .env

# API 키 추가
echo 'GOOGLE_API_KEY="AIza..."' >> .env
```

---

### JSON 파일 형식 오류

**증상**
```
SyntaxError: Unexpected token } in JSON at position XXX
```

**확인**

```bash
# JSON 유효성 검사
python3 -m json.tool data/entries.json

# 또는 Node.js
node -e "JSON.parse(require('fs').readFileSync('data/entries.json'))"
```

**해결책**

```bash
# 손상된 entries.json 복구
git checkout HEAD -- data/entries.json

# 또는 백업에서 복구
cp data/entries-backup.json data/entries.json

# 아니면 빈 배열로 리셋
echo '[]' > data/entries.json
```

---

### 파일 권한 문제

**증상**
```
EACCES: permission denied, open 'data/entries.json'
```

**해결책**

```bash
# 권한 확인
ls -la data/

# 권한 수정
chmod 644 data/entries.json
chmod 755 data/

# 또는 소유권 변경
sudo chown $USER:$USER data/entries.json
```

---

## API 및 Supabase 문제

### Gemini API 오류

**증상**
```
"API key not valid. Please pass a valid API key."
```

**확인**

```bash
# API 키 확인
echo $GOOGLE_API_KEY

# 또는 .env 파일에서 확인
cat .env | grep GOOGLE_API_KEY
```

**해결책**

1. Google AI Studio에서 새 API 키 생성
2. `.env` 파일에서 기존 키 삭제 후 새 키 추가
3. 서버 재시작: `npm run dev`

---

### Supabase 연결 오류

**증상**
```
"Failed to connect to Supabase"
"PostgreSQL connection timeout"
```

**확인**

```bash
# 1. 환경 변수 확인
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# 2. 네트워크 연결 테스트
curl https://srupvepoinyobbjcbamz.supabase.co

# 3. 로그에서 에러 메시지 확인
tail -f logs/app-*.log | grep -i supabase

# 4. Supabase 대시보드 상태 확인
# https://app.supabase.com/projects/srupvepoinyobbjcbamz/auth/users
```

**해결책**

```bash
# 방법 1: 환경 변수 재설정
# .env 파일을 수정하고 서버 재시작

# 방법 2: JSON 폴백 사용
# Supabase 변수를 제거하면 자동으로 JSON 파일 사용
unset SUPABASE_URL
unset SUPABASE_ANON_KEY

# 방법 3: 데이터베이스 상태 확인
# https://app.supabase.com/projects/srupvepoinyobbjcbamz/query/new
```

---

### "Supabase SDK requires Node 20+"

**증상**
```
Warning: The Supabase SDK requires Node.js 20 or higher
```

**설명**: 경고일 뿐 기능 동작에 문제 없습니다.

**해결책** (선택사항)

```bash
# nvm으로 Node 20 설치
nvm install 20
nvm use 20
nvm default 20
```

---

## 감정 분석 문제

### Gemini 응답 파싱 오류

**증상**
```
SyntaxError: Unexpected token in JSON at position 0
```

**원인**: Gemini가 JSON을 마크다운 코드블록으로 감싸서 반환

**확인**

```bash
# 서버 로그에서 응답 확인
tail logs/app-*.log | grep "Gemini Response"

# 예시 응답:
# """
# ```json
# {"emotion": "기쁨", ...}
# ```
# """
```

**해결책** (이미 수정됨)

server.js의 `parseGeminiResponse()` 함수가 자동으로 처리합니다:

```javascript
function parseGeminiResponse(responseText) {
  // 마크다운 코드블록 제거
  const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }
  return JSON.parse(responseText);
}
```

---

### 감정 신뢰도가 낮음

**증상**
```
"confidence": 0.3
```

**원인**: 모호한 일기 텍스트, Gemini 모델 특성

**확인**

```bash
# 최근 일기와 신뢰도 확인
curl http://localhost:3000/api/stats | jq '.average_confidence'
```

**개선 방법**

1. 일기 텍스트 명확성 개선
2. 온톨로지에 감정 추가
3. confidence_threshold 조정

---

## 프론트엔드 문제

### 페이지 로드 실패

**증상**
```
404 Not Found (Vercel)
```

**확인**

1. **로컬**: `http://localhost:3000` 접속 가능?
2. **Vercel**: `https://sentimind-delta.vercel.app` 접속 가능?

**해결책**

**로컬 404**
```bash
# server.js가 정상 실행 중인지 확인
npm run dev

# 로그 확인
# [INFO] Server is running at http://localhost:3000
```

**Vercel 404**
```bash
# vercel.json 확인
cat vercel.json

# 배포 상태 확인
vercel logs https://sentimind-delta.vercel.app
```

---

### API 응답 없음

**증상**
```
"Failed to fetch from /api/analyze"
콘솔: "Unexpected token < in JSON at position 0"
```

**원인**: HTML 에러 페이지 반환

**확인**

```bash
# API 직접 호출
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "테스트"}'

# 응답이 HTML이면 에러, JSON이면 정상
```

**해결책**

```bash
# 서버 로그 확인
tail -f logs/app-*.log

# 환경 변수 확인
echo $GOOGLE_API_KEY

# API 키가 없으면 오류 반환
```

---

## Vercel 배포 문제

### 배포 실패

**증상**
```
Build failed: npm ERR! ERR!
```

**확인**

```bash
# Vercel 대시보드 Logs 탭에서 상세 오류 확인
# https://vercel.com/dashboard/projects

# 또는 CLI
vercel logs https://sentimind-delta.vercel.app --limit=100
```

**일반적인 원인**

| 오류 | 원인 | 해결책 |
|------|------|--------|
| `npm ERR! 404` | 패키지 찾을 수 없음 | `npm install` 재실행 |
| `SyntaxError` | JavaScript 문법 오류 | 로컬에서 `npm run dev` 테스트 |
| `ENOENT: no such file` | 파일 누락 | git에 파일 추가 |

---

### 데이터가 저장되지 않음

**증상**
```
입력한 일기가 페이지 새로고침 후 사라짐
```

**원인**: Supabase 미연결, /tmp 파일 삭제

**확인**

```bash
# 1. Supabase 연결 확인
curl https://sentimind-delta.vercel.app/api/entries

# 2. 환경 변수 확인 (Vercel 대시보드)
# Settings → Environment Variables
```

**해결책**

```bash
# Vercel 환경 변수 설정
# Settings → Environment Variables
SUPABASE_URL="https://srupve..."
SUPABASE_ANON_KEY="eyJhbGc..."

# 배포 재시작
vercel redeploy
```

---

### 느린 응답

**증상**
```
첫 요청이 3-5초 걸림 (cold start)
```

**원인**: Vercel serverless cold start

**해결책**

1. Pro 플랜으로 업그레이드 (cold start 감소)
2. 요청 최적화:
   ```javascript
   // server.js에서 불필요한 연산 제거
   // 응답 JSON 크기 최소화
   ```

---

## 디버깅 기법

### 로그 확인

```bash
# 실시간 로그 보기
tail -f logs/app-*.log

# 특정 에러만 필터
tail -f logs/app-*.log | grep ERROR

# 특정 기능 필터
tail -f logs/app-*.log | grep "POST /api/analyze"

# 날짜별 로그
tail logs/app-2026-03-05.log
```

### API 테스트

```bash
# REST Client (VS Code)
# test.http 파일 생성 후 "Send Request" 클릭

# 또는 curl
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "X-Debug: true" \
  -d '{"text": "테스트"}'
```

### 데이터베이스 검사

```bash
# JSON 파일 확인
cat data/entries.json | jq '.'

# Supabase 대시보드
# Table Editor → entries
# https://app.supabase.com/projects/srupvepoinyobbjcbamz/editor/
```

### 환경 변수 확인

```bash
# 현재 환경 변수 출력
env | grep -E "GOOGLE_API_KEY|SUPABASE"

# Node.js에서 확인
node -e "require('dotenv').config(); console.log({
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY?.slice(0, 10) + '...',
  SUPABASE_URL: process.env.SUPABASE_URL
})"
```

---

## 도움 받기

문제 해결이 안 되면:

1. **GitHub Issues**: 이슈 생성 및 팀 협의
2. **로그 첨부**: 에러 로그를 이슈에 포함
3. **재현 방법**: 문제를 재현하는 정확한 단계 기록

**이슈 템플릿**

```markdown
### 문제
[어떤 일이 일어났는가]

### 재현 방법
1. npm run dev 실행
2. http://localhost:3000에서 일기 입력
3. 제출 버튼 클릭

### 예상 결과
감정 분석 결과 표시

### 실제 결과
콘솔에 오류 메시지 표시

### 로그
[logs/app-*.log의 오류 부분 붙여넣기]
```

---

**마지막 업데이트**: 2026-03-05
