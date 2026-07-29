import type { FrontmatterReader } from '../domain/mutation/frontmatter-reader'
import type { VaultFile } from './obsidian-file-mutation-port'
import { resolveFile } from './obsidian-file-mutation-port'

/** The exact metadataCache surface this reader needs, rather than the full `App`. */
export interface ObsidianFrontmatterReaderDeps {
  readonly vault: {
    getFileByPath(path: string): VaultFile | null
  }
  readonly metadataCache: {
    getFileCache(file: VaultFile): { frontmatter?: Record<string, unknown> } | null
  }
}

/** Real, Obsidian-backed `FrontmatterReader`. A class for parity with `ObsidianFileMutationPort`. */
export class ObsidianFrontmatterReader implements FrontmatterReader {
  constructor(private readonly deps: ObsidianFrontmatterReaderDeps) {}

  readValue(filePath: string, property: string): unknown {
    const file = resolveFile(this.deps.vault, filePath)
    return this.deps.metadataCache.getFileCache(file)?.frontmatter?.[property]
  }

  readAll(filePath: string): Readonly<Record<string, unknown>> | null {
    const file = resolveFile(this.deps.vault, filePath)
    return this.deps.metadataCache.getFileCache(file)?.frontmatter ?? null
  }
}
