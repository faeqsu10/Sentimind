import { state, resetState } from './state.js';
import { showError, showToast, getPasswordStrength, calculateStreak } from './utils.js';
import { fetchWithAuth, exportData } from './api.js';
import { requestNotificationPermission, scheduleReminder } from './reminder.js';

// Dependencies injected from app.js
let deps = {};
export function setupProfile(d) { deps = d; }

const profilePreferenceDraft = {
  responseLength: 'balanced',
  adviceStyle: 'balanced',
  personaPreset: 'none',
};

export function renderProfileScreen() {
  const avatarEl = document.getElementById('profileAvatar');
  const nicknameDisplay = document.getElementById('profileDisplayNickname');
  const emailDisplay = document.getElementById('profileDisplayEmail');
  const totalEntries = document.getElementById('profileTotalEntries');
  const profileStreakEl = document.getElementById('profileStreak');
  const joinDate = document.getElementById('profileJoinDate');
  const nicknameInput = document.getElementById('profile-nickname');
  const bioInput = document.getElementById('profile-bio');
  const bioCounter = document.getElementById('bioCharCount');

  if (state.userProfile) {
    const nickname = state.userProfile.nickname || (state.currentUser && state.currentUser.email) || '--';
    nicknameDisplay.textContent = nickname;
    emailDisplay.textContent = (state.currentUser && state.currentUser.email) || '';
    totalEntries.textContent = state.userProfile.total_entries || 0;
    avatarEl.textContent = nickname.charAt(0).toUpperCase();

    if (state.userProfile.created_at) {
      joinDate.textContent = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: 'short', day: 'numeric'
      }).format(new Date(state.userProfile.created_at));
    } else {
      joinDate.textContent = '--';
    }

    nicknameInput.value = state.userProfile.nickname || '';
    bioInput.value = state.userProfile.bio || '';

    if (bioCounter) {
      const len = (state.userProfile.bio || '').length;
      bioCounter.textContent = len + ' / 200';
      bioCounter.classList.toggle('near-limit', len >= 160 && len < 200);
      bioCounter.classList.toggle('at-limit', len >= 200);
    }

    const savedResponseLength = state.userProfile.response_length || 'balanced';
    profilePreferenceDraft.responseLength = savedResponseLength;
    document.querySelectorAll('.response-length-btn[data-response-length]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.responseLength === savedResponseLength ? 'true' : 'false');
    });

    const savedAdviceStyle = state.userProfile.advice_style || 'balanced';
    profilePreferenceDraft.adviceStyle = savedAdviceStyle;
    document.querySelectorAll('.advice-style-btn[data-advice-style]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.adviceStyle === savedAdviceStyle ? 'true' : 'false');
    });

    const savedPersonaPreset = state.userProfile.persona_preset || 'none';
    profilePreferenceDraft.personaPreset = savedPersonaPreset;
    document.querySelectorAll('.persona-preset-btn[data-persona-preset]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.personaPreset === savedPersonaPreset ? 'true' : 'false');
    });

    const savedTime = state.userProfile.notification_time || '';
    const notifEnabledToggle = document.getElementById('profileNotificationEnabled');
    if (notifEnabledToggle) {
      notifEnabledToggle.checked = !!state.userProfile.notification_enabled;
    }
    const notificationControlsDisabled = !state.userProfile.notification_enabled;
    document.querySelectorAll('.notification-time-btn[data-time]').forEach(btn => {
      btn.disabled = notificationControlsDisabled;
    });
    document.querySelectorAll('.notification-time-btn[data-time]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.time === savedTime ? 'true' : 'false');
    });
    const customTimeInput = document.getElementById('profile-notification-custom');
    if (customTimeInput) {
      customTimeInput.disabled = notificationControlsDisabled;
      const presetTimes = ['08:00', '12:00', '18:00', '21:00', '22:00'];
      if (savedTime && !presetTimes.includes(savedTime)) {
        customTimeInput.value = savedTime;
      } else {
        customTimeInput.value = '';
      }
    }
  } else if (state.currentUser) {
    nicknameDisplay.textContent = state.currentUser.email || '--';
    emailDisplay.textContent = state.currentUser.email || '';
    avatarEl.textContent = (state.currentUser.email || '?').charAt(0).toUpperCase();
  }

  // Streak
  if (profileStreakEl) {
    profileStreakEl.textContent = calculateStreak(state.allEntries);
  }
}

