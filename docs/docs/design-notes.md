---
sidebar_position: 3
---

# Design & decisions

Why the plugin works the way it does.

## Why a phase graph, not a fixed 25/5 cycle

The engine models a routine as a generic phase graph: a set of phases and the transitions between them.
A phase can be timed or rep-based, so a routine describes any sequence — a workout, a standup, a study block — not only focus and break.
The shipped default (25 min focus, 5 min break, 15 min long break every fourth cycle) is one graph among many.
Nothing about it is special-cased in the engine.

## Why routines are vault notes, not code

A routine is data: a vault note with `is-routine: true` in frontmatter and one fenced JSON block holding the phase graph, validated against a schema.
It is not a constant compiled into the plugin, so you can author or share a custom routine without a plugin update.
The graph lives in a JSON block rather than frontmatter properties because Obsidian's Properties UI only renders flat properties usefully.
A graph that nests phases, transitions, completion policies, and hooks several levels deep would be hand-edited YAML with none of that UI benefit.

## Why only one routine runs at a time

There is a single global engine, not one per Base view or per routine.
Starting a routine from any view promotes it to the active routine; there is no "running locally" versus "promoted to global" distinction.
This is deliberate, not a limitation to revisit soon: running several routines at once detracts from the focus work the plugin exists to support.
A Base view can show a routine that is not the active one, and that does not imply it is running.

## Why routine-file data is resolved by name, never executed

A `Phase`'s `onEnter`, `onComplete`, `onSkip`, and `onExit`, a transition's custom predicate, and a non-default log target are all plain names in routine-file JSON.
The engine resolves each name against a registry it constructs and injects itself.
Routine-file data can reference a name, but nothing in a vault note can define what that name does.
This matters because routine files may be shared or authored by other people, and baking a live function reference into that data would let vault content drive arbitrary code execution by name.
A routine file can still cause a script to run, if its `onComplete` (or `onEnter`/`onSkip`/`onExit`) names a hook you have bound under Settings → "Script hooks" — but that script was already reviewed and trusted at bind time, independent of any routine file, which only ever supplies a name and never the code behind it.
See [Usage notes & gotchas](./usage-notes) for how script hooks are reviewed.

## Why hooks fire around phase transitions

Side effects like frontmatter write-back once ran from ad hoc code scattered wherever a state change might matter.
Hook firing now lives in one place: the engine compares state before and after each action, derives which lifecycle events just happened, and fires them in a fixed order.
This keeps "what happened" logic in one testable place instead of duplicated across every caller that cares about transitions.
Hooks fire sequentially, and one hook's failure does not stop the others or roll back the timer.
The timer always moves on, matching how the rest of the engine treats failures as non-fatal.

## Why a manualClear phase can get stuck

A `completionPolicy` of `manualClear` leaves a phase parked at completion with no UI control to advance past it, as [Usage notes & gotchas](./usage-notes) records.
The design reason is that completion is a real, distinct `EngineStatus` of `completed`, not a boolean layered on top of `running`, `paused`, and `stopped`.
That status was chosen over reusing `stopped`, which already means "reset to the graph's first phase" — a genuinely different state than sitting at a completed phase awaiting clear.
Modeling completion as a first-class status was correct; the missing piece is only that the UI does not yet render a "Clear" affordance for it, tracked as separate follow-up work.
