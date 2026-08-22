# Bases Chartkit routine analytics and focus dashboard

## Description

Routine Flow coordinates timed intervals and executes lifecycle hooks when phases complete.
When a focus phase finishes, its `write-back` hook records progress by incrementing frontmatter properties (e.g. `sessions: 4`) on the active task note.
Obsidian Bases provides structured data query capabilities across all notes in a vault.
Bases Chartkit extends Obsidian Bases with interactive visualization views (bar charts, calendar heatmaps, pie charts, gauge meters).
By pairing Routine Flow and Bases Chartkit in a single `.base` file or embedding both inside a markdown dashboard note, users get an integrated control and analytics surface.
Timers advance task execution, write-backs persist metrics, and charts update live as Obsidian metadata cache updates propagate.

## Domain mapping

This example combines Routine Flow domain primitives with Obsidian Bases and Bases Chartkit view specifications.

### Frontmatter write-back schema

Tasks tracked in the routine queue carry frontmatter properties updated by Routine Flow:

```yaml
---
title: Refactor auth module
type: work
status: in-progress
priority: 1
due: 2026-08-25
sessions: 4
routine-status: active
---
```

- `sessions`: Numeric counter incremented by `onComplete: "write-back"` on focus phases.
- `status`: String state (`todo`, `in-progress`, `done`).
- `priority`: Numeric priority level (`1`, `2`, `3`).
- `due`: ISO date (`YYYY-MM-DD`) representing task deadline or scheduled execution date.
- `routine-status`: Routine pipeline progress state (`pending`, `active`, `done`, `skipped`, `deferred`).

### Obsidian Base view configuration (`Dashboard.base`)

The `.base` file defines task properties and registers multiple view types alongside each other:

```yaml
type: base
properties:
  note.status:
    displayName: Status
  note.due:
    displayName: Due date
  note.priority:
    displayName: Priority
  note.sessions:
    displayName: Completed sessions
  note.type:
    displayName: Task type
  note.routine-status:
    displayName: Routine status
views:
  - type: routine-timer
    name: Pomodoro focus
    routineFile: pomodoro/pomodoro-routine.md
  - type: routine-timer
    name: Bug triage sprint
    routineFile: bug-triage-blitz/bug-triage-blitz-routine.md
  - type: routine-timer
    name: Shutdown ritual
    routineFile: shutdown-ritual/shutdown-ritual-routine.md
  - type: bar-chart
    name: Completed sessions by task
    xAxisProp: file.name
    yAxisProp: note.sessions
    showLegend: true
    filters:
      and:
        - note.sessions > 0
  - type: calendar-chart
    name: Focus activity calendar
    xAxisProp: note.due
    valueProp: note.sessions
    showLegend: true
  - type: pie-chart
    name: Sessions by status
    xAxisProp: note.status
    yAxisProp: note.sessions
    showLegend: true
  - type: table
    name: Task queue
```

### Markdown dashboard embedding (`Focus-Dashboard.md`)

Markdown notes embed individual views by name using Obsidian embed links:

- `![[Dashboard.base#Pomodoro focus]]`: Renders the interactive Routine Flow countdown timer and queue runner.
- `![[Dashboard.base#Completed sessions by task]]`: Renders a Bases Chartkit bar chart of completed sessions.
- `![[Dashboard.base#Focus activity calendar]]`: Renders a Bases Chartkit calendar contribution heatmap.
- `![[Dashboard.base#Sessions by status]]`: Renders a Bases Chartkit pie breakdown of sessions grouped by task status.
- `![[Dashboard.base#Task queue]]`: Renders an Obsidian Bases table view of pending tasks.

## Walk-through

Trace of a full focus session and automatic chart update:

1. The user opens `Focus-Dashboard.md` in Obsidian.
2. The embedded Routine Flow view (`![[Dashboard.base#Pomodoro focus]]`) loads `pomodoro/pomodoro-routine.md` and binds its `focus-queue` task source to the tasks matching `type: work`.
3. The user starts the 25-minute focus countdown for the active note `pomodoro/01-refactor-auth-module.md` (which currently has `sessions: 3`).
4. When the countdown reaches zero, `engineReducer` handles `tick`, invokes `completePhase`, and emits the `onComplete` event for the `focus` phase.
5. The `write-back` hook resolves `logTarget.kind === 'activeItem'` to `pomodoro/01-refactor-auth-module.md`, computes `nextLogEntry(3) === 4`, and displays the `WriteBackModal`.
6. Upon confirmation (`Enter`), the hook returns a `frontmatter` `FileMutation` writing `sessions: 4`.
7. `EngineStore` applies the mutation through Obsidian's Vault API (`app.fileManager.processFrontMatter`).
8. Obsidian updates its internal `MetadataCache` for `pomodoro/01-refactor-auth-module.md`.
9. The Obsidian Bases query engine detects the metadata change and notifies subscribers.
10. The embedded Bases Chartkit views (`Completed sessions by task`, `Focus activity calendar`, `Sessions by status`) re-query the updated frontmatter and re-render their chart graphics automatically.

## Where it strains

- **Single-property write-backs**: Routine Flow currently supports writing back one configured property at a time via `writeBackProperty` (default `sessions`). Multi-property write-backs (e.g. updating `sessions` and `status` and `last-focus-date` in a single phase completion) require multiple manual prompt steps or custom hooks.
- **Duration write-backs as elapsed time**: Routine Flow increments session counts by integer count rather than total elapsed seconds/minutes. Visualizing duration in minutes on charts requires either standard duration units per session (e.g. 25 minutes per session) or custom formula properties in Bases.
- **Write-back prompt modal interaction**: While write-backs trigger automatically on completion, confirmation requires interactive user confirmation (`Enter`/Submit) before file mutations are written.
