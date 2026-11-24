import * as fs from 'node:fs/promises'

import * as path from 'node:path'
import type { NoteDefinition } from './schema'
import { serializeFrontmatter } from './serializer'

export class VaultBuilder {
  private constructor(private readonly notes: readonly NoteDefinition[]) {}

  static create(): VaultBuilder {
    return new VaultBuilder([])
  }

  getNotes(): readonly NoteDefinition[] {
    return this.notes
  }

  withNote(note: NoteDefinition): VaultBuilder {
    return new VaultBuilder([...this.notes, note])
  }

  withNotes(notes: readonly NoteDefinition[]): VaultBuilder {
    return new VaultBuilder([...this.notes, ...notes])
  }
}

export async function writeNoteToVault(baseDir: string, note: NoteDefinition): Promise<void | Error> {
  try {
    const fullPath = path.join(baseDir, note.relativePath.dir, note.relativePath.base)
    const parentDir = path.dirname(fullPath)

    await fs.mkdir(parentDir, { recursive: true })

    const frontmatterStr = serializeFrontmatter(note.frontmatter)
    const content = note.body !== undefined ? `${frontmatterStr}\n${note.body}` : frontmatterStr

    await fs.writeFile(fullPath, content, 'utf-8')
  }
  catch (error) {
    if (error instanceof Error) {
      return error
    }
    return new Error(String(error))
  }
}

export async function writeVault(baseDir: string, notes: readonly NoteDefinition[]): Promise<readonly Error[]> {
  const results = await Promise.all(notes.map(note => writeNoteToVault(baseDir, note)))
  return results.filter((result): result is Error => result instanceof Error)
}

/**
 * Removes the paths listed in `<vaultDir>/.gitignore` from `vaultDir` itself.
 * A plain recursive copy of the vault (e.g. obsidian-launcher's `copy: true`) is
 * gitignore-unaware, so runtime state like `.obsidian/workspace.json` or a stray
 * `.obsidian/plugins/` install can leak from the source vault into the copy and make
 * a test pass/fail for reasons that wouldn't reproduce from a fresh checkout.
 */
export async function stripGitignoredVaultState(vaultDir: string): Promise<void> {
  const gitignore = await fs.readFile(path.join(vaultDir, '.gitignore'), 'utf-8').catch(() => '')
  const patterns = gitignore
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => line.replace(/\/$/, ''))

  await Promise.all(patterns.map(pattern =>
    fs.rm(path.join(vaultDir, pattern), { recursive: true, force: true })))
}
