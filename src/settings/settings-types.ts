import { z } from 'zod'
import { PredicateNameSchema } from '../domain/hook/predicate'
import { HookNameSchema } from '../domain/hook/hook-reference'
import { ProgressMeterStyleSchema } from '../timer/progress-meter-style'
import { CadenceRuleSchema } from '../domain/routine/cadence-selection'

/** A settings-authored name+formula pair for a 'custom' TransitionCondition predicate — see FormulaPredicateSetting (src/timer/formula-predicate-registry.ts), which this schema's parsed shape matches structurally. */
export const FormulaPredicateSettingSchema = z.object({
  name: PredicateNameSchema,
  formula: z.string().min(1),
})

/** A settings-authored name+script pair — see ScriptHookBindingSetting (src/timer/script-hook-registry.ts), which this schema's parsed shape matches structurally. */
export const ScriptHookBindingSettingSchema = z.object({
  name: HookNameSchema,
  scriptPath: z.string().min(1),
  scriptSource: z.string(),
})

export const RoutineFlowSettingsSchema = z.object({
  /** Frontmatter property to increment when a focus phase completes. */
  writeBackProperty: z.string().default('sessions'),
  /** Whether to show a confirmation modal before applying write-back mutations. */
  confirmWriteBack: z.boolean().default(true),
  /** Frontmatter property used to read and write task completion status. */
  statusProperty: z.string().default('routine-status'),
  /** Status value written when marking a task done and recognized as completed. */
  doneStatusValue: z.string().default('done'),
  /** Clock speedup multiplier for testing/dev fast-forwarding (1 to 60). */
  clockSpeedMultiplier: z.number().min(1).max(60).default(1),
  /** Active built-in progress-meter visualization for the timer panel's dial (see flow-gu1.19.15 family). */
  progressMeterStyle: ProgressMeterStyleSchema.default('radial'),
  /** Named formula-authored 'custom' TransitionCondition predicates, evaluated via MutableFormulaPredicateRegistry. */
  formulaPredicates: z.array(FormulaPredicateSettingSchema).default([]),
  /** Vault folder .js script hooks are selected from — see script-hook-source. */
  scriptsFolder: z.string().default(''),
  /** Named, bind-time-confirmed script-hook bindings, resolved via MutableScriptHookRegistry. */
  scriptHookBindings: z.array(ScriptHookBindingSettingSchema).default([]),
  /** Scheduled cadence rules for criteria-based routine selection. */
  cadenceRules: z.array(CadenceRuleSchema).default([]),
})

export type RoutineFlowSettings = z.infer<typeof RoutineFlowSettingsSchema>

export const DEFAULT_SETTINGS: RoutineFlowSettings = {
  writeBackProperty: 'sessions',
  confirmWriteBack: true,
  statusProperty: 'routine-status',
  doneStatusValue: 'done',
  clockSpeedMultiplier: 1,
  progressMeterStyle: 'radial',
  formulaPredicates: [],
  scriptsFolder: '',
  scriptHookBindings: [],
  cadenceRules: [],
}
