import type { Temporal } from 'temporal-polyfill'
import type { FileMutation } from '../domain/mutation/file-mutation'
import type { Phase } from '../domain/phase/phase'
import { TaskQueueItemIdSchema } from '../domain/queue/task-source'

/**
 * Derives the `FileMutation`s to apply when a phase with a completion policy completes (`onComplete`).
 * Pure function: effect-unaware, returning empty array if `activeFilePath` is `null` or policy emits no mutations.
 */
export function deriveCompletionMutations(
  phase: Phase,
  activeFilePath: string | null,
  now: Temporal.Instant,
): readonly FileMutation[] {
  const policy = phase.completionPolicy
  if (policy === null || activeFilePath === null) {
    return []
  }

  if (policy.kind === 'queueCycle') {
    const itemId = TaskQueueItemIdSchema.parse(activeFilePath)
    return [{ kind: 'queueReorder', itemId, position: 'back' }]
  }

  if (policy.kind === 'futureDate') {
    const itemId = TaskQueueItemIdSchema.parse(activeFilePath)
    const dueIsoString = now.toZonedDateTimeISO('UTC').add(policy.after).toInstant().toString()
    return [
      { kind: 'queueStatusChange', itemId, status: 'deferred' },
      { kind: 'frontmatter', filePath: activeFilePath, property: 'routine-due', value: dueIsoString },
    ]
  }

  return []
}
