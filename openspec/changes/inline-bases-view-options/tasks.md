## 1. Timer View Inline Configuration UI

- [x] 1.1 Add gear toggle button and expandable configuration panel UI to `RoutineTimerView` (`src/views/timer-view.ts`)
- [x] 1.2 Implement routine file `<select>` input reading vault routines and calling `this.config.set('routineFile', path)`
- [x] 1.3 Implement work and break queue filter inputs calling `this.config.set` for `focusProperty`, `focusValue`, `breakProperty`, and `breakValue`
- [x] 1.4 Add CSS styles for inline configuration panel and controls in `styles.css`

## 2. Testing & Verification

- [x] 2.1 Add unit tests verifying `BasesViewConfig` programmatic option updates and queue re-filtering in `tests/timer-view.test.ts` (or relevant view tests)
- [x] 2.2 Run typecheck, linter, unit tests, and Playwright e2e tests to ensure all gates pass
