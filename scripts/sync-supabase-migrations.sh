#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/migrations"
TARGET_DIR="$ROOT_DIR/supabase/migrations"

if [[ ! -d "$ROOT_DIR/supabase" ]]; then
  echo "supabase 디렉토리가 없습니다. 먼저 'npx supabase init'을 실행하세요." >&2
  exit 1
fi

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

index=0
while IFS= read -r file; do
  index=$((index + 1))
  printf -v prefix "2026031100%04d" "$index"
  cp "$file" "$TARGET_DIR/${prefix}_$(basename "$file")"
done < <(find "$SOURCE_DIR" -maxdepth 1 -type f -name '*.sql' | sort)

echo "Synced $(find "$TARGET_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ') migration files into supabase/migrations"
