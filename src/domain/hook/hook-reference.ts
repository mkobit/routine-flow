import { z } from 'zod'

/**
 * Name of a hook resolved via a HookRegistry (name -> function). Never eval'd
 * from settings/frontmatter — always a lookup against code the plugin (or a
 * registering third party) actually shipped.
 */
export const HookNameSchema = z.string().min(1).brand<'HookName'>()
export type HookName = z.infer<typeof HookNameSchema>

/**
 * Which lifecycle moment a hook fires for. Lives here rather than in hook.ts
 * so PhaseInstance (session.ts) can name the firing event on a recorded hook
 * outcome without session.ts importing from hook.ts, which already imports
 * PhaseInstance/Session from session.ts -- this module has no imports of its
 * own for exactly this "don't cyclically depend on the hook execution model"
 * reason (see HookReference's doc comment below). Re-exported from hook.ts.
 */
export type HookEvent = 'onEnter' | 'onComplete' | 'onSkip' | 'onExit'

/**
 * A reference to a hook plus the parameters to invoke it with, embeddable on
 * a Phase (onEnter/onComplete/onSkip/onExit) or a PhaseTransition (custom
 * condition predicate) without pulling in the full Hook/HookContext types —
 * keeps Phase from cyclically depending on the hook execution model.
 */
export const HookReferenceSchema = z.object({
  name: HookNameSchema,
  params: z.record(z.string(), z.unknown()).readonly(),
}).readonly()

export type HookReference = z.infer<typeof HookReferenceSchema>
