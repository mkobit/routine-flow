import { Temporal } from 'temporal-polyfill'

/** Fixed so a fresh checkout without VAULT_SEED set reproduces the same vault every run. */
export const DEFAULT_VAULT_SEED = 424_242

/** All generated due/rest-day dates offset from this — fixed so output never depends on the real calendar date. */
export const ANCHOR_DATE = Temporal.PlainDate.from('2026-01-01')

/** Reads VAULT_SEED so a flaky e2e run can be regenerated exactly for debugging, falling back to the fixed default. */
export function resolveVaultSeed(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env.VAULT_SEED
  if (raw === undefined) {
    return DEFAULT_VAULT_SEED
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`VAULT_SEED must be a finite number, got: "${raw}"`)
  }
  return parsed
}
