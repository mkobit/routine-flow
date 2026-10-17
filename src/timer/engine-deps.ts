import type { HookRegistry } from '../domain/hook/hook'
import type { PredicateRegistry } from '../domain/hook/predicate'
import type { FileMutationPort } from '../domain/mutation/apply-mutations'
import type { FrontmatterReader } from '../domain/mutation/frontmatter-reader'
import type { TaskSourceRegistry } from '../domain/queue/task-source'
import type { NotificationPort } from './notification-port'

/**
 * Optional collaborators shared by engineReducer and EngineStore. A single
 * growing bag instead of one positional parameter per capability, so adding
 * a new dependency stays non-breaking for every existing call site.
 *
 * `taskSourceRegistry` and `frontmatterReader` are only read by EngineStore
 * (to snapshot `state.queueExhausted` and `state.trackerFrontmatter` before
 * each dispatch, see store.ts) — engineReducer itself never dereferences a
 * live registry or reader, so it stays pure.
 */
export interface EngineDeps {
  readonly hookRegistry?: HookRegistry
  readonly port?: FileMutationPort
  readonly predicateRegistry?: PredicateRegistry
  readonly taskSourceRegistry?: TaskSourceRegistry
  readonly notificationPort?: NotificationPort
  readonly frontmatterReader?: FrontmatterReader
  readonly trackerFilePath?: string
}
