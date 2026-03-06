// Main entry point — orchestrates all modules
import { state } from './state.js';
import { showToast, showError, showSkeleton, autoResize, openModalFocus, closeModalFocus } from './utils.js';
import { setAuthExpiredHandler, fetchWithAuth, fetchEntries, loadProfile } from './api.js';
import { setupAuth, checkAuth, initAuthForms } from './auth.js';
import { setupGuest, initDemoScreen, initDemoEventListeners, migrateGuestData } from './guest.js';
import { setupDiary, handleSubmit } from './diary.js';
import { setupHistory, renderHistory, showHistoryDetail, initHistoryEventListeners } from './history.js';
import { renderCalendar, setupCalendar } from './calendar.js';
import { loadDashboard, setupStats } from './stats.js';
import { updateSidebar, createConfetti, renderProfileBadges } from './sidebar.js';
import { setupProfile, renderProfileScreen, initProfileEventListeners } from './profile.js';

// ===== DOM Elements =====
const landingScreen = document.getElementById('landingScreen');
const authScreen = document.getElementById('authScreen');
const onboardingScreen = document.getElementById('onboardingScreen');
const appContainer = document.getElementById('appContainer');
const demoScreen = document.getElementById('demoScreen');

// ===== Screen Navigation =====
function setScreen(screen) {
  landingScreen.hidden = true;
  authScreen.hidden = true;
  onboardingScreen.hidden = true;
  appContainer.hidden = true;
  demoScreen.hidden = true;
  document.getElementById('welcomeScreen').hidden = true;
  switch (screen) {
    case 'landing': landingScreen.hidden = false; break;
    case 'auth': authScreen.hidden = false; break;
    case 'demo': demoScreen.hidden = false; break;
    case 'onboarding': onboardingScreen.hidden = false; break;
    case 'app': appContainer.hidden = false; break;
  }
}

let initialScreenSet = false;
function pushScreen(screen) {
  const current = history.state?.screen;
  if (current === screen) return;
  if (!initialScreenSet) {
    history.replaceState({ screen }, '', '');
    initialScreenSet = true;
  } else {
    history.pushState({ screen }, '', '');
  }
}

function showLanding(pushHistory = true) {
  setScreen('landing');
  if (pushHistory) pushScreen('landing');
}

function showAuthScreen(pushHistory = true) {
  setScreen('auth');
  if (pushHistory) pushScreen('auth');
  showAuthCard('login');
}

function showDemo(pushHistory = true) {
  state.guestMode = true;
  setScreen('demo');
  if (pushHistory) pushScreen('demo');
  initDemoScreen();
}

function showOnboarding(pushHistory = true) {
  setScreen('onboarding');
  if (pushHistory) pushScreen('onboarding');
  state.onboardingStep = 1;
  updateOnboardingUI();
}

function showApp(pushHistory = true) {
  state.guestMode = false;
  setScreen('app');
  if (pushHistory) pushScreen('app');
  updateUserMenu();
  initApp();
}

function showWelcomeScreen() {
  authScreen.hidden = true;
  onboardingScreen.hidden = true;
  appContainer.hidden = true;
  document.getElementById('welcomeScreen').hidden = false;
}

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
  const screen = e.state?.screen;
  if (!screen) { showLanding(false); return; }
  switch (screen) {
    case 'landing': showLanding(false); break;
    case 'auth': showAuthScreen(false); break;
    case 'demo': showDemo(false); break;
    case 'app':
      if (state.accessToken) { showApp(false); }
      else { showLanding(false); }
      break;
    default: showLanding(false);
  }
});

function showAuthCard(which) {
  document.getElementById('authLoginCard').hidden = which !== 'login';
  document.getElementById('authSignupCard').hidden = which !== 'signup';
  document.getElementById('authResetCard').hidden = which !== 'reset';
  ['loginMessage', 'signupMessage', 'resetMessage'].forEach(id => {
    const el = document.getElementById(id);
    el.hidden = true;
    el.textContent = '';
  });
}

function updateUserMenu() {
  const userMenu = document.getElementById('userMenu');
  const userMenuName = document.getElementById('userMenuName');
  if (state.currentUser) {
    userMenu.hidden = false;
    const displayName = (state.userProfile && state.userProfile.nickname) || state.currentUser.email || '';
    userMenuName.textContent = displayName;
  } else {
    userMenu.hidden = true;
  }
}

