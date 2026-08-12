## Context

`flow-gu1.19.19` addresses the feasibility of per-phase sound/alert playback in Routine Flow.
`NotificationPolicySchema` (`src/domain/notification-policy.ts`) defines `sound: z.string().nullable()`, which is embedded inside `Phase.notification` (`src/domain/phase/phase.ts`). Currently, `EngineStore` (`src/timer/store.ts`) reads `systemNotification` to invoke `NotificationPort.notifySystem`, but `sound` is completely unread across `src/` — no sound-playback code or audio handling exists.

This document evaluates the audio playback mechanisms, sound source options, volume/mute control hierarchy, and architecture required for real implementation, and provides a target release decision (`0.1.0` vs `0.2.0+`).

---

## Goals / Non-Goals

**Goals:**
- Evaluate technical audio playback APIs available inside Obsidian's Electron renderer process.
- Analyze sound file sourcing strategies (built-in synth, bundled presets, vault-relative custom sound files).
- Design the settings control hierarchy (global master mute/volume vs per-phase routine authoring).
- Define the future `AudioPort` interface for dependency injection into `EngineStore`.
- Provide a clear release recommendation for `0.1.0` vs `0.2.0+`.

**Non-Goals:**
- Implementing audio playback code or bundling audio assets in `0.1.0`.
- Modifying `NotificationPolicySchema` in `src/domain/notification-policy.ts` (the schema remains `sound: z.string().nullable()`).

---

## Technical Feasibility Analysis

### 1. Audio Playback APIs in Electron / Obsidian

Obsidian runs as an Electron application with a Chromium renderer process. The available audio options include:

1. **HTML5 `<audio>` / `HTMLAudioElement` (`new Audio(url)`)**:
   - **Pros**: Standard DOM API, native support for MP3, WAV, OGG; simple `.volume` control (0.0 to 1.0) and `.play()`.
   - **Cons**: `play()` returns a Promise that rejects if browser autoplay policies block audio without prior user interaction. Must always attach a `.catch()` handler to avoid unhandled rejection crashes.
2. **Web Audio API (`AudioContext`)**:
   - **Pros**: High precision, zero asset-loading latency when synthesizing tones (`OscillatorNode`), independent of external files.
   - **Cons**: Requires managing `AudioContext` lifecycle (e.g. `resume()` if context is suspended by Electron power-saving/background tab state).
3. **Electron / Node native sound libraries**:
   - **Cons**: Native C++ node modules cannot be bundled into an Obsidian plugin single JS bundle. Must be avoided.

**Decision for Audio API**: HTML5 `HTMLAudioElement` for file/preset playback, with optional `AudioContext` synth fallback for zero-file default chimes.

---

### 2. Sound Sourcing Strategy

How should sound identifiers (`sound: string`) in `Phase.notification.sound` be resolved?

1. **Built-in Presets (`preset:chime`, `preset:bell`, `preset:gong`)**:
   - Bundled directly in JS as base64 data URIs or synthesized via Web Audio API.
   - **Pros**: 100% reliable across OSs, no missing file errors, zero vault pollution.
2. **Vault-Relative Audio Files (`vault:sounds/bell.mp3`)**:
   - User specifies a path inside their Obsidian vault.
   - Resolved via `app.vault.getAbstractFileByPath(path)` and converted to a resource URL via `app.vault.getResourcePath(file)`.
   - **Pros**: High user customizability.
   - **Cons**: File may be missing or deleted; formats may be unsupported by Chromium. Needs safe error handling and fallback to a default preset.

**Decision for Sound Sourcing**: Support built-in presets by default (`chime`, `bell`, `gong`), with optional `vault:` path prefix support for custom user files.

---

### 3. Volume & Control Hierarchy

A two-level control model is required:

1. **Global Plugin Settings (`RoutineFlowSettings`)**:
   - `soundEnabled: boolean` (default: `true`) — Master toggle to mute all audio plugin-wide.
   - `soundVolume: number` (0–100, default: `80`) — Master volume multiplier applied to all played sounds.
   - `defaultPhaseSound: string | null` (default: `"chime"`) — Fallback sound when a phase enables sound without specifying a custom sound key.
2. **Per-Phase Routine Authoring (`Phase.notification.sound`)**:
   - `sound: null` — Phase is completely silent.
   - `sound: "chime"` — Play specific preset or custom sound.
   - `sound: "default"` — Play the global setting's default sound.

---

### 4. Architecture & Dependency Injection (`AudioPort`)

To maintain clean Functional Programming isolation and testability (matching `NotificationPort` and `FileMutationPort`), sound playback will be abstracted behind an `AudioPort` interface:

```ts
export interface AudioPort {
  playSound(soundKey: string, volume: number): Promise<void>
}
```

- `EngineStore` dependencies (`EngineDeps`) receives an optional `audioPort?: AudioPort`.
- On phase transition in `EngineStore`:
  ```ts
  if (audioPort !== undefined && settings.soundEnabled && newPhase.notification?.sound !== null) {
    const soundKey = newPhase.notification.sound ?? settings.defaultPhaseSound
    if (soundKey !== null) {
      const volume = settings.soundVolume / 100
      void audioPort.playSound(soundKey, volume).catch(() => {
        // Silently swallow audio playback failures (e.g. autoplay block or missing file)
      })
    }
  }
  ```

---

## Release Recommendation: Defer to 0.2.0+

### Target Release: **0.2.0+ (Deferred from 0.1.0)**

**Rationale for Deferring:**
1. **Scope Control for 0.1.0**: The `0.1.0` release milestone is focused on core routine execution, Obsidian Bases view integration, write-back modal, side panel, settings tab, and text/system notifications. All `0.1.0` release block items are nearing completion (release gate `flow-7c4`).
2. **Domain Stability**: `NotificationPolicySchema` already cleanly contains `sound: z.string().nullable()`. Deferring implementation requires **zero schema changes** or migration scripts.
3. **Edge Case Complexity**: File-system path resolution in Obsidian, web resource URL conversion, audio context suspension in background tabs, and Chromium autoplay policies require dedicated testing across platforms (macOS, Windows, Linux, Mobile).

---

## Implementation Plan for 0.2.0+

When `0.2.0` planning begins, create the following sub-task:
1. `flow-sound-impl`: Implement `ObsidianAudioPort`, global settings controls (`soundEnabled`, `soundVolume`), preset chimes, and wire `audioPort` into `EngineStore`.

---

## Risks / Trade-offs

- **[Risk]** User sets a non-existent `vault:sounds/missing.mp3` path.
  - **Mitigation:** `ObsidianAudioPort` checks file existence via `app.vault.getAbstractFileByPath` and falls back to default `preset:chime` while logging a non-disruptive console warning.
- **[Risk]** Electron/Chromium suspends audio in background or unfocused tabs.
  - **Mitigation:** Wrap `.play()` in try/catch and handle `AudioContext.resume()` on user interaction.
