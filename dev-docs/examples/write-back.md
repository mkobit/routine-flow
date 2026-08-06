# Frontmatter write-back

## Description

When a phase finishes, record that it happened by bumping a counter in a note's frontmatter — a focus phase completing increments the active task's `sessions` count.
Different phases opt in or out of this: some write back, some stay silent, and where the write lands depends on the phase.
Before anything is written, a modal shows the file, property, and value it's about to write, so it can be confirmed, edited, or cancelled.

This example is the write-back hook itself as a configuration surface, not a new routine shape.
It is exercised end to end today by the shipped pomodoro graph (`DEFAULT_PHASE_GRAPH` in `src/timer/phase-graph.ts`), whose every phase already opts in — see [pomodoro.md](pomodoro.md).
The hand-authored `routine-flow-example-vault/routines/write-back-variants-routine.md` isolates the three per-phase states side by side.

## Domain mapping

Write-back is a named `Hook` (`createWriteBackHook`, `src/timer/write-back.ts`), registered under the name `write-back` in `src/main.ts` and referenced from a phase's `onComplete`.
A phase fires it only if one of its hook slots names it; the shipped graph sets `onComplete: { name: 'write-back', params: {} }` on every phase via `phaseDefaults` (`src/timer/phase-graph.ts`).

The `write-back-variants` graph, one phase per configuration state:

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Active-item write | `active-write` | `focus` | 10s | `null` | `null` | `{ kind: 'activeItem' }` | `onComplete: write-back` |
| Callback write | `callback-write` | `focus` | 10s | `null` | `null` | `{ kind: 'callback', name: 'dailyNote' }` | `onComplete: write-back` |
| No write-back | `no-write` | `break` | 10s | `null` | `null` | `{ kind: 'activeItem' }` | none |

Transitions: `active-write` → `callback-write` → `no-write` → `active-write`, all `always`, cycling.

Three configuration axes, all read at completion time, decide whether and what a phase writes.

- Opt-in — whether a hook slot names `write-back`. `active-write` and `callback-write` set `onComplete`; `no-write` leaves it `null` and never fires the hook.
- Target — `phase.logTarget`. `activeItem` resolves to the `HookContext`'s `activeFilePath`; `callback` looks the name up in a `LogTargetResolverRegistry`.
- Property — `settings.writeBackProperty` (default `sessions`, `src/settings.ts`), read live via `getWriteBackProperty` on every invocation. It is one global setting, not a per-phase field.

## Walk-through

One cycle, traced against `src/timer/write-back.ts`, `src/views/write-back-modal.ts`, `src/timer/reducer.ts`, and `src/timer/store.ts`.

1. `active-write` runs its 10s timer with a work note active. On tick-to-zero, `completePhase` sees `completionPolicy: null` and advances, so `deriveHookEvents` reports `onComplete(active-write)` (alongside `onExit`/`onEnter`), same derivation as the pomodoro focus phase.
2. `EngineStore.runDispatch` resolves `active-write.onComplete.name` through `hookRegistry` to the write-back hook and invokes it.
3. The hook resolves the target: `logTarget.kind === 'activeItem'`, so `resolveTargetFilePath` returns `context.activeFilePath` — the active work note.
4. It reads that note's current `sessions` value via `FrontmatterReader`, computes the next value with `nextLogEntry` (a finite number increments; anything missing or non-numeric starts at `1`), and calls `writeBackPrompt.prompt` with `{ filePath, property, value }` as defaults.
5. `WriteBackModal` opens pre-filled, reading "Write `<value>` to `<property>` on `<file>`?", with the file field focused (the highest-stakes field) and vault-wide file suggestions.
6. On Submit, the hook returns one `frontmatter` `FileMutation` built from the submitted (possibly edited) values; `EngineStore.dispatch`'s apply loop writes it through the `FileMutationPort`. On Cancel or Escape, the hook returns `[]` and nothing is written.
7. `callback-write` completes next. Its `onComplete` also names the hook, but `logTarget.kind === 'callback'` and `logTargetResolverRegistry.resolve('dailyNote')` returns `undefined` (`src/main.ts` registers no resolvers), so `resolveTargetFilePath` returns `null`, the hook returns `[]` before reading or prompting, and the completion is silently skipped.
8. `no-write` completes last. Its `onComplete` is `null`, so `hookReferenceFor` yields nothing and no write-back hook is invoked at all — no read, no prompt, no write.
9. The graph loops back to `active-write`.

Every opt-in phase that resolves a target prompts on every completion — there is no path that applies the write without the modal.

## Where it strains

- There is no auto-apply mode.
  The old silent auto-increment was replaced by a mandatory prompt (the write-back-input-modal change), so a phase that completes often (a short break, a rep) prompts every single time it finishes.
  The only way to stop prompting is to opt out entirely (`onComplete: null`), which also stops the write — there is no "write silently, don't ask" middle state.
  Per-phase opt-in/skip of the prompt is exactly the still-open flow-00x; today opt-in is all-or-nothing.
- The property is global, not per-phase.
  `writeBackProperty` is a single setting read the same way for every phase, so a routine can't declare "focus writes `sessions`, break writes `breaks`" without hand-editing the property in each prompt.
  The `onComplete` `HookReference` carries `params` (here `{}`), and the hook receives them as `context.params`, but `createWriteBackHook` never reads them — so `params` can't override the target property or value per phase yet.
- The `callback` log target is inert.
  `src/main.ts` wires `logTargetResolverRegistry: { resolve: () => undefined }`, so any `callback` target (like `callback-write` above, or the stretch break in [stretch-break.md](stretch-break.md)) resolves to nothing and skips with no visible feedback.
  `activeItem` is the only target that resolves to a real file today.
- An `activeItem` phase with no active file skips just as silently.
  `resolveTargetFilePath` returns `null` when `activeFilePath` is `null`, and the hook returns `[]` before prompting — indistinguishable, from the outside, from a phase that opted out.
  Only an outright failure (a hook throw, or a `FileMutation` that fails to apply) surfaces anything, via the `Notice`s in `reportFailedHookApplications` (`src/main.ts`).
