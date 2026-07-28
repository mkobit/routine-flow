import { Temporal } from 'temporal-polyfill'
import type { FileMutation } from '../domain/mutation/file-mutation'
import type { FileMutationPort } from '../domain/mutation/apply-mutations'

/**
 * Only the field this port actually reads off a resolved file. Deliberately
 * not Obsidian's real `TFile` — `TFile` is a recursive class (`TFile.vault:
 * Vault`) with no runtime module outside the Obsidian app itself, so faking
 * one for a test would need an `as TFile` cast (flagged by
 * eslint-plugin-obsidianmd's `no-tfile-tfolder-cast`, for good reason: nothing
 * verifies the fake actually matches Obsidian's real shape). A real `TFile`
 * satisfies this structurally with zero cast, since `TFile` has strictly more
 * fields than this needs.
 */
export interface VaultFile {
  readonly path: string
}

/**
 * The exact vault/fileManager surface this port needs, rather than the full
 * `App` — keeps test fakes to 3 plain-object methods instead of `App`'s (or
 * `TFile`'s) entire shape, and avoids casts at test call sites.
 */
export interface ObsidianFileMutationPortDeps {
  readonly vault: {
    // Method-shorthand (not property/arrow syntax) deliberately: it makes the
    // `file` parameter bivariant, so the real `Vault` (whose methods take the
    // much wider `TFile`) satisfies this narrower `VaultFile`-based shape
    // without a cast.
    getFileByPath(path: string): VaultFile | null
    append(file: VaultFile, data: string): Promise<void>
  }
  readonly fileManager: {
    processFrontMatter(file: VaultFile, fn: (frontmatter: Record<string, unknown>) => void): Promise<void>
  }
}

export function resolveFile(vault: { getFileByPath(path: string): VaultFile | null }, filePath: string): VaultFile {
  const file = vault.getFileByPath(filePath)
  if (file === null) {
    throw new Error(`resolveFile: no file found at path "${filePath}"`)
  }
  return file
}

/**
 * Real, Obsidian-backed `FileMutationPort`. See
 * openspec/specs/obsidian-file-mutation-port/spec.md.
 *
 * A class, not a factory function, so `functional/immutable-data`'s
 * `ignoreClasses` exemption (see eslint.config.mts's `src/timer/**`
 * override) covers the frontmatter-callback mutation `processFrontMatter`
 * requires — that Obsidian API has no non-mutating shape.
 */
export class ObsidianFileMutationPort implements FileMutationPort {
  constructor(private readonly deps: ObsidianFileMutationPortDeps) {}

  async writeFrontmatter(mutation: Extract<FileMutation, { kind: 'frontmatter' }>): Promise<void> {
    const file = resolveFile(this.deps.vault, mutation.filePath)
    await this.deps.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter[mutation.property] = mutation.value
    })
  }

  async appendText(mutation: Extract<FileMutation, { kind: 'append' }>): Promise<void> {
    const file = resolveFile(this.deps.vault, mutation.filePath)
    await this.deps.vault.append(file, mutation.text)
  }

  /**
   * Writes a `routine-priority` sort key: a live Base query can't be
   * reordered in place, so "reorder" means writing a value the user's own
   * Base sort config orders by. Epoch-millis (negated for 'front'), computed
   * locally with no sibling-queue lookup — see design.md decision 6.
   */
  async reorderQueueItem(mutation: Extract<FileMutation, { kind: 'queueReorder' }>): Promise<void> {
    const file = resolveFile(this.deps.vault, mutation.itemId)
    const epochMillis = Temporal.Now.instant().epochMilliseconds
    const priority = mutation.position === 'back' ? epochMillis : -epochMillis
    await this.deps.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter['routine-priority'] = priority
    })
  }

  async changeQueueItemStatus(mutation: Extract<FileMutation, { kind: 'queueStatusChange' }>): Promise<void> {
    const file = resolveFile(this.deps.vault, mutation.itemId)
    await this.deps.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter['routine-status'] = mutation.status
    })
  }
}
