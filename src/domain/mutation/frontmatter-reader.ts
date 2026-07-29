/**
 * Reads a file's current frontmatter. Kept separate from FileMutationPort —
 * reading isn't a mutation intent (see design.md decision 3 for why
 * FileMutationPort itself doesn't gain a read method).
 */
export interface FrontmatterReader {
  /** One property's value — what the write-back hook needs to compute its next log entry. */
  readonly readValue: (filePath: string, property: string) => unknown
  /** The whole frontmatter record, or null when the file has none yet — what a script-backed hook's context enrichment needs (see transition-hook-script-runner's script-hook-execution spec). */
  readonly readAll: (filePath: string) => Readonly<Record<string, unknown>> | null
}
