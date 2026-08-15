## Context

Mike's 2026-07-04 manual testing of flow-gu1.8 first flagged the plugin's visual styling as rough; his 2026-07-21 pass expanded that into six tracked "screens" under epic flow-gu1.20 (notes on flow-gu1.20, updated 2026-07-22). flow-gu1.20.1 claimed the job of turning that into "a prioritized list of concrete styling follow-up beads" — this document is that scoping pass's write-up, produced by auditing `src/views/`, `src/main.ts`, and `src/settings.ts` directly rather than working from the six-screen list alone.

Two adjacent, already-filed beads bound this document's scope:
- flow-gu1.61: `styles.css`'s current content (`.bases-echarts-*`, `.bases-chart-modal`) is dead CSS from an unrelated project (confirmed via grep — zero `echarts`/`chart` hits anywhere in `src/`). Every surface below is audited as if `styles.css` were empty; the dead rules are noise, not prior art.
- flow-gu1.60: internal `Pomodoro*` naming (class names, `pomodoro-*` CSS classes, `pomodoro-*` frontmatter keys) is pervasive and some of it is persisted/user-facing (the Bases view-type string, frontmatter keys), so it can't be blindly renamed. This document used the then-current names throughout (e.g. `pomodoro-timer-panel`) — a future rename was that bead's job, not this one's. (2026-07-28: flow-gu1.60's rename has since landed; citations throughout this document have been updated to the new `Routine*`/`routine-*` names.)

A `claude.ai/design` DesignSync project ("Routine Flow", projectId `f9c07593-4338-4513-bfc7-1c52557d97d5`) exists with one throwaway test component pushed. That track is paused pending a separate Stitch MCP evaluation and is untouched by this change.

## Goals / Non-Goals

**Goals:**
- Enumerate every distinct UI surface implemented in `src/` today, each grounded in a concrete file:line reference — not just the six screens already named in flow-gu1.20's notes.
- State each surface's actual current visual state (styling, not behavior) plainly and honestly — distinguish "exists, unstyled" from "doesn't exist yet, this is a proposal."
- Give each surface a first-pass design direction: what it needs to communicate, its information hierarchy, its distinct states — as a prose brief, not CSS or pixel values, suitable as later input to Stitch.
- Identify any surface not yet covered by an existing bead and get it tracked.

**Non-Goals:**
- Writing or proposing actual CSS, class names, colors, or spacing values.
- Deciding the `Pomodoro*` → `Routine Flow` internal renaming (flow-gu1.60) — this document originally used the pre-rename real names; citations were updated in place once that rename landed (2026-07-28), rather than left to drift stale.
- Removing the dead `styles.css` content (flow-gu1.61) — noted as noise, not removed here.
- Evaluating or configuring the Stitch MCP integration itself, or touching the DesignSync project.
- Implementing any of flow-gu1.11/.56/.57/.59 — those remain unbuilt; this document describes what they'd need to communicate, not how to build them.

## Decisions

This scoping pass settled on documenting 12 distinct surfaces/states — the six already tracked, five additional `RoutineTimerView` rendering states worth calling out individually rather than folding into "the timer view," and one new modal. Each is numbered below with its current state and first-pass design direction. Surfaces are grouped by whether they exist in shipped code today (1-8) or are not-yet-built proposals (9-12).

A companion document, `surface-model.md`, layers four analytical lenses on this same 12-surface inventory — taxonomy (surface type/primitive/lifecycle), relationships (concurrency, mutual exclusion, triggers/lifecycle, sequencing), jobs-to-be-done (why the user is there), and a grounded interactions inventory (every button/field/click target, with keyboard behavior) — using the same #1–#12 numbering and the same shipped-vs-proposed honesty convention. It also resolves this document's first Open Question (surface #9 vs. #1 design pass — see below). Read the two side by side.

### Surfaces that exist in `src/` today

