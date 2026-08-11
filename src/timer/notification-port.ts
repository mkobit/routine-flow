/**
 * Port interface for sending in-app toasts and OS-level notifications.
 */
export interface NotificationPort {
  readonly notifyInApp: (message: string) => void
  readonly notifySystem: (title: string, body: string) => void
}
