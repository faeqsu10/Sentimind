# Local Supabase Setup

이 프로젝트는 기본적으로 원격 Supabase를 쓰지만, 무료 프로젝트 한도와 무관하게 로컬 Supabase로도 개발할 수 있다.

## 준비 사항

- Docker 실행 중
- Node / npm 사용 가능
- 프로젝트 루트에서 작업

## 한 번만 하면 되는 작업

```bash
npm install
```

CLI가 없으면 dev dependency로 설치한다.

## 로컬 Supabase 시작

```bash
npm run supabase:start
```

이 명령은 다음을 순서대로 수행한다.

- 기존 `migrations/*.sql`를 `supabase/migrations/`로 동기화
- 로컬 Supabase 스택 시작

첫 실행은 Docker 이미지 pull 때문에 오래 걸릴 수 있다.

## 로컬 접속 정보 확인

로컬 Supabase가 올라온 뒤 다음 명령으로 env 값을 확인한다.

```bash
npm run supabase:status
```

출력된 값 중 아래를 `.env`에 넣는다.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

추가로 Gemini 연동을 위해 아래 값도 필요하다.

- `GOOGLE_API_KEY`

## 권장 `.env` 예시

```env
PORT=3000
GOOGLE_API_KEY=your_gemini_api_key
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=...status output...
SUPABASE_SERVICE_ROLE_KEY=...status output...
```

## 앱 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 후 회원가입 / 로그인 / 프로필 저장을 확인한다.

## 스키마 반영 방식

원본 마이그레이션은 `migrations/`에 유지한다.
로컬 Supabase용 `supabase/migrations/`는 아래 명령으로 매번 다시 생성할 수 있다.

```bash
npm run supabase:sync
```

## 확인 포인트

- `GET /api/health`에서 Supabase 연결 확인
- 프로필의 `응답 길이`, `조언 강도`, `대화 스타일` 저장 확인
- `POST /api/analyze` 응답의 `personalization` 필드 확인
