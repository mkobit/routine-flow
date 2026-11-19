import { createBaseQuerySource } from '../adapters/obsidian/bases/query-task-source'
import type { BaseQueryEntry, ExtraPropertiesLens } from '../adapters/obsidian/bases/query-task-source'
import type { TaskSourceId } from '../domain/queue/task-source'
import type { MutableTaskSourceRegistry } from './task-source-registry'

/** Snapshot of a TaskSource's filtered entries and lens, retained when no RoutineTimerView is mounted. */
export interface FallbackTaskSourceSnapshot {
  readonly entries: readonly BaseQueryEntry[]
  readonly extraPropertiesLens?: ExtraPropertiesLens
}

/**
 * Keeps active TaskSources refreshed from Obsidian's metadataCache and vault
 * rename events after all RoutineTimerViews unmount while a routine is still
 * running or paused.
 */
export class FallbackTaskSourceManager {
  private readonly fallbackScope = Symbol('fallback-task-source-scope')
  private readonly snapshots = new Map<TaskSourceId, FallbackTaskSourceSnapshot>()

  constructor(private readonly registry: MutableTaskSourceRegistry) {}

  retainIfUnprovided(id: TaskSourceId, snapshot: FallbackTaskSourceSnapshot): void {
    if (this.registry.resolve(id) !== undefined) {
      return
    }
    const entries = snapshot.entries.map(entry => ({ ...entry }))
    this.updateSource(id, entries, snapshot.extraPropertiesLens)
  }

  clearForSource(id: TaskSourceId): void {
    if (this.snapshots.delete(id)) {
      this.registry.unregister(id, this.fallbackScope)
    }
  }

  clearAll(): void {
    if (this.snapshots.size === 0) {
      return
    }
    this.snapshots.clear()
    this.registry.unregisterScope(this.fallbackScope)
  }

  handleFileChanged(path: string, frontmatter: Record<string, unknown> | undefined): boolean {
    let changed = false
    const copiedFrontmatter = frontmatter !== undefined ? { ...frontmatter } : undefined
    for (const [id, snapshot] of this.snapshots.entries()) {
      if (!snapshot.entries.some(entry => entry.path === path)) {
        continue
      }
      const nextEntries = snapshot.entries.map(entry =>
        entry.path === path ? { ...entry, frontmatter: copiedFrontmatter } : entry,
      )
      this.updateSource(id, nextEntries, snapshot.extraPropertiesLens)
      changed = true
    }
    return changed
  }

  handleFileDeleted(path: string): boolean {
    let changed = false
    for (const [id, snapshot] of this.snapshots.entries()) {
      const nextEntries = snapshot.entries.filter(entry => entry.path !== path)
      if (nextEntries.length === snapshot.entries.length) {
        continue
      }
      this.updateSource(id, nextEntries, snapshot.extraPropertiesLens)
      changed = true
    }
    return changed
  }

  handleFileRenamed(oldPath: string, newPath: string, newBasename: string): boolean {
    let changed = false
    for (const [id, snapshot] of this.snapshots.entries()) {
      if (!snapshot.entries.some(entry => entry.path === oldPath)) {
        continue
      }
      const nextEntries = snapshot.entries.map(entry =>
        entry.path === oldPath ? { ...entry, path: newPath, basename: newBasename } : entry,
      )
      this.updateSource(id, nextEntries, snapshot.extraPropertiesLens)
      changed = true
    }
    return changed
  }

  private updateSource(
    id: TaskSourceId,
    entries: readonly BaseQueryEntry[],
    extraPropertiesLens: ExtraPropertiesLens | undefined,
  ): void {
    this.snapshots.set(id, {
      entries,
      ...(extraPropertiesLens !== undefined ? { extraPropertiesLens } : {}),
    })
    this.registry.register(
      id,
      createBaseQuerySource(entries, { extraPropertiesLens }),
      this.fallbackScope,
    )
  }
}
