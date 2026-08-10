import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface BaseViewState {
  readonly type: 'bases'
  readonly file: string
  readonly viewName: string
}

export interface MarkdownViewState {
  readonly type: 'markdown'
  readonly file: string
}

export type TargetViewState = BaseViewState | MarkdownViewState

const PRESET_OPEN_TARGETS: Readonly<Record<string, TargetViewState>> = {
  'default': { type: 'bases', file: 'Tasks.base', viewName: 'Default' },
  'pomodoro': { type: 'bases', file: 'Tasks.base', viewName: 'Default' },
  'standup': { type: 'bases', file: 'Tasks.base', viewName: 'Standup' },
  'workout': { type: 'bases', file: 'Tasks.base', viewName: 'Workout' },
  'chore-list': { type: 'bases', file: 'Tasks.base', viewName: 'Chore list' },
  'chores': { type: 'bases', file: 'Tasks.base', viewName: 'Chore list' },
  'manual-clear': { type: 'bases', file: 'Tasks.base', viewName: 'Manual clear' },
  'table': { type: 'bases', file: 'Tasks.base', viewName: 'Table' },
  'shared-routines': { type: 'bases', file: 'shared-routines/Shared-routines.base', viewName: 'Standup' },
}

export function resolveOpenTarget(rawTarget: string): TargetViewState {
  const normalized = rawTarget.trim().toLowerCase()
  const preset = PRESET_OPEN_TARGETS[normalized]
  if (preset) {
    return preset
  }

  if (rawTarget.includes(':')) {
    const colonIndex = rawTarget.indexOf(':')
    const file = rawTarget.slice(0, colonIndex).trim()
    const viewName = rawTarget.slice(colonIndex + 1).trim()
    return { type: 'bases', file, viewName }
  }

  if (rawTarget.endsWith('.base')) {
    return { type: 'bases', file: rawTarget, viewName: 'Default' }
  }

  return { type: 'markdown', file: rawTarget }
}

export function buildWorkspaceLayout(target: TargetViewState): Record<string, unknown> {
  const leafState = target.type === 'bases'
    ? {
      type: 'bases',
      state: {
        file: target.file,
        viewName: target.viewName,
      },
    }
    : {
      type: 'markdown',
      state: {
        file: target.file,
        mode: 'source',
        source: false,
      },
    }

  return {
    main: {
      id: 'main-split',
      type: 'split',
      children: [
        {
          id: 'main-tabs',
          type: 'tabs',
          children: [
            {
              id: 'active-leaf',
              type: 'leaf',
              state: leafState,
            },
          ],
        },
      ],
      direction: 'vertical',
    },
    active: 'active-leaf',
  }
}

/**
 * Presets `.obsidian/workspace.json` in a copied vault before launch.
 */
export async function applyInitialWorkspace(vaultPath: string, rawTarget: string): Promise<void> {
  const workspacePath = path.join(vaultPath, '.obsidian', 'workspace.json')
  const target = resolveOpenTarget(rawTarget)
  const layout = buildWorkspaceLayout(target)
  await fs.mkdir(path.dirname(workspacePath), { recursive: true })
  await fs.writeFile(workspacePath, JSON.stringify(layout, null, 2), 'utf-8')
}
