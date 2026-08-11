import type { HookRegistry } from '../domain/hook/hook'
import type { PredicateRegistry } from '../domain/hook/predicate'
import type { FileMutationPort } from '../domain/mutation/apply-mutations'
import type { TaskSourceRegistry } from '../domain/queue/task-source'
import type { NotificationPort } from './notification-port'

/**
 * Optional collaborators shared by engineReducer and EngineStore. A single
 * growing bag instead of one positional parameter per capability, so adding
 * a new dependency stays non-breaking for every existing call site.
 *
 * `taskSourceRegistry` is only read by EngineStore (to snapshot
 * state.queueExhausted before each dispatch, see store.ts) — engineReducer
 * itself never dereferences a live registry, so it stays pure.
 */
export interface EngineDeps {
  readonly hookRegistry?: HookRegistry
  readonly port?: FileMutationPort
  readonly predicateRegistry?: PredicateRegistry
  readonly taskSourceRegistry?: TaskSourceRegistry
  readonly notificationPort?: NotificationPort
}