function resetSessionAndUI() {
  localStorage.removeItem('sb-access-token');
  localStorage.removeItem('sb-refresh-token');
  resetState();
  document.getElementById('historyList').innerHTML = '';
  document.getElementById('responseCard').hidden = true;
  document.getElementById('similarEntries').hidden = true;
  document.getElementById('historyDetail').hidden = true;
  document.getElementById('diary-text').value = '';
  document.getElementById('charCount').textContent = '';
  deps.showLanding();
}

export function initProfileEventListeners() {
  function bindSingleChoiceButtons(selector, draftKey, datasetKey) {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(selector).forEach(other => other.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        profilePreferenceDraft[draftKey] = btn.dataset[datasetKey];
      });
    });
  }

  // Bio character counter
  document.getElementById('profile-bio').addEventListener('input', function() {
    const counter = document.getElementById('bioCharCount');
    if (!counter) return;
    const len = this.value.length;
    counter.textContent = len + ' / 200';
    counter.classList.toggle('near-limit', len >= 160 && len < 200);
    counter.classList.toggle('at-limit', len >= 200);
  });

  bindSingleChoiceButtons('.response-length-btn[data-response-length]', 'responseLength', 'responseLength');
  bindSingleChoiceButtons('.advice-style-btn[data-advice-style]', 'adviceStyle', 'adviceStyle');
  bindSingleChoiceButtons('.persona-preset-btn[data-persona-preset]', 'personaPreset', 'personaPreset');

  // Notification time preset buttons
  document.querySelectorAll('.notification-time-btn[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.notification-time-btn[data-time]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      const customInput = document.getElementById('profile-notification-custom');
      if (customInput) customInput.value = '';
    });
  });

  const profileNotifCustom = document.getElementById('profile-notification-custom');
  if (profileNotifCustom) {
    profileNotifCustom.addEventListener('change', function() {
      if (this.value) {
        document.querySelectorAll('.notification-time-btn[data-time]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      }
    });
  }

  const profileNotifEnabled = document.getElementById('profileNotificationEnabled');
  if (profileNotifEnabled) {
    profileNotifEnabled.addEventListener('change', function() {
      const disabled = !this.checked;
      document.querySelectorAll('.notification-time-btn[data-time]').forEach(btn => {
        btn.disabled = disabled;
      });
      const customInput = document.getElementById('profile-notification-custom');
      if (customInput) customInput.disabled = disabled;
    });
  }

  // Password strength indicator
  document.getElementById('new-password').addEventListener('input', function() {
    const strengthEl = document.getElementById('profilePwStrength');
    if (strengthEl) {
      strengthEl.dataset.level = getPasswordStrength(this.value);
    }
  });

  // Profile form
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nicknameInput = document.getElementById('profile-nickname');
    const bioInput = document.getElementById('profile-bio');
    const profileMessage = document.getElementById('profileMessage');
    const saveBtn = document.getElementById('profileSaveBtn');

    profileMessage.hidden = true;
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';

    const responseLength = profilePreferenceDraft.responseLength || 'balanced';
    const adviceStyle = profilePreferenceDraft.adviceStyle || 'balanced';
    const personaPreset = profilePreferenceDraft.personaPreset || 'none';
    const notificationEnabled = !!document.getElementById('profileNotificationEnabled')?.checked;

    let notificationTime = null;
    const activePreset = document.querySelector('.notification-time-btn[data-time][aria-pressed="true"]');
    const customTimeInput = document.getElementById('profile-notification-custom');
    if (activePreset) {
      notificationTime = activePreset.dataset.time;
    } else if (customTimeInput && customTimeInput.value) {
      notificationTime = customTimeInput.value;
    }

    const patchBody = {
      nickname: nicknameInput.value.trim(),
      bio: bioInput.value.trim(),
      response_length: responseLength,
      advice_style: adviceStyle,
      persona_preset: personaPreset,
      notification_enabled: notificationEnabled,
    };
    if (notificationEnabled && notificationTime) {
      patchBody.notification_time = notificationTime;
    }

    if (notificationEnabled && !notificationTime) {
      profileMessage.textContent = '알림을 켜려면 시간을 선택해주세요.';
      profileMessage.className = 'profile-message error';
      profileMessage.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
      return;
    }

    try {
      if (notificationEnabled) {
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') {
          profileMessage.textContent = '브라우저 알림 권한이 필요합니다.';
          profileMessage.className = 'profile-message error';
          profileMessage.hidden = false;
          saveBtn.disabled = false;
          saveBtn.textContent = '저장';
          return;
        }
      }

      const res = await fetchWithAuth('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(patchBody),
      });

      if (res.ok) {
        const result = await res.json();
        const optimisticProfileState = {
          ...patchBody,
          notification_time: notificationEnabled
            ? ((patchBody.notification_time || state.userProfile?.notification_time || '').slice(0, 5) || null)
            : null,
        };
        if (result.data) {
          state.userProfile = { ...state.userProfile, ...optimisticProfileState, ...result.data };
        } else {
          state.userProfile = { ...state.userProfile, ...optimisticProfileState };
        }
        scheduleReminder();
        profileMessage.textContent = '프로필이 저장되었어요.';
        profileMessage.className = 'profile-message success';
        profileMessage.hidden = false;
        renderProfileScreen();
        deps.updateUserMenu();
      } else {
        const result = await res.json();
        profileMessage.textContent = result.error || '저장에 실패했습니다.';
        profileMessage.className = 'profile-message error';
        profileMessage.hidden = false;
      }
    } catch (err) {
      if (err.userMessage) {
        showError(err.userMessage);
        profileMessage.textContent = err.userMessage;
        profileMessage.className = 'profile-message error';
        profileMessage.hidden = false;
      } else {
        profileMessage.textContent = '서버에 연결할 수 없습니다.';
        profileMessage.className = 'profile-message error';
        profileMessage.hidden = false;
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  });

  // Data Export
  document.getElementById('exportCsvBtn').addEventListener('click', () => exportData('csv').catch(() => showError('이야기를 내보내지 못했어요.')));
  document.getElementById('exportJsonBtn').addEventListener('click', () => exportData('json').catch(() => showError('이야기를 내보내지 못했어요.')));

  // Password Change
  document.getElementById('passwordChangeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPass = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;
    const btn = document.getElementById('passwordChangeBtn');

    if (!currentPass) { showToast('현재 비밀번호를 입력해주세요.', 'error'); return; }
    if (newPass.length < 8) { showToast('새 비밀번호는 8자 이상이어야 합니다.', 'error'); return; }
    if (newPass !== confirmPass) { showToast('비밀번호가 일치하지 않습니다.', 'error'); return; }

    btn.disabled = true;
    btn.textContent = '변경 중...';
    try {
      const res = await fetchWithAuth('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      const result = await res.json();
      if (res.ok) {
        showToast('비밀번호가 변경되었어요.', 'success');
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        const strengthEl = document.getElementById('profilePwStrength');
        if (strengthEl) strengthEl.dataset.level = '';
      } else {
        showToast(result.error || '비밀번호 변경에 실패했습니다.', 'error');
      }
    } catch {
      showToast('서버에 연결할 수 없습니다.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '비밀번호 변경';
    }
  });

  // Account Deletion
  document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
    const password = prompt('회원탈퇴를 위해 비밀번호를 입력해주세요.');
    if (!password) return;

    const confirmed = confirm('정말 떠나시겠어요?\n그동안 나눈 모든 이야기가 사라지며, 되돌릴 수 없어요.');
    if (!confirmed) return;

    const btn = document.getElementById('deleteAccountBtn');
    btn.disabled = true;
    btn.textContent = '처리 중...';
    try {
      const res = await fetchWithAuth('/api/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) });
      if (res.ok) {
        alert('회원탈퇴가 완료되었습니다. 이용해주셔서 감사합니다.');
        resetSessionAndUI();
      } else {
        const result = await res.json();
        showError(result.error || '회원탈퇴에 실패했습니다.');
      }
    } catch {
      showError('서버에 연결할 수 없습니다.');
    } finally {
      btn.disabled = false;
      btn.textContent = '회원탈퇴';
    }
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } catch {
      // Always proceed
    }
    resetSessionAndUI();
  });
}
