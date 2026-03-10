// Shared mutable state — all modules import from here
export const state = {
  // Auth
  currentUser: null,
  accessToken: null,
  refreshToken: null,
  userProfile: null,

  // Entries
  allEntries: [],
  activeFilters: new Set(),
  currentPage: 1,
  filteredEntries: [],

  // Guest mode
  guestMode: false,

  // UI
  latestAnalysisResult: null,
  appInitialized: false,
  lastFocusedElement: null,

  // Calendar
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  calSelectedDate: null,

  // Dashboard
  activePeriod: 'all',

  // Onboarding
  onboardingStep: 1,
  selectedNotificationTime: null,
};

// Constants
export const PAGE_SIZE = 5;

export const GUEST_STORAGE_KEY = 'sentimind-guest-entries';
export const GUEST_MAX_ENTRIES = 10;
export const GUEST_MAX_DAYS = 7;

export const PERIOD_MAP = { '0': 'all', '7': '7d', '30': '30d', '90': '90d' };

export const STREAK_MILESTONES = [
  { days: 3, label: '3일 연속', badge: '🌱', desc: '새싹이 자라고 있어요' },
  { days: 7, label: '7일 연속', badge: '🌿', desc: '한 주를 완주했어요!' },
  { days: 14, label: '14일 연속', badge: '🌳', desc: '습관이 되어가고 있어요' },
  { days: 30, label: '30일 연속', badge: '🏆', desc: '한 달의 기록, 대단해요!' },
  { days: 50, label: '50일 연속', badge: '💎', desc: '반백의 기록!' },
  { days: 100, label: '100일 연속', badge: '👑', desc: '100일의 왕관을 씌워드려요' },
];

export const DOMAIN_EMOJI = {
  '\uB300\uC778\uAD00\uACC4': '\u{1F465}',
  '\uC9C1\uC7A5': '\u{1F4BC}',
  '\uD559\uC5C5': '\u{1F4DA}',
  '\uAC74\uAC15': '\u{1F3E5}',
  '\uC790\uAE30\uBC18\uC131': '\u{1FA9E}',
  '\uAE30\uD0C0': '\u{1F4AD}',
};
