import { state } from './state.js';
import { showError, isValidEmail, getPasswordStrength } from './utils.js';
import { fetchWithAuth, tryRefreshToken, loadProfile } from './api.js';
import { track } from './analytics.js';

// Dependencies injected from app.js
let deps = {};
export function setupAuth(d) { deps = d; }

export async function handleAuthRedirect() {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return false;

  const params = new URLSearchParams(hash.substring(1));
  const error = params.get('error');
  if (error) {
    history.replaceState(null, '', window.location.pathname);
    const errorMessages = {
      'otp_expired': '인증 링크가 만료되었습니다. 다시 회원가입하거나 로그인하여 새 인증 메일을 받아주세요.',
      'access_denied': '인증 링크가 유효하지 않거나 만료되었습니다.',
    };
    const errorCode = params.get('error_code') || error;
    const msg = errorMessages[errorCode] || params.get('error_description') || '인증 처리 중 오류가 발생했습니다.';
    deps.showAuthScreen();
    setTimeout(() => showError(msg), 300);
    return true;
  }

  if (!hash.includes('access_token')) return false;

  const token = params.get('access_token');
  const refresh = params.get('refresh_token');
  const type = params.get('type');

  if (!token) return false;

  history.replaceState(null, '', window.location.pathname);

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      const result = await res.json();
      if (result.data && result.data.id) {
        state.currentUser = result.data;
        state.accessToken = token;
        state.refreshToken = refresh;
        localStorage.setItem('sb-access-token', token);
        if (refresh) localStorage.setItem('sb-refresh-token', refresh);

        if (type === 'signup') {
          deps.showWelcomeScreen();
          return true;
        }
        await loadProfile();
        if (state.userProfile && !state.userProfile.onboarding_completed) {
          deps.showOnboarding();
        } else {
          deps.showApp();
        }
        return true;
      }
    }
  } catch {
    // Fall through
  }
  return false;
}

export async function checkAuth() {
  const handled = await handleAuthRedirect();
  if (handled) return;

  const token = localStorage.getItem('sb-access-token');
  const refresh = localStorage.getItem('sb-refresh-token');
  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res.ok) {
        const result = await res.json();
        if (result.data && result.data.id) {
          state.currentUser = result.data;
          state.accessToken = token;
          state.refreshToken = refresh;
          await loadProfile();
          if (state.userProfile && !state.userProfile.onboarding_completed) {
            deps.showOnboarding();
          } else {
            deps.showApp();
          }
          return;
        }
      }
      // Access token expired — try refresh
      if (refresh) {
        state.refreshToken = refresh;
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          const retryRes = await fetch('/api/auth/me', {
            headers: { 'Authorization': 'Bearer ' + state.accessToken }
          });
          if (retryRes.ok) {
            const retryResult = await retryRes.json();
            if (retryResult.data && retryResult.data.id) {
              state.currentUser = retryResult.data;
              await loadProfile();
              if (state.userProfile && !state.userProfile.onboarding_completed) {
                deps.showOnboarding();
              } else {
                deps.showApp();
              }
              return;
            }
          }
        }
      }
    } catch {
      // Fall through to showLanding
    }
    localStorage.removeItem('sb-access-token');
    localStorage.removeItem('sb-refresh-token');
  }
  deps.showLanding();
}

