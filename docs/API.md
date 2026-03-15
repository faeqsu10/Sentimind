# API 엔드포인트 참조

## 개요

Sentimind 백엔드는 인증, 감정 분석, 일기 저장, 통계 조회를 위한 REST API를 제공합니다.

기본 URL
- 로컬: `http://localhost:3000`
- 배포: `https://sentimind-delta.vercel.app`

## 인증

### `POST /api/auth/signup`
요청:
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "nickname": "마음기록자"
}
```

### `POST /api/auth/login`
요청:
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

응답:
```json
{
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com"
    },
    "session": {
      "access_token": "token",
      "refresh_token": "refresh-token",
      "expires_in": 3600,
      "token_type": "bearer"
    }
  }
}
```

### `POST /api/auth/refresh`
요청:
```json
{
  "refresh_token": "refresh-token"
}
```

### `POST /api/auth/anonymous`
익명 로그인 (게스트 체험). Rate limit: loginLimiter 적용.

응답:
```json
{
  "data": {
    "user": { "id": "uuid", "is_anonymous": true },
    "session": { "access_token": "...", "refresh_token": "...", "expires_in": 3600, "token_type": "bearer" }
  }
}
```

### `POST /api/auth/link-account`
익명 사용자를 정식 회원으로 전환. 기존 entries가 동일 user_id에 유지됨.

헤더:
- `Authorization: Bearer {access_token}` (익명 유저 토큰)

요청:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "nickname": "닉네임 (선택)"
}
```

