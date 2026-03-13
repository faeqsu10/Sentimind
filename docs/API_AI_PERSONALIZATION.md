# API Draft: AI 개인화 및 그림일기 카드

**문서 버전**: v0.1
**작성일**: 2026-03-11
**상태**: Draft
**관련 문서**: `docs/API.md`, `docs/PRD_AI_PERSONALIZATION.md`

## 1. 설계 원칙

- 기존 `/api/profile`과 `/api/analyze`를 확장하는 방식으로 간다.
- 자유 입력 프롬프트는 허용하지 않고 enum 기반 설정만 허용한다.
- 안전 fallback은 서버가 최종 책임을 가진다.

## 2. 프로필 확장

### GET `/api/profile`

응답 `data`에 아래 필드를 추가한다.

```json
{
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "response_length": "balanced",
    "advice_style": "balanced",
    "persona_preset": "none"
  }
}
```

### PATCH `/api/profile`

기존 프로필 수정 API에 아래 필드를 추가한다.

요청 예시:
```json
{
  "response_length": "detailed",
  "advice_style": "comfort",
  "persona_preset": "gentle_friend"
}
```

검증 규칙:
- `response_length`: `short | balanced | detailed`
- `advice_style`: `comfort | balanced | actionable`
- `persona_preset`: `none | gentle_friend | calm_coach | clear_reflector | wise_elder | mindful_guide | creative_muse | humor_buddy`

오류 예시:
```json
{
  "error": "지원하지 않는 응답 길이입니다.",
  "code": "VALIDATION_ERROR"
}
```

## 3. 감정 분석 확장

### POST `/api/analyze`

기존 요청 바디는 유지한다.

요청:
```json
{
  "text": "오늘 발표가 끝나서 긴장이 풀렸어."
}
```

응답에 개인화 메타를 추가한다.

응답 예시:
```json
{
  "emotion": "안도감",
  "emoji": "😮‍💨",
  "message": "오늘 정말 긴 호흡을 잘 버텨냈네요.",
  "advice": "지금은 결과를 정리하기보다 몸의 긴장을 먼저 풀어줘도 좋아요.",
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
    "related_emotions": ["만족감", "기쁨"]
  },
  "personalization": {
    "applied_response_length": "balanced",
    "applied_advice_style": "comfort",
    "applied_persona_preset": "gentle_friend",
    "safety_mode": "normal"
  }
}
```

서버 동작 규칙:
- 위기성 표현이면 `safety_mode = crisis`
- 페르소나는 응답 표현만 바꾸고 감정 분류 결과는 바꾸지 않음

## 4. 그림일기 카드

### POST `/api/entries/:id/illustrated-summary`

설명:
- 저장된 일기 기준으로 3컷 그림일기 카드용 JSON 생성
- 실제 이미지 생성이 아니라 텍스트 기반 카드 응답

요청 본문:
```json
{}
```

응답 예시:
```json
{
  "data": {
    "entry_id": "entry_123",
    "title": "긴장이 풀리던 저녁",
    "dominant_emotion": "안도감",
    "panels": [
      {
        "scene": 1,
        "caption": "발표 직전, 심장이 조금 빠르게 뛰었어요.",
        "visual_prompt": "회의실 앞에서 숨을 고르는 인물"
      },
      {
        "scene": 2,
        "caption": "준비한 말을 끝내고 나니 어깨 힘이 조금 내려갔어요.",
        "visual_prompt": "발표를 마치고 미소 짓는 인물"
      },
      {
        "scene": 3,
        "caption": "집으로 돌아오는 길, 오늘을 버틴 내가 조금 대견했어요.",
        "visual_prompt": "저녁길을 걸으며 안도하는 인물"
      }
    ],
    "closing_reflection": "오늘은 결과보다도 끝까지 해낸 힘이 남는 하루였어요."
  }
}
```

오류:
- `404 NOT_FOUND`: 대상 일기 없음
- `409 UNSUITABLE_CONTENT`: 민감도 규칙상 카드 생성이 부적절함
- `502 AI_SERVICE_ERROR`: 생성 실패

## 5. 분석 시 직접 생성하는 경량 흐름

### POST `/api/analyze/illustrated-preview`

설명:
- 저장 전 미리보기용 3컷 그림일기 초안 생성
- 게스트 허용 여부는 추후 결정, 기본안은 로그인 사용자만 허용

요청:
```json
{
  "text": "오늘은 바빴지만 저녁엔 마음이 편해졌어."
}
```

응답 형태는 `/api/entries/:id/illustrated-summary`와 동일하되 `entry_id` 없음.

## 6. 분석 이벤트 권장 추가

추천 이벤트:
- `profile_style_saved`
- `persona_preset_changed`
- `playful_tone_blocked_by_safety`
- `illustrated_summary_requested`
- `illustrated_summary_generated`
- `illustrated_summary_shared`

속성 예시:
```json
{
  "event": "profile_style_saved",
  "properties": {
    "response_length": "detailed",
    "advice_style": "comfort",
    "persona_preset": "gentle_friend"
  }
}
```
