import type { TaskSource, TaskSourceId, TaskSourceRegistry } from '../domain/queue/task-source'

/**
 * Widens TaskSourceRegistry with register/unregister — unlike HookRegistry/
 * PredicateRegistry (populated once at plugin load), a baseQuery source's
 * contents change on every Bases onDataUpdated, so RoutineTimerView needs to
 * keep the registry fresh at runtime. Only the integration layer
 * (RoutineTimerView) needs this wider type; ObsidianFileMutationPort and
 * domain code only ever see the narrow resolve-only TaskSourceRegistry.
 */
export interface MutableTaskSourceRegistry extends TaskSourceRegistry {
  readonly register: (id: TaskSourceId, source: TaskSource) => void
  readonly unregister: (id: TaskSourceId) => void
}

/**
 * A class, not a closure-returning factory: eslint-plugin-functional's
 * `ignoreClasses` exemption (see eslint.config.mts's `src/timer/**` override,
 * and ObsidianFileMutationPort's identical rationale) only covers mutation
 * inside an actual `class` — a closure over a `Map` trips
 * `functional/immutable-data` on `.set()`/`.delete()` with no such exemption.
 */
class TaskSourceRegistryImpl implements MutableTaskSourceRegistry {
  private readonly sources = new Map<TaskSourceId, TaskSource>()

  resolve = (id: TaskSourceId): TaskSource | undefined => this.sources.get(id)

  register = (id: TaskSourceId, source: TaskSource): void => {
    this.sources.set(id, source)
  }

  unregister = (id: TaskSourceId): void => {
    this.sources.delete(id)
  }
}

export function createTaskSourceRegistry(): MutableTaskSourceRegistry {
  return new TaskSourceRegistryImpl()
}
