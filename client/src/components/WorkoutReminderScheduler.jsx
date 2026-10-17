import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { workoutAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  getNextWorkoutReminder,
  readLastWorkoutReminderDate,
  readWorkoutReminderSettings,
  REMINDER_SETTINGS_CHANGED_EVENT,
  showWorkoutNotification,
  WORKOUTS_CHANGED_EVENT,
} from '../utils/workoutReminders';

function ReminderSchedule({ userId }) {
  const settingsKey = `gymlog_workout_reminders_${userId}`;
  const lastSentKey = `gymlog_workout_reminder_last_sent_${userId}`;
  const [settings, setSettings] = useState(() => readWorkoutReminderSettings(settingsKey));
  const [workoutDates, setWorkoutDates] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refreshWorkoutDates = async () => {
      try {
        const response = await workoutAPI.getConsistency();
        if (!mounted) return;
        setWorkoutDates(response.data.workoutDates || []);
        setReady(true);
      } catch (error) {
        if (!mounted) return;
        console.error('Could not load workouts for reminder scheduling', error);
        setReady(false);
      }
    };

    const handleReminderSettingsChange = (event) => {
      if (event.detail?.userId === userId) setSettings(event.detail.settings);
    };
    const handleStoredSettingsChange = (event) => {
      if (event.key === settingsKey) setSettings(readWorkoutReminderSettings(settingsKey));
    };

    window.addEventListener(WORKOUTS_CHANGED_EVENT, refreshWorkoutDates);
    window.addEventListener(REMINDER_SETTINGS_CHANGED_EVENT, handleReminderSettingsChange);
    window.addEventListener('storage', handleStoredSettingsChange);
    refreshWorkoutDates();

    return () => {
      mounted = false;
      window.removeEventListener(WORKOUTS_CHANGED_EVENT, refreshWorkoutDates);
      window.removeEventListener(REMINDER_SETTINGS_CHANGED_EVENT, handleReminderSettingsChange);
      window.removeEventListener('storage', handleStoredSettingsChange);
    };
  }, [settingsKey, userId]);

  useEffect(() => {
    if (!ready || !settings.enabled || !settings.days.length) return undefined;

    let timeout;
    let cancelled = false;
    const scheduleNextReminder = () => {
      const nextReminder = getNextWorkoutReminder(
        new Date(),
        settings.days,
        settings.time,
        workoutDates,
        readLastWorkoutReminderDate(lastSentKey)
      );
      if (!nextReminder || cancelled) return;

      timeout = window.setTimeout(() => {
        if (cancelled) return;
        const now = new Date();
        const reminderDate = format(nextReminder, 'yyyy-MM-dd');
        const isScheduledToday = format(now, 'yyyy-MM-dd') === reminderDate &&
          settings.days.includes(now.getDay());
        if (isScheduledToday && !workoutDates.includes(reminderDate)) {
          if (showWorkoutNotification(
            'Workout reminder',
            'Time for a workout. Log a session when you are ready.',
            'workout-reminder'
          )) {
            try {
              localStorage.setItem(lastSentKey, reminderDate);
            } catch (error) {
              console.error('Could not record sent workout reminder', error);
            }
          }
        }
        scheduleNextReminder();
      }, Math.max(0, nextReminder.getTime() - Date.now()));
    };

    scheduleNextReminder();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [lastSentKey, ready, settings, workoutDates]);

  return null;
}

export default function WorkoutReminderScheduler() {
  const { user } = useAuth();
  const userId = user?.id || user?._id;
  if (!userId) return null;
  return <ReminderSchedule key={userId} userId={userId} />;
}
