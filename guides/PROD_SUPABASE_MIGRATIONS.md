# Production Supabase Migrations

운영 Supabase 마이그레이션은 GitHub Actions로 자동 실행한다.

워크플로 파일:

- `.github/workflows/supabase-prod-migrate.yml`

## 트리거

- `main` 브랜치 push
- `workflow_dispatch`

다음 파일이 바뀌면 자동 실행된다.

- `migrations/**`
- `supabase/**`
- `scripts/sync-supabase-migrations.sh`

## 필요한 GitHub Secrets

- `SUPABASE_ACCESS_TOKEN`
- `PRODUCTION_PROJECT_ID`
- `PRODUCTION_DB_PASSWORD`

## 동작 순서

1. 저장소 checkout
2. Supabase CLI 설치
3. `migrations/`를 `supabase/migrations/`로 동기화
4. Supabase CLI 로그인
5. 운영 프로젝트 link
6. `supabase db push --linked --yes`

## 주의사항

- 이 자동화는 `운영 DB 비밀번호`가 GitHub Secrets에 있어야 동작한다.
- 첫 운영 적용 전에 Vercel 코드 배포와 별개로 DB 변경이 반영되는 흐름인지 팀이 인지하고 있어야 한다.
- 이미 운영 DB에 수동으로 적용된 스키마가 많고 Supabase migration history가 비어 있다면, 첫 실행 전에 기준선 정리가 필요할 수 있다.

## 권장 운영 방식

- 새 SQL은 항상 `migrations/`에 추가
- 로컬에서 `npm run supabase:sync` 및 테스트 확인
- `main` 머지 후 운영 migration 자동 반영
