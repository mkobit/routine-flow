## Context

See proposal.md - Why. The findings below are grounded in `bd show flow-616` and `bd comments
flow-6fd`; this document resolves the items that walkthrough left as "direction confirmed, not yet
designed" into concrete decisions, since flow-6fd/flow-ej1/flow-731 are blocked on this closing.

Existing spec capabilities this touches, read in full before drafting deltas:
`completion-policy-execution`, `queue-item-actions`, `frontmatter-write-back-trigger`,
`routine-file-format`, `hook-execution`, `transition-predicate-resolution`,
`base-query-task-source`, `phase-transition-notifications`.

## Goals / Non-Goals

**Goals:**
- Resolve every item the walkthrough flagged as "direction confirmed, shape undecided" into a
  concrete, justified decision — not leave them as open questions past this document.
- Apply the indirection rule (flow-6fd comment, 2026-08-17: "avoid indirection unless needed to
  simplify usage") as an actual test against each of the 4 registries and 4 ports, not just state
  it — including reaching "keep, it earns its keep" where that's the honest answer.

**Non-Goals:**
- Item-selection/mutation-targeting UX (explicitly deferred in the walkthrough — a real, separate
  design effort).
- `flow-ej1`'s `PhaseGraph.cssClass` removal itself (separate bead), though the `NotificationPolicy`
  decision below deliberately mirrors its approach for consistency.
- Redesigning the state-machine/events/handlers model as a unified type in *this change's specs*.
  **Superseded 2026-08-18** — Mike reviewed this reshape and judged it didn't go far enough ("we are
  so so overcomplicating everything"). A Software Architect (Opus) pass pressure-tested his proposed
  two-concept frame against three concrete worked examples and produced a concrete target design —
  see "Distilled direction" below. That target is *not* implemented by this change's spec deltas;
  it's the documented direction for the follow-up change tracked in bd. This change's specs remain a
  real, valid, smaller slice of it (see "Distilled direction"'s closing note for which decisions
  above survive unchanged).

## Decisions

### 1. Collapse CompletionPolicy into `manualClear` + `autoAdvance` with QueueItemAction payloads

```
CompletionPolicy
  = { kind: 'manualClear' }
  | { kind: 'autoAdvance', actions: readonly QueueItemActionPayload[] }
  | null   // sugar for { kind: 'autoAdvance', actions: [] } — today's null/noOp equivalence, now one pair instead of three
```

`actions` reuses `QueueItemActionPayload` (the `queueCycle`/`markDone`/`deferDuration`/
`setFrontmatter` union already in `queue-item-action.ts`) — not the full `QueueItemAction`, which
also carries `id`/`label`/`style` fields that only make sense for a UI-triggered button and would
be meaningless on an auto-fired completion action.

**Why**: `completion-policy-executor.ts`'s `queueCycle`/`futureDate` branches and
`derive-action-mutations.ts`'s `queueCycle`/`deferDuration` branches produce byte-identical
`FileMutation`s today, in two files, independently. One derivation function
(`deriveActionMutationsForPath` or its successor) now serves both the manual (button click) and
automatic (completion) trigger paths. `noOp` is retired in the same pass — it was already
behaviorally identical to `null` everywhere (confirmed during the walkthrough), so folding it into
`autoAdvance` with zero actions removes a second redundant pair, not just the queueCycle/futureDate
one.

**Alternative considered**: keep `CompletionPolicy` and `QueueItemAction` as fully separate types,
just delete `CompletionPolicy`'s duplicate variants and have its `queueCycle`/`futureDate`-
equivalent behavior call into `QueueItemAction`'s derivation function internally. Rejected: this
still leaves two closed unions asserting overlapping domain concepts (what mutation happens),
which is what the walkthrough flagged as the actual problem, not just the code duplication.

### 2. Move NotificationPolicy off Phase, into a PhaseId-keyed map outside the domain schema

`NotificationPolicy` is removed from `Phase`. Per-phase notification config becomes a
`Record<PhaseId, NotificationPolicy>`-shaped mapping that lives at the same layer as `flow-ej1`'s
planned home for `cssClass` (settings or view-layer construct, not the `Phase`/`PhaseGraph` domain
schema) — resolved at the integration layer, not carried by the domain type.

**Why**: confirmed during the walkthrough — "a phase is a node in the state diagram, not a bag of
presentation/notification concerns." `flow-ej1` is already making the identical call for
`cssClass` for the identical reason; mirroring its approach keeps one consistent place for
"presentation/notification config keyed by phase" instead of two different patterns for two
instances of the same category of problem. This does not touch `NotificationPolicy.sound` itself —
`sound-playback-scoping` already decided (2026 change) to keep that field unimplemented until
0.2.0+; this only changes *where* the policy struct is attached, not what it contains or whether
it's wired to audio yet.

**Alternative considered**: fold notification-firing into the Hook/handler model directly (an
`onEnter`-scoped notification hook, consistent with the state-machine/events/handlers direction).
Rejected for *this* pass as a Non-Goal — see above; that unification isn't designed yet, and
forcing notification into it here would be inventing that design under a different name.

### 3. Registries: remove one, keep three, with the actual test applied to each

Applying "does this indirection demonstrably simplify usage, or just add generality nothing
currently needs":

- **`LogTargetResolverRegistry` — removed.** Zero registrations anywhere, ever (`main.ts:63`
  permanently wires `{ resolve: () => undefined }`), no settings UI or registration mechanism
  exists to populate it. `PhaseLogTarget`'s `'callback'` variant is removed with it — the only
  remaining variant is `{ kind: 'activeItem' }`, so `Phase.logTarget` becomes a plain
  `'activeItem'`-shaped marker rather than a discriminated union with one live case.
- **`HookRegistry` — kept.** It resolves both the one built-in hook and settings-driven,
  runtime-rebindable script hooks (add/remove/change a binding in settings without editing any
  routine file). That rebinding is real, used capability, not speculative — a routine file names a
  hook by a stable identifier that settings can repoint to a different script without touching the
  routine. The earlier walkthrough observation (`ScriptHookBindingSetting.scriptPath` already being
  a real file underneath the `name` indirection) was a correct observation but not a case for
  removing the registry — it's a case for what the registry's *entries* are keyed by, not whether
  the registry should exist. No change beyond what's already true today.
- **`PredicateRegistry` — kept**, same reasoning: settings-driven, runtime-editable formula
  predicates need a mutable resolve-by-name lookup.
- **`TaskSourceRegistry` — kept**, but not for the reason originally assumed. It's not really
  standing in for backend-swappability (one backend, Bases, will likely ever exist — per the
  walkthrough). It's doing different, real work: keeping a phase's queue contents *fresh* as Bases'
  live query data changes (`MutableTaskSourceRegistry`'s own doc comment: re-registered on every
  `onDataUpdated`). That's a mutable-lookup problem regardless of backend count.

**Separate, larger, explicitly-not-resolved-here item**: whether `Phase` should carry Bases filter
criteria directly (replacing today's global, hardcoded binary `isFocus`/`isBreak` split in
`queue-filter.ts` with a real per-phase filter) is a bigger scope change — it reverses a named
Non-Goal from the already-shipped `base-query-task-source` design ("arbitrary per-phase Bases
filters are out of scope"). Reversing a shipped, deliberate Non-Goal needs Mike's explicit sign-off,
not an extrapolation from the indirection rule. **Open Question**, not decided here.

### 4. TaskQueueItemId: formalize, don't decouple

`base-query-task-source`'s spec already asserts `id` and `sourcePath` are both the entry's `path`
as a requirement (not an accident) — the only actual gap was `task-source.ts`'s doc comment
claiming independence that contradicts the spec's own shipped behavior. Fix: correct the doc
comment on `TaskQueueItemId` to state the identity explicitly, matching what three call sites and
the spec already assume. No behavior or spec change — a source-comment correction, not a delta.

**Why not decouple**: decoupling would mean inventing a real second id scheme with no concrete
driving use case (no second `TaskSource` backend is planned — see Decision 3). That's exactly the
speculative-generality pattern this reshape is arguing against everywhere else.

### 5. Bundled routine presets: extend the existing scaffold mechanism, don't build a picker UI yet

`scaffoldExampleRoutine` already ships one hardcoded preset (Pomodoro) as vault files. Extend it to
offer more than one named preset through the same mechanism (a command/settings entry per preset,
each scaffolding its own routine note + accompanying `.base`/task notes) rather than building a new
in-app routine picker or editor. This directly targets the human-authoring-without-agents gap
(day-1 is already fine; presets extend "day-1 fine" to more starting points) without taking on the
larger "visual routine editor" problem, which is a different, bigger scope than this reshape.

## Distilled direction (2026-08-18) — Graph + Handler + Effect

Not implemented by this change's spec deltas. Documented here as the agreed target direction,
worked out by pressure-testing Mike's proposed frame — "a graph representation, cyclic-capable,
carrying enough state to say this is transition x or y, plus event handlers around it" — against
three concrete worked routines (Pomodoro, an exercise/stretch routine, a morning checklist), each
drawn as a Mermaid diagram and mapped onto every current domain type. Full analysis, diagrams, and
a complete zod-shaped type sketch: see bd issue `flow-16c` (sanity-check review pass — this
section is its input) and `flow-jw3` (expand the example vault with the exercise/morning-routine
presets used as fixtures throughout this analysis).

**Headline**: the two-concept frame holds, refined — it's *graph, with routing guards living on the
edges, plus one effect-handler concept* — not one universal handler. Three things legitimately
don't collapse into either bucket: a node's auto-advance gate (it's a plain field, not a reactor or
structure), `TaskSource` (a node's data supply), and the ports (`FileMutationPort` etc. — they
execute effects, they aren't handlers).

**On `Predicate`**: not "just another handler." A routing guard (`everyNth`, `queueExhausted`,
`custom`) must be pure, synchronous, and safe to evaluate speculatively — `findNextPhase` already
previews the next phase without committing, to drive the UI. An effect handler is the opposite:
async, impure, may prompt the user, and must never run speculatively (previewing would double-write
the vault). These are incompatible contracts; fusing them either breaks reducer purity or
reintroduces the discriminated union under a new name. `Predicate` is the **guard on an edge** — it
belongs to the graph, not the handler concept.

**Two real capability gaps this exposed**, missed by the original walkthrough because it only
examined the shipped, cyclic Pomodoro graph:
1. **No terminal node.** A reachable phase with no outgoing transition is currently treated as a
   configuration *error* (`checkPhaseGraphIntegrity`'s `noOutgoingTransitionIssues`) — so an
   acyclic, naturally-ending routine (the morning checklist; an exercise routine's cool-down)
   literally cannot be authored today. Every routine is forced into a perpetual loop.
2. **No cross-session scheduling concept.** "Run this routine again tomorrow" (the morning
   routine's actual recurrence) isn't a graph cycle at all — it's a scheduling wrapper around
   opening a fresh traversal of the same graph, and nothing in the domain models that today.

**Biggest cut beyond what this change's Decision 1 already did**: delete `CompletionPolicy` as a
*type* entirely, not just trim its variants. Across all three worked examples its only real job is
a gate (`manualClear` vs. auto-advance) — properly a single field on the node
(`onCompletion: 'autoAdvance' | 'waitForManual'`), not a discriminated union. Its mutation variants
were already proven duplicate of `QueueItemAction` (Decision 1); folding the gate out as a plain
field is what finishes the job.

**Net result**: six current domain types (`TransitionCondition`, `CompletionPolicy`,
`QueueItemAction`, `NotificationPolicy`, `Predicate`, `Hook`) fold into two (`Handler`, `Effect`)
plus edge guards living on the graph. `Effect` absorbs `FileMutation` and notification-as-data;
`Handler` has two bindings (`preset` — declarative, closed vocabulary, subsumes
`CompletionPolicy`'s mutation variants + `QueueItemAction` + notification; `script` — today's
`Hook`, unchanged in kind). A node's `handlers.onEnter/onComplete/onSkip/onExit` each become a
*list* of `Handler` (today: at most one `HookReference` per event) — a genuine capability increase,
not just a rename.

**What stays exactly as this change already decided**: keep static `Graph` (was `PhaseGraph`) and
runtime `Traversal` (was `EngineState`) as two separate types — that split is correct and is *not*
what's overcomplicated; Mike's "carry some state" is satisfied by the runtime companion, not by
fattening the graph type itself. This change's Decisions 2 (`NotificationPolicy` off the node), 4
(`TaskQueueItemId` formalization), and the `LogTargetResolverRegistry`/`LogEntry.recordedAt`
removals are all still correct and orthogonal to this distillation — it builds on them rather than
replacing them.

**What this section deliberately does not do**: propose task-level implementation steps, or spec
deltas for the full unification. That's the point of the sanity-check pass this document is now
checkpointed for — see `flow-16c`.

## Risks / Trade-offs

- **[Risk]** Removing `CompletionPolicy.queueCycle`/`futureDate` is a breaking schema change — any
  existing hand-authored routine file using them stops parsing. **Mitigation**: `parseRoutineFile`
  already returns a structured `RoutineParseError` rather than throwing; the migration is
  mechanical (documented in the spec delta's Migration note) and the only shipped routine file
  using the old shape is the onboarding scaffold itself, updated in the same change.
- **[Risk]** `NotificationPolicy` moving off `Phase` changes how routine authors configure it (a
  separate mapping instead of an inline field) — a real authoring-ergonomics regression if that
  separate mapping isn't itself simple. **Mitigation**: same shape/precedent as `flow-ej1`'s
  `cssClass` approach; solving that ergonomics question once (in whichever bead lands first between
  this and `flow-ej1`) covers both.
- **[Trade-off]** Keeping 3 of 4 registries means this reshape delivers less API-surface reduction
  than the walkthrough's early "compress/reduce APIs" framing implied. That's an intentional result
  of actually applying the indirection rule rather than a shortfall — the rule is a test, not a
  quota, and two of the three kept registries are load-bearing for existing, real settings-driven
  runtime behavior.

## Open Questions

- Should `Phase` carry Bases filter criteria directly, replacing the global hardcoded
  `isFocus`/`isBreak` binary split (`queue-filter.ts`)? This reverses a named Non-Goal from the
  shipped `base-query-task-source` design and needs Mike's explicit call, not an extrapolation.
- Exact shape of the `PhaseId`-keyed notification mapping (Decision 2) — deliberately left to
  converge with whatever `flow-ej1` lands on for `cssClass`'s equivalent, rather than designed
  twice independently.
- Terminal-node support and cross-session scheduling (both surfaced by "Distilled direction" above)
  — tracked for `flow-16c`'s sanity-check pass, not designed here.
