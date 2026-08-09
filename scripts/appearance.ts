import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// Obsidian's own appearance.json vocabulary for the two built-in base
// themes -- "obsidian" is the dark scheme, "moonstone" is the light scheme.
// Ported from bases-chartkit's shared/appearance.ts (same obsidian-launcher
// harness, same --theme technique).
export const OBSIDIAN_THEME_BY_MODE = { dark: 'obsidian', light: 'moonstone' } as const
export type ViewMode = keyof typeof OBSIDIAN_THEME_BY_MODE

// Matches src/domain/routine/routine-file.ts's isRecord -- this project's
// convention for narrowing JSON.parse's `any` without a type assertion
// (consistent-type-assertions: never).
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Presets a copied (not-yet-launched) vault's color scheme before Obsidian
 * ever reads appearance.json. Must run against a vault copy that hasn't
 * been launched yet -- writing after launch() would race Obsidian actually
 * reading it.
 */
export async function applyViewMode(vaultPath: string, mode: ViewMode): Promise<void> {
  const appearancePath = path.join(vaultPath, '.obsidian', 'appearance.json')
  const existingRaw = await fs.readFile(appearancePath, 'utf8').catch(() => '{}')
  const parsed: unknown = JSON.parse(existingRaw)
  const existing = isRecord(parsed) ? parsed : {}
  await fs.writeFile(
    appearancePath,
    JSON.stringify({ ...existing, theme: OBSIDIAN_THEME_BY_MODE[mode] }),
  )
}
