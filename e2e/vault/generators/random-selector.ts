import fc from 'fast-check'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const RANDOM_SELECTOR_TASKS = [
  'Audit CSS color tokens against design foundations',
  'Benchmark queue roulette deceleration schedule',
  'Draft architecture decision record for task promotion',
  'Profile memory footprint in long running tickers',
  'Review error handling in query task source',
] as const

export function generateRandomSelectorNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    title: fc.constantFrom(...RANDOM_SELECTOR_TASKS),
    dueOffsetDays: fc.integer({ min: 0, max: 4 }),
    priority: fc.integer({ min: 10, max: 50 }),
  })
  const samples = fc.sample(arb, { numRuns: 3, seed })
  return [
    routineReadme(
      'random-selector',
      'The random-selector routine selects and promotes tasks with a roulette wheel animation before starting timed focus and break intervals.\nThe roulette selector highlights candidate tasks in sequence and gradually decelerates.\nWhen the wheel stops, the selected task promotes to the front of the queue and becomes the active file.',
    ),
    routineFileNote(
      'random-selector',
      'random-selector-routine.md',
      {
        id: 'random-selector',
        name: 'Random task selector',
        phases: [
          {
            id: 'selector',
            name: 'Spin task wheel',
            label: 'Spin task wheel',
            kind: 'selector',
            duration: null,
            onCompletion: 'waitForManual',
            taskSourceId: 'selector-queue',
            queryFilter: {
              property: 'note.type',
              value: 'random-selector-task',
            },
            selector: {
              autoSpin: false,
              promoteToFront: true,
            },
            handlers: {},
          },
          {
            id: 'focus',
            name: 'Focus sprint',
            label: 'Focus sprint',
            kind: 'focus',
            duration: 'PT25M',
            onCompletion: 'autoAdvance',
            taskSourceId: 'selector-queue',
            queryFilter: {
              property: 'note.type',
              value: 'random-selector-task',
            },
            handlers: {},
          },
          {
            id: 'short-break',
            name: 'Short break',
            label: 'Short break',
            kind: 'break',
            duration: 'PT5M',
            onCompletion: 'autoAdvance',
            handlers: {},
          },
        ],
        transitions: [
          { from: 'selector', to: 'focus', guard: { kind: 'always' } },
          { from: 'focus', to: 'short-break', guard: { kind: 'always' } },
          { from: 'short-break', to: 'selector', guard: { kind: 'always' } },
        ],
      },
      'Random task selector routine',
      'Routine configuration note for randomized task selection, promotion, and interval timing.',
    ),
    ...samples.map((s, i) => createNote(
      indexedPath('random-selector', i, s.title),
      {
        'type': 'random-selector-task',
        'routine-priority': s.priority,
        'priority': s.priority,
        'due': ANCHOR_DATE.add({ days: s.dueOffsetDays }),
        'status': 'todo',
      },
      'Sample task note for randomized task selection.',
    )),
  ]
}
