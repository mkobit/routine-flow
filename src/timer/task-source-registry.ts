import type { TaskSource, TaskSourceId, TaskSourceRegistry } from '../domain/queue/task-source'

const DEFAULT_SCOPE = Symbol('default-task-source-scope')

/**
 * Widens TaskSourceRegistry with register/unregister — unlike HookRegistry/
 * PredicateRegistry (populated once at plugin load), a baseQuery source's
 * contents change on every Bases onDataUpdated, so RoutineTimerView needs to
 * keep the registry fresh at runtime. Only the integration layer
 * (RoutineTimerView) needs this wider type; ObsidianFileMutationPort and
 * domain code only ever see the narrow resolve-only TaskSourceRegistry.
 */
export interface MutableTaskSourceRegistry extends TaskSourceRegistry {
  readonly register: (id: TaskSourceId, source: TaskSource, scope?: unknown) => void
  readonly unregister: (id: TaskSourceId, scope?: unknown) => void
  readonly unregisterScope: (scope: unknown) => void
  readonly replaceScope: (scope: unknown, entries: ReadonlyMap<TaskSourceId, TaskSource>) => void
  readonly subscribe: (listener: () => void) => () => void
  readonly notifyChanged: () => void
}

function mergeTaskSources(sources: Iterable<TaskSource>): TaskSource {
  const snapshot = [...sources]
  return {
    getQueue: () => {
      const entries = snapshot.flatMap(source => source.getQueue())
      // Reverse before Map construction so earlier scopes win when item IDs collide.
      const deduped = new Map([...entries].reverse().map(item => [item.id, item] as const))
      return [...deduped.values()].reverse()
    },
  }
}

/** Class wrapper so `ignoreClasses` covers internal Map/Set updates. */
class TaskSourceRegistryImpl implements MutableTaskSourceRegistry {
  private readonly sources = new Map<TaskSourceId, Map<unknown, TaskSource>>()
  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  notifyChanged = (): void => {
    for (const listener of [...this.listeners]) {
      listener()
    }
  }

  resolve = (id: TaskSourceId): TaskSource | undefined => {
    const scoped = this.sources.get(id)
    if (scoped === undefined || scoped.size === 0) {
      return undefined
    }
    if (scoped.size === 1) {
      return scoped.values().next().value
    }
    return mergeTaskSources(scoped.values())
  }

  register = (id: TaskSourceId, source: TaskSource, scope: unknown = DEFAULT_SCOPE): void => {
    let scoped = this.sources.get(id)
    if (scoped === undefined) {
      scoped = new Map<unknown, TaskSource>()
      this.sources.set(id, scoped)
    }
    scoped.set(scope, source)
    this.notifyChanged()
  }

  unregister = (id: TaskSourceId, scope: unknown = DEFAULT_SCOPE): void => {
    const scoped = this.sources.get(id)
    if (scoped === undefined) {
      return
    }
    const existed = scoped.delete(scope)
    if (scoped.size === 0) {
      this.sources.delete(id)
    }
    if (existed) {
      this.notifyChanged()
    }
  }

  unregisterScope = (scope: unknown): void => {
    let removed = false
    for (const [id, scoped] of this.sources.entries()) {
      if (scoped.delete(scope)) {
        removed = true
        if (scoped.size === 0) {
          this.sources.delete(id)
        }
      }
    }
    if (removed) {
      this.notifyChanged()
    }
  }

  replaceScope = (scope: unknown, entries: ReadonlyMap<TaskSourceId, TaskSource>): void => {
    for (const [id, scoped] of this.sources.entries()) {
      if (scoped.delete(scope) && scoped.size === 0) {
        this.sources.delete(id)
      }
    }
    for (const [id, source] of entries.entries()) {
      let scoped = this.sources.get(id)
      if (scoped === undefined) {
        scoped = new Map<unknown, TaskSource>()
        this.sources.set(id, scoped)
      }
      scoped.set(scope, source)
    }
    this.notifyChanged()
  }
}

export function createTaskSourceRegistry(): MutableTaskSourceRegistry {
  return new TaskSourceRegistryImpl()
}
