## ADDED Requirements

### Requirement: Grounded surface inventory
`design.md` SHALL enumerate every distinct UI surface a user can see in the plugin as implemented today, each entry citing the concrete `src/` file and line(s) it comes from. The inventory SHALL cover the 6 screens already tracked as flow-gu1 children (flow-gu1.20.1's `RoutineTimerView`/`WriteBackModal` scope, flow-gu1.11, flow-gu1.56, flow-gu1.57, flow-gu1.58, flow-gu1.59) plus any additional surface found by auditing `src/views/`, `src/main.ts`, and `src/settings.ts` that is not yet named by one of those beads.

#### Scenario: Every tracked screen has an inventory entry
- **WHEN** a reader cross-references `design.md`'s inventory against the descriptions of flow-gu1.11, flow-gu1.56, flow-gu1.57, flow-gu1.58, and flow-gu1.59
- **THEN** each of those screens has a corresponding inventory entry in `design.md`

#### Scenario: Newly identified surfaces are itemized, not folded into an existing entry
- **WHEN** a reader looks for `RoutineTimerView`'s error, loading, inert, empty-queue, and no-queue rendering states, and for `RoutineReplaceModal`
- **THEN** each has its own inventory entry (not merged into a single generic "timer view" entry), citing the exact file:line the state or component is implemented at

### Requirement: Honest current-state grounding
Each inventory entry SHALL state whether the surface exists in shipped code today or is an as-yet-unbuilt proposal (per its tracking bead), and SHALL NOT describe proposed visual treatment as already decided or implemented.

#### Scenario: Shipped-but-unstyled surface
- **WHEN** a reader reads the inventory entry for a surface that exists in `src/` today (e.g. `RoutineTimerView`, `WriteBackModal`, `RoutineReplaceModal`, `RoutineFlowSettingTab`)
- **THEN** the entry states its current styling is unstyled/raw Obsidian defaults, consistent with `styles.css` containing no rules for any `routine-*` class or `is-active-task`

#### Scenario: Not-yet-built surface
- **WHEN** a reader reads the inventory entry for a surface with no implementation yet (e.g. flow-gu1.11's workspace-wide view, flow-gu1.56's OS notifications, flow-gu1.57's phase-transition Notice toasts, flow-gu1.59's onboarding)
- **THEN** the entry states plainly that no code exists yet, and any visual/behavioral detail offered is marked as this change's own proposed direction, not an audit finding

### Requirement: Per-surface design-direction brief
Each inventory entry SHALL include a first-pass design direction covering: what the surface needs to communicate to the user, its information hierarchy, and its distinct states — expressed as prose suitable as an input brief for AI UI design tooling (Stitch), not as CSS rules or pixel/color values.

#### Scenario: Design direction has no implementation-level detail
- **WHEN** a reader searches `design.md`'s per-surface design-direction subsections for CSS property names, hex/color values, or pixel measurements
- **THEN** none are found — direction is expressed only as communication goals, hierarchy, and states

### Requirement: Surface taxonomy
`surface-model.md` SHALL classify each of the 12 inventoried surfaces by its Obsidian UI primitive and lifecycle (e.g. embedded Bases view, modal dialog, settings panel, workspace chrome, transient notification, onboarding flow), so that the correct Obsidian convention and design-tool briefing strategy can be chosen per surface.

#### Scenario: Every surface has a taxonomy classification
- **WHEN** a reader looks up any surface #1–#12 in `surface-model.md`'s taxonomy
- **THEN** it is assigned a category, an Obsidian primitive, a lifecycle, and a shipped-or-proposed marker

### Requirement: Surface relationships
`surface-model.md` SHALL model how the surfaces relate: which can be visible simultaneously, which are mutually exclusive, what triggers each to appear and disappear, and any sequencing between them. It SHALL resolve, or make explicit progress on, `design.md`'s open question of whether the workspace-wide view (surface #9) shares a design pass with the Bases-embedded view (surface #1).

#### Scenario: Concurrency and triggers are documented
- **WHEN** a reader asks whether two surfaces can be open at once, or what makes a surface appear
- **THEN** `surface-model.md` answers it with a grounded trigger/lifecycle and concurrency mapping

#### Scenario: The #9-vs-#1 question is addressed
- **WHEN** a reader looks for the resolution of `design.md`'s surface #9 / surface #1 open question
- **THEN** `surface-model.md` states a resolution (shared state model and foundations, separate per-surface briefs) grounded in the single shared `EngineStore`

### Requirement: Per-surface jobs-to-be-done
`surface-model.md` SHALL state, for each surface, the job the user is trying to accomplish (the outcome they want and what they were doing immediately before), distinct from what the surface displays.

#### Scenario: Each surface has a job statement
- **WHEN** a reader reads any surface's jobs-to-be-done entry
- **THEN** it describes the user's intended outcome and prior context, not merely what the surface renders

### Requirement: Grounded interactions inventory
`surface-model.md` SHALL enumerate, for each surface, every interaction available today (buttons, fields, click targets, keyboard behavior) with `src/` file:line references, and SHALL mark interactions on not-yet-built surfaces (#9–#12) as proposed rather than shipped.

#### Scenario: Shipped interactions are grounded and proposed ones are marked
- **WHEN** a reader reads the interactions inventory for a shipped surface (#1–#8) versus a proposed one (#9–#12)
- **THEN** the shipped surface's interactions each cite a `src/` file:line, and the proposed surface's interactions are labelled proposed

#### Scenario: Keyboard behavior is stated
- **WHEN** a reader checks how the modals handle Escape and Enter
- **THEN** the inventory states that no surface overrides Obsidian's default keyboard behavior, and that Escape/click-outside resolve the modals as cancelled while Enter-to-submit is not explicitly wired
