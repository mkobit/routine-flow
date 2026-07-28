import { z } from 'zod'
import { Temporal } from 'temporal-polyfill'

/**
 * A single write-back to a task's frontmatter, e.g. incrementing a session
 * count. Zod-backed because the property's current value is read back from
 * (untrusted, user-editable) frontmatter before this is constructed.
 */
export const LogEntrySchema = z.object({
  property: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean()]),
  recordedAt: z.instanceof(Temporal.Instant),
}).readonly()

export type LogEntry = z.infer<typeof LogEntrySchema>

/**
 * Computes the next write-back value for a single-field frontmatter counter:
 * increments a finite numeric current value, or starts at 1 for anything else
 * (missing, non-numeric, NaN/Infinity — the latter two rejected by
 * FileMutationSchema's z.number() downstream, so treated as unusable here too)
 * — covers a property that's never been written yet.
 */
export const nextLogEntry = (currentValue: unknown, property: string, recordedAt: Temporal.Instant): LogEntry => ({
  property,
  value: typeof currentValue === 'number' && Number.isFinite(currentValue) ? currentValue + 1 : 1,
  recordedAt,
})
