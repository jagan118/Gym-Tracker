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