#### 1. Timer panel + controls + queue — normal/active state
**Tracked by:** flow-gu1.20.1. **Where:** `src/views/timer-view.ts:108-171` (`.routine-timer-panel`, `.routine-controls`, `.routine-queue`), rendered inside the Bases-embedded `RoutineTimerView`.
**Current state:** Unstyled. A `<h2>` header (`phase.label: mm:ss (status)`, line 109-118), a next-phase indicator (`.routine-next-phase`), a row of plain `<button>` elements with no layout container styling (Pause/Start, conditionally Done, always Reset — lines 127-142), and a `<ul>` of plain `<li><button></button></li>` queue rows (lines 161-171), one of which gets `.is-active-task` with no corresponding rule. No visual grouping, spacing, or hierarchy beyond default block/HTML flow.
**Communicates:** Time remaining and phase identity (most important — this is a timer), the upcoming next phase in sequence (e.g. "Next: Short break" or "Next: Long break" for every-Nth transitions), current transport state (running/paused/stopped), and the current task queue with which item is active.
**Hierarchy:** Countdown + phase label should dominate; next-phase sub-caption provides secondary sequence context; transport controls are secondary but need to be immediately reachable; the queue is tertiary — useful for context, but shouldn't compete with the countdown for attention.
**Design direction:** A clear typographic scale (large countdown, smaller phase/status text, sub-caption for next phase), a grouped control row (not three loose buttons), and a queue list where the active item is visually distinct (not just structurally marked via `.is-active-task`) from pending items. The queue's underlying data already carries `routine-status`/`routine-priority` per item (`src/timer/base-query-task-source.ts:20,23`) that today's rendering doesn't surface at all (`timer-view.ts:162-170` only renders `displayName`) — worth deciding whether a design pass exposes status/priority visually (e.g. a badge) or deliberately keeps the queue text-only.

#### 2. Timer panel — loading state
**Tracked by:** flow-gu1.20.1 (not previously itemized by name). **Where:** `src/views/timer-view.ts:86-89`, class `routine-loading`.
**Current state:** A single unstyled `<p>Loading routine…</p>`; nothing else renders (early return at line 88).
**Communicates:** The view is waiting on an async read of a configured routine file (`loadRoutineFile`, line 204) and is not yet interactive.
**Hierarchy:** Single message, no competing content — but it replaces the entire panel, so it should read as "in progress," not "broken" or "empty."
**Design direction:** A lightweight in-progress affordance (motion or icon, not just text) so it's visually distinct from the error and empty-queue states below, which also reduce to short strings today and are otherwise easy to confuse with each other.

