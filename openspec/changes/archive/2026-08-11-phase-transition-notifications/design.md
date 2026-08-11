## Context

See proposal.md for motivation and scope.
`Phase.notification` (`NotificationPolicy`) exists in `src/domain/phase/phase.ts` but is currently unused. `EngineStore` manages phase transitions via pure reducers and notifies listeners when state changes.

## Goals / Non-Goals

**Goals:**
- Provide a `NotificationPort` abstraction for sending in-app Notice toasts and system (OS) notifications on phase transitions.
- Wire `NotificationPort` into `EngineStore` dependencies or subscribers so phase changes trigger appropriate notifications.
- Clean up legacy hardcoded "Pomodoro:" prefixes in existing `Notice` calls across the codebase.

**Non-Goals:**
- Audio / sound file playback (out of scope for v1, `sound` field in `NotificationPolicy` remains reserved/null).
- Custom desktop notification actions / buttons (OS dependent, beyond basic title/body).

## Decisions

### Decision 1: `NotificationPort` abstraction for testability
Define a `NotificationPort` interface in `src/domain/notification/notification-port.ts`:
```ts
export interface NotificationPort {
  notifyInApp(message: string): void
  notifySystem(title: string, body: string): void
}
```
*Rationale:* Isolates Obsidian `Notice` and Electron/Web `Notification` APIs, allowing unit testing with a mock port.

### Decision 2: Listen for phase transitions in `EngineStore`
Attach a transition listener or integrate into `EngineDeps` in `EngineStore`. When `prevState.currentPhaseId !== nextState.currentPhaseId`, evaluate the new phase's `notification` policy.
*Rationale:* `EngineStore` is the central coordinator for session state changes.

### Decision 3: Standardized Notice copy without legacy prefixes
Format in-app notices as `{phase.label} phase started` (or i18n key equivalent). Replace hardcoded "Pomodoro:" strings across existing notice sites.

## Risks / Trade-offs

- [OS notification permissions] → Check `Notification.permission` before calling `new Notification(...)` in the default system notification implementation, falling back gracefully if denied.
