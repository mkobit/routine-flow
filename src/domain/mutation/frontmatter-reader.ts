/**
 * Reads a file's current frontmatter. Kept separate from `FileMutationPort`
 * because reading is not a mutation intent.
 */
export interface FrontmatterReader {
  /** Reads one property's value. */
  readonly readValue: (filePath: string, property: string) => unknown
  /** Reads the full frontmatter record, or null if absent. */
  readonly readAll: (filePath: string) => Readonly<Record<string, unknown>> | null
}
