// ---------------------------------------------------------------------------
// Shared Database Utilities
// ---------------------------------------------------------------------------

/**
 * Supabase 에러가 특정 컬럼 미존재 에러인지 확인.
 * 마이그레이션 미적용 환경에서 새 컬럼 참조 시 graceful fallback에 사용.
 * @param {object} error - Supabase error object
 * @param {string[]} columns - 확인할 컬럼명 배열
 * @returns {boolean}
 */
function isMissingColumnError(error, columns) {
  const message = error?.message || '';
  return columns.some(column =>
    message.includes(column) &&
    (message.includes('does not exist') || message.includes('schema cache'))
  );
}

module.exports = { isMissingColumnError };
