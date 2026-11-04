import { z } from 'zod'
/** A duration that must be greater than zero (e.g. a phase's configured length). */
export const PositiveDurationSchema = z.instanceof(Temporal.Duration).refine(
  duration => duration.sign > 0,
  { message: 'duration must be positive' },
)

/** A duration that may be zero (e.g. time remaining right as a phase completes). */
export const NonNegativeDurationSchema = z.instanceof(Temporal.Duration).refine(
  duration => duration.sign >= 0,
  { message: 'duration must not be negative' },
)
