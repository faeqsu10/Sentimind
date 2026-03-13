// ---------------------------------------------------------------------------
// Input Validators
// ---------------------------------------------------------------------------
// 요청 입력값을 검증하는 유틸리티 함수들입니다.
// 모든 검증 함수는 { valid: boolean, error?: string } 형태를 반환합니다.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Auth Validators
// ---------------------------------------------------------------------------

function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: '이메일을 입력해주세요.' };
  }
  const trimmed = email.trim().toLowerCase();
  // RFC 5322 simplified
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: '유효한 이메일 형식이 아닙니다.' };
  }
  if (trimmed.length > 255) {
    return { valid: false, error: '이메일이 너무 깁니다.' };
  }
  return { valid: true, value: trimmed };
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: '비밀번호를 입력해주세요.' };
  }
  if (password.length < 8) {
    return { valid: false, error: '비밀번호는 8자 이상이어야 합니다.' };
  }
  if (password.length > 72) {
    // bcrypt limit
    return { valid: false, error: '비밀번호는 72자 이하여야 합니다.' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: '비밀번호에 영문자를 포함해주세요.' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: '비밀번호에 숫자를 포함해주세요.' };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Entry Validators
// ---------------------------------------------------------------------------

const MAX_ENTRY_LENGTH = parseInt(process.env.MAX_ENTRY_LENGTH || '2000', 10);

function validateEntryText(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { valid: false, error: '일기 내용을 입력해주세요.' };
  }
  if (text.length > MAX_ENTRY_LENGTH) {
    return { valid: false, error: `일기는 ${MAX_ENTRY_LENGTH}자 이내로 작성해주세요.` };
  }
  return { valid: true, value: text.trim() };
}

function validateConfidenceScore(score) {
  if (score === undefined || score === null) {
    return { valid: true, value: 0 };
  }
  const num = parseInt(score, 10);
  if (isNaN(num) || num < 0 || num > 100) {
    return { valid: false, error: '신뢰도 점수는 0~100 사이여야 합니다.' };
  }
  return { valid: true, value: num };
}

// ---------------------------------------------------------------------------
// Profile Validators
// ---------------------------------------------------------------------------

function validateNickname(nickname) {
  if (nickname === undefined || nickname === null) {
    return { valid: true, value: null };
  }
  if (typeof nickname !== 'string') {
    return { valid: false, error: '닉네임은 문자열이어야 합니다.' };
  }
  const trimmed = nickname.trim();
  if (trimmed.length > 30) {
    return { valid: false, error: '닉네임은 30자 이내여야 합니다.' };
  }
  return { valid: true, value: trimmed || null };
}

function validateBio(bio) {
  if (bio === undefined || bio === null) {
    return { valid: true, value: null };
  }
  if (typeof bio !== 'string') {
    return { valid: false, error: '자기소개는 문자열이어야 합니다.' };
  }
  if (bio.length > 200) {
    return { valid: false, error: '자기소개는 200자 이내여야 합니다.' };
  }
  return { valid: true, value: bio.trim() || null };
}

function validateTheme(theme) {
  if (theme === undefined || theme === null) {
    return { valid: true };
  }
  if (theme !== 'light' && theme !== 'dark') {
    return { valid: false, error: '테마는 light 또는 dark만 가능합니다.' };
  }
  return { valid: true, value: theme };
}

function validateNotificationTime(time) {
  if (time === undefined || time === null) {
    return { valid: true, value: null };
  }
  if (typeof time !== 'string') {
    return { valid: false, error: '알림 시간은 HH:MM 형식이어야 합니다.' };
  }
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(time)) {
    return { valid: false, error: '알림 시간은 HH:MM 형식이어야 합니다 (예: 21:00).' };
  }
  return { valid: true, value: time + ':00' }; // Append seconds for TIME type
}

// ---------------------------------------------------------------------------
// AI Personalization Validators
// ---------------------------------------------------------------------------

const VALID_RESPONSE_LENGTHS = ['short', 'balanced', 'detailed'];
const VALID_ADVICE_STYLES = ['comfort', 'balanced', 'actionable'];
const VALID_PERSONA_PRESETS = ['none', 'gentle_friend', 'calm_coach', 'clear_reflector', 'cheerful_supporter', 'wise_elder', 'playful_buddy', 'mindful_guide'];

function validateResponseLength(length) {
  if (length === undefined || length === null) {
    return { valid: true };
  }
  if (typeof length !== 'string' || !VALID_RESPONSE_LENGTHS.includes(length)) {
    return { valid: false, error: '응답 길이는 short, balanced, detailed 중 하나여야 합니다.' };
  }
  return { valid: true, value: length };
}

function validateAdviceStyle(style) {
  if (style === undefined || style === null) {
    return { valid: true };
  }
  if (typeof style !== 'string' || !VALID_ADVICE_STYLES.includes(style)) {
    return { valid: false, error: '조언 스타일은 comfort, balanced, actionable 중 하나여야 합니다.' };
  }
  return { valid: true, value: style };
}

function validatePersonaPreset(preset) {
  if (preset === undefined || preset === null) {
    return { valid: true };
  }
  if (typeof preset !== 'string' || !VALID_PERSONA_PRESETS.includes(preset)) {
    return { valid: false, error: '유효하지 않은 페르소나 프리셋입니다.' };
  }
  return { valid: true, value: preset };
}

// ---------------------------------------------------------------------------
// Pagination Validators
// ---------------------------------------------------------------------------

function validatePagination(query) {
  const limit = Math.min(Math.max(parseInt(query.limit) || 20, 1), 100);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  return { limit, offset };
}

module.exports = {
  validateEmail,
  validatePassword,
  validateEntryText,
  validateConfidenceScore,
  validateNickname,
  validateBio,
  validateTheme,
  validateNotificationTime,
  validateResponseLength,
  validateAdviceStyle,
  validatePersonaPreset,
  validatePagination,
};
