import { format } from 'date-fns';

export const WORKOUTS_CHANGED_EVENT = 'gymlog:workouts-changed';
export const REMINDER_SETTINGS_CHANGED_EVENT = 'gymlog:reminder-settings-changed';

export const DEFAULT_REMINDER_SETTINGS = {
  enabled: false,
  days: [1, 3, 5],
  time: '18:00',
  timerNotifications: false,
};

export function notifyWorkoutDataChanged() {
  window.dispatchEvent(new Event(WORKOUTS_CHANGED_EVENT));
}

export function notifyReminderSettingsChanged(userId, settings) {
  window.dispatchEvent(new CustomEvent(REMINDER_SETTINGS_CHANGED_EVENT, {
    detail: { userId, settings },
  }));
}

export function readWorkoutReminderSettings(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULT_REMINDER_SETTINGS;

    const days = Array.isArray(saved.days)
      ? [...new Set(saved.days.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))]
      : DEFAULT_REMINDER_SETTINGS.days;
    const time = typeof saved.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.time)
      ? saved.time
      : DEFAULT_REMINDER_SETTINGS.time;

    return {
      enabled: saved.enabled === true,
      days,
      time,
      timerNotifications: typeof saved.timerNotifications === 'boolean'
        ? saved.timerNotifications
        : DEFAULT_REMINDER_SETTINGS.timerNotifications,
    };
  } catch (error) {
    console.warn('Could not read workout reminder settings', error);
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export function getNotificationPermission() {
  return typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'unsupported';
}

export async function requestNotificationPermission() {
  if (getNotificationPermission() === 'unsupported') {
    return { permission: 'unsupported', error: 'This browser does not support notifications.' };
  }

  try {
    return { permission: await Notification.requestPermission(), error: '' };
  } catch (error) {
    console.error('Could not request notification permission', error);
    return {
      permission: Notification.permission,
      error: 'Could not request notification permission. Check your browser settings and try again.',
    };
  }
}

export function showWorkoutNotification(title, body, tag) {
  if (getNotificationPermission() !== 'granted') return false;

  try {
    const notification = new Notification(title, { body, tag });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch (error) {
    console.error('Could not show workout notification', error);
    return false;
  }
}

export function getNextWorkoutReminder(now, days, time, workoutDates, lastNotifiedDate) {
  if (!days.length || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  const completedDates = new Set(workoutDates);

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    const dateKey = format(candidate, 'yyyy-MM-dd');

    if (
      days.includes(candidate.getDay()) &&
      candidate > now &&
      !completedDates.has(dateKey) &&
      dateKey !== lastNotifiedDate
    ) {
      return candidate;
    }
  }

  return null;
}

export function readLastWorkoutReminderDate(storageKey) {
  try {
    return localStorage.getItem(storageKey);
  } catch (error) {
    console.error('Could not read last workout reminder date', error);
    return null;
  }
}
