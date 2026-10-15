import type { Phase } from '../domain/phase/phase'
import { TaskQueueItemIdSchema } from '../domain/queue/task-source'
import type { ApplyMutationsResult } from '../domain/mutation/apply-mutations'
import type { EngineStore } from './store'

/**
 * Dispatches active file update, optional promotion mutation, and auto-advance on selector winner.
 */
export async function handleSelectorWinner(
  store: Pick<EngineStore, 'dispatch' | 'reorderQueueItem'>,
  phase: Phase,
  filePath: string,
  notice?: (message: string) => void,
): Promise<ApplyMutationsResult | null> {
  await store.dispatch({ type: 'set-active-file', filePath })

  let mutationResult: ApplyMutationsResult | null = null
  if (phase.selector?.promoteToFront && store.reorderQueueItem) {
    const itemId = TaskQueueItemIdSchema.parse(filePath)
    mutationResult = await store.reorderQueueItem(itemId, 'front')
    if (mutationResult !== null && !mutationResult.success) {
      const causeMsg = mutationResult.cause instanceof Error ? mutationResult.cause.message : String(mutationResult.cause)
      notice?.(`Routine Flow: queue reorder failed — ${causeMsg}`)
    }
  }

  if (phase.onCompletion === 'autoAdvance') {
    await store.dispatch({ type: 'finish-phase' })
  }

  return mutationResult
}
