## Why

Configuring a Bases view's options today (`routineFile`, `focusProperty`, `focusValue`, `breakProperty`, `breakValue`) requires opening Obsidian Bases' native top-right view options menu — a mechanism that is hidden, hard to discover, and detached from the timer view UI. Users need inline, clickable configuration controls directly within the timer panel to seamlessly pick routine files and configure task queue filters without relying solely on Bases' generic toolbar menu.

## What Changes

- **Inline configuration UI**: Add an inline configuration toggle (e.g. gear icon) to `RoutineTimerView` that expands an inline configuration panel.
- **Programmatic view option write-back**: Implement inline controls (routine file selector dropdown, work/break queue property and value inputs) that programmatically update view options using Obsidian's `BasesViewConfig.set(key, value)` API.
- **Immediate view reactivity**: Updating an option via the inline controls updates the `.base` configuration and immediately re-evaluates routine loading and task queue filtering.

## Capabilities

### Modified Capabilities

- `base-view-routine-selection`: Extend the capability to require inline, clickable configuration controls in `RoutineTimerView` for updating `routineFile` and queue filter view options programmatically.

## Impact

- `src/views/timer-view.ts`: Update `RoutineTimerView` to render the inline configuration UI toggle and controls, calling `this.config.set(key, value)` on change.
- `styles.css`: Add styles for the inline configuration bar, gear icon button, inputs, and selectors.