// ===== Onboarding =====
function updateOnboardingUI() {
  document.querySelectorAll('.onboarding-dot').forEach(dot => {
    const step = parseInt(dot.dataset.step);
    dot.classList.toggle('active', step === state.onboardingStep);
    dot.classList.toggle('completed', step < state.onboardingStep);
  });
  document.getElementById('onboardingProgress').setAttribute('aria-valuenow', state.onboardingStep);

  document.getElementById('onboardingStep1').hidden = state.onboardingStep !== 1;
  document.getElementById('onboardingStep2').hidden = state.onboardingStep !== 2;
  document.getElementById('onboardingStep3').hidden = state.onboardingStep !== 3;
}

document.getElementById('onboardingNext1').addEventListener('click', () => {
  state.onboardingStep = 2;
  updateOnboardingUI();
});

document.getElementById('onboardingNext2').addEventListener('click', () => {
  state.onboardingStep = 3;
  updateOnboardingUI();
});

document.getElementById('onboardingTimeSelect').addEventListener('click', (e) => {
  const btn = e.target.closest('.onboarding-time-btn');
  if (!btn) return;
  document.querySelectorAll('.onboarding-time-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
  btn.setAttribute('aria-pressed', 'true');
  state.selectedNotificationTime = btn.dataset.time;
});

async function completeOnboarding() {
  try {
    const updateData = { onboarding_completed: true };
    if (state.selectedNotificationTime) {
      updateData.notification_time = state.selectedNotificationTime;
      updateData.notification_enabled = true;
    }
    await fetchWithAuth('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  } catch {
    // Silently continue
  }
  await loadProfile();
  showApp();
}

document.getElementById('onboardingFinish').addEventListener('click', completeOnboarding);
document.getElementById('onboardingSkip3').addEventListener('click', completeOnboarding);

document.getElementById('welcomeStartBtn').addEventListener('click', () => {
  document.getElementById('welcomeScreen').hidden = true;
  showOnboarding();
});

// ===== Init App =====
function initApp() {
  if (state.appInitialized) return;
  state.appInitialized = true;

  const todayDate = document.getElementById('todayDate');
  const diaryText = document.getElementById('diary-text');
  const submitBtn = document.getElementById('submitBtn');
  const charCount = document.getElementById('charCount');
  const diaryForm = document.getElementById('diaryForm');

  const now = new Date();
  todayDate.textContent = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  }).format(now);
  todayDate.setAttribute('datetime', now.toISOString().split('T')[0]);

  loadEntries();
  renderProfileScreen();
  updateSidebar();

  if (!diaryText._listenerAttached) {
    diaryText.addEventListener('input', () => {
      submitBtn.disabled = diaryText.value.trim().length === 0;
      autoResize(diaryText);
      const len = diaryText.value.length;
      const max = parseInt(diaryText.getAttribute('maxlength'), 10);
      charCount.textContent = len > 0 ? len + '/' + max : '';
      charCount.className = 'char-count' + (len >= max - 20 ? ' warn' : '');
    });
    diaryForm.addEventListener('submit', handleSubmit);

    const expandBtn = document.getElementById('expandBtn');
    expandBtn.addEventListener('click', () => {
      const expanded = diaryText.classList.toggle('expanded');
      expandBtn.classList.toggle('active', expanded);
      expandBtn.textContent = expanded ? '축소' : '확장';
      autoResize(diaryText);
    });

    diaryText._listenerAttached = true;
  }
}

// ===== Load Entries (coordination) =====
async function loadEntries() {
  const historyList = document.getElementById('historyList');
  historyList.setAttribute('aria-busy', 'true');
  showSkeleton('entries');
  try {
    const entries = await fetchEntries();
    renderHistory(entries);
  } catch (err) {
    renderHistory([]);
    if (!err.userMessage) showError('일기 목록을 불러올 수 없습니다.');
  } finally {
    historyList.removeAttribute('aria-busy');
  }
}

// ===== Tab Navigation =====
const tabDiary = document.getElementById('tab-diary');
const tabCalendar = document.getElementById('tab-calendar');
const tabDashboard = document.getElementById('tab-dashboard');
const tabProfile = document.getElementById('tab-profile');
const panelDiary = document.getElementById('panel-diary');
const panelCalendar = document.getElementById('panel-calendar');
const panelDashboard = document.getElementById('panel-dashboard');
const panelProfile = document.getElementById('panel-profile');

