import { z } from 'zod'
import { Temporal } from 'temporal-polyfill'

/**
 * ISO day of week: 1 (Monday) to 7 (Sunday), matching Temporal.ZonedDateTime.dayOfWeek.
 */
export const DayOfWeekSchema = z.number().int().min(1).max(7)

/**
 * 24-hour time format: HH:mm or HH:mm:ss.
 */
const TimeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Expected time in HH:mm or HH:mm:ss format')

export const CadenceRuleSchema = z.object({
  id: z.string().min(1),
  routinePath: z.string().min(1),
  daysOfWeek: z.array(DayOfWeekSchema).optional(),
  startTime: TimeStringSchema.optional(),
  endTime: TimeStringSchema.optional(),
  tags: z.array(z.string().min(1)).optional(),
})

export type CadenceRule = z.infer<typeof CadenceRuleSchema>

export const CadenceRulesetSchema = z.object({
  rules: z.array(CadenceRuleSchema),
})

export type CadenceRuleset = z.infer<typeof CadenceRulesetSchema>

export interface CadenceContext {
  readonly now: Temporal.Instant
  readonly timeZone?: string
  readonly tags?: readonly string[]
}

function matchesDayOfWeek(ruleDays: readonly number[] | undefined, dayOfWeek: number): boolean {
  return ruleDays === undefined || ruleDays.length === 0
    ? true
    : ruleDays.includes(dayOfWeek)
}

function matchesStartTime(startTime: string | undefined, time: Temporal.PlainTime): boolean {
  return startTime === undefined
    ? true
    : Temporal.PlainTime.compare(time, Temporal.PlainTime.from(startTime)) >= 0
}

function matchesEndTime(endTime: string | undefined, time: Temporal.PlainTime): boolean {
  return endTime === undefined
    ? true
    : Temporal.PlainTime.compare(time, Temporal.PlainTime.from(endTime)) <= 0
}

function matchesTimeRange(
  startTime: string | undefined,
  endTime: string | undefined,
  time: Temporal.PlainTime,
): boolean {
  return matchesStartTime(startTime, time) && matchesEndTime(endTime, time)
}

function matchesTags(ruleTags: readonly string[] | undefined, contextTags: readonly string[] | undefined): boolean {
  return ruleTags === undefined || ruleTags.length === 0
    ? true
    : contextTags === undefined || contextTags.length === 0
      ? false
      : ruleTags.some(tag => new Set(contextTags).has(tag))
}

function matchesRule(rule: CadenceRule, zonedDateTime: Temporal.ZonedDateTime, contextTags: readonly string[] | undefined): boolean {
  return (
    matchesDayOfWeek(rule.daysOfWeek, zonedDateTime.dayOfWeek)
    && matchesTimeRange(rule.startTime, rule.endTime, zonedDateTime.toPlainTime())
    && matchesTags(rule.tags, contextTags)
  )
}

/**
 * Pure function to resolve the target routine from timestamp/context and a ruleset.
 * Rules are evaluated in sequential priority order; the first match wins.
 */
export function resolveCadenceRoutine(
  rules: readonly CadenceRule[],
  context: CadenceContext,
): CadenceRule | null {
  const timeZone = context.timeZone ?? 'UTC'
  const zonedDateTime = context.now.toZonedDateTimeISO(timeZone)

  return rules.find(rule => matchesRule(rule, zonedDateTime, context.tags)) ?? null
}
