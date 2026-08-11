## 1. Domain & Port Interfaces

- [x] 1.1 Create `NotificationPort` interface and `ObsidianNotificationPort` implementation wrapping Obsidian `Notice` and `Notification` API.
- [x] 1.2 Add `notificationPort` to `EngineDeps`.

## 2. EngineStore Wiring & Notice Cleanup

- [x] 2.1 Update `EngineStore` to trigger notifications on phase transitions according to `Phase.notification`.
- [x] 2.2 Standardize existing `Notice` calls across `src/main.ts` removing legacy "Pomodoro:" prefixes.

## 3. Testing & Verification

- [x] 3.1 Add unit tests for `NotificationPort` dispatching in `tests/store.test.ts`.
- [x] 3.2 Run `bun run typecheck`, `bun run lint`, and `bun test`.
