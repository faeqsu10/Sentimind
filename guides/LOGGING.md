# 로깅 시스템 가이드

로그 모니터링은 **QA 엔지니어**의 주요 책임입니다. 이 가이드는 로그를 해석하고, 문제를 진단하고, 팀에 보고하는 방법을 설명합니다.

---

## 📋 목차

1. [로그 파일 위치](#로그-파일-위치)
2. [로그 형식 이해하기](#로그-형식-이해하기)
3. [로그 레벨](#로그-레벨)
4. [일반적인 에러 및 해결](#일반적인-에러-및-해결)
5. [모니터링 체크리스트](#모니터링-체크리스트)
6. [성능 분석](#성능-분석)
7. [문제 보고](#문제-보고)

---

## 로그 파일 위치

### 로컬 개발 환경
```
logs/app-YYYY-MM-DD.log
```

예시: `logs/app-2026-03-05.log`

### Vercel 프로덕션
- **방법 1**: Vercel 대시보드 → 프로젝트 → Logs 탭
- **방법 2**: Vercel CLI
  ```bash
  vercel logs [project-name] --prod
  ```

### 로그 보존 정책
- **로컬**: 7일 이상 된 로그 자동 삭제
- **Vercel**: 기본 7일 (Pro 플랜 시 30일)

---

## 로그 형식 이해하기

### JSON 구조

```json
{
  "timestamp": "2026-03-05T04:57:19.024Z",
  "level": "INFO",
  "message": "일기 저장 완료",
  "data": {
    "requestId": "1709618239024-abc123de",
    "entryId": "mmcxixvmomnkt",
    "emotion": "기쁨",
    "duration": "45ms"
  },
  "environment": "development"
}
```

### 필드 설명

| 필드 | 의미 | 예시 |
|------|------|------|
| `timestamp` | UTC 시간 | `2026-03-05T04:57:19.024Z` |
| `level` | 로그 수준 | `INFO`, `ERROR`, `WARN`, `DEBUG` |
| `message` | 이벤트 설명 | `"일기 저장 완료"` |
| `data` | 세부 정보 (JSON) | `{"requestId": "...", ...}` |
| `environment` | 실행 환경 | `"development"` 또는 `"production"` |

---

## 로그 레벨

### DEBUG (0) - 개발 전용
```json
{"level":"DEBUG","message":"데이터 읽기 시작","data":{"file":"entries.json"}}
```
- 용도: 개발 중 상세한 추적
- 기본 표시: **미표시** (로컬에서 `LOG_LEVEL=DEBUG` 설정 필요)

### INFO (1) - 정상 작동
```json
{"level":"INFO","message":"일기 저장 완료","data":{"entryId":"mm...","duration":"45ms"}}
```
- 용도: 정상적인 작업 흐름 기록
- 기본 표시: **표시**

### WARN (2) - 경고
```json
{"level":"WARN","message":"삭제할 일기를 찾을 수 없음","data":{"id":"mm...","duration":"12ms"}}
```
- 용도: 예상된 에러 상황
- 기본 표시: **표시**
- 대응: 팀에 알림, 사용자 입력 검증

### ERROR (3) - 심각한 에러
```json
{"level":"ERROR","message":"Gemini API 오류","data":{"error":"Your API key was reported as leaked","status":403,"duration":"1200ms"}}
```
- 용도: 예상 밖의 실패
- 기본 표시: **표시**
- 대응: 즉시 대응 필요

---

## 일반적인 에러 및 해결

### 1. 감정 분석 실패 (Gemini API)

**증상**
```json
{
  "level":"ERROR",
  "message":"Gemini API 오류",
  "data":{
    "status":403,
    "error":"Your API key was reported as leaked"
  }
}
```

**원인**: API 키가 노출됨 (GitHub, git history 등)

**해결**
1. Google AI Studio에서 새 API 키 생성
2. Vercel 환경 변수 업데이트 (`GOOGLE_API_KEY`)
3. 로컬 `.env` 파일 수정
4. Vercel 재배포

```bash
# 1. 새 키 생성
# Google AI Studio: https://aistudio.google.com/app/apikey

# 2. 환경 변수 업데이트 (Vercel)
# Settings → Environment Variables → GOOGLE_API_KEY 변경

# 3. 로컬 테스트
export GOOGLE_API_KEY=your_new_key
npm start
```

---

### 2. 데이터베이스 읽기 실패

**증상**
```json
{
  "level":"ERROR",
  "message":"일기 목록 조회 실패",
  "data":{
    "error":"ENOENT: no such file or directory"
  }
}
```

**원인**:
- `data/entries.json` 파일 손상
- 파일 시스템 권한 문제 (Vercel)
- JSON 파싱 오류

**해결**
```bash
# 로컬 재설정
rm data/entries.json
npm start
# 자동 생성됨

# Vercel: 재배포 후 자동 복구
vercel redeploy
```

---

### 3. 타임아웃 에러

**증상**
```json
{
  "level":"ERROR",
  "message":"Gemini API 오류",
  "data":{
    "status":"TIMEOUT",
    "attempt":3,
    "duration":"30000ms"
  }
}
```

**원인**:
- Gemini API 응답 느림
- 네트워크 지연
- API 할당량 초과

**해결**
1. 자동 재시도 (최대 3회) 확인
2. 네트워크 연결 확인
3. Gemini API 상태 확인: https://status.cloud.google.com/
4. API 할당량 확인: Google Cloud Console

---

### 4. JSON 파싱 에러

**증상**
```json
{
  "level":"ERROR",
  "message":"JSON 파싱 실패",
  "data":{
    "error":"SyntaxError: Unexpected token",
    "input":"일부 텍스트..."
  }
}
```

**원인**: API 응답이 유효한 JSON이 아님

**해결**
```javascript
// 자동으로 처리됨 (parseGeminiResponse 함수)
// - JSON 코드블록 제거
// - 여러 줄 응답 처리
// - 재시도 로직

// 지속적으로 실패하면:
// 1. Gemini API 프롬프트 확인
// 2. 모델 버전 확인
// 3. API 상태 점검
```

---

## 모니터링 체크리스트

### 일일 체크리스트 (매일 아침)

- [ ] 오류율 확인 (ERROR 로그 개수)
- [ ] 응답 시간 확인 (duration < 100ms)
- [ ] API 할당량 확인
- [ ] 로그 파일 크기 확인 (> 100MB는 경고)

### 주간 체크리스트 (매주 금요일)

```bash
# 1. 이번 주 에러 집계
grep '"level":"ERROR"' logs/app-*.log | wc -l

# 2. 가장 흔한 에러
grep '"level":"ERROR"' logs/app-*.log | grep -o '"error":"[^"]*"' | sort | uniq -c | sort -rn

# 3. 느린 요청 (100ms 이상)
grep '"duration":"[1-9][0-9][0-9]' logs/app-*.log

# 4. 평균 응답 시간
grep '"duration"' logs/app-*.log | grep -o '"[0-9]*ms' | sed 's/"//g' | sed 's/ms//g' | awk '{sum+=$1; count++} END {print "평균:", sum/count "ms"}'
```

---

## 성능 분석

### 응답 시간 목표

| 엔드포인트 | 목표 | 경고 | 심각 |
|-----------|------|------|------|
| `GET /api/entries` | <50ms | >100ms | >500ms |
| `POST /api/entries` | <100ms | >200ms | >1000ms |
| `DELETE /api/entries/:id` | <50ms | >100ms | >500ms |
| `POST /api/analyze` (Gemini) | <2000ms | >3000ms | >5000ms |
| `GET /api/stats` | <100ms | >200ms | >500ms |

### 성능 모니터링 쿼리

```bash
# 1. 평균 응답 시간 (엔드포인트별)
grep 'GET /api/stats' logs/app-*.log | grep '"duration"' | grep -o '"[0-9]*ms' | sed 's/"//g' | sed 's/ms//g' | awk '{sum+=$1; count++} END {print "평균:", int(sum/count) "ms"}'

# 2. 느린 요청 목록 (100ms 이상)
grep 'POST /api/analyze' logs/app-*.log | grep '\"duration\"' | grep -E '[1-9][0-9]{3}ms|[1-9][0-9]{2}[0-9]ms'

# 3. 시간대별 요청 수
grep '"level":"INFO"' logs/app-*.log | cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c
```

---

## 문제 보고

### GitHub Issue 작성 템플릿

```markdown
**제목**: [로그] Gemini API 에러 - 누출된 키 (2026-03-05)

**로그 샘플**
\`\`\`json
{
  "timestamp":"2026-03-05T04:57:19.024Z",
  "level":"ERROR",
  "message":"Gemini API 오류",
  "data":{
    "status":403,
    "error":"Your API key was reported as leaked"
  }
}
\`\`\`

**발생 시간**: 2026-03-05 04:57:19 UTC
**영향 범위**: 모든 감정 분석 요청 실패
**재현 방법**: 웹사이트에서 일기 작성 시도

**권장 조치**:
1. 새 API 키 생성
2. Vercel 환경 변수 업데이트
3. 재배포 및 테스트
```

### 보고 순서

1. **QA 엔지니어 (발견)**
   - 로그에서 에러 패턴 감지
   - GitHub Issue 생성
   - Slack으로 팀 알림

2. **Backend 개발자 (대응)**
   - 원인 분석
   - 응급 조치 또는 수정 계획
   - Issue에 댓글 달기

3. **팀 회의 (검토)**
   - 주간 회의에서 로그 분석 결과 공유
   - 패턴 분석 및 예방 방안 논의

---

## 로컬 개발 로그 설정

### 디버그 모드 활성화

```bash
# 디버그 로그 표시
LOG_LEVEL=DEBUG npm start

# 또는 .env 파일에 추가
echo "LOG_LEVEL=DEBUG" >> .env
npm start
```

### 로그 필터링

```bash
# 모든 에러 로그 보기
tail -f logs/app-*.log | grep '"level":"ERROR"'

# 특정 엔드포인트 로그 보기
tail -f logs/app-*.log | grep 'POST /api/analyze'

# 느린 요청만 보기
tail -f logs/app-*.log | grep -E '[1-9][0-9]{3}ms'

# 실시간 모니터링
tail -100f logs/app-*.log
```

---

## 자동화 도구

### 로그 분석 스크립트

```bash
#!/bin/bash
# scripts/analyze-logs.sh

echo "=== 로그 분석 ==="
echo "📊 최근 24시간 통계"

# 에러 개수
ERROR_COUNT=$(grep '"level":"ERROR"' logs/app-*.log | wc -l)
echo "❌ 에러: $ERROR_COUNT건"

# 경고 개수
WARN_COUNT=$(grep '"level":"WARN"' logs/app-*.log | wc -l)
echo "⚠️  경고: $WARN_COUNT건"

# 평균 응답 시간
AVG_DURATION=$(grep '"duration"' logs/app-*.log | grep -o '[0-9]*ms' | sed 's/ms//g' | awk '{sum+=$1; count++} END {print int(sum/count)}')
echo "⏱️  평균 응답: ${AVG_DURATION}ms"

# 성공 요청
SUCCESS=$(grep '"level":"INFO"' logs/app-*.log | grep -c '완료')
echo "✅ 성공: $SUCCESS건"
```

### Vercel 실시간 모니터링

```bash
# 프로덕션 로그 실시간 보기
vercel logs [project-name] --prod --follow
```

---

## 문의 및 지원

- **로깅 시스템 개선**: Backend Developer와 상의
- **로그 분석 방법**: 가이드 업데이트 (이 파일 수정)
- **성능 최적화**: Tech Architect와 상의

---

**마지막 업데이트**: 2026-03-05
**작성자**: QA Engineer
**다음 검토**: 2026-03-12
