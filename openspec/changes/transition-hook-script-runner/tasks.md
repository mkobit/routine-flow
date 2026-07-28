## 1. Hook-invocation error isolation (independent, lands first)

- [x] 1.1 In `src/timer/store.ts`'s `EngineStore.dispatch` hook loop, wrap each `await hook(...)` call in its own `try`/`catch` so a throw/rejection is captured per-event rather than propagating out of `dispatch`
- [x] 1.2 Extend `HookEventApplication` (or an equivalent per-event result shape) so a caught invocation failure is distinguishable from a successful (possibly empty) `FileMutation[]` result, without changing `dispatch`'s "never rejects" contract
- [x] 1.3 Update `main.ts`'s `reportFailedHookApplications` (or add an equivalent) to surface an invocation-failure entry via `Notice`, distinct from today's mutation-application failure message
- [x] 1.4 Add `tests/store.test.ts` scenarios: a throwing `onExit` hook doesn't suppress a same-dispatch `onEnter` hook; a rejecting hook's promise doesn't suppress a later event's hook; `dispatch`'s resolved result reflects the failure without throwing

## 2. Predicate expression grammar

Confirmed: string-formula interpreter (not a structured/dropdown-built config) — see design.md's Decisions section for the resolved rationale.

- [x] 2.1 Design and document the supported grammar precisely (comparison operators, `if(cond, then, else)`, boolean `and`/`or`/`not`, the exact set of `visitCounts`/`fromPhaseId`-derived values a formula can reference) as a comment/doc alongside the parser
- [x] 2.2 Implement a parser producing a small typed AST for the grammar, rejecting any syntax outside it (no assignment, no function definitions, no loops/recursion, no I/O), with identifier/member-access resolution restricted to a fixed whitelist (`fromPhaseId`, each phase id's own key under `visitCounts`) — explicitly rejecting prototype-chain references (`.constructor`, `.__proto__` or equivalent) at parse time, not just at evaluation time
- [x] 2.3 Implement a synchronous evaluator: AST + `(fromPhaseId, visitCounts)` -> `boolean`, matching `Predicate`'s existing signature exactly (`src/domain/hook/predicate.ts` — no type changes needed)
- [x] 2.4 Add a settings-tab section: a list of named formula-authored predicates (name + formula-string fields, add/edit/remove), each validated through the parser on save — an unparseable formula blocks saving with a shown error
- [x] 2.5 Wire a `MutableFormulaPredicateRegistry` (or fold into a single new mutable predicate registry) built from the settings list, implementing `PredicateRegistry`, replacing `main.ts`'s static `{ resolve: () => undefined }`
- [x] 2.6 Unit tests: grammar parse success/failure cases (including prototype-chain reference rejection); evaluator correctness against representative `visitCounts` fixtures; registry resolution by name; settings-tab validation rejects bad formulas at save time

## 3. Script-hook Worker execution — BLOCKED (see design.md's Status section and revised Open Questions)

- [ ] 3.0 **Feasibility spike (gates the rest of this group):** in the dev vault, spawn a trivial Worker from plugin code (a minimal Blob/`URL.createObjectURL`-sourced Worker) and confirm it actually runs under Obsidian's Electron/CSP constraints before committing to 3.1's build-pipeline work. If it doesn't work as assumed, revisit design.md's Worker-spawn Open Question before proceeding.
  - **Run 2026-07-25: spike executed, group blocked.** The Worker spawns and runs, but has full Node integration (`require('fs')`/`child_process`/`process` all functional inside it) — the isolation this whole group assumes does not hold. Per this task's own instruction, stopped rather than proceeding to 3.1. See design.md's Decisions-section erratum and revised Open Questions for the evidence and candidate resolutions (none chosen yet). Tasks 3.1–3.6 are unstarted pending a new isolation-mechanism decision.
- [ ] 3.1 Add a second esbuild entry point that bundles the Worker-side script-execution runtime into a single string (per design.md's Blob/`URL.createObjectURL` leaning, validated by 3.0), embedded as a constant the main bundle can spawn a Worker from without a separate file on disk — note this bundle carries its own `temporal-polyfill` copy for 3.2's rehydration, not just application logic
- [ ] 3.2 Implement the Temporal serialize/rehydrate boundary: a function converting `HookContext`'s `Temporal.Instant`/`Duration` fields to plain ISO strings before `postMessage`, and the Worker-side counterpart rehydrating them back into `Temporal` values before the script sees `context`
- [ ] 3.3 Implement active-file frontmatter enrichment: resolve `EngineState.activeFilePath`'s note's current frontmatter (when non-null) synchronously via `ObsidianFrontmatterReader` on the main thread, fold into the `HookContext` payload before spawning the Worker — no second "phase's own note" path exists to resolve (`Phase` has no note/file-path field)
- [ ] 3.4 Implement per-invocation Worker lifecycle: spawn, post the serialized context + script source, await a single result message (`FileMutation[]`) or timeout, terminate the Worker in either case
- [ ] 3.5 Implement the invocation-level `Hook` adapter: given a script source string, returns a `Hook` (`(context) => Promise<readonly FileMutation[]>`) wrapping 3.1-3.4, with `ObsidianFrontmatterReader` (from `main.ts`'s existing construction) injected in as 3.3's dependency — this is what gets registered under a binding's name
- [ ] 3.6 Unit/integration tests: a script returning mutations resolves correctly; a throwing script rejects (caught by task 1's isolation, not this layer); a hanging script is terminated at its timeout and treated as a failure; a script attempting `require` fails inside the Worker; a script attempting to reference `window`/`document`/`app` fails inside the Worker; a script has no code path to read a vault path outside the enriched context; a `Temporal`-carrying context crosses the boundary without a structured-clone error and script-observed values are real `Temporal` objects, not strings

## 4. Script-hook binding + settings UI

- [ ] 4.1 Add a settings-tab field for the designated scripts folder path
- [ ] 4.2 Add a settings-tab list of script-to-event bindings: script (selected from `.js` files directly inside the configured folder) + one or more of `onEnter`/`onComplete`/`onSkip`/`onExit`, add/edit/remove
- [ ] 4.3 Add the bind-time confirmation UI: on creating a binding, show the selected script's current source and require explicit confirmation before the binding is stored as enabled; an unconfirmed binding is not persisted as resolvable
- [ ] 4.4 Wire a `MutableScriptHookRegistry` implementing `HookRegistry`, built from the confirmed bindings list (name -> the task 3.5 `Hook` adapter over that binding's script source), replacing `main.ts`'s static single-entry `HookRegistry`
- [ ] 4.5 Settings-tab tests/manual checks: a `.js` file outside the configured folder isn't selectable; removing a binding makes its name stop resolving; an unconfirmed binding doesn't resolve

## 5. main.ts wiring

- [ ] 5.1 Replace `main.ts`'s static `hookRegistry`/`predicateRegistry` construction with the mutable registries from tasks 2.5 and 4.4, keeping `createWriteBackHook`'s existing entry alongside script-authored ones (both resolvable via the same `HookRegistry`)
- [ ] 5.2 Confirm `EngineStore` construction and `RoutineFlowSettingTab` wiring both receive/reference the same registry instances (no duplicate registries)

## 6. Manual verification

- [ ] 6.1 In the dev vault (`bun run vault:dev:headless`), configure a scripts folder and a real `.js` script bound to `onComplete`, confirm the binding, complete a focus phase, and verify the script's `FileMutation` is applied
- [ ] 6.2 Verify a script left unconfirmed does not fire on phase completion
- [ ] 6.3 Verify a formula-authored predicate correctly gates a `'custom'` `TransitionCondition` end-to-end in a routine using one
- [ ] 6.4 Verify a script that throws does not prevent a same-transition write-back (or other) hook from still applying its own mutation

## 7. Quality gates

- [ ] 7.1 `bun test` passes
- [ ] 7.2 `bun run typecheck` passes
- [ ] 7.3 `bun run lint` passes
- [ ] 7.4 `bun run build` succeeds with the new Worker entry point bundled
- [ ] 7.5 Close flow-gu1.10 in beads, referencing this change; file any follow-up issues raised in design.md's Open Questions (bind-time content-hash re-confirmation; predicate context widening for vault-state-dependent predicates) rather than leaving them implicit
