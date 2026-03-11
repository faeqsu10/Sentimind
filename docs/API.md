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
  "tz_offset": -540
}
```

### `PATCH /api/entries/:id`
헤더:
- `Authorization: Bearer {access_token}`

지원 예시:
```json
{
  "is_bookmarked": true
}
```

또는 본문 수정:
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

### `GET /api/report?period=weekly|monthly`
헤더:
- `Authorization: Bearer {access_token}`

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

오류:
- `400 INSUFFICIENT_DATA`: 최소 일기 수 부족
- `501 NOT_IMPLEMENTED`: Supabase 미설정 환경

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
