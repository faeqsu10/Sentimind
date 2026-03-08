// Smart Reminder — Browser Notification API integration
import { state } from './state.js';
import { track } from './analytics.js';
import { toLocalDateStr, todayLocalStr } from './utils.js';

let _reminderTimer = null;

const REMINDER_MESSAGES = [
  { icon: '🌸', text: '오늘의 마음을 기록해볼까요?' },
  { icon: '📝', text: '한 줄이면 충분해요. 오늘 하루 어땠나요?' },
  { icon: '💭', text: '마음이가 기다리고 있어요' },
  { icon: '🌿', text: '잠깐 멈추고, 마음을 들여다봐요' },
  { icon: '✨', text: '오늘도 마음을 돌보는 시간을 가져볼까요?' },
  { icon: '🫂', text: '당신의 이야기를 듣고 싶어요' },
  { icon: '🌙', text: '하루를 마무리하며 마음을 정리해봐요' },
  { icon: '☀️', text: '좋은 아침! 오늘의 첫 마음을 적어볼까요?' },
];

// Context-aware message selection
function pickReminderMessage() {
  const hour = new Date().getHours();
  const entries = state.allEntries || [];
  const streak = state.userProfile?.current_streak || 0;

  // Morning (6-11)
  if (hour >= 6 && hour < 12) {
    if (streak >= 3) {
      return { icon: '🔥', text: streak + '일째 기록 중! 오늘도 마음을 적어볼까요?' };
    }
    return REMINDER_MESSAGES[7]; // 좋은 아침
  }

  // Evening (18-23)
  if (hour >= 18) {
    // Check if already wrote today
    const today = todayLocalStr();
    const wroteToday = entries.some(e => toLocalDateStr(e.date || '') === today);
    if (wroteToday) return null; // Don't remind if already wrote
    return REMINDER_MESSAGES[6]; // 하루 마무리
  }

  // Daytime - random
  const idx = Math.floor(Math.random() * 6); // first 6 general messages
  return REMINDER_MESSAGES[idx];
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  const result = await Notification.requestPermission();
  track('notification_permission', { result });
  return result;
}

export function scheduleReminder() {
  // Clear existing timer
  if (_reminderTimer) {
    clearTimeout(_reminderTimer);
    _reminderTimer = null;
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notifTime = state.userProfile?.notification_time;
  if (!notifTime) return;

  // Parse HH:MM format
  const [hours, minutes] = notifTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return;

  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // If target time already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  // Safety: don't schedule more than 24h ahead
  if (delay > 86400000) return;

  _reminderTimer = setTimeout(() => {
    showReminder();
    // Re-schedule for next day
    scheduleReminder();
  }, delay);
}

function showReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const msg = pickReminderMessage();
  if (!msg) return;

  const notification = new Notification('Sentimind ' + msg.icon, {
    body: msg.text,
    icon: '/icon.svg',
    tag: 'sentimind-reminder',
    requireInteraction: false,
  });

  notification.addEventListener('click', () => {
    window.focus();
    notification.close();
    track('reminder_clicked', {});
  });

  track('reminder_shown', {
    hour: new Date().getHours(),
    streak: state.userProfile?.current_streak || 0,
  });
}

export function initReminder() {
  if (!state.userProfile?.notification_enabled) return;
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    scheduleReminder();
  }
}