export function initAuthForms() {
  // Login form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const emailError = document.getElementById('login-email-error');
    const passwordError = document.getElementById('login-password-error');
    const loginMessage = document.getElementById('loginMessage');
    const loginBtn = document.getElementById('loginBtn');

    emailError.textContent = '';
    passwordError.textContent = '';
    emailInput.removeAttribute('aria-invalid');
    passwordInput.removeAttribute('aria-invalid');
    loginMessage.hidden = true;

    let valid = true;
    if (!emailInput.value.trim()) {
      emailError.textContent = '이메일을 입력해주세요.';
      emailInput.setAttribute('aria-invalid', 'true');
      valid = false;
    } else if (!isValidEmail(emailInput.value.trim())) {
      emailError.textContent = '올바른 이메일 형식이 아닙니다.';
      emailInput.setAttribute('aria-invalid', 'true');
      valid = false;
    }
    if (!passwordInput.value) {
      passwordError.textContent = '비밀번호를 입력해주세요.';
      passwordInput.setAttribute('aria-invalid', 'true');
      valid = false;
    }
    if (!valid) return;

    loginBtn.disabled = true;
    loginBtn.textContent = '일기장 여는 중...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        loginMessage.textContent = result.error || '로그인에 실패했습니다.';
        loginMessage.className = 'auth-message error';
        loginMessage.hidden = false;
        return;
      }

      state.currentUser = result.data.user;
      state.accessToken = result.data.session.access_token;
      state.refreshToken = result.data.session.refresh_token;
      localStorage.setItem('sb-access-token', state.accessToken);
      localStorage.setItem('sb-refresh-token', state.refreshToken);

      await loadProfile();
      await deps.migrateGuestData();
      if (state.userProfile && !state.userProfile.onboarding_completed) {
        deps.showOnboarding();
      } else {
        deps.showApp();
      }
    } catch (err) {
      loginMessage.textContent = '서버에 연결할 수 없습니다.';
      loginMessage.className = 'auth-message error';
      loginMessage.hidden = false;
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = '로그인';
    }
  });

  // Signup form
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('signup-email');
    const nicknameInput = document.getElementById('signup-nickname');
    const passwordInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-password-confirm');
    const emailError = document.getElementById('signup-email-error');
    const passwordError = document.getElementById('signup-password-error');
    const confirmError = document.getElementById('signup-confirm-error');
    const signupMessage = document.getElementById('signupMessage');
    const signupBtn = document.getElementById('signupBtn');

    emailError.textContent = '';
    passwordError.textContent = '';
    confirmError.textContent = '';
    emailInput.removeAttribute('aria-invalid');
    passwordInput.removeAttribute('aria-invalid');
    confirmInput.removeAttribute('aria-invalid');
    signupMessage.hidden = true;

    let valid = true;
    if (!emailInput.value.trim()) {
      emailError.textContent = '이메일을 입력해주세요.';
      emailInput.setAttribute('aria-invalid', 'true');
      valid = false;
    } else if (!isValidEmail(emailInput.value.trim())) {
      emailError.textContent = '올바른 이메일 형식이 아닙니다.';
      emailInput.setAttribute('aria-invalid', 'true');
      valid = false;
    }
    if (!passwordInput.value || passwordInput.value.length < 8) {
      passwordError.textContent = '비밀번호는 8자 이상이어야 합니다.';
      passwordInput.setAttribute('aria-invalid', 'true');
      valid = false;
    }
    if (passwordInput.value !== confirmInput.value) {
      confirmError.textContent = '비밀번호가 일치하지 않습니다.';
      confirmInput.setAttribute('aria-invalid', 'true');
      valid = false;
    }
    if (!valid) return;

    signupBtn.disabled = true;
    signupBtn.textContent = '일기장 만드는 중...';

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value,
          nickname: nicknameInput.value.trim() || undefined,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        signupMessage.textContent = result.error || '회원가입에 실패했습니다.';
        signupMessage.className = 'auth-message error';
        signupMessage.hidden = false;
        return;
      }

      // E-06: signup_completed
      const guestEntries = JSON.parse(localStorage.getItem('sentimind-guest-entries') || '[]');
      track('signup_completed', {
        has_nickname: !!(nicknameInput.value.trim()),
        had_guest_data: guestEntries.length > 0,
        email_verification_required: !result.data.session,
      });

      if (result.data.session) {
        state.currentUser = result.data.user;
        state.accessToken = result.data.session.access_token;
        state.refreshToken = result.data.session.refresh_token;
        localStorage.setItem('sb-access-token', state.accessToken);
        localStorage.setItem('sb-refresh-token', state.refreshToken);
        await deps.migrateGuestData();
        deps.showOnboarding();
      } else {
        signupMessage.textContent = result.message || '인증 이메일을 보내드렸어요. 메일함을 확인해주세요.';
        signupMessage.className = 'auth-message success';
        signupMessage.hidden = false;
      }
    } catch (err) {
      signupMessage.textContent = '서버에 연결할 수 없습니다.';
      signupMessage.className = 'auth-message error';
      signupMessage.hidden = false;
    } finally {
      signupBtn.disabled = false;
      signupBtn.textContent = '일기장 만들기';
    }
  });

  // Password reset form
  document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('reset-email');
    const emailError = document.getElementById('reset-email-error');
    const resetMessage = document.getElementById('resetMessage');
    const resetBtn = document.getElementById('resetBtn');

    emailError.textContent = '';
    emailInput.removeAttribute('aria-invalid');
    resetMessage.hidden = true;

    if (!emailInput.value.trim() || !isValidEmail(emailInput.value.trim())) {
      emailError.textContent = '올바른 이메일 주소를 입력해주세요.';
      emailInput.setAttribute('aria-invalid', 'true');
      return;
    }

    resetBtn.disabled = true;
    resetBtn.textContent = '메일 보내는 중...';

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.value.trim() }),
      });
      const result = await res.json();
      resetMessage.textContent = (result.data && result.data.message) || '해당 이메일로 재설정 링크를 보내드렸어요.';
      resetMessage.className = 'auth-message success';
      resetMessage.hidden = false;
    } catch {
      resetMessage.textContent = '서버에 연결할 수 없습니다.';
      resetMessage.className = 'auth-message error';
      resetMessage.hidden = false;
    } finally {
      resetBtn.disabled = false;
      resetBtn.textContent = '재설정 링크 보내기';
    }
  });

  // Password strength indicator
  document.getElementById('signup-password').addEventListener('input', (e) => {
    document.getElementById('passwordStrength').setAttribute('data-level', getPasswordStrength(e.target.value));
  });

  // Auth card navigation
  document.getElementById('showSignupBtn').addEventListener('click', () => deps.showAuthCard('signup'));
  document.getElementById('showLoginFromSignupBtn').addEventListener('click', () => deps.showAuthCard('login'));
  document.getElementById('showResetBtn').addEventListener('click', () => deps.showAuthCard('reset'));
  document.getElementById('showLoginFromResetBtn').addEventListener('click', () => deps.showAuthCard('login'));
}