function switchTab(activeTab) {
  const tabs = [tabDiary, tabCalendar, tabDashboard, tabProfile];
  const panels = [panelDiary, panelCalendar, panelDashboard, panelProfile];

  tabs.forEach((tab, i) => {
    const isActive = tab === activeTab;
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
    panels[i].hidden = !isActive;
    if (isActive) {
      panels[i].style.animation = 'none';
      requestAnimationFrame(() => { panels[i].style.animation = ''; });

      requestAnimationFrame(() => {
        const focusTarget = panels[i].querySelector(
          'textarea, input:not([type="hidden"]), button:not([disabled]), [tabindex="0"]'
        );
        if (focusTarget && focusTarget.offsetParent !== null) {
          focusTarget.focus({ preventScroll: true });
        }
      });
    }
  });

  if (activeTab === tabCalendar) renderCalendar();
  if (activeTab === tabDashboard) loadDashboard();
  if (activeTab === tabProfile) renderProfileScreen();
}

tabDiary.addEventListener('click', () => switchTab(tabDiary));
tabCalendar.addEventListener('click', () => switchTab(tabCalendar));
tabDashboard.addEventListener('click', () => switchTab(tabDashboard));
tabProfile.addEventListener('click', () => switchTab(tabProfile));

[tabDiary, tabCalendar, tabDashboard, tabProfile].forEach((tab, idx, arr) => {
  tab.addEventListener('keydown', (e) => {
    let target = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      target = arr[(idx + 1) % arr.length];
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      target = arr[(idx - 1 + arr.length) % arr.length];
    }
    if (target) {
      e.preventDefault();
      target.focus();
      switchTab(target);
    }
  });
});

document.getElementById('btnUserMenu').addEventListener('click', () => {
  switchTab(tabProfile);
});

// ===== Dark Mode =====
const darkToggle = document.getElementById('darkModeToggle');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  darkToggle.checked = theme === 'dark';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#1a1a2e' : '#FFF8F0';
}

const savedTheme = localStorage.getItem('sentimind-theme');
if (savedTheme) applyTheme(savedTheme);

// Apply server theme after profile load (called from loadProfile callback)
function applyServerTheme() {
  if (state.userProfile && state.userProfile.theme && !localStorage.getItem('sentimind-theme')) {
    applyTheme(state.userProfile.theme);
  }
}

darkToggle.addEventListener('change', async () => {
  const theme = darkToggle.checked ? 'dark' : 'light';
  applyTheme(theme);
  localStorage.setItem('sentimind-theme', theme);
  if (state.accessToken) {
    try { await fetchWithAuth('/api/profile', { method: 'PATCH', body: JSON.stringify({ theme }) }); } catch {}
  }
});

// ===== Legal Modals =====
const legalContents = {
  privacy: {
    title: '개인정보처리방침',
    body: `
      <h3>1. 수집하는 개인정보</h3>
      <p>Sentimind는 서비스 제공을 위해 다음 정보를 수집합니다.</p>
      <ul>
        <li><strong>필수 항목</strong>: 이메일 주소, 비밀번호(암호화 저장)</li>
        <li><strong>선택 항목</strong>: 닉네임</li>
        <li><strong>자동 수집</strong>: 일기 작성 내용, 감정 분석 결과, 서비스 이용 기록</li>
      </ul>
      <h3>2. 개인정보의 이용 목적</h3>
      <ul>
        <li>회원 식별 및 인증</li>
        <li>AI 감정 분석 서비스 제공</li>
        <li>감정 통계 및 대시보드 제공</li>
        <li>서비스 개선 및 안정적 운영</li>
      </ul>
      <h3>3. 개인정보의 보유 및 파기</h3>
      <p>회원 탈퇴 시 모든 개인정보(일기 데이터 포함)는 즉시 삭제됩니다. 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 별도 보관 후 파기합니다.</p>
      <h3>4. 개인정보의 제3자 제공</h3>
      <p>Sentimind는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 감정 분석을 위해 일기 텍스트가 Google Gemini API로 전송되며, 이는 분석 목적으로만 사용되고 별도 저장되지 않습니다.</p>
      <h3>5. 이용자의 권리</h3>
      <ul>
        <li>개인정보 열람, 수정, 삭제 요청 (프로필 설정에서 직접 가능)</li>
        <li>데이터 내보내기 (CSV/JSON 형식)</li>
        <li>회원 탈퇴를 통한 전체 데이터 삭제</li>
      </ul>
      <h3>6. 개인정보 보호 조치</h3>
      <p>비밀번호 암호화, HTTPS 통신, Row-Level Security 정책을 통해 개인정보를 보호합니다.</p>
      <h3>7. 문의</h3>
      <p>개인정보 관련 문의는 서비스 내 프로필에 등록된 이메일로 연락해 주시기 바랍니다.</p>
    `
  },
  terms: {
    title: '이용약관',
    body: `
      <h3>제1조 (목적)</h3>
      <p>이 약관은 Sentimind(이하 "서비스")의 이용 조건 및 절차에 관한 사항을 규정합니다.</p>
      <h3>제2조 (서비스 내용)</h3>
      <p>서비스는 사용자가 작성한 일기를 AI로 분석하여 감정을 파악하고, 공감 메시지를 제공하는 웹 애플리케이션입니다.</p>
      <ul>
        <li>일기 작성 및 저장 (최대 500자)</li>
        <li>AI 기반 감정 분석 및 공감 메시지</li>
        <li>감정 통계 대시보드</li>
        <li>데이터 내보내기</li>
      </ul>
      <h3>제3조 (회원가입 및 탈퇴)</h3>
      <p>이메일 인증을 통해 회원가입하며, 언제든 프로필 설정에서 회원탈퇴가 가능합니다. 탈퇴 시 모든 데이터는 즉시 삭제되며 복구할 수 없습니다.</p>
      <h3>제4조 (이용자의 의무)</h3>
      <ul>
        <li>타인의 개인정보를 도용하지 않을 것</li>
        <li>서비스의 정상적 운영을 방해하지 않을 것</li>
        <li>불법적이거나 부적절한 콘텐츠를 작성하지 않을 것</li>
      </ul>
      <h3>제5조 (서비스 제공의 제한)</h3>
      <p>서비스는 무료로 제공되며, 시스템 점검이나 기술적 사유로 일시 중단될 수 있습니다. AI 분석 결과는 참고용이며, 전문적인 심리 상담을 대체하지 않습니다.</p>
      <h3>제6조 (면책)</h3>
      <p>AI가 생성한 감정 분석 및 메시지는 참고 목적이며, 의학적·심리학적 조언이 아닙니다. 서비스 이용으로 인한 결과에 대해 법적 책임을 지지 않습니다.</p>
      <h3>제7조 (약관 변경)</h3>
      <p>약관이 변경될 경우 서비스 내 공지를 통해 안내합니다.</p>
    `
  }
};

