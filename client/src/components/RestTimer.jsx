import { useEffect, useRef, useState } from 'react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showWorkoutNotification,
} from '../utils/workoutNotifications';

const PRESETS = [60, 90, 120];

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

function playTimerAlert(context) {
  try {
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.12;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
  } catch (error) {
    console.error('Could not play rest timer alert', error);
  }
}

export default function RestTimer() {
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [deadline, setDeadline] = useState(null);
  const completionHandled = useRef(false);
  const alertAudioContext = useRef(null);

  useEffect(() => () => {
    if (alertAudioContext.current?.state !== 'closed') {
      alertAudioContext.current?.close().catch(error => {
        console.error('Could not close rest timer audio context', error);
      });
    }
  }, []);

  useEffect(() => {
    if (!running || deadline === null) return undefined;

    const updateRemaining = () => {
      const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(secondsLeft);
      if (secondsLeft === 0 && !completionHandled.current) {
        completionHandled.current = true;
        setRunning(false);
        setFinished(true);
        setDeadline(null);
        setPermissionMessage('');
        playTimerAlert(alertAudioContext.current);
        if ('vibrate' in navigator) navigator.vibrate([250, 100, 250]);
        if (permission === 'granted') {
          showWorkoutNotification('Rest complete', 'Ready for your next set?', 'rest-timer');
        }
      }
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(interval);
  }, [deadline, permission, running]);

  const chooseDuration = (seconds) => {
    setDuration(seconds);
    setRemaining(seconds);
    setRunning(false);
    setFinished(false);
    setDeadline(null);
    completionHandled.current = false;
  };

  const toggleTimer = () => {
    if (running) {
      setRunning(false);
      setDeadline(null);
      return;
    }
    const seconds = remaining === 0 ? duration : remaining;
    if (window.AudioContext) {
      try {
        if (!alertAudioContext.current || alertAudioContext.current.state === 'closed') {
          alertAudioContext.current = new window.AudioContext();
        }
        alertAudioContext.current.resume().catch(error => {
          console.error('Could not activate rest timer audio', error);
        });
      } catch (error) {
        console.error('Could not initialize rest timer audio', error);
      }
    }
    setRemaining(seconds);
    setFinished(false);
    completionHandled.current = false;
    setDeadline(Date.now() + seconds * 1000);
    setRunning(true);
  };

  const resetTimer = () => {
    setRunning(false);
    setRemaining(duration);
    setFinished(false);
    setDeadline(null);
    completionHandled.current = false;
  };

  const enableNotifications = async () => {
    setPermissionMessage('');
    const result = await requestNotificationPermission();
    setPermission(result.permission);
    if (result.permission === 'granted') {
      setPermissionMessage('Timer notifications are enabled.');
    } else {
      setPermissionMessage(result.error || 'Allow notifications in your browser settings to receive timer alerts.');
    }
  };

  return (
    <section className={`rest-timer ${finished ? 'rest-timer-finished' : ''}`} aria-label="Rest timer">
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
      <div className="rest-timer-notification-row">
        {permission === 'granted' ? (
          <span className="rest-timer-notification-enabled">Notifications enabled</span>
        ) : (
          <button type="button" className="rest-timer-notification-button" onClick={enableNotifications}>
            Enable notifications
          </button>
        )}
        {permissionMessage && <span className="rest-timer-permission-message" role="status">{permissionMessage}</span>}
      </div>
      {finished && <div className="rest-timer-done" role="alert">Rest complete. Ready for the next set?</div>}
    </section>
  );
}
