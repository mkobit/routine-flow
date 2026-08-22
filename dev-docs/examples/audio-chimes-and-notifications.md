# Audio chimes and desktop notification hook configurations

## Description

Routine Flow provides multi-sensory feedback across routine phase lifecycles without requiring external media assets or internet connectivity.
Using the browser standard Web Audio API and OS-level Notification API, routines can play harmonic synthesizer chimes, trigger warning alert tones before interval expirations, display in-app Obsidian notices, and emit desktop notifications.
Phase transition handlers (`onEnter`, `onComplete`, `onSkip`, `onExit`) execute either declarative preset actions (such as `preset: notify`) or vault-authored script hooks.
This technical walkthrough explains how audio synthesizer chimes, notification policies, and warning alerts are configured, executed, and coordinated across phase state transitions.

## Domain mapping

The audio chime and notification workflow leverages four core domain mechanisms:

1. **`NotificationPolicy` (`src/domain/notification-policy.ts`)**: Per-phase configuration specifying default sound tokens and system notification flags (`sound: string | null`, `systemNotification: boolean`).
2. **`Handler` (`src/domain/handler/handler.ts`)**: Phase lifecycle action bindings declaring either `preset: notify` with parameters (`title`, `body`, `system`) or `script` pointing to a JavaScript hook file.
3. **`NotificationPort` (`src/timer/notification-port.ts` & `src/timer/obsidian-notification-port.ts`)**: Infrastructure adapter delegating to Obsidian's `Notice` and the standard `window.Notification` API.
4. **`createScriptHook` (`src/timer/script-hook.ts`)**: In-process executor providing `ScriptHookContext` with full access to `window.AudioContext` for procedural tone generation and gain envelopes.

### Phase lifecycle hooks and notification mapping

| Phase | id | kind | duration | notification policy | onEnter handlers | onComplete handlers | onSkip handlers |
|---|---|---|---|---|---|---|---|
| Focus interval | `focus` | `focus` | 25m | `sound: chime-start`, `systemNotification: true` | Web Audio major chord script, in-app notice preset | Web Audio fanfare chime script, desktop system notification preset, `write-back` | Web Audio skip warning script |
| Short break | `short-break` | `break` | 5m | `sound: soft-bell`, `systemNotification: true` | Web Audio soft chord script, in-app notice preset | Web Audio alert chime script, desktop system notification preset | none |
| Long break | `long-break` | `break` | 15m | `sound: restorative-bell`, `systemNotification: true` | Web Audio restorative chord script, desktop system notification preset | Web Audio fanfare chime script, desktop system notification preset | none |

### Transitions

- `focus` → `long-break` (`condition: { kind: 'everyNth', n: 4 }`)
- `focus` → `short-break` (`condition: { kind: 'always' }`)
- `short-break` → `focus` (`condition: { kind: 'always' }`)
- `long-break` → `focus` (`condition: { kind: 'always' }`)

### Audio synthesis and notification architecture

```mermaid
graph TD
    ER[Engine Reducer & Store] -->|Phase state transition: onEnter, onComplete, onSkip| HE[Handler Executor]
    HE -->|Preset: notify| NP[NotificationPort]
    NP -->|In-app alert| ON[Obsidian Notice]
    NP -->|System alert| SN[OS Desktop Notification]
    HE -->|Script: audio chime hook| SH[ScriptHook Executor]
    SH -->|Web Audio API| AC[window.AudioContext]
    AC -->|OscillatorNode + GainNode| AS[Synthesized tone & exponential decay envelope]
    SH -->|Return FileMutation[]| ER
```

## Walk-through

1. **Phase start (`onEnter`)**:
   When the user starts a session or transitions into the `focus` phase, `EngineStore` dispatches the transition action.
   The `onEnter` handler array triggers:
   - The `scripts/audio-chime-hook.js` script initializes a `window.AudioContext`, creating multiple `OscillatorNode` instances tuned to a C-major arpeggio (523.25 Hz base).
   - An exponential gain decay curve ramps down the amplitude over 800 milliseconds, producing a crisp acoustic chime.
   - The preset `notify` handler invokes `NotificationPort.notifyInApp`, rendering an unobtrusive "Focus interval started — time for deep work" toast in Obsidian.

2. **Phase running & warning tones**:
   While the timer counts down, milestone alerts can fire.
   If a user manually advances or skips the phase before completion, `onSkip` executes `scripts/interval-warning-hook.js`, playing a distinct triangle-wave warning tone (329.63 Hz) to provide acoustic confirmation of the manual intervention.

3. **Phase completion (`onComplete`)**:
   When the remaining duration reaches zero, `completePhase` in `src/timer/reducer.ts` marks the instance complete.
   The `onComplete` handlers fire in sequence:
   - `scripts/audio-chime-hook.js` synthesizes a resonant victory fanfare chord (E5 base arpeggio).
   - The preset `notify` handler calls `NotificationPort.notifySystem("Routine Flow", "Focus interval complete! Great work.")`, posting a desktop notification that appears even if Obsidian is minimized or in the background.
   - The built-in `write-back` hook opens the write-back modal to record the completed session to the active task note's frontmatter.

4. **Break transition**:
   The engine evaluates transition rules: after cycles 1–3, it transitions to `short-break`; on cycle 4, `everyNth: 4` transitions to `long-break`.
   Each break phase executes its own specialized `onEnter` and `onComplete` chimes and notifications, guiding the user through resting and resuming focus without requiring eyes on the screen.

## Where it strains

- **Browser and Electron autoplay policy**:
  Modern Chromium/Electron engines may suspend an `AudioContext` until the user interacts with the document window (`AudioContext.state === 'suspended'`).
  If Routine Flow starts automatically in the background without recent user input, `ctx.resume()` must be called to unblock audio playback.
- **OS notification permissions**:
  Desktop notifications depend on the host operating system granting notification permissions to the Obsidian application.
  If notifications are silenced at the OS level or blocked in system settings, `Notification.permission` reports `denied`, causing desktop alerts to silently fall back to in-app `Notice` toasts.
- **Main thread execution for Web Audio**:
  Script hooks execute in-process on the main UI thread via `new Function`.
  While lightweight audio synthesis via `OscillatorNode` and `GainNode` is non-blocking (audio synthesis runs on the browser audio thread), heavy computational scripts must avoid blocking the main thread during phase dispatch.
