/**
 * The file/property/value a write-back prompt was shown with (as defaults)
 * or submitted with (as the user's edits).
 */
export interface WriteBackFormValues {
  readonly filePath: string
  readonly property: string
  readonly value: number | string | boolean
}

export type WriteBackPromptResult =
  | { readonly kind: 'submitted', readonly values: WriteBackFormValues }
  | { readonly kind: 'cancelled' }

/**
 * Prompts the user to confirm or edit write-back defaults before applying.
 * Kept separate from `FrontmatterReader` (read-only) and `FileMutationPort` (apply-only).
 */
export interface WriteBackPromptPort {
  readonly prompt: (defaults: WriteBackFormValues) => Promise<WriteBackPromptResult>
}

/**
 * Coerces a write-back modal's raw text input into a number when it parses
 * as one, matching nextLogEntry's own finite-number heuristic — otherwise a
 * numeric default (e.g. an auto-incremented count) would round-trip through
 * the text field as a string and break future increments.
 */
export const coerceWriteBackValue = (raw: string): number | string => {
  const trimmed = raw.trim()
  const parsed = Number(trimmed)
  return trimmed !== '' && Number.isFinite(parsed) ? parsed : raw
}
