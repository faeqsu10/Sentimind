import { state } from './state.js';
import { showToast } from './utils.js';

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
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw { userMessage: '요청 시간이 초과되었습니다. 다시 시도해주세요.' };
    }
    throw { userMessage: '네트워크 연결을 확인해주세요.' };
  } finally {
    clearTimeout(timeoutId);
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

export async function saveEntry(text, result) {
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
      confidence_score: result.ontology?.confidence || 0,
      related_emotions: result.ontology?.related_emotions || [],
    }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw { userMessage: data.error || '일기 저장에 실패했습니다.' };
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
  const response = await fetchWithAuth('/api/entries');
  if (!response.ok) throw new Error();
  return await response.json();
}

export async function toggleBookmarkAPI(entryId, newState) {
  const response = await fetchWithAuth('/api/entries/' + entryId, {
    method: 'PATCH',
    body: JSON.stringify({ is_bookmarked: newState }),
  });
  if (!response.ok) throw new Error();
}

export async function deleteEntryAPI(id) {
  const response = await fetchWithAuth('/api/entries/' + id, { method: 'DELETE' });
  if (!response.ok) throw new Error();
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
