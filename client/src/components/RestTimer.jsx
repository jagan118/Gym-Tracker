import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  readWorkoutReminderSettings,
  showWorkoutNotification,
} from '../utils/workoutReminders';

const PRESETS = [60, 90, 120];

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export default function RestTimer() {
  const { user } = useAuth();
  const userId = user?.id || user?._id || 'unknown';
  const notifyOnComplete = readWorkoutReminderSettings(`gymlog_workout_reminders_${userId}`).timerNotifications;
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    const timeout = window.setTimeout(() => {
      if (remaining <= 1) {
        setRemaining(0);
        setRunning(false);
        setFinished(true);
        if (notifyOnComplete) {
          showWorkoutNotification('Rest complete', 'Ready for your next set?', 'rest-timer');
        }
        return;
      }
      setRemaining(remaining - 1);
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [running, remaining, notifyOnComplete]);

  const chooseDuration = (seconds) => {
    setDuration(seconds);
    setRemaining(seconds);
    setRunning(false);
    setFinished(false);
  };

  const toggleTimer = () => {
    if (remaining === 0) setRemaining(duration);
    setFinished(false);
    setRunning(current => !current);
  };

  const resetTimer = () => {
    setRunning(false);
    setRemaining(duration);
    setFinished(false);
  };

  return (
    <section className="rest-timer" aria-label="Rest timer">
      <div className="rest-timer-header">
        <div>
          <div className="rest-timer-title">Rest Timer</div>
          <div className="rest-timer-subtitle">Between sets</div>
        </div>
        <div className="rest-timer-clock" role="timer" aria-live="off">{formatTime(remaining)}</div>
      </div>
      <div className="rest-timer-controls">
        <div className="rest-timer-presets" aria-label="Rest duration">
          {PRESETS.map(seconds => (
            <button
              key={seconds}
              type="button"
              className={`rest-timer-preset ${duration === seconds ? 'active' : ''}`}
              onClick={() => chooseDuration(seconds)}
              disabled={running}
              aria-pressed={duration === seconds}
            >
              {formatTime(seconds)}
            </button>
          ))}
        </div>
        <div className="rest-timer-actions">
          <button type="button" className="rest-timer-start" onClick={toggleTimer}>
            {finished ? 'Start again' : running ? 'Pause' : remaining === duration ? 'Start rest' : 'Resume'}
          </button>
          <button type="button" className="rest-timer-reset" onClick={resetTimer} aria-label="Reset rest timer">
            Reset
          </button>
        </div>
      </div>
      {finished && <div className="rest-timer-done" role="status">Rest complete. Ready for the next set?</div>}
    </section>
  );
}
