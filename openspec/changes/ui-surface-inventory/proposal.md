## Why

Mike's 2026-07-21 manual UX pass found the plugin "looks generally quite bad" in light mode and expanded flow-gu1.20's scope from one screen (the Bases-embedded timer view) to six tracked screens. flow-gu1.20.1 was claimed to scope that pass, with a deliverable of "a prioritized list of concrete styling follow-up beads, not code changes" — but no written inventory exists yet of exactly which surfaces need design attention, what each currently looks like, or what direction a design pass (and eventually Stitch, once Mike finishes evaluating a Stitch MCP integration) should take. A source-level audit also turns up more distinct surfaces than the six already tracked.

## What Changes

- Add `design.md`: a grounded inventory of every distinct UI surface currently in `src/` — the 6 screens already tracked as flow-gu1 children (flow-gu1.20.1/flow-gu1.11/flow-gu1.56/flow-gu1.57/flow-gu1.58/flow-gu1.59), plus surfaces/states this audit newly itemizes explicitly: `RoutineTimerView`'s distinct error/loading/inert/empty-queue/no-queue rendering states, and `RoutineReplaceModal` as its own confirmation-dialog surface (new bead flow-gu1.62). Each entry records current visual state (verified: `styles.css` has zero rules targeting any `routine-*` class or `is-active-task`; every surface renders with unstyled Obsidian defaults) and a first-pass design direction (what the surface must communicate, its information hierarchy, its states) as a prose brief — not CSS, not pixel values — suitable as later Stitch input.
- Add `surface-model.md`: a companion analytical model over the same 12 surfaces, covering (1) taxonomy — classifying each surface by Obsidian primitive and lifecycle; (2) relationships — concurrency, mutual exclusion, grounded triggers/lifecycle, and sequencing, resolving `design.md`'s open question on surface #9 (workspace-wide view) vs. surface #1 (Bases-embedded view) as "shared state model and foundations, separate per-surface briefs" grounded in the single shared `EngineStore`; (3) jobs-to-be-done per surface; and (4) a grounded, file:line-referenced interactions inventory (every button/field/click target and keyboard behavior), marking #9–#12's interactions proposed. Referenced from `design.md`.
- File flow-gu1.62 (`RoutineReplaceModal: visual design pass`) for the newly identified confirmation-dialog surface.
- Append cross-reference notes pointing at this change from flow-gu1.20's and flow-gu1.20.1's `--notes`.
- Close flow-gu1.20.1 once this document and the beads below exist — its stated deliverable (a prioritized list of concrete styling follow-up beads) is satisfied by the existing flow-gu1.11/.56/.57/.58/.59/.62 beads plus this design brief.
- No `src/` or `styles.css` changes. This change is a documentation/scoping artifact only — no runtime behavior changes.

## Capabilities

### New Capabilities
- `ui-surface-inventory`: the grounded UI-surface/screen inventory and per-surface design-direction brief that serves as the durable record of this scoping pass and as input for later design tooling (Stitch).

### Modified Capabilities
(none — no existing capability's runtime requirements change; this is a documentation artifact, not a behavior change)

## Impact

- New: `openspec/changes/ui-surface-inventory/` (this change), including `design.md` (per-surface inventory + design direction) and `surface-model.md` (taxonomy/relationships/jobs/interactions).
- bd: flow-gu1.20.1 closed; notes appended to flow-gu1.20 and flow-gu1.20.1; new bead flow-gu1.62 filed under flow-gu1.
- No `src/` or `styles.css` changes.