#### 3. Timer panel — error state
**Tracked by:** flow-gu1.20.1 (not previously itemized by name). **Where:** `src/views/timer-view.ts:81-84`, class `routine-error`.
**Current state:** A single unstyled `<p>Routine error: {message}</p>`; nothing else renders (early return at line 83). Reachable when a configured `routineFile` doesn't resolve to a vault file, or fails to parse as a valid routine (`resolveRoutineGraph`).
**Communicates:** Something the user configured (a routine file reference) is broken, and what specifically is wrong (the raw error message).
**Hierarchy:** The error message is the only content — it must be legible as an error (not mistakable for the loading or normal-state text) and ideally point toward a fix (the Bases view's `routineFile` option).
**Design direction:** Obsidian's conventional error/warning visual language (icon + color drawing on theme error variables) rather than plain paragraph text, so it reads as "fix your configuration" at a glance, not as another status line.

#### 4. Timer panel — inert state
**Tracked by:** flow-gu1.20.1 (not previously itemized by name). **Where:** `src/views/timer-view.ts:120-122`, class `routine-inert`.
**Current state:** An unstyled `<p>` appended below the header, reading `"{active routine}" is currently active instead of this view's routine ("{this view's routine}").`. Shown when this Bases leaf's configured routine differs from whatever routine graph is globally active and running/paused (`isViewRoutineActive` false, `state.status !== 'stopped'`) — i.e., this specific view is a bystander to a routine running elsewhere.
**Communicates:** "This isn't the routine that's actually running right now" — a disambiguation the current global-single-active-routine model (flow-gu1.23) makes necessary whenever more than one Bases leaf is open on different routines.
**Hierarchy:** Subordinate to the header, but must be noticeable enough that a user doesn't mistake what the header is showing. Correction (2026-07-22, caught by adversarial review): the header does **not** show this leaf's own routine while inert — `phase`/`headerText` (`timer-view.ts:93-118`) are derived from `graph = this.plugin.store.getGraph()`, the globally *active* routine, never from `viewGraph` (this leaf's own configured routine). So an inert leaf displays the *other, actually-running* routine's live phase/countdown/queue, with this disclaimer paragraph appended below it — not a static snapshot of its own routine.
**Design direction:** A distinct visual treatment (e.g. a muted/informational banner style) that reads as "informational, not an error" — this is expected multi-view behavior, not a problem — while making unmistakable that the countdown/queue above belongs to the *other* routine, not this leaf's own, before someone clicks Start or a queue item expecting to interrupt the wrong routine.

#### 5. Queue panel — empty and no-queue-at-all states
**Tracked by:** flow-gu1.20.1 (not previously itemized by name). **Where:** empty queue — `src/views/timer-view.ts:156-158`, unstyled `<p>No tasks found.</p>`, no CSS class at all. No-queue-at-all — `timer-view.ts:145-147`, an early `return` when `phase.taskSourceId === null` (e.g. a rep-based phase with nothing to queue), meaning the queue panel doesn't render at all, not even a heading.
**Communicates:** Empty queue: "your filter/routine matched zero notes." No-queue-at-all: this phase was never meant to have a queue (a structural fact about the routine, not a transient empty state) — conflating the two would mislead a user into thinking they misconfigured something when they didn't.
**Hierarchy:** Both are low-priority relative to the timer panel/controls above them, but need to be visually distinguishable from each other since they mean different things.
**Design direction:** Give the empty-queue state its own class (there isn't one today) and copy/treatment that invites action ("no notes match — check your queue filter"), distinct from the no-queue-at-all case, which needs no visual affordance at all beyond simply not implying a queue was expected.

#### 6. WriteBackModal — "Confirm write-back"
**Tracked by:** flow-gu1.20.1. **Where:** `src/views/write-back-modal.ts:45-73`.
**Current state:** Unstyled `Setting`-row chrome: a File field with vault-wide autosuggest (`VaultFileSuggest`, lines 7-16, 48-60), a Property text field (62-64), a Value text field (66-68), and Cancel/Submit buttons (70-72) — plain Obsidian `Modal`/`Setting` defaults, no custom layout or field grouping.
**Communicates:** "A focus phase just completed and is about to write `{value}` to `{property}` on `{file}` — confirm or change any of the three before it happens."
**Hierarchy:** The file is the highest-stakes field (wrong file = wrong note edited); property and value are usually accepted as-is (they're pre-filled with sane defaults) but need to remain easily editable.
**Design direction:** Visually establish the sentence this modal is really asking ("write **{value}** to **{property}** on **{file}**?") rather than three undifferentiated fields — likely via field ordering/grouping and typographic emphasis on the resolved defaults, with the autosuggest dropdown kept legible against the modal background.

#### 7. RoutineReplaceModal — "Replace running routine?"
**Tracked by:** flow-gu1.62 (**new bead, filed by this scoping pass**). **Where:** `src/views/routine-replace-modal.ts:27-36`.
**Current state:** Unstyled: a single `<p>` (lines 29-31) stating the current routine's name, the incoming routine's name, and that progress will be lost, plus Cancel/Replace buttons (33-35). Shown when the user clicks Start on a routine while a different routine is already active (`decideStartAction`'s `'confirm'` branch, `timer-view.ts:224-229`).
**Communicates:** A destructive-ish action is about to happen (the running routine's progress resets) and needs explicit confirmation — this is a "are you sure" dialog, structurally close to WriteBackModal but semantically a warning, not a data-entry form.
**Hierarchy:** The consequence ("progress will be lost") is the single most important fact; routine names are supporting detail.
**Design direction:** Should read as a warning/confirmation (Obsidian's destructive-action button styling on "Replace," consistent with how Obsidian itself styles delete-type confirmations) rather than as a neutral form — currently "Replace" uses `.setCta()` (the same treatment WriteBackModal gives its neutral "Submit"), which doesn't distinguish "confirm a write" from "confirm losing progress."

#### 8. RoutineFlowSettingTab — settings screen
**Tracked by:** flow-gu1.58. **Where:** `src/settings.ts:69-154`.
**Current state:** Declarative `getSettingDefinitions()` defining four sections / controls: Write-back property (`writeBackProperty`), Progress meter style dropdown (`progressMeterStyle`), Custom formula predicates list + add-row (`formulaPredicates`), and Script hooks group (Scripts folder `scriptsFolder` + `scriptHookBindings` list + add-row).
**Communicates:** Global plugin settings across four operational areas: write-back target property, timer dial visualization style, formula-authored transition condition predicates, and vault JS script hook bindings.
**Hierarchy:** Top-level scalar settings (write-back property, progress-meter style) followed by list/builder sections for custom transition predicates and script hook bindings.
**Design direction:** Uses Obsidian's settings-tab conventions via `getSettingDefinitions()` (`SettingDefinitionItem`), organized into clear setting rows, list controls, and group sections (`type: 'group'`).

### Surfaces not yet built (proposals only — no code exists)

#### 9. Workspace-wide app view
**Tracked by:** flow-gu1.11. **Where:** nothing yet — no `ItemView`/status-bar registration exists anywhere in `src/main.ts` (confirmed: no `addStatusBarItem`/`registerView`/`ItemView` subclass in `src/`).
**Communicates (proposed):** At a glance, whether a routine is running, which phase, and how much time remains — from anywhere in the workspace, not just the Bases leaf.
**Hierarchy (proposed):** Necessarily far more compressed than surface #1 — likely phase label + countdown only in a status-bar form, with a fuller view (phase + controls + queue) as an optional expanded/side-panel state.
**Design direction:** Two effective sub-surfaces to brief separately once built: a status-bar item (glanceable, minimal) and a side-panel view (closer to surface #1's fidelity, but usable while another file has focus). Needs its own relationship to surface #1 defined — e.g. does starting a routine from the Bases view also populate the status bar, and do controls exist in both places or only one.

#### 10. System (OS-level) notifications
**Tracked by:** flow-gu1.56. **Where:** nothing yet — `Phase.notification` (`src/domain/phase/phase.ts:63`) is unread by any code in `src/` (flow-gu1.34 already flags this as dead config).
**Communicates (proposed):** A phase transition happened, for a user who isn't currently looking at Obsidian.
**Hierarchy (proposed):** Title (what transitioned) + one line of detail (what's next); OS notification chrome imposes its own hierarchy, so this is mostly a copy/timing brief, not a layout one.
**Design direction:** Copy and timing brief: what wording distinguishes "focus complete, break starting" from "break complete, focus starting," whether/when the notification is actionable (e.g. a "start break" action button, OS-permitting), and whether it needs a permission-prompt UX pass (first use) distinct from the notification content itself.

#### 11. In-app notifications (Obsidian Notice) on phase transitions
**Tracked by:** flow-gu1.57. **Where:** nothing yet for phase transitions specifically. Two *existing* `Notice` call sites exist for a different trigger — error reporting, not phase transitions: `src/main.ts:22` (write-back mutation failure) and `src/main.ts:54` (hook dispatch failure), both plain default-styled `new Notice('Routine Flow: ...')` calls.
**Communicates (proposed):** Same phase-transition information as surface #10, but for the in-app case (no OS permission needed, only visible while Obsidian is focused).
**Design direction:** Copy/duration/actionability brief, same shape as surface #10's. Worth reconciling with the two existing error-toast call sites during implementation — both currently prefix copy with `Routine Flow:` (flow-gu1.60's naming audit resolved the prefix's wording; consistency across surfaces is still this bead's call) and neither currently has any visual treatment beyond Obsidian's own `Notice` default, so a consistent in-app-notification copy/tone convention across "phase transitioned" and "something failed" toasts is worth deciding once, not twice.

#### 12. In-app demo/onboarding
**Tracked by:** flow-gu1.59. **Where:** `src/onboarding/scaffold-example.ts`, command palette entry `Routine Flow: Seed example routine` (`main.ts`).
**Communicates:** How to get a working routine without hand-authoring a `.base` file and routine frontmatter from scratch.
**Design direction:** Scaffolds a `Routine Flow Examples/` folder containing `Pomodoro Routine.md`, `Sample Task.md`, and `Tasks.base` into the active vault.

### Confirmed absent (negative findings, so a future pass doesn't have to re-check)

- **No ribbon icon:** no `addRibbonIcon` call anywhere in `src/`.
- **No command palette entries:** no `addCommand` call anywhere in `src/`.
- **No mobile-specific rendering:** no `isMobile`/`Platform` checks anywhere in `src/`; `styles.css`'s mobile media queries belong to the dead chartkit CSS (flow-gu1.61), not this plugin.
- **Bases "add view" picker entry** (`src/main.ts:68-80`, `registerBasesView('routine-timer', { name: 'Routine Timer', icon: 'timer', ... })`): the name/icon shown when a user adds this view type to a Base is native Obsidian/Bases chrome — not a surface this plugin can restyle beyond the declared name string and Lucide icon name. (Its naming used to overlap flow-gu1.60's audit; that rename has since landed.)
- **Bases view-options configuration UI** (`RoutineTimerView.getViewOptions`, `timer-view.ts:237-270`): the field list (focus/break property/value, routine file) is rendered entirely by Bases itself from the declared `BasesOptions[]` metadata — no custom styling surface exists here either.

## Risks / Trade-offs

**2026-07-22 correction pass:** an adversarial review (a separate agent, instructed to find flaws rather than confirm the work) checked every file:line citation in this document and `surface-model.md` against the actual code, attacked the relationships/mutual-exclusion claims, and re-verified the "confirmed absent" negative findings. It found and this pass fixed: (1) this document's #4 entry had the inert-leaf header claim backwards (corrected above); (2) `surface-model.md` contradicted itself on whether #1/#4 can coexist (corrected there); (3) the "#6/#7 never fire together" claim rested on an unsound justification (softened, not disproven); (4) the #9-vs-#1 resolution overstated certainty about unbuilt code (softened); (5) a wrong file:line citation in `surface-model.md`'s triggers table (removed); (6) surfaces #1-6 had no dedicated implementation-tracking bead despite being flow-gu1.20.1's original scope (filed as flow-gu1.19.5). One review finding (a supposed citation mixup in `write-back.ts`) was itself checked and found incorrect — the original citation was accurate, so it was left unchanged. Every other claim the review attacked (all `#1-#8` citations, all four "confirmed absent" negatives, the jobs-to-be-done section) held up.

- **[Risk]** Treating surfaces #2-#5 as individually brief-able states rather than one "timer view" brief adds inventory overhead → **Mitigation:** accepted deliberately, per this task's own instruction — they're genuinely different information states (loading vs. broken vs. informational vs. empty) that a single generic brief would blur together, and Stitch mockup generation benefits from distinct state descriptions.
- **[Risk]** This document proposes design *direction* (communication goals, hierarchy) without validating it with Mike before beads are filed against it → **Mitigation:** none of the 12 entries commit to specific visual treatment (no color/spacing/CSS) — the follow-up beads (existing + flow-gu1.62) remain the place where an actual styling pass, informed by Stitch output and Mike's review, happens.
- **[Trade-off]** Surfaces #9-#12 are briefed at a shallower level than #1-#8 since no implementation exists to audit → accepted; deeper detail on those would be speculation about code that doesn't exist yet, not grounded scoping.

## Migration Plan

Not applicable — this change adds a document and files/updates beads; no code or data migrates.

## Open Questions

- ~~Should surface #9 (workspace-wide view) and surface #1 (Bases-embedded view) share a single design language pass, or be briefed to Stitch independently given how different their space constraints are (status bar vs. full panel)?~~ **Resolved in `surface-model.md` §2.5:** they share the underlying state model (one `EngineStore`, so they agree by construction — no sync problem) and the cross-surface design foundations (flow-gu1.19.2), but warrant separate per-surface briefs because their space budget differs fundamentally, #9 has no per-leaf routine binding (so no inert state #4), and their interaction sets differ. No new bead — owned by flow-gu1.11/flow-gu1.19.4.
- Does reconciling the existing error-`Notice` copy (surface #11) belong inside flow-gu1.57's scope, or is it a separate small cleanup? Left as a note on flow-gu1.57's future implementer to decide, not resolved here.
