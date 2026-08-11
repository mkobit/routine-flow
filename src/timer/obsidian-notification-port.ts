import { Notice } from 'obsidian'
import type { NotificationPort } from './notification-port'

export class ObsidianNotificationPort implements NotificationPort {
  public notifyInApp(message: string): void {
    new Notice(message)
  }

  public notifySystem(title: string, body: string): void {
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        new Notification(title, { body })
      }
      else if (Notification.permission !== 'denied') {
        void (async () => {
          try {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
              new Notification(title, { body })
            }
          }
          catch {
            // Ignore permission request failures
          }
        })()
      }
    }
  }
}