function openLegalModal(type) {
  const content = legalContents[type];
  if (!content) return;
  const overlay = document.getElementById('legalModal');
  const modal = overlay.querySelector('.legal-modal');
  document.getElementById('legalModalTitle').textContent = content.title;
  document.getElementById('legalModalBody').innerHTML = content.body;
  overlay.hidden = false;
  openModalFocus(overlay, modal);
}

function closeLegalModal() {
  const overlay = document.getElementById('legalModal');
  const modal = overlay.querySelector('.legal-modal');
  overlay.hidden = true;
  closeModalFocus(overlay, modal);
}

document.getElementById('privacyLink').addEventListener('click', (e) => {
  e.preventDefault();
  openLegalModal('privacy');
});
document.getElementById('termsLink').addEventListener('click', (e) => {
  e.preventDefault();
  openLegalModal('terms');
});
document.getElementById('legalModalClose').addEventListener('click', closeLegalModal);
document.getElementById('legalModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeLegalModal();
});

// ===== Keyboard Shortcuts =====
const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const modLabel = isMac ? 'Cmd' : 'Ctrl';

const shortcutHelpBtn = document.getElementById('shortcutHelpBtn');
const shortcutModal = document.getElementById('shortcutModal');
const shortcutModalClose = document.getElementById('shortcutModalClose');

const shortcuts = [
  { keys: [modLabel, 'Enter'], desc: '일기 분석 제출' },
  { keys: [modLabel, '1'], desc: '일기 탭으로 이동' },
  { keys: [modLabel, '2'], desc: '달력 탭으로 이동' },
  { keys: [modLabel, '3'], desc: '통계 탭으로 이동' },
  { keys: [modLabel, '4'], desc: '프로필 탭으로 이동' },
  { keys: [modLabel, 'D'], desc: '다크 모드 전환' },
  { keys: [modLabel, 'N'], desc: '새 일기 작성' },
  { keys: ['Esc'], desc: '모달 닫기' },
];

function renderShortcutList() {
  const list = document.getElementById('shortcutList');
  list.innerHTML = shortcuts.map(s => {
    const keysHtml = s.keys
      .map(k => `<kbd>${k}</kbd>`)
      .join('<span class="shortcut-sep">+</span>');
    return `<li><span>${s.desc}</span><span class="shortcut-keys">${keysHtml}</span></li>`;
  }).join('');
  document.getElementById('shortcutModalFooter').textContent =
    isMac ? 'Mac: Cmd 키 사용' : 'Windows/Linux: Ctrl 키 사용';
}

function openShortcutModal() {
  renderShortcutList();
  const overlay = shortcutModal;
  const modal = overlay.querySelector('.shortcut-modal');
  overlay.hidden = false;
  openModalFocus(overlay, modal);
}

