import { state } from './state.js';
import { showToast } from './utils.js';
import { reportApiError } from './error-reporter.js';

// Callback set by app.js to handle auth expiration
let onAuthExpired = null;
export function setAuthExpiredHandler(handler) { onAuthExpired = handler; }

const DEFAULT_TIMEOUT = 30000; // 30초

export async function fetchWithAuth(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.accessToken && { 'Authorization': 'Bearer ' + state.accessToken }),
    ...options.headers,
  };

  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw { userMessage: '요청 시간이 초과되었습니다. 다시 시도해주세요.' };
    }
    throw { userMessage: '네트워크 연결을 확인해주세요.' };
  } finally {
    clearTimeout(timeoutId);
  }

  // 5xx 에러 자동 리포트
  if (response.status >= 500) {
    reportApiError(response, url);
  }

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = 'Bearer ' + state.accessToken;
      const retryController = new AbortController();
      const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);
      try {
        const retryResponse = await fetch(url, { ...options, headers, signal: retryController.signal });
        clearTimeout(retryTimeoutId);
        if (retryResponse.status === 401) {
          clearAuthState();
          throw { userMessage: '세션이 만료되었습니다. 다시 로그인해주세요.' };
        }
        return retryResponse;
      } catch (err) {
        clearTimeout(retryTimeoutId);
        if (err.userMessage) throw err;
        throw { userMessage: '네트워크 연결을 확인해주세요.' };
      }
    }
    clearAuthState();
    throw { userMessage: '세션이 만료되었습니다. 다시 로그인해주세요.' };
  }
  return response;
}

function clearAuthState() {
  localStorage.removeItem('sb-access-token');
  localStorage.removeItem('sb-refresh-token');
  state.currentUser = null;
  state.accessToken = null;
  state.refreshToken = null;
  if (onAuthExpired) onAuthExpired();
}

export async function tryRefreshToken() {
  if (!state.refreshToken) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: state.refreshToken }),
    });
    if (!res.ok) return false;
    const result = await res.json();
    if (result.data && result.data.session) {
      state.accessToken = result.data.session.access_token;
      state.refreshToken = result.data.session.refresh_token;
      localStorage.setItem('sb-access-token', state.accessToken);
      localStorage.setItem('sb-refresh-token', state.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function analyzeEmotion(text) {
  let response;
  try {
    response = await fetchWithAuth('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ text }),
      timeout: 60000, // Gemini API는 응답이 느릴 수 있음
    });
  } catch (e) {
    if (e.userMessage) throw e;
    throw { userMessage: '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.' };
  }

  let data;
  try { data = await response.json(); }
  catch { throw { userMessage: '서버 응답을 처리할 수 없습니다. 다시 시도해주세요.' }; }
  if (!response.ok) {
    throw { userMessage: data.error || '서버 오류가 발생했습니다.' };
  }
  return data;
}

export async function saveEntry(text, result, activityTags = []) {
  const response = await fetchWithAuth('/api/entries', {
    method: 'POST',
    body: JSON.stringify({
      text,
      emotion: result.emotion,
      emoji: result.emoji,
      message: result.message,
      advice: result.advice,
      emotion_hierarchy: result.ontology?.emotion_hierarchy || {},
      situation_context: result.ontology?.situation_context || [],
      confidence_score: result.ontology?.confidence ?? 0,
      related_emotions: result.ontology?.related_emotions || [],
      activity_tags: activityTags,
      crisis_detected: result.crisis_detected || false,
      tz_offset: new Date().getTimezoneOffset(),
    }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw { userMessage: data.error || '일기 저장에 실패했습니다.' };
  }
  return await response.json();
}

export async function fetchFollowup(stage, emotion, originalText, userReply, context) {
  const response = await fetchWithAuth('/api/followup', {
    method: 'POST',
    body: JSON.stringify({ stage, emotion, originalText, userReply, context }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw { userMessage: data.error || '후속 질문을 불러오지 못했어요.' };
  }
  return await response.json();
}

export async function submitFeedback(entryId, rating) {
  const response = await fetchWithAuth('/api/entries/' + entryId + '/feedback', {
    method: 'PATCH',
    body: JSON.stringify({ rating }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw { userMessage: data.error || '피드백 저장에 실패했습니다.' };
  }
  return await response.json();
}

export async function fetchEntries() {
  // 모든 항목을 가져오기 위해 페이지네이션 루프 (기본 limit=20이므로 누락 방지)
  const PAGE_LIMIT = 100;
  let allEntries = [];
  let offset = 0;

  while (true) {
    const response = await fetchWithAuth(`/api/entries?limit=${PAGE_LIMIT}&offset=${offset}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw { userMessage: data.error || '일기 목록을 불러오지 못했습니다.' };
    }
    const entries = await response.json(); // 백엔드가 배열 직접 반환
    allEntries = allEntries.concat(entries);
    if (entries.length < PAGE_LIMIT) break; // 마지막 페이지
    offset += PAGE_LIMIT;
  }

  return allEntries;
}

export async function toggleBookmarkAPI(entryId, newState) {
  const response = await fetchWithAuth('/api/entries/' + entryId, {
    method: 'PATCH',
    body: JSON.stringify({ is_bookmarked: newState }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw { userMessage: data.error || '즐겨찾기 변경에 실패했습니다.' };
  }
}

export async function deleteEntryAPI(id) {
  const response = await fetchWithAuth('/api/entries/' + id, { method: 'DELETE' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw { userMessage: data.error || '삭제에 실패했습니다.' };
  }
}

export async function loadProfile() {
  try {
    const res = await fetchWithAuth('/api/profile');
    if (res.ok) {
      const result = await res.json();
      state.userProfile = result.data || null;
    }
  } catch {
    state.userProfile = null;
  }
}

export async function exportData(format) {
  const res = await fetchWithAuth('/api/export?format=' + format);
  if (!res.ok) throw new Error();
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sentimind-export.' + format;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchIllustratedDiary(text, emotion, emoji) {
  const response = await fetchWithAuth('/api/illustrated-diary', {
    method: 'POST',
    body: JSON.stringify({ text, emotion, emoji }),
    timeout: 60000,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw { userMessage: data.error || '그림일기를 만들지 못했어요.' };
  }
  return await response.json();
}
