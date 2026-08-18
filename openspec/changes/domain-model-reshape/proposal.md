## Why

A human-led walkthrough of the domain model (bead flow-616, all 7 originally-scoped types plus
QueueItemAction/NotificationPolicy) found the model has accreted more indirection and duplicated
concepts than its actual usage justifies: two closed unions independently reinvent the same two
operations, three schema fields carry real plumbing but zero consumers, one registry has zero real
registrations ever, and the only routine-authoring format (raw JSON in a code fence) is a cliff for
a human user without agent help past the shipped default. flow-6fd (the programming-model spec),
flow-ej1 (PhaseGraph's cssClass removal), and flow-731 (the pre-ship review) are all blocked on
flow-616 closing — this reshape is what unblocks them, consolidating what the walkthrough already
decided rather than re-deriving it.

This change is a checkpoint, not the end state. Mike reviewed it and judged it hadn't gone far
enough — see `design.md`'s "Distilled direction" section for the further Graph+Handler+Effect
unification that resulted, tracked as follow-up work (`flow-16c`, `flow-jw3`) rather than
implemented by this change's specs. What's below remains real, decided, and independently valid;
it's the concrete first step, not a competing design.

## What Changes

- Collapse `CompletionPolicy`'s `queueCycle`/`futureDate` variants into `QueueItemAction`: both
  already derive byte-identical `FileMutation`s to `queueCycle`/`deferDuration` in two separate
  files (`completion-policy-executor.ts`, `derive-action-mutations.ts`) — confirmed duplicate at
  the spec level too (`completion-policy-execution` and `queue-item-actions` specify the same
  mutations independently). `CompletionPolicy` keeps only what's actually unique: the
  `manualClear` auto/manual-advance gate, plus which `QueueItemAction`(s) auto-fire on completion.
  **BREAKING**: `CompletionPolicy.queueCycle`/`futureDate` variants are removed; existing routine
  files using them need a mechanical rewrite to the equivalent `QueueItemAction`-based form.
- Remove `LogTargetResolverRegistry` and `PhaseLogTarget`'s `'callback'` variant entirely —
  confirmed permanently dead (`main.ts` wires `{ resolve: () => undefined }`, zero registrations
  anywhere, no settings UI or registration mechanism ever existed). **BREAKING**: schema no longer
  accepts `logTarget.kind: 'callback'`.
- Remove `LogEntry.recordedAt` — computed and validated but never read by any consumer.
- Move `NotificationPolicy` off `Phase` into a `PhaseId`-keyed mapping resolved at the integration
  layer — confirmed during the walkthrough that a phase is state-diagram node data, not a bag of
  presentation/notification concerns; mirrors `flow-ej1`'s approach to `cssClass` for the same
  reason. This does not touch `NotificationPolicy.sound` itself, which `sound-playback-scoping`
  already decided to keep unimplemented until 0.2.0+.
- Formalize that `TaskQueueItemId` is the item's vault file path (a doc-comment correction, not a
  behavior change — `base-query-task-source`'s spec already requires `id`/`sourcePath` equality;
  only the domain type's comment claimed otherwise) rather than decoupling it, since no second
  `TaskSource` backend is planned to justify the generality.
- Applied the "indirection must earn its keep" rule to all 4 resolve-by-name registries: only
  `LogTargetResolverRegistry` fails the test and is removed (above). `HookRegistry` and
  `PredicateRegistry` resolve settings-driven, runtime-rebindable script hooks and formula
  predicates — real, used mutability, kept as-is. `TaskSourceRegistry` isn't actually standing in
  for backend-swappability (one backend, Bases, will likely ever exist) — it's keeping a phase's
  queue contents fresh as Bases' live query data changes, which is real, kept as-is. See design.md
  Decision 3 for the full reasoning per registry.
- Establish bundled/preset routine configs (Pomodoro as the first) as a requirement of the
  programming-model spec, so a human user can get a customized routine without hand-authoring the
  full `PhaseGraph` JSON.
- Establish "a human user in Obsidian, without agent help" as an explicit evaluation lens for every
  authoring-surface decision in flow-6fd's spec, not just an implicit goal.

**Non-goals**: the item-selection/mutation-targeting UX (active vs. selected vs. arbitrary queue
item, parameterized by phase/action context) is a real, confirmed-open requirement but explicitly
deferred — out of scope here. `flow-ej1`'s `PhaseGraph.cssClass` removal is a separate, narrower
bead and not touched directly, though the `NotificationPolicy`-doesn't-belong-on-`Phase` finding
above is the same category of problem.

## Capabilities

### New Capabilities
(none — this reshape modifies existing capability contracts rather than introducing new domain
concepts; the state-machine/events/handlers reframing is a restructuring of `completion-policy-
execution`/`queue-item-actions`/`hook-execution`'s existing requirements, not a new capability)

### Modified Capabilities
- `completion-policy-execution`: `queueCycle`/`futureDate`/`noOp` variants removed; `manualClear`
  gate behavior is retained, and the `null`/`autoAdvance` auto-advance path gains mutation
  derivation via `QueueItemActionPayload`.
- `queue-item-actions`: gains the "shared derivation between manual and completion-triggered
  actions" requirement, formalizing that `CompletionPolicy`'s auto-fired actions use the same
  derivation function as a manually-triggered `QueueItemAction`.
- `frontmatter-write-back-trigger`: drops the `callback` log-target branch and
  `LogTargetResolverRegistry` entirely; `nextLogEntry` drops `recordedAt`.
- `phase-transition-notifications`: "Notification Policy Wiring" requirement changes to resolve
  the current phase's notification policy via the new `PhaseId`-keyed mapping instead of reading
  `Phase.notification`.
- `routine-file-format`: drops the requirement that `queueCycle`/`futureDate` completion policies
  parse (mechanically replaced by the `autoAdvance` migration); gains a requirement for bundled/
  preset routine configs.

`hook-execution`, `transition-predicate-resolution`, and `base-query-task-source` were evaluated
against the same indirection rule and found to have no requirement-level change — see design.md
Decision 3 and 4 for why each registry (and `TaskQueueItemId`'s doc comment) is a source-level or
no-op outcome rather than a spec delta.

## Impact

- `src/domain/policy/completion-policy.ts`, `src/domain/action/queue-item-action.ts`,
  `src/timer/completion-policy-executor.ts`, `src/domain/action/derive-action-mutations.ts` —
  collapse the duplicated derivation logic.
- `src/domain/phase/phase.ts` — `PhaseLogTargetSchema`'s `'callback'` variant removed;
  `notification` field relocated.
- `src/domain/log-target/log-target-resolver.ts` — deleted.
- `src/domain/mutation/log-entry.ts` — `recordedAt` field removed.
- `src/main.ts` — `logTargetResolverRegistry` wiring removed.
- `src/domain/notification-policy.ts`'s consumer moves from `src/domain/phase/phase.ts` to a new
  `PhaseId`-keyed mapping; `src/timer/store.ts`'s notification-firing logic reads from that mapping
  instead of `phase.notification`.
- `src/domain/queue/task-source.ts` — `TaskQueueItemId`'s doc comment corrected; no shape change.
  `HookRegistry`/`PredicateRegistry`/`TaskSourceRegistry` and their `src/timer/` implementations are
  unaffected (design.md Decision 3: all three earn their keep, kept as-is).
- `src/onboarding/scaffold-example.ts`, `openspec/specs/routine-file-format/` — bundled-preset
  requirements.
- Existing routine files (including the shipped onboarding scaffold) authored against
  `CompletionPolicy.queueCycle`/`futureDate` or `logTarget.kind: 'callback'` need migration.