응답:
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com" },
    "session": { "access_token": "...", "refresh_token": "..." }
  },
  "message": "계정 연결 완료"
}
```

### `POST /api/auth/logout`
헤더:
- `Authorization: Bearer {access_token}`

### `GET /api/auth/me`
헤더:
- `Authorization: Bearer {access_token}`

### `PUT /api/auth/password`
헤더:
- `Authorization: Bearer {access_token}`

요청:
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

### `DELETE /api/auth/account`
헤더:
- `Authorization: Bearer {access_token}`

요청:
```json
{
  "password": "CurrentPassword123"
}
```

### `POST /api/auth/reset-password`
요청:
```json
{
  "email": "user@example.com"
}
```

### `GET /api/auth/oauth/google`
Google OAuth 시작 URL을 반환합니다.

## 감정 분석

### `POST /api/analyze`
게스트/로그인 사용자 모두 호출할 수 있습니다.

요청:
```json
{
  "text": "오늘 발표가 잘 끝나서 마음이 놓였어."
}
```

응답:
```json
{
  "emotion": "안도감",
  "emoji": "😮‍💨",
  "message": "큰 일을 마치고 한숨 놓은 마음이 느껴져요.",
  "advice": "오늘은 스스로를 다독이며 쉬어가도 좋아요.",
  "ontology": {
    "emotion_hierarchy": {
      "level1": "긍정",
      "level2": "안도감"
    },
    "situation_context": [
      {
        "domain": "직장",
        "context": "발표"
      }
    ],
    "confidence": 84,
    "related_emotions": ["기쁨", "만족감"]
  }
}
```

## 일기

### `GET /api/entries`
헤더:
- `Authorization: Bearer {access_token}`

쿼리:
- `limit`
- `offset`
- `emotion`
- `bookmarked=true`
- `search`

### `POST /api/entries`
헤더:
- `Authorization: Bearer {access_token}`

요청:
```json
{
  "text": "오늘 발표가 잘 끝났어",
  "emotion": "안도감",
  "emoji": "😮‍💨",
  "message": "정말 수고했어요.",
  "advice": "오늘은 충분히 쉬어보세요.",
  "emotion_hierarchy": {},
  "situation_context": [],
  "confidence_score": 84,
  "related_emotions": [],
  "activity_tags": ["발표"],
  "crisis_detected": false,
  "tz_offset": -540
}
```

### `PATCH /api/entries/:id`
헤더:
- `Authorization: Bearer {access_token}`

북마크 설정:
```json
{
  "is_bookmarked": true
}
```

또는 본문 수정 (text, emotion, message 지원):
```json
{
  "text": "수정된 일기",
  "emotion": "평온",
  "message": "수정된 메시지"
}
```

### `PATCH /api/entries/:id/feedback`
헤더:
- `Authorization: Bearer {access_token}`

요청:
```json
{
  "rating": "helpful"
}
```

### `DELETE /api/entries/:id`
헤더:
- `Authorization: Bearer {access_token}`

소프트 삭제합니다.

### `GET /api/export?format=csv|json`
헤더:
- `Authorization: Bearer {access_token}`

## 통계

### `GET /api/stats?period=7d|30d|90d|all&tz_offset=-540`
게스트도 호출할 수 있으며, 게스트인 경우 빈 통계를 반환합니다.

응답 주요 필드:
- `total_entries`
- `avg_confidence`
- `emotion_distribution`
- `top_emotions`
- `top_situations`
- `recent_entries`
- `this_week`
- `today`
- `streak`

### `GET /api/stats/emotion-graph?period=7d|30d|90d|all`
게스트도 호출할 수 있으며, 게스트인 경우 빈 그래프 구조를 반환합니다.

## AI 리포트

### `GET /api/report?period=weekly|monthly&regenerate=true`
헤더:
- `Authorization: Bearer {access_token}`

쿼리:
- `period`: `weekly` 또는 `monthly` (필수)
- `regenerate`: `true`일 때 기존 리포트 삭제 후 재생성 (선택)

리포트는 `user_reports` 테이블에 영구 저장됩니다. 같은 기간의 리포트가 이미 존재하면 DB에서 즉시 반환 (Gemini API 호출 없음).

응답:
```json
{
  "period": "weekly",
  "entryCount": 7,
  "summary": "이번 주 감정은 전반적으로 안정적이었어요.",
  "emotionTrend": "초반 긴장에서 후반 안도감으로 이동했어요.",
  "insight": "업무 마감 직후 안도감과 만족감이 반복됩니다.",
  "encouragement": "이번 주처럼 자신을 잘 돌보는 흐름을 이어가보세요."
}
```

헤더:
- `X-Cache: HIT` — DB에서 조회됨
- `X-Cache: MISS` — Gemini API로 새로 생성됨

오류:
- `400 INSUFFICIENT_DATA`: 최소 일기 수 부족
- `501 NOT_IMPLEMENTED`: Supabase 미설정 환경

### `GET /api/reports?period=weekly|monthly&limit=10&offset=0`
헤더:
- `Authorization: Bearer {access_token}`

쿼리:
- `period`: `weekly` 또는 `monthly` (선택, 미지정 시 전체)
- `limit`: 최대 50 (기본 10)
- `offset`: 페이지네이션 (기본 0)

과거 리포트 목록을 최신순으로 반환합니다.

### `DELETE /api/reports/:id`
헤더:
- `Authorization: Bearer {access_token}`

파라미터:
- `id`: 삭제할 리포트 ID (UUID)

본인의 리포트만 삭제 가능. 성공 시 204 No Content.

응답:
```json
[
  {
    "id": "uuid",
    "period": "weekly",
    "periodStart": "2026-03-09",
    "periodEnd": "2026-03-15",
    "entryCount": 5,
    "summary": "이번 주는 전반적으로...",
    "emotionTrend": "...",
    "insight": "...",
    "encouragement": "...",
    "createdAt": "2026-03-12T12:00:00Z"
  }
]
```

헤더:
- `X-Total-Count`: 전체 리포트 수

## 후속 대화

### `POST /api/followup`
게스트/로그인 사용자 모두 호출할 수 있습니다.

요청:
```json
{
  "stage": "explore",
  "emotion": "불안",
  "originalText": "내일 발표가 걱정돼",
  "userReply": "실수할까 봐 겁나",
  "context": [
    { "role": "ai", "text": "어떤 점이 가장 걱정되나요?" }
  ]
}
```

## 게스트 마이그레이션

### `POST /api/migrate/from-guest`
헤더:
- `Authorization: Bearer {access_token}`

요청:
```json
{
  "entries": [
    {
      "text": "게스트 일기",
      "emotion": "기쁨",
      "emoji": "😊",
      "message": "좋은 하루네요",
      "advice": "이 순간을 기억해보세요",
      "date": "2026-03-11T00:00:00.000Z"
    }
  ]
}
```

응답:
```json
{
  "success": true,
  "imported": 1,
  "skipped": 0
}
```

## 그림일기 3컷 카드

### `POST /api/illustrated-diary`
게스트/로그인 사용자 모두 호출할 수 있습니다.

요청:
```json
{
  "text": "일기 텍스트",
  "emotion": "감정명",
  "emoji": "이모지"
}
```

응답:
```json
{
  "title": "긴장이 풀리던 저녁",
  "panels": [
    { "scene": 1, "caption": "발표 직전, 심장이 빠르게 뛰었어요", "mood": "tense", "emoji": "🫀" },
    { "scene": 2, "caption": "준비한 말을 끝내고 어깨 힘이 풀렸어요", "mood": "relief", "emoji": "😮‍💨" },
    { "scene": 3, "caption": "집으로 돌아오며 오늘의 나를 응원했어요", "mood": "warm", "emoji": "🌅" }
  ],
  "closing": "오늘은 끝까지 해낸 힘이 남는 하루였어요"
}
```

오류:
- `400 VALIDATION_ERROR`: 요청 본문 누락 또는 형식 오류
- `500 INTERNAL_ERROR`: Gemini API 호출 실패

환경변수:
- `ILLUSTRATED_MAX_TOKENS`: 응답 최대 토큰 수 (기본 512)
- `ILLUSTRATED_TEMPERATURE`: 생성 온도 (기본 0.8)

## 에러 로그

### `POST /api/error-logs`
프론트엔드 에러를 배치로 수신합니다. 인증은 선택적(optionalAuth)이며, 인증 시 user_id가 자동 추출됩니다.

요청:
```json
{
  "errors": [
    {
      "message": "Cannot read properties of null",
      "stack": "TypeError: Cannot read properties...\n  at renderHistory (history.js:45:12)",
      "source_file": "history.js",
      "lineno": 45,
      "colno": 12,
      "fingerprint": "fe1a2b3c",
      "metadata": {
        "request_id": "1710-abc123",
        "current_tab": "diary"
      }
    }
  ],
  "session_id": "uuid",
  "user_agent": "Mozilla/5.0 ..."
}
```

응답:
```json
{
  "accepted": 1
}
```

제한:
- 배치 최대 10개/요청
- message 최대 1000자, stack 최대 4000자
- 동일 fingerprint 에러는 프론트엔드에서 5분 내 1회만 전송

## 이벤트 수집

### `POST /api/analytics`
인증 없이 배치 이벤트를 수집합니다.

요청:
```json
{
  "events": [
    {
      "event": "landing_viewed",
      "session_id": "session-1",
      "device_type": "desktop",
      "theme": "light"
    }
  ]
}
```

응답:
```json
{
  "accepted": 1
}
```
