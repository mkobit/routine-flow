import { describe, expect, it } from 'bun:test'
import { buildWorkspaceLayout, resolveOpenTarget } from '../scripts/initial-workspace'

describe('resolveOpenTarget', () => {
  it('resolves preset short names to bases views', () => {
    expect(resolveOpenTarget('default')).toEqual({ type: 'bases', file: 'Tasks.base', viewName: 'Default' })
    expect(resolveOpenTarget('standup')).toEqual({ type: 'bases', file: 'Tasks.base', viewName: 'Standup' })
    expect(resolveOpenTarget('workout')).toEqual({ type: 'bases', file: 'Tasks.base', viewName: 'Workout' })
    expect(resolveOpenTarget('chore-list')).toEqual({ type: 'bases', file: 'Tasks.base', viewName: 'Chore list' })
    expect(resolveOpenTarget('chores')).toEqual({ type: 'bases', file: 'Tasks.base', viewName: 'Chore list' })
    expect(resolveOpenTarget('manual-clear')).toEqual({ type: 'bases', file: 'Tasks.base', viewName: 'Manual clear' })
    expect(resolveOpenTarget('table')).toEqual({ type: 'bases', file: 'Tasks.base', viewName: 'Table' })
    expect(resolveOpenTarget('shared-routines')).toEqual({
      type: 'bases',
      file: 'shared-routines/Shared-routines.base',
      viewName: 'Standup',
    })
  })

  it('supports explicit file:viewName syntax', () => {
    expect(resolveOpenTarget('Tasks.base:Workout')).toEqual({ type: 'bases', file: 'Tasks.base', viewName: 'Workout' })
  })

  it('defaults unadorned .base files to Default viewName', () => {
    expect(resolveOpenTarget('custom/MyTasks.base')).toEqual({ type: 'bases', file: 'custom/MyTasks.base', viewName: 'Default' })
  })

  it('resolves markdown file paths', () => {
    expect(resolveOpenTarget('routines/standup-routine.md')).toEqual({ type: 'markdown', file: 'routines/standup-routine.md' })
  })
})

describe('buildWorkspaceLayout', () => {
  it('builds layout for bases target', () => {
    const layout = buildWorkspaceLayout({ type: 'bases', file: 'Tasks.base', viewName: 'Standup' })
    expect(layout).toEqual({
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
                state: {
                  type: 'bases',
                  state: {
                    file: 'Tasks.base',
                    viewName: 'Standup',
                  },
                },
              },
            ],
          },
        ],
        direction: 'vertical',
      },
      active: 'active-leaf',
    })
  })

  it('builds layout for markdown target', () => {
    const layout = buildWorkspaceLayout({ type: 'markdown', file: 'README.md' })
    expect(layout).toEqual({
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
                state: {
                  type: 'markdown',
                  state: {
                    file: 'README.md',
                    mode: 'source',
                    source: false,
                  },
                },
              },
            ],
          },
        ],
        direction: 'vertical',
      },
      active: 'active-leaf',
    })
  })
})
