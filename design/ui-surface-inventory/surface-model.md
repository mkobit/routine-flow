# Surface model

This document layers four analytical lenses on top of `design.md`'s per-surface inventory: taxonomy, relationships, jobs-to-be-done, and a grounded interactions inventory.
`design.md` catalogs *what* each of the 12 surfaces renders and *what it must communicate*; this document models *what type* each surface is, *how they relate*, *why a user is there*, and *every interaction one offers today*.
Surface numbers (#1–#12) are the same as `design.md`'s and are not repeated in full here — read the two side by side.

The same honesty convention applies: surfaces #1–#8 exist in `src/` today; surfaces #9–#12 are proposals with no code, so their relationships and interactions are marked **proposed**, not shipped.

## 1. Taxonomy

Each surface is classified by its Obsidian UI primitive and its lifecycle, because those two facts drive both the Obsidian convention that governs it and the design-tool briefing strategy it needs (a glanceable status-bar chrome, an app-modal form, and a persistent in-leaf panel are briefed very differently).

| # | Surface | Category | Obsidian primitive | Lifecycle | Shipped |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Timer panel — active | A. Embedded Bases view | `BasesView` subclass (`timer-view.ts:15`) | Persistent (lives in a workspace leaf) | Yes |
| 2 | Timer panel — loading | A. Embedded Bases view (render state) | same `BasesView` (`timer-view.ts:86-89`) | Persistent, transient sub-state | Yes |
| 3 | Timer panel — error | A. Embedded Bases view (render state) | same `BasesView` (`timer-view.ts:81-84`) | Persistent, transient sub-state | Yes |
| 4 | Timer panel — inert | A. Embedded Bases view (render state) | same `BasesView` (`timer-view.ts:120-122`) | Persistent, conditional sub-state | Yes |
| 5 | Queue — empty / no-queue | A. Embedded Bases view (render state) | same `BasesView` (`timer-view.ts:145-158`) | Persistent, conditional sub-state | Yes |
| 6 | WriteBackModal | B. Modal dialog (data-entry) | `Modal` subclass (`write-back-modal.ts:24`) | Transient, app-modal (blocking) | Yes |
| 7 | RoutineReplaceModal | B. Modal dialog (confirmation) | `Modal` subclass (`routine-replace-modal.ts:12`) | Transient, app-modal (blocking) | Yes |
| 8 | RoutineFlowSettingTab | C. Settings panel | `PluginSettingTab` subclass (`settings.ts:69`) | On-demand, in Obsidian's settings window | Yes |
| 9 | Workspace-wide view | D. Workspace chrome | `addStatusBarItem` + side-panel `ItemView` (neither registered) | Persistent (proposed) | **Proposed** |
| 10 | System (OS) notifications | E. Transient notification (OS) | OS notification API via `Phase.notification` (unread) | Transient, non-blocking (proposed) | **Proposed** |
| 11 | In-app phase-transition toasts | E. Transient notification (in-app) | `Notice` (`main.ts:22,54` exist for errors only) | Transient, non-blocking (proposed) | **Proposed** |
| 12 | In-app demo / onboarding | F. Onboarding / first-run flow | Command palette action (`main.ts`) | One-off | Yes |

Category summary:

- **A. Embedded Bases view** — one component (`RoutineTimerView`) with five distinct render states (#1–#5). It is *persistent*: it stays mounted in its leaf across state changes and re-renders in place (`timer-view.ts:31-34,43-46`). Its states are mutually exclusive branches of a single `render()` call, not separate surfaces a user navigates between.
- **B. Modal dialog** — two `Modal` subclasses (#6, #7), both *transient* and *app-modal* (they block interaction with the workspace until resolved). Both use the same "modal as an awaitable" pattern (`waitForResult` opens the modal and returns the one promise it resolves — `write-back-modal.ts:38-43`, `routine-replace-modal.ts:20-25`).
- **C. Settings panel** — one `PluginSettingTab` (#8), rendered by Obsidian inside its own settings window, independent of the workspace.
- **D. Workspace chrome** — the proposed workspace-wide view (#9), itself two candidate sub-surfaces (a status-bar item and a side-panel view). *Persistent* like category A, but not bound to a Bases leaf.
- **E. Transient notification** — proposed phase-transition notifications, OS-level (#10) and in-app (#11). Non-blocking, self-dismissing. #11's in-app `Notice` primitive is already used for two *error* call sites (`main.ts:22,54`), but not yet for phase transitions.
- **F. Onboarding flow** — the proposed first-run/demo experience (#12), whose primitive is deliberately undecided (`design.md` #12).

## 2. Relationships

### 2.1 Single source of truth

Every surface that shows timer state is a projection of one shared `EngineStore` (`main.ts:51`) — there is exactly one store, holding one active `PhaseGraph` and one `EngineState`.
`RoutineTimerView` subscribes to it (`timer-view.ts:31-34`) and re-renders on every state change; it never holds timer state of its own.
This is the load-bearing fact for every relationship below: surfaces cannot *disagree* about status / phase / remaining, because there is only one state to read.

### 2.2 Concurrency — what can be visible at once

| Pair | Can coexist? | Notes |
| :-- | :-- | :-- |
| Multiple #1 instances (several Bases leaves) | Yes | Multiple leaves can each render `RoutineTimerView` simultaneously. All read the one store, so they agree on global status/phase/remaining. Each has its *own* configured `routineFile` (`timer-view.ts:60,199-202`), so at most one is "active" and the rest render the inert state #4 (`timer-view.ts:99,120-122`). |
| #1 and #4 (inert) | Yes — #4 is additive within #1 | Corrected (2026-07-22, adversarial review caught a self-contradiction with §2.3 below): #4 is not an alternative branch to #1, it's conditional content *appended within* the same active-panel render (`timer-view.ts:120-122`, right after the header at `:118`). A bystander leaf renders #1's full panel (header, controls, queue — all still reading the globally active routine's state) *and* the inert paragraph together, not one or the other. |
| #6 (WriteBackModal) and #7 (RoutineReplaceModal) | Not observed in normal flow, but the reasoning below is weaker than originally stated | Softened (2026-07-22, adversarial review): `EngineStore.dispatch` (`store.ts:70-97`) has no reentrancy guard — "single-threaded JS" alone doesn't prevent a second `dispatch`/`handleStart` call while a prior one's hook is still `await`ing the write-back prompt. On natural (tick-driven) completion, `status` is set to `'stopped'` before the hook's prompt is awaited, which defuses `decideStartAction`'s guard — but on a manual-clear (Done button) completion, `status` becomes `'completed'` instead, which does *not* defuse that guard. Whether RoutineReplaceModal could open while WriteBackModal is still pending (e.g. via a second window/pop-out leaf, never ruled out by this document) is unproven either way — treat "they do not fire together" as an open question, not a settled fact. |
| #6/#7 modal and any #1–#5 timer state | Modal is layered over it | The modal blocks the workspace but the timer panel remains mounted underneath and resumes on modal close. |
| #8 (settings) and a running routine | Yes | Settings opens in Obsidian's own settings window; it does not display timer state, so there is nothing to keep in sync. |
| #10/#11 (notifications) and any surface | Yes | Transient, non-blocking; can appear over any surface. **Proposed.** |
| #9 (workspace view) and #1 | Yes — **proposed** | See 2.5. |

### 2.3 Mutual exclusion

- The five embedded-view states #1–#5 are mutually exclusive *per leaf*: `render()` takes exactly one branch — error → return (`:81-84`), else loading → return (`:86-89`), else the active panel, within which the queue is either empty (`:156-158`), absent (`:145-147`), or populated (`:161-171`), and the inert notice (`:120-122`) is additive on a bystander leaf.
- The two modals #6 and #7 are mutually exclusive in practice (2.2).

### 2.4 Triggers and lifecycle — what makes each appear / disappear

| # | Appears when | Disappears when | Grounding |
| :-- | :-- | :-- | :-- |
| 1 | The `routine-timer` Bases view is added to a leaf and its routine resolves to `default`/`loaded` with a findable phase | Leaf closes, or state moves into a loading/error/inert branch | `main.ts:68-80`, `timer-view.ts:29-35,91-97` |
| 2 | A newly configured `routineFile` differs from the last and its async read is in flight | `loadRoutineFile` settles to `loaded`/`error` | `timer-view.ts:61-66,86-89,204-215` |
| 3 | The configured `routineFile` doesn't resolve to a vault file, or fails to parse | The routine selection changes to a valid file | `timer-view.ts:81-84,206-208`; `routine-selection.ts:18-21` |
| 4 | A *different* routine is globally active (`status !== 'stopped'`) than this leaf's configured routine | The active routine matches this leaf's, or status returns to `stopped` | `timer-view.ts:99,120-122` |
| 5 | Active phase has a `taskSourceId` but zero queue items (empty), or no `taskSourceId` at all (no-queue) | Queue gains items, or phase changes | `timer-view.ts:145-147,156-158` |
| 6 | A phase completes and its write-back hook resolves a target file — in practice a **focus** phase with a non-null `activeFilePath` (the `activeItem` log target) | Cancel / Submit / Escape / click-outside | `phase-graph.ts:88,99`; `write-back.ts:28-32,46-53`; `write-back-modal.ts:45-93` |
| 7 | Start is clicked while a session is in progress on a *different* routine (`decideStartAction` → `'confirm'`) | Cancel / Replace / Escape / click-outside | `timer-view.ts:217-229`; `routine-selection.ts:30-37`; `routine-replace-modal.ts:27-49` |
| 8 | User opens the plugin's tab in Obsidian settings | User leaves the settings tab | `main.ts:82`; `settings.ts:25-41` |
| 9–12 | **Proposed** — see `design.md` #9–#12 | **Proposed** | — |

Note on #6's trigger precision: `onComplete` is wired on *all three* phases (`phase-graph.ts:88`, via `phaseDefaults`), but the break and long-break phases use a `dailyNote` callback log target (`phase-graph.ts:109,119`) for which no resolver is registered (`main.ts:41`), so the hook returns `[]` before prompting (`write-back.ts:31-32,47-49`). The modal therefore surfaces only on focus-phase completion with an active task set — not on every phase completion.

### 2.5 Resolution — does surface #9 share a design pass with surface #1?

`design.md`'s Open Questions left this unresolved. Resolution, grounded in the code:

**They share the underlying state model and the cross-surface design foundations, but warrant separate per-surface design briefs.**

Why they share:

- There is one `EngineStore` (`main.ts:51`). *If* a workspace-wide view (#9) subscribes to that *same* store — the natural approach, and what `RoutineTimerView` itself does (`timer-view.ts:31-34`) — it cannot hold a second copy of timer state, so **#9 and #1 would agree by construction**: no state to reconcile, no sync problem. Softened (2026-07-22, adversarial review): this is a strong architectural recommendation given how the store already works, not a settled fact about code that doesn't exist yet — #9 has zero implementation, so "subscribes to the shared store" is the recommended design, not a verified property of a real component. `design.md` #9's own sub-question ("does starting a routine from the Bases view also populate the status bar") is answered *conditionally*: yes, if #9 is built this way — which whoever picks up flow-gu1.11 should treat as a design decision to make, not inherit as inevitable.
- The state vocabulary they render (phase label, status, remaining) is identical, so the color/type/spacing/state-language decisions belong to the shared design foundations (`flow-gu1.19.2`), not to either surface alone.

Why they still need separate briefs:

1. **Space budget differs fundamentally.** #1 is a full in-leaf panel (header + controls + queue, `timer-view.ts:108-171`); a status-bar #9 is a single glanceable line. A brief tuned for one produces the wrong layout for the other.
2. **#9 has no per-leaf routine binding.** #1's inert state #4 exists *only* because a Bases leaf is bound to a specific configured `routineFile` (`timer-view.ts:60,199-202`) that may differ from the active routine. A status-bar item is an unconditional projection of "whatever is globally active," so it has **no inert state and no view-vs-active disambiguation** — a structural difference #1's brief carries and #9's must not.
3. **Interaction sets differ** (see section 4): #1 offers Start/Pause/Done/Reset plus queue selection plus the routine-replace confirmation flow; a glanceable #9 is likely display-only or minimal-control, with its fuller side-panel sub-surface closer to #1's fidelity.

No new bead is filed for this: the question is design-modeling, already owned by `flow-gu1.11` (build #9) and `flow-gu1.19.4` (mockups), and is now resolved in-document rather than left open.

## 3. Jobs-to-be-done

For each surface: the job the user is trying to accomplish (the outcome they want), and what they were doing immediately before engaging it. Not "what it displays" — `design.md`'s "Communicates" field covers that.

- **#1 — Active timer panel.** Job: "let me control and monitor a routine I've already started without losing my place in the note I'm working from." Before: they started a focus session and are working in the vault; they glance back to check time or change transport state. Outcome: stay oriented in the routine while doing the actual work.
- **#2 — Loading.** Job: "tell me the view is coming up, not stuck." Before: they switched to / configured this Bases view. Outcome: confidence to wait a beat rather than re-click.
- **#3 — Error.** Job: "tell me what I misconfigured and point me at the fix." Before: they set a `routineFile` that doesn't resolve or parse. Outcome: correct the routine-file configuration.
- **#4 — Inert.** Job: "reassure me this view isn't the live one, before I click Start and clobber the routine that actually is running." Before: they opened a second Bases view on a different routine while one is already running. Outcome: avoid mistaking a bystander view for the active session.
- **#5 — Empty / no-queue.** Job (empty): "tell me my queue filter matched nothing so I can fix the filter." Job (no-queue): "don't imply I was supposed to have a queue here." Before: they entered a phase whose queue is empty, or a rep-based phase with no queue. Outcome: distinguish a misconfiguration from an expected absence.
- **#6 — WriteBackModal.** Job: "let me confirm — or correct — exactly which note gets credited before it's written." Before: a focus phase just completed on an active task. Outcome: the right note is incremented, with a chance to redirect it.
- **#7 — RoutineReplaceModal.** Job: "make me consciously choose to discard the running routine's progress before I lose it." Before: they clicked Start on a different routine mid-session. Outcome: an intentional decision, not an accidental reset.
- **#8 — Settings.** Job: "change how the plugin behaves globally" (today: which frontmatter property write-back increments). Before: they opened Obsidian settings looking for the plugin's options. Outcome: a persisted preference change.
- **#9 — Workspace-wide view (proposed).** Job: "keep a running routine visible while I work in other files, without leaving the Bases leaf open." Before: they started a routine and navigated away. Outcome: at-a-glance awareness from anywhere.
- **#10 — OS notifications (proposed).** Job: "tell me a phase changed when I'm not looking at Obsidian." Before: they tabbed away during a focus phase. Outcome: return at the right moment.
- **#11 — In-app toasts (proposed).** Job: "tell me a phase changed while I'm in Obsidian but not looking at the timer." Before: they're editing a note with the timer offscreen. Outcome: notice the transition without watching the countdown.
- **#12 — Onboarding (proposed).** Job: "get me a working routine without hand-authoring a `.base` file and routine frontmatter from scratch." Before: they just installed the plugin. Outcome: a runnable first routine. (Shape undecided — `design.md` #12.)

## 4. Interactions inventory

Every interaction available *today*, grounded in file:line. Proposed-surface interactions (#9–#12) are marked **proposed**.

Keyboard baseline: no surface overrides Obsidian's default keyboard behavior — a repo-wide check of `src/views/` and `src/settings.ts` finds only `click` listeners, no `keydown`/`onKeydown`/`Scope` handlers. Both modals therefore rely on Obsidian's `Modal` defaults: **Escape and click-outside both close the modal and resolve it as cancelled** (confirmed by `onClose` resolving the cancel path — `write-back-modal.ts:75-80`, `routine-replace-modal.ts:38-43` — and the latter's own doc comment, `routine-replace-modal.ts:8-10`). Neither modal explicitly wires **Enter-to-submit**; activation is via the buttons (or native button focus). Timer-panel and settings controls are native `<button>`/`<input>` elements, so they carry only default browser keyboard semantics (Space/Enter activate a focused button).

### #1 — Active timer panel

- **Header** `<h2>` — display only, no interaction (`timer-view.ts:118`).
- **Pause button** — shown only while this view's routine is active and running; dispatches `{ type: 'pause' }` (`timer-view.ts:127-130`).
- **Start button** — shown otherwise; calls `handleStart(viewGraph)`, which may open RoutineReplaceModal (#7), then `setGraph` + dispatch `{ type: 'start' }` (`timer-view.ts:131-134,217-235`).
- **Done button** — shown only when active + running + `remaining === null` (a completed manual-clear phase); dispatches `{ type: 'finish-phase' }` (`timer-view.ts:136-139`).
- **Reset button** — always present; dispatches `{ type: 'stop' }` (`timer-view.ts:141-142`).
- **Queue item buttons** — one per queue item; dispatch `{ type: 'start', filePath: item.sourcePath }` (`timer-view.ts:161-171`). The active item's `<li>` gets `.is-active-task` (`:165-167`).

### #2 / #3 / #4 / #5 — Loading / error / inert / empty / no-queue

- No interactions. All are display-only text (`timer-view.ts:82,87,121,157`); no-queue renders nothing at all (`:145-147`). #4's inert notice is additive text above the still-interactive controls of the same panel.

### #6 — WriteBackModal

- **File text field** with `VaultFileSuggest` autosuggest — `onChange` updates the target path; selecting a suggestion fills the path (`write-back-modal.ts:48-60`). The autosuggest dropdown carries Obsidian `AbstractInputSuggest` keyboard navigation (arrow/Enter within the popup), provided by Obsidian, not overridden here (`write-back-modal.ts:7-16`).
- **Property text field** — `onChange` updates the property (`write-back-modal.ts:62-64`).
- **Value text field** — `onChange` updates the raw value (`write-back-modal.ts:66-68`).
- **Cancel button** — `close()` → resolves `{ kind: 'cancelled' }` (`write-back-modal.ts:71,75-80`).
- **Submit button** (`.setCta()`) — `submit()` → resolves `{ kind: 'submitted', values }` after `coerceWriteBackValue` (`write-back-modal.ts:72,82-93`).
- **Escape / click-outside** — resolve cancelled (Obsidian `Modal` default; `onClose` `:75-80`).

### #7 — RoutineReplaceModal

- **Explanatory paragraph** — display only (`routine-replace-modal.ts:29-31`).
- **Cancel button** — `close()` → resolves `'cancelled'` (`routine-replace-modal.ts:34,38-43`).
- **Replace button** (`.setCta()`) — `confirm()` → resolves `'confirmed'` (`routine-replace-modal.ts:35,45-49`).
- **Escape / click-outside** — resolve cancelled (Obsidian `Modal` default; `:38-43`).

### #8 — RoutineFlowSettingTab

- **Write-back property text field** — placeholder `Property name`; `onChange` writes `settings.writeBackProperty` (`settings.ts:89-97`).
- **Progress meter style dropdown** — dropdown options (`radial`, `bar`, `minimal`); `onChange` writes `settings.progressMeterStyle` (`settings.ts:98-106`).
- **Custom predicates list & add row** — delete existing predicate, add new predicate by name and formula condition (`settings.ts:107-121`).
- **Scripts folder text field** — placeholder `Scripts`; `onChange` writes `settings.scriptsFolder` (`settings.ts:122-136`).
- **Script hook bindings list & add row** — delete/reconfirm existing binding, add new binding by name and `.js` script path with `ScriptFileSuggest` autosuggest (`settings.ts:137-153`).

### #9 — Workspace-wide view (proposed)

- **Proposed:** a status-bar item (glanceable, likely display-only or click-to-open) and a side-panel view (closer to #1's control set). No interactions exist — no `addStatusBarItem`/`registerView`/`ItemView` in `src/` (`design.md` #9).

### #10 — OS notifications (proposed)

- **Proposed:** possibly an actionable notification (e.g. a "start break" action button, OS-permitting) and a first-use permission prompt (`design.md` #10). Nothing exists — `Phase.notification` is unread (`design.md` #10).

### #11 — In-app phase-transition toasts (proposed)

- **Proposed:** phase-transition `Notice` toasts, copy/duration/actionability TBD (`design.md` #11). The two *existing* `Notice` call sites are error toasts, not interactions and not phase transitions (`main.ts:22,54`).

### #12 — In-app demo / onboarding

- Scaffolding command palette entry (`Routine Flow: Seed example routine`) creates `Routine Flow Examples/` folder containing `Pomodoro Routine.md`, `Sample Task.md`, and `Tasks.base`.
