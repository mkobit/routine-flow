## Context

The domain model reshape (`openspec/changes/domain-model-reshape/`, merged in PR #211) collapsed duplicate mutation derivation and removed dead registries.
However, a follow-up architecture pass (`flow-16c`) evaluated the domain model against 3 worked examples (Pomodoro, an exercise routine, and a morning checklist) and identified that the model could be further simplified into two core concepts:
- **Graph + Routing Guards on Edges**: A cyclic-capable directed graph carrying phase nodes and transition edges guarded by pure, synchronous predicate functions (`EdgeGuard`).
- **Effect Handlers**: Asynchronous side-effect reactors (`Handler`) triggered by phase node lifecycle events (`onEnter`, `onComplete`, `onSkip`, `onExit`) that emit pure `Effect` values (file mutations, notifications) for integration ports to execute.

This document details the concrete field-by-field type sketch, terminal-node traversal semantics, and boundary definition for cross-session scheduling.

## Goals / Non-Goals

**Goals:**
- Unify `CompletionPolicy`, `QueueItemAction`, `NotificationPolicy`, `Predicate`, `Hook`, and `TransitionCondition` into `EdgeGuard`, `Handler`, `Effect`, and scalar node properties.
- Support terminal nodes (acyclic routine traversal) natively in `checkPhaseGraphIntegrity` and `resolveNextPhaseId`.
- Support multiple `Handler`s per lifecycle event stage on a `PhaseNode`.
- Keep edge routing guards pure, synchronous, and safe for speculative preview evaluation (`findNextPhase`).

**Non-Goals:**
- Cross-session scheduling implementation (defined conceptually as an outer `RoutineSchedule` wrapper, but out of scope for single-session `PhaseGraph` traversal execution).
- Item-selection/mutation-targeting UX parameterization (deferred per original reshape).

## Field-by-Field Type Sketch

### 1. PhaseNode

```typescript
export const PhaseNodeSchema = z.object({
  id: PhaseIdSchema,
  name: z.string().min(1),
  duration: DurationSchema.nullable(),
  onCompletion: z.enum(['autoAdvance', 'waitForManual']).default('autoAdvance'),
  taskSource: TaskSourceConfigSchema.nullable().default(null),
  logTarget: z.enum(['activeItem']).nullable().default(null),
  handlers: z.object({
    onEnter: z.array(HandlerSchema).default([]),
    onComplete: z.array(HandlerSchema).default([]),
    onSkip: z.array(HandlerSchema).default([]),
    onExit: z.array(HandlerSchema).default([]),
  }).default({}),
});
```

- `onCompletion`: Scalar gate replacing `CompletionPolicy`. `'autoAdvance'` triggers transition resolution when remaining duration reaches zero (or `finish-phase` is dispatched). `'waitForManual'` sets status to `'completed'` and halts.
- `handlers`: Map of lifecycle stages to lists of `Handler`s. Allows composing multiple handlers (e.g. log item + send notification) on phase entry/completion.

### 2. TransitionEdge & EdgeGuard

```typescript
export const EdgeGuardSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('always') }),
  z.object({ kind: z.literal('everyNth'), count: z.number().int().positive() }),
  z.object({ kind: z.literal('queueExhausted') }),
  z.object({ kind: z.literal('custom'), predicateName: z.string(), params: z.record(z.unknown()).optional() }),
]);

export const TransitionEdgeSchema = z.object({
  from: PhaseIdSchema,
  to: PhaseIdSchema,
  guard: EdgeGuardSchema.default({ kind: 'always' }),
});
```

- `EdgeGuard` must be pure and synchronous. It receives current `Traversal` state and context, returning `boolean`. Safe to execute speculatively during UI preview rendering.

### 3. Handler & Effect

```typescript
export const PresetHandlerNameSchema = z.enum([
  'markDone',
  'queueCycle',
  'deferDuration',
  'setFrontmatter',
  'notify',
]);

export const HandlerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('preset'),
    preset: PresetHandlerNameSchema,
    params: z.record(z.unknown()).optional(),
  }),
  z.object({
    kind: z.literal('script'),
    scriptPath: z.string().min(1),
    params: z.record(z.unknown()).optional(),
  }),
]);
```

- Handlers run asynchronously on lifecycle events.
- Handlers produce pure `Effect` objects (`FileMutation`, `NotificationData`) passed to integration ports (`FileMutationPort`, `NotificationPort`).

### 4. Terminal Nodes (Acyclic Routines)

- In `checkPhaseGraphIntegrity`, nodes without outgoing edges are valid (terminal nodes).
- In `resolveNextPhaseId(graph, state)`:
  - Finds outgoing edges from `state.currentPhaseId`.
  - Evaluates `edge.guard`.
  - If no outgoing edge is found or no guard evaluates to true, `resolveNextPhaseId` returns `null`.
- When `resolveNextPhaseId` returns `null` during `completePhase` or `advancePhase`:
  - `engineReducer` sets `EngineState.status` to `'ended'`.
  - Timer stops and traversal completes gracefully.

### 5. Cross-Session Scheduling Boundary

- `RoutineSchedule` lives outside `PhaseGraph`:
  ```typescript
  export const RoutineScheduleSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('manual') }),
    z.object({ kind: z.literal('cron'), cronExpression: z.string() }),
    z.object({ kind: z.literal('interval'), duration: DurationSchema }),
  ]);
  ```
- Triggering a schedule creates a new initial `Traversal` instance for the target `PhaseGraph`. `PhaseGraph` traversal itself remains unaware of scheduling.

## Risks / Trade-offs

- **Schema breaking change**: `CompletionPolicy` and `Phase.hooks` are removed from routine file JSON. Existing routine files must be migrated to `onCompletion` and `handlers`.
- **Mitigation**: `parseRoutineFile` provides structured error reports and automatic migration helpers for standard Pomodoro presets.