function closeShortcutModal() {
  const overlay = shortcutModal;
  const modal = overlay.querySelector('.shortcut-modal');
  overlay.hidden = true;
  closeModalFocus(overlay, modal);
}

if (isMac) {
  const hint = document.getElementById('submitShortcutHint');
  if (hint) hint.innerHTML = '<kbd>Cmd</kbd>+<kbd>Enter</kbd> 전송';
}

shortcutHelpBtn.addEventListener('click', openShortcutModal);
shortcutModalClose.addEventListener('click', closeShortcutModal);
shortcutModal.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeShortcutModal();
});

function isTyping() {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
}

document.addEventListener('keydown', (e) => {
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const otherMod = isMac ? e.ctrlKey : e.metaKey;
  const diaryText = document.getElementById('diary-text');
  const diaryForm = document.getElementById('diaryForm');
  const submitBtn = document.getElementById('submitBtn');
  const historyDetail = document.getElementById('historyDetail');

  if (mod && !otherMod && e.key === 'Enter' && !appContainer.hidden) {
    const text = diaryText.value.trim();
    if (text && !submitBtn.disabled) {
      e.preventDefault();
      diaryForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
    return;
  }

  if (e.key === 'Escape') {
    if (!shortcutModal.hidden) {
      closeShortcutModal();
    } else if (!document.getElementById('legalModal').hidden) {
      closeLegalModal();
    } else if (!historyDetail.hidden) {
      historyDetail.hidden = true;
    }
    return;
  }

  if (!mod || otherMod || e.altKey) return;
  if (isTyping()) return;
  if (appContainer.hidden) return;

  const tabMap = { '1': tabDiary, '2': tabCalendar, '3': tabDashboard, '4': tabProfile };

  if (tabMap[e.key]) {
    e.preventDefault();
    switchTab(tabMap[e.key]);
    return;
  }

  if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    darkToggle.checked = !darkToggle.checked;
    darkToggle.dispatchEvent(new Event('change'));
    return;
  }

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    switchTab(tabDiary);
    diaryText.value = '';
    diaryText.focus();
    return;
  }
});

// ===== Landing: Button handlers =====
document.getElementById('landingStartBtn').addEventListener('click', () => {
  showAuthScreen();
});
document.getElementById('landingSignupBtn').addEventListener('click', () => {
  showAuthScreen();
  showAuthCard('signup');
});
document.getElementById('landingDemoBtn').addEventListener('click', () => {
  showDemo();
});

// ===== Landing: FAQ accordion =====
document.querySelectorAll('.landing-faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.landing-faq-item');
    const isOpen = item.classList.contains('active');

    document.querySelectorAll('.landing-faq-item.active').forEach(openItem => {
      openItem.classList.remove('active');
      openItem.querySelector('.landing-faq-question').setAttribute('aria-expanded', 'false');
    });

    if (!isOpen) {
      item.classList.add('active');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

// ===== Global Error Handlers =====
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', { message, source, lineno, colno, error });
  showToast('예기치 않은 오류가 발생했습니다. 페이지를 새로고침해주세요.', 'error');
  return true;
};

window.onunhandledrejection = function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  const msg = (event.reason && event.reason.userMessage)
    ? event.reason.userMessage
    : '요청을 처리하는 중 오류가 발생했습니다.';
  showToast(msg, 'error');
  event.preventDefault();
};

// ===== PWA Service Worker =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});

  window.addEventListener('online', () => {
    navigator.serviceWorker.controller?.postMessage('SYNC_OFFLINE');
  });

  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'OFFLINE_SYNC_COMPLETE') {
      showError(`오프라인 일기 ${e.data.count}건이 동기화되었습니다.`);
      loadEntries();
    }
  });
}

// ===== Wire dependencies =====
const sharedDeps = {
  showAuthScreen,
  showAuthCard,
  showApp,
  showOnboarding,
  showWelcomeScreen,
  showLanding,
  showDemo,
  loadEntries,
  updateSidebar,
  createConfetti,
  showHistoryDetail,
  updateUserMenu,
  migrateGuestData,
  initApp,
};

setAuthExpiredHandler(showAuthScreen);
setupAuth(sharedDeps);
setupGuest(sharedDeps);
setupDiary(sharedDeps);
setupHistory(sharedDeps);
setupProfile(sharedDeps);

// ===== Init event listeners =====
initAuthForms();
initDemoEventListeners();
initHistoryEventListeners();
initProfileEventListeners();
setupCalendar();
setupStats();

// ===== Start =====
checkAuth();
