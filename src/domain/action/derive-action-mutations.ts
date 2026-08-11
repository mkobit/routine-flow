import type { Temporal } from 'temporal-polyfill'
import type { FileMutation } from '../mutation/file-mutation'
import { TaskQueueItemIdSchema } from '../queue/task-source'
import type { QueueItemAction } from './queue-item-action'

/**
 * Derives concrete `FileMutation`s to apply when a `QueueItemAction` is triggered against an active item path.
 * Pure domain function: effect-unaware, returning empty array if `activeFilePath` is `null`.
 */
export function deriveActionMutations(
  action: QueueItemAction,
  activeFilePath: string | null,
  now: Temporal.Instant,
): readonly FileMutation[] {
  return activeFilePath === null
    ? []
    : deriveActionMutationsForPath(action, activeFilePath, now)
}

function deriveActionMutationsForPath(
  action: QueueItemAction,
  activeFilePath: string,
  now: Temporal.Instant,
): readonly FileMutation[] {
  const itemId = TaskQueueItemIdSchema.parse(activeFilePath)
  const payload = action.payload

  return payload.kind === 'queueCycle'
    ? [{ kind: 'queueReorder', itemId, position: 'back' }]
    : payload.kind === 'markDone'
      ? [{ kind: 'queueStatusChange', itemId, status: 'done' }]
      : payload.kind === 'deferDuration'
        ? [
            { kind: 'queueStatusChange', itemId, status: 'deferred' },
            {
              kind: 'frontmatter',
              filePath: activeFilePath,
              property: 'routine-due',
              value: now.toZonedDateTimeISO('UTC').add(payload.after).toInstant().toString(),
            },
          ]
        : [
            {
              kind: 'frontmatter',
              filePath: activeFilePath,
              property: payload.property,
              value: payload.value,
            },
          ]
}
