// Desktop notification hook
// Delivers OS-level system notifications with fallback in-app notices.

const title = typeof context.params.title === 'string' ? context.params.title : 'Routine Flow';
const body = typeof context.params.body === 'string' ? context.params.body : `${context.phase.name} event`;

if (typeof Notification !== 'undefined') {
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    } catch {
      // Ignore permission request failures
    }
  }
}

return [];
