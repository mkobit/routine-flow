import { createNote } from './note'
import type { NoteDefinition } from './schema'

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function indexedPath(dir: string, index: number, title: string): string {
  return `${dir}/${String(index + 1).padStart(2, '0')}-${slugify(title)}.md`
}

/**
 * An in-vault README orientation for someone browsing the vault.
 */
export function routineReadme(folder: string, body: string): NoteDefinition {
  return createNote(`${folder}/README.md`, {}, body)
}

/**
 * Creates a markdown routine definition note containing a fenced JSON graph block.
 */
export function routineFileNote(
  folder: string,
  filename: string,
  jsonGraph: object,
  title: string,
  description: string,
): NoteDefinition {
  const body = `# ${title}\n\n${description}\n\n\`\`\`json\n${JSON.stringify(jsonGraph, null, 2)}\n\`\`\``
  return createNote(`${folder}/${filename}`, { 'is-routine': true }, body)
}
