## Context

See `proposal.md` for motivation and high-level requirements.
The plugin currently supports `CompletionPolicy` execution (`deriveCompletionMutations`) and `FileMutationPort` (`applyMutations`) for applying mutations to vault files. Interactive queue item actions extend this pattern by allowing user-triggered, one-click mutations defined declaratively on a phase or routine.

## Goals / Non-Goals

**Goals:**
- Provide a pure domain data model (`QueueItemAction`) for defining interactive buttons on active queue items.
- Provide a pure derivation function (`deriveActionMutations`) that converts an action trigger on an active item into `FileMutation`s.
- Extend `Phase` schema and routine YAML parser to support declaring `actions`.
- Define standard action presets (`queueCycle`, `markDone`, `deferDuration`, `setFrontmatter`).

**Non-Goals:**
- Arbitrary code execution or scripting in button actions (complex logic remains in `ScriptHook`s).
- Creating interactive multi-step input dialogs for actions (interactive inputs remain in `WriteBackModal`).

## Decisions

### Decision 1: Discriminated Union for `QueueItemActionPayload`
Represent action payloads as a Zod discriminated union on `kind`.

```ts
export const QueueItemActionPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('queueCycle') }),
  z.object({ kind: z.literal('markDone') }),
  z.object({ kind: z.literal('deferDuration'), after: PositiveDurationSchema }),
  z.object({
    kind: z.literal('setFrontmatter'),
    property: z.string().min(1),
    value: z.union([z.number(), z.string(), z.boolean()]),
  }),
])
```

*Rationale*: A closed discriminated union matches `CompletionPolicy` and `FileMutation` patterns in the codebase, ensuring strict type safety and exhaustiveness checking.

*Alternatives Considered*:
- Freeform JSON or string expressions: rejected because it bypasses TypeScript strict typing and Zod validation.

### Decision 2: Pure Action Derivation (`deriveActionMutations`)
Separate action mutation derivation into a pure domain function:

```ts
export function deriveActionMutations(
  action: QueueItemAction,
  activeFilePath: string | null,
  now: Temporal.Instant,
): readonly FileMutation[]
```

*Rationale*: Keeps domain logic pure and independent of Obsidian APIs, UI state, or side effects, making unit testing straightforward.

### Decision 3: Direct Integration with `FileMutationPort`
When an action is triggered, derived `FileMutation`s are dispatched directly to `FileMutationPort.applyMutations`.

*Rationale*: Reuses the existing choke point for vault writes, error logging, and frontmatter updates.

## Risks / Trade-offs

- [Action targets file outside queue] → `deriveActionMutations` validates `activeFilePath` presence before deriving mutations; returns empty array if no active item is selected.
