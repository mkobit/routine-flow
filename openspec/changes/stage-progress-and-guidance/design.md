# Design

## Context

Multi-phase review routines guide users through sequential stages such as inbox processing, project review, and waiting-for review.
Users need visible position feedback across the routine sequence and interactive checklist instructions for each stage.
All state transformations must follow functional programming constraints enforced by repository linters.
See `proposal.md` for motivation.

## Goals / non-goals

**Goals:**
- Provide pure stage sequence and status derivation from `PhaseGraph` and `EngineState`.
- Render a stage progress bar and stepper component displaying completed, active, and upcoming stages.
- Render interactive checklist guidance items when defined on the active phase.
- Conform strictly to `DESIGN.md` CSS variables and state class toggles (`.is-active`, `.is-completed`, `.is-upcoming`).

**Non-goals:**
- Arbitrary phase jumping or out-of-order execution via stepper clicks.
- Persisting interactive checklist item check state across application restarts.
- Nested or hierarchical sub-checklists.

## Decisions

### Decision 1: Pure stage sequence derivation in domain model

We implement `deriveStageProgress(graph: PhaseGraph, state: EngineState): StageProgress` in `src/domain/phase/stage-progress.ts`.
The function maps `graph.phases` into an ordered sequence:
- A stage is `completed` when its visit count in `state.phaseVisitCounts` is greater than 0 and its phase identifier is not `state.currentPhaseId`.
- A stage is `active` when its phase identifier matches `state.currentPhaseId`.
- A stage is `upcoming` when it is neither completed nor active.

```typescript
export interface StageItem {
  readonly phaseId: PhaseId
  readonly label: string
  readonly status: 'completed' | 'active' | 'upcoming'
  readonly isCurrent: boolean
}

export interface StageProgress {
  readonly stages: readonly StageItem[]
  readonly completedCount: number
  readonly totalCount: number
  readonly progressFraction: number
}
```

*Alternatives considered:*
- Traverse transitions DAG dynamically on every tick: Rejected because complex or cyclical graphs can cause indeterminate display order; declaration order in `graph.phases` preserves routine author intent.
- Store stepper state inside `EngineState`: Rejected because stage progress is purely derivable from existing graph and visit counts.

### Decision 2: Guidance checklist as an optional phase schema property

Extend `PhaseNodeSchema` with `guidance: z.array(z.string().min(1)).readonly().optional()`.
In preprocessing, map legacy or alternative `checklist` field to `guidance`.

```typescript
export const PhaseNodeSchema = z.preprocess((val) => {
  const raw = getRawRecord(val)
  const guidance = raw ? (raw.guidance ?? raw.checklist) : undefined
  // ...
}, z.object({
  // ...
  guidance: z.array(z.string().min(1)).readonly().optional(),
}))
```

*Alternatives considered:*
- Structured checklist object with explicit ids and weights: Rejected because review instructions are short human-readable reminders; string arrays minimize routine file complexity.

### Decision 3: Isolated component renderers in `src/views/timer/stage-progress-panel.ts`

Following repository pattern established in `src/views/timer/queue-panel.ts`, we encapsulate stepper and guidance DOM rendering in isolated functions:
- `renderStageProgress(containerEl: HTMLElement, progress: StageProgress): HTMLElement`
- `renderGuidanceChecklist(containerEl: HTMLElement, items: readonly string[]): HTMLElement`

Both `RoutineTimerView` and `RoutineSidePanelView` call these functions to ensure identical visual presentation.

*Alternatives considered:*
- Direct inline DOM creation in `RoutineTimerView` and `RoutineSidePanelView`: Rejected to prevent code duplication and inconsistent markup.

## Risks / trade-offs

- **[Risk]** Routines with many phases could cause horizontal stepper overflow in narrow side panels.
  → **Mitigation**: Stepper CSS uses flex-wrap or horizontal scroll containment with compact text styling (`--font-ui-smaller`).
- **[Risk]** Single-phase routines render unnecessary visual chrome.
  → **Mitigation**: Stage stepper rendering is omitted when `progress.totalCount <= 1`.
