## Why

Every Hook (`onEnter`/`onComplete`/`onSkip`/`onExit`) and every `TransitionCondition` `'custom'` predicate must be hand-typed TypeScript compiled into the plugin bundle — exactly one Hook exists anywhere (write-back), and zero predicates. A user or an agent acting on their behalf cannot add new phase-lifecycle behavior (a log line on completion, a streak counter, a rest-day skip rule) without forking and rebuilding the plugin. This lets both resolve to vault-authored code/config instead.

## What Changes

- Adds a settings-tab "scripts folder" setting: any `.js` file placed there becomes selectable in a new list of named bindings (one binding = a chosen name + one selected script). A binding carries no event association of its own — a routine's own `onEnter`/`onComplete`/`onSkip`/`onExit` `HookReference` (`{ name, params }`) is what actually wires a binding's name to a specific phase and event, same as the built-in write-back hook already works.
- Each binding requires a one-time bind-time confirmation (review the script, confirm trust) before it's enabled — no per-firing prompt afterward.
- A bound script executes in-process (no Worker, no runtime sandbox — see design.md's 2026-07-28 update) as `(context) => Promise<FileMutation[]>` — the existing `Hook` contract, unchanged. The bind-time confirmation gate is the only trust boundary; a confirmed script has the same Node/host access as any other in-process code. Stronger sandboxing is tracked separately (flow-gu1.67), not part of this change.
- `HookContext` gains pre-resolved, read-only frontmatter for one context-implied path only (the active file's note, via `EngineState.activeFilePath` — `Phase` has no note/file-path field of its own, so there is no second "phase's own note" to resolve) — resolved synchronously before the script runs.
- `EngineStore.dispatch`'s hook-invocation loop gets a per-invocation `try`/`catch` plus a `Promise.race`-based soft timeout, so one throwing or (asynchronously) hanging script no longer aborts every later hook event's mutations in the same dispatch.
- Adds a settings-tab list of named `'custom'` predicates, each a small formula string (comparisons, `if(cond, then, else)`, boolean operators — modeled on Obsidian Bases' own formula grammar) evaluated synchronously in-process against `fromPhaseId`/`visitCounts` — no file, no Worker, no isolation machinery.
- Does not widen `Predicate`'s inputs beyond `fromPhaseId`/`visitCounts` — vault-state-dependent predicates (e.g. `isRestDay`) remain out of reach until a follow-up change adds a pre-resolved snapshot input, tracked separately.

## Capabilities

### New Capabilities
- `script-hook-source`: settings-tab scripts-folder configuration, the script-to-event binding list, and the bind-time confirmation gate — how a vault-authored script becomes a name a `HookRegistry` can resolve.
- `script-hook-execution`: in-process invocation with a `Promise.race` soft timeout, context-implied-path frontmatter enrichment, and the declarative `FileMutation[]` return contract.
- `predicate-expression-grammar`: the restricted formula grammar, its in-repo interpreter, and the settings-tab name+formula registration into a `PredicateRegistry`.

### Modified Capabilities
- `hook-execution`: adds a requirement that a hook invocation which throws or whose returned promise rejects does not stop remaining hook events in the same dispatch from being resolved and invoked (today, only a failed `applyMutations` result is isolated this way — an invocation-level failure currently propagates out of `EngineStore.dispatch` and aborts the loop).

## Impact

- `src/timer/store.ts` (`EngineStore.dispatch`'s hook loop — per-invocation error isolation).
- `src/domain/hook/hook.ts` (`HookContext` gains enrichment fields; no change to `Hook`'s own type).
- New: an in-process script-invocation module (compiles script source, races it against a soft timeout), a script-hook registry (settings-backed, mutable, plugin-scoped — distinct from today's load-once `HookRegistry`/`PredicateRegistry` pattern), a predicate-expression parser/interpreter, and settings-tab UI for both the script-binding list and the predicate list.
- `src/settings.ts` / `RoutineFlowSettingTab` (new configuration surfaces).
- `main.ts` (wiring the new registries in place of the current static resolve-only objects).
- No change to `src/domain/hook/predicate.ts`'s `Predicate` type signature in this change.
