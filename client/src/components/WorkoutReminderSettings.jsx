import { useState } from 'react';
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '../utils/workoutReminders';

const DAYS = [
  { label: 'M', name: 'Monday', value: 1 },
  { label: 'T', name: 'Tuesday', value: 2 },
  { label: 'W', name: 'Wednesday', value: 3 },
  { label: 'T', name: 'Thursday', value: 4 },
  { label: 'F', name: 'Friday', value: 5 },
  { label: 'S', name: 'Saturday', value: 6 },
  { label: 'S', name: 'Sunday', value: 0 },
];

export default function WorkoutReminderSettings({ settings, onChange }) {
  const [permission, setPermission] = useState(getNotificationPermission);
  const [permissionError, setPermissionError] = useState('');

  const toggleDay = (day) => {
    const days = settings.days.includes(day)
      ? settings.days.filter(value => value !== day)
      : [...settings.days, day];
    onChange({ ...settings, days });
  };

  const toggleReminders = async () => {
    setPermissionError('');
    if (settings.enabled) {
      onChange({ ...settings, enabled: false });
      return;
    }

    const permissionGranted = await ensureNotificationPermission();
    if (permissionGranted && settings.days.length > 0) {
      onChange({ ...settings, enabled: true });
    }
  };

  const ensureNotificationPermission = async () => {
    if (permission === 'granted') return true;
    const result = await requestNotificationPermission();
    setPermission(result.permission);
    setPermissionError(result.error);
    return result.permission === 'granted';
  };

  const toggleTimerNotifications = async (enabled) => {
    setPermissionError('');
    if (enabled && !(await ensureNotificationPermission())) return;
    onChange({ ...settings, timerNotifications: enabled });
  };

  const permissionMessage = permission === 'denied'
    ? 'Notifications are blocked in your browser settings. Allow them there, then try again.'
    : permission === 'unsupported'
      ? 'This browser does not support notifications.'
      : 'Reminders notify only while Gym Tracker is open.';

  return (
    <section className="workout-reminder-card" aria-label="Workout reminders">
      <div className="workout-reminder-heading">
        <div>
          <div className="workout-reminder-title">Workout reminders</div>
          <div className="workout-reminder-help">{permissionMessage}</div>
        </div>
        <button
          type="button"
          className={`reminder-toggle ${settings.enabled ? 'active' : ''}`}
          onClick={toggleReminders}
          disabled={!settings.enabled && settings.days.length === 0}
        >
          {settings.enabled ? 'Pause' : permission === 'granted' ? 'Enable' : 'Allow'}
        </button>
      </div>

      <div className="reminder-schedule">
        <div className="reminder-days" role="group" aria-label="Reminder days">
          {DAYS.map(day => (
            <button
              type="button"
              key={day.value}
              className={`reminder-day ${settings.days.includes(day.value) ? 'active' : ''}`}
              aria-label={day.name}
              aria-pressed={settings.days.includes(day.value)}
              onClick={() => toggleDay(day.value)}
            >
              {day.label}
            </button>
          ))}
        </div>
        <label className="reminder-time-label">
          <span>At</span>
          <input
            type="time"
            value={settings.time}
            onChange={event => onChange({
              ...settings,
              time: event.target.value || '18:00',
            })}
            aria-label="Workout reminder time"
          />
        </label>
      </div>

      <label className="timer-notification-option">
        <input
          type="checkbox"
          checked={settings.timerNotifications}
          onChange={event => toggleTimerNotifications(event.target.checked)}
        />
        <span>Notify when my rest timer ends</span>
      </label>

      {settings.days.length === 0 && (
        <div className="reminder-feedback" role="status">Select at least one day to enable reminders.</div>
      )}
      {permissionError && <div className="reminder-feedback" role="alert">{permissionError}</div>}
    </section>
  );
}
