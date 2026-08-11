## Why

Users running routines need timely feedback when phases transition (e.g., focus phase ends, break starting). While timer views display live countdowns, users are often working in other Obsidian notes or outside Obsidian entirely. Native OS notifications and in-app toasts inform users immediately upon phase transitions.

## What Changes

- Add a notification dispatcher that listens to phase transitions in `EngineStore`.
- Render in-app `Notice` toasts on phase transitions with clean, standardized copy (removing obsolete hardcoded "Pomodoro:" prefixes).
- Trigger native OS/system notifications via Electron/Web Notification API when `Phase.notification` (`systemNotification: true`) is enabled.
- Wire `Phase.notification` (`NotificationPolicy`) so per-phase notification preferences are fully respected across phase transitions.

## Capabilities

### New Capabilities
- `phase-transition-notifications`: Phase transition notification dispatching for Obsidian `Notice` toasts and system/OS-level notifications.

### Modified Capabilities

## Impact

- `src/timer/store.ts` or `src/notification/`: Notification listener/dispatcher integration.
- `src/domain/phase/phase.ts` and `src/domain/notification-policy.ts`: Utilization of `Phase.notification`.
- In-app Obsidian Notice toasts and native OS notifications.
