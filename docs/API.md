# API 엔드포인트 참조

## 개요

Sentimind 백엔드는 일기 저장, 감정 분석, 통계 조회를 위한 RESTful API를 제공합니다.

**기본 URL**
- 로컬: `http://localhost:3000`
- Vercel: `https://sentimind-delta.vercel.app`

---

## 1. 감정 분석 (POST /api/analyze)

사용자 일기를 Gemini AI로 분석하여 감정, 공감 메시지, 조언을 생성합니다.

**요청**
```javascript
POST /api/analyze
Content-Type: application/json

{
  "text": "오늘 프로젝트 발표 성공했어. 정말 신나!"
}
```

**응답 (성공)**
```json
{
  "emotion": "기쁨",
  "emoji": "😊",
  "message": "발표 성공을 축하합니다! 그동안의 준비가 헛되지 않았네요.",
  "advice": "이런 성취감을 느낄 때는 팀원들과 함께 축하하고 배운 점들을 정리하는 것이 좋습니다.",
  "emotion_hierarchy": {
    "level_1": "긍정",
    "level_2": "기쁨",
    "level_3": "기뻐"
  },
  "situation_context": {
    "domain": "work",
    "keywords": ["프로젝트", "발표"]
  },
  "confidence": 0.95,
  "related_emotions": ["설렘", "자신감"]
}
```

**오류 응답**
```json
{
  "error": "텍스트는 500자 이내여야 합니다",
  "status": 400
}
```

**기술 상세**
- **모델**: Gemini 2.5 Flash
- **응답 형식**: JSON (마크다운 코드블록 자동 처리)
- **온톨로지 메타데이터**: OntologyEngine에서 자동 추가
- **신뢰도**: 0.0 ~ 1.0 (Gemini 확률 기반)

---

## 2. 일기 조회 (GET /api/entries)

저장된 모든 일기를 최신순으로 조회합니다.

**요청**
```javascript
GET /api/entries
```

**응답 (성공)**
```json
[
  {
    "id": "uuid-1",
    "date": "2026-03-05T14:32:00Z",
    "text": "오늘 정말 기분이 좋아",
    "emotion": "기쁨",
    "emoji": "😊",
    "message": "좋은 하루 보내셨군요!",
    "advice": "이 기분을 유지하세요",
    "created_at": "2026-03-05T14:32:00Z",
    "updated_at": "2026-03-05T14:32:00Z"
  },
  {
    "id": "uuid-2",
    "date": "2026-03-04T10:15:00Z",
    "text": "일이 많아서 피곤해",
    "emotion": "피로",
    "emoji": "😴",
    "message": "힘내세요",
    "advice": "충분한 휴식을 취하세요",
    "created_at": "2026-03-04T10:15:00Z",
    "updated_at": "2026-03-04T10:15:00Z"
  }
]
```

**오류 응답**
```json
{
  "error": "Failed to fetch entries",
  "status": 500
}
```

**기술 상세**
- **정렬**: `date DESC` (최신순)
- **저장소**: Supabase PostgreSQL (또는 JSON 폴백)
- **성능**: 인덱스 `idx_entries_date` 활용으로 <100ms

---

## 3. 일기 저장 (POST /api/entries)

분석된 일기를 데이터베이스에 저장합니다.

**요청**
```javascript
POST /api/entries
Content-Type: application/json

{
  "text": "오늘 프로젝트 발표 성공했어",
  "emotion": "기쁨",
  "emoji": "😊",
  "message": "발표 성공을 축하합니다!",
  "advice": "이 성취감을 유지하세요"
}
```

**응답 (성공)**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2026-03-05T14:32:00Z",
  "text": "오늘 프로젝트 발표 성공했어",
  "emotion": "기쁨",
  "emoji": "😊",
  "message": "발표 성공을 축하합니다!",
  "advice": "이 성취감을 유지하세요",
  "created_at": "2026-03-05T14:32:00Z",
  "updated_at": "2026-03-05T14:32:00Z"
}
```

**오류 응답**
```json
{
  "error": "Missing required field: emotion",
  "status": 400
}
```

**기술 상세**
- **ID**: UUID v4 (자동 생성)
- **저장소**: Supabase PostgreSQL 또는 JSON 파일
- **동시성**: write lock으로 데이터 무결성 보장
- **환경**: 로컬(/data/entries.json) 또는 Vercel(/tmp)

---

## 4. 일기 삭제 (DELETE /api/entries/:id)

특정 일기를 삭제합니다.

**요청**
```javascript
DELETE /api/entries/550e8400-e29b-41d4-a716-446655440000
```

**응답 (성공)**
```json
{
  "message": "Entry deleted successfully",
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**오류 응답**
```json
{
  "error": "Entry not found",
  "status": 404
}
```

**기술 상세**
- **검증**: UUID 형식 확인
- **저장소**: Supabase DELETE 또는 JSON 파일 편집

---

## 5. 통계 조회 (GET /api/stats)

감정별 통계 및 대시보드 데이터를 조회합니다.

**요청**
```javascript
GET /api/stats
```

**응답 (성공)**
```json
{
  "total_entries": 42,
  "emotions": {
    "기쁨": {
      "count": 12,
      "percentage": 28.57,
      "recent_date": "2026-03-05T14:32:00Z"
    },
    "슬픔": {
      "count": 8,
      "percentage": 19.05,
      "recent_date": "2026-03-04T10:15:00Z"
    },
    "중립": {
      "count": 22,
      "percentage": 52.38,
      "recent_date": "2026-03-03T09:00:00Z"
    }
  },
  "emotion_hierarchy": {
    "긍정": 12,
    "부정": 8,
    "중립": 22
  },
  "situation_domains": {
    "work": 15,
    "relationship": 8,
    "health": 6,
    "daily": 10,
    "growth": 3
  },
  "average_confidence": 0.87
}
```

**오류 응답**
```json
{
  "error": "Failed to calculate statistics",
  "status": 500
}
```

**기술 상세**
- **계산**: GROUP BY emotion, COUNT(*), 백분율 계산
- **신뢰도**: 모든 일기의 평균값
- **캐싱**: 매 요청마다 실시간 계산 (향후 캐싱 추가 가능)

---

## 에러 처리

모든 API 응답은 다음 HTTP 상태 코드를 사용합니다.

| 코드 | 의미 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 (유효성 검사 실패) |
| 404 | 찾을 수 없음 |
| 500 | 서버 오류 |

**에러 응답 형식**
```json
{
  "error": "에러 메시지",
  "status": 400
}
```

---

## 요청 제한

- **텍스트 길이**: 최대 500자
- **요청 형식**: JSON (`Content-Type: application/json`)
- **CORS**: 모든 출처 허용

---

## 예제 (cURL)

**감정 분석**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "오늘 정말 기쁜 날이었어"}'
```

**일기 조회**
```bash
curl http://localhost:3000/api/entries
```

**일기 저장**
```bash
curl -X POST http://localhost:3000/api/entries \
  -H "Content-Type: application/json" \
  -d '{
    "text": "오늘 정말 기쁜 날이었어",
    "emotion": "기쁨",
    "emoji": "😊",
    "message": "축하합니다!",
    "advice": "이 기분을 유지하세요"
  }'
```

**통계 조회**
```bash
curl http://localhost:3000/api/stats
```

---

**마지막 업데이트**: 2026-03-05
