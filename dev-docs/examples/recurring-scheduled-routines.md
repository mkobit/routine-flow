# Recurring scheduled routines and daily note calendar integration

## Description

Knowledge workers structure recurring work around daily temporal rhythms: morning startup, focused deep work blocks, midday resets, shutdown rituals, and evening wind-downs.
In Obsidian, the Daily Notes plugin and community plugins (such as Templater, Periodic Notes, and Full Calendar or Day Planner) serve as the central daily schedule hub.
Routine Flow decouples routine topologies from specific note files by defining routines as reusable phase graphs (`routineFile`) referenced by Obsidian Bases views.
By embedding multiple Routine Flow views inside daily note templates, users link recurring calendar blocks directly to executable timer engines.
Each scheduled time block in a daily note hosts its corresponding routine view, while Bases queries dynamically filter tasks scheduled for the active date.

## Domain mapping

This workflow maps recurring daily schedule blocks to distinct Routine Flow topologies and Bases view definitions.

### Daily routine schedule blocks

| Time block | Routine | Routine file | Topology type | Task source binding |
|---|---|---|---|---|
| `08:30 - 09:00` | Morning kickoff | `morning-kickoff/morning-kickoff-routine.md` | Linear non-looping | None (`null`) |
| `09:30 - 12:00` | Morning focus | `pomodoro/pomodoro-routine.md` | Looping interval with branching break ladder | `focus-queue` (`due == today`) |
| `13:30 - 13:45` | Midday reset | `desk-micro-movement/desk-micro-movement-routine.md` | Repeating physical stretch interval | None (`null`) |
| `14:00 - 16:00` | Deep work | `ultradian-rhythm/ultradian-rhythm-routine.md` | 90m focus / 20m recharge cycle | `focus-queue` (`priority: 1`) |
| `16:45 - 17:15` | Shutdown ritual | `shutdown-ritual/shutdown-ritual-routine.md` | Linear checklist with untimed terminal phase | `activeItem` write-back |
| `21:30 - 22:00` | Evening wind down | `evening-wind-down/evening-wind-down-routine.md` | Linear untimed wind-down | None (`null`) |

### Base view configurations (`Daily-Routines.base`)

The `.base` definition pairs multiple timer views alongside table and calendar visualizers:

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
  note.scheduled-time:
    displayName: Scheduled time
views:
  - type: routine-timer
    name: Morning kickoff
    routineFile: morning-kickoff/morning-kickoff-routine.md
  - type: routine-timer
    name: Pomodoro focus block
    routineFile: pomodoro/pomodoro-routine.md
  - type: routine-timer
    name: Ultradian deep work
    routineFile: ultradian-rhythm/ultradian-rhythm-routine.md
  - type: routine-timer
    name: Desk micro-movement
    routineFile: desk-micro-movement/desk-micro-movement-routine.md
  - type: routine-timer
    name: Shutdown ritual
    routineFile: shutdown-ritual/shutdown-ritual-routine.md
  - type: routine-timer
    name: Evening wind down
    routineFile: evening-wind-down/evening-wind-down-routine.md
  - type: table
    name: Today's schedule
  - type: calendar-chart
    name: Calendar timeline
    xAxisProp: note.due
    valueProp: note.sessions
    showLegend: true
```

### Templater daily note integration (`Daily-Template.md`)

Daily note templates dynamically instantiate daily logs and embed named routine views:

```markdown
---
title: "<% tp.file.title %>"
date: "<% tp.date.now("YYYY-MM-DD") %>"
type: daily-note
tags:
  - daily-log
  - routine-flow
---

# Daily schedule: <% tp.date.now("dddd, MMMM D, YYYY") %>

## Daily task queue and calendar overview

![[Daily-Routines.base#Today's schedule]]

![[Daily-Routines.base#Calendar timeline]]

---

## 08:30 - 09:00 · Morning kickoff

![[Daily-Routines.base#Morning kickoff]]

---

## 09:30 - 12:00 · Morning focus block (Pomodoro)

![[Daily-Routines.base#Pomodoro focus block]]

---

## 13:30 - 13:45 · Midday reset

![[Daily-Routines.base#Desk micro-movement]]

---

## 14:00 - 16:00 · Deep work block (Ultradian)

![[Daily-Routines.base#Ultradian deep work]]

---

## 16:45 - 17:15 · Workday shutdown ritual

![[Daily-Routines.base#Shutdown ritual]]

---

## 21:30 - 22:00 · Evening wind down

![[Daily-Routines.base#Evening wind down]]
```

## Walk-through

Trace of a user executing their daily recurring routine schedule:

1. **Daily note creation**: At the start of the workday, the user opens Obsidian and triggers daily note creation via Templater.
2. Templater resolves `<% tp.date.now("YYYY-MM-DD") %>` to today's date stamp and renders the schedule structure.
3. **Morning kickoff (`08:30`)**: The user scrolls to the `Morning kickoff` section and starts the timer.
4. The kickoff routine steps through calendar review (5m), task selection (5m), and workspace setup (5m).
5. **Focus interval execution (`09:30`)**: In the `Morning focus block` section, the embedded view loads `pomodoro/pomodoro-routine.md`.
6. The timer connects to the task queue filtered by `due: today` and runs alternating 25m focus and 5m break phases.
7. Upon completing focus phases, the `write-back` hook prompts to increment `sessions` on active task notes.
8. **Midday recharge & deep work (`13:30 - 16:00`)**: The user runs `Desk micro-movement` for eye-strain and physical resets, followed by the 90-minute `Ultradian deep work` block for complex technical tasks.
9. **Workday shutdown (`16:45`)**: The user launches `Shutdown ritual` to triage lingering inbox items, log accomplishments, and plan tomorrow's top 3 tasks.
10. Completing the untimed `desk-tidy` terminal phase marks the shutdown complete and triggers day-end write-backs.
11. **Calendar log update**: Obsidian's `MetadataCache` updates all modified task and daily notes, updating embedded Bases calendar and table views.

## Where it strains

- **Clock-time scheduling vs elapsed timer duration**: Routine Flow models relative interval durations (`PT25M`, `PT90M`), while calendar schedulers operate on absolute wall-clock times (`09:30 - 10:00`). Automatic routine triggering at a designated wall-clock time requires external scheduler integration (e.g. system notifications, Obsidian calendar plugins, or Templater startup scripts).
- **Dynamic date-filter parameters in Base views**: Obsidian Bases queries in `.base` files use static filters; dynamically filtering by "today's date relative to the embedding note" currently relies on formula properties or task date conventions (`today`).
- **Multiple simultaneous timer views**: While multiple routine views can be embedded in a single markdown document, active timer state execution is managed per running view instance.
