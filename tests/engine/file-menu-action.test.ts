import { describe, expect, test } from 'bun:test'
import { decideFileMenuAction, focusTaskInActiveRoutine, startRoutineForTask } from '../../src/timer/file-menu-action'
import { DEFAULT_PHASE_GRAPH } from '../../src/timer/phase-graph-query'
import type { PhaseGraph } from '../../src/domain/phase/phase-graph'

const VALID_ROUTINE_MARKDOWN = `---
is-routine: true
---

\`\`\`json
{
  "id": "custom-routine",
  "name": "Custom Routine",
  "phases": [
    {
      "id": "focus",
      "label": "Focus",
      "kind": "focus",
      "duration": "PT15M",
      "taskSourceId": null
    }
  ],
  "transitions": []
}
\`\`\`
`

describe('file-menu-action', () => {
  test('decideFileMenuAction returns focus when running or paused, and start otherwise', () => {
    expect(decideFileMenuAction('running')).toBe('focus')
    expect(decideFileMenuAction('paused')).toBe('focus')
    expect(decideFileMenuAction('stopped')).toBe('start')
    expect(decideFileMenuAction('ended')).toBe('start')
    expect(decideFileMenuAction('completed')).toBe('start')
  })

  test('focusTaskInActiveRoutine dispatches start with filePath and activates view', async () => {
    let dispatched: readonly string[] = []
    let activated = 0

    await focusTaskInActiveRoutine('Tasks/My Task.md', {
      dispatchStart: async (filePath) => {
        dispatched = [...dispatched, filePath]
      },
      activateView: async () => {
        activated += 1
      },
    })

    expect(dispatched).toEqual(['Tasks/My Task.md'])
    expect(activated).toBe(1)
  })

  test('startRoutineForTask starts DEFAULT_PHASE_GRAPH when routineFile is null', async () => {
    let clearedConfig = 0
    let graphs: readonly PhaseGraph[] = []
    let dispatched: readonly string[] = []
    let activated = 0

    const ok = await startRoutineForTask('Tasks/My Task.md', null, {
      clearActiveViewStatusConfig: () => {
        clearedConfig += 1
      },
      setGraph: (graph) => {
        graphs = [...graphs, graph]
      },
      dispatchStart: async (filePath) => {
        dispatched = [...dispatched, filePath]
      },
      activateView: async () => {
        activated += 1
      },
      readRoutineFile: async () => '',
      showNotice: () => {},
    })

    expect(ok).toBe(true)
    expect(clearedConfig).toBe(1)
    expect(graphs).toEqual([DEFAULT_PHASE_GRAPH])
    expect(dispatched).toEqual(['Tasks/My Task.md'])
    expect(activated).toBe(1)
  })

  test('startRoutineForTask parses selected routine file and starts it', async () => {
    let clearedConfig = 0
    let graphs: readonly PhaseGraph[] = []
    let dispatched: readonly string[] = []
    let activated = 0
    let notices: readonly string[] = []

    const ok = await startRoutineForTask(
      'Tasks/My Task.md',
      { path: 'Routines/Custom.md', label: 'Custom' },
      {
        clearActiveViewStatusConfig: () => {
          clearedConfig += 1
        },
        setGraph: (graph) => {
          graphs = [...graphs, graph]
        },
        dispatchStart: async (filePath) => {
          dispatched = [...dispatched, filePath]
        },
        activateView: async () => {
          activated += 1
        },
        readRoutineFile: async () => VALID_ROUTINE_MARKDOWN,
        showNotice: (msg) => {
          notices = [...notices, msg]
        },
      },
    )

    expect(ok).toBe(true)
    expect(clearedConfig).toBe(1)
    expect(graphs).toHaveLength(1)
    expect(String(graphs[0]?.id)).toBe('custom-routine')
    expect(dispatched).toEqual(['Tasks/My Task.md'])
    expect(activated).toBe(1)
    expect(notices).toEqual([])
  })

  test('startRoutineForTask shows Notice and aborts when routine file fails to parse', async () => {
    let clearedConfig = 0
    let graphs: readonly PhaseGraph[] = []
    let dispatched: readonly string[] = []
    let activated = 0
    let notices: readonly string[] = []

    const ok = await startRoutineForTask(
      'Tasks/My Task.md',
      { path: 'Routines/Broken.md', label: 'Broken' },
      {
        clearActiveViewStatusConfig: () => {
          clearedConfig += 1
        },
        setGraph: (graph) => {
          graphs = [...graphs, graph]
        },
        dispatchStart: async (filePath) => {
          dispatched = [...dispatched, filePath]
        },
        activateView: async () => {
          activated += 1
        },
        readRoutineFile: async () => 'not a valid routine',
        showNotice: (msg) => {
          notices = [...notices, msg]
        },
      },
    )

    expect(ok).toBe(false)
    expect(clearedConfig).toBe(0)
    expect(graphs).toEqual([])
    expect(dispatched).toEqual([])
    expect(activated).toBe(0)
    expect(notices).toHaveLength(1)
    expect(notices[0]).toContain('Broken')
  })
})
