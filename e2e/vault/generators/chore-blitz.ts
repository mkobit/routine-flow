import fc from 'fast-check'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const CHORE_TITLES = [
  'Wipe kitchen counters',
  'Empty dishwasher',
  'Take out recycling',
  'Water indoor plants',
  'Sort incoming mail',
  'Fold clean laundry',
] as const

export function generateChoreBlitzNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    title: fc.constantFrom(...CHORE_TITLES),
    area: fc.constantFrom('kitchen', 'living-room', 'office'),
    dueOffsetDays: fc.integer({ min: 0, max: 3 }),
    priority: fc.integer({ min: 1, max: 3 }),
  })
  const samples = fc.sample(arb, { numRuns: 3, seed })
  return [
    routineReadme(
      'chore-blitz',
      'The chore-blitz routine executes household chores in rapid 15m focus sprints with 3m breathers.\nIt batch-logs completed tasks to markdown frontmatter and advances early to wrap-up when the chore queue is exhausted.',
    ),
    routineFileNote(
      'chore-blitz',
      'chore-blitz-routine.md',
      {
        id: 'chore-blitz',
        name: 'Chore blitz',
        phases: [
          {
            id: 'blitz',
            label: 'Chore blitz sprint',
            kind: 'focus',
            duration: 'PT15M',
            taskSourceId: 'chore-queue',
            completionPolicy: null,
            notification: null,
            logTarget: {
              kind: 'completedItems',
            },
            actions: [
              {
                id: 'done',
                label: 'Done',
                style: 'primary',
                payload: {
                  kind: 'markDone',
                },
              },
            ],
            onEnter: null,
            onComplete: 'write-back',
            onSkip: null,
            onExit: null,
          },
          {
            id: 'breather',
            label: 'Intermission breather',
            kind: 'break',
            duration: 'PT3M',
            taskSourceId: null,
            completionPolicy: null,
            notification: null,
            logTarget: {
              kind: 'activeItem',
            },
            actions: [],
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'wrap-up',
            label: 'Clean-up and wrap-up',
            kind: 'ritual',
            duration: 'PT5M',
            taskSourceId: null,
            completionPolicy: {
              kind: 'manualClear',
            },
            notification: null,
            logTarget: {
              kind: 'activeItem',
            },
            actions: [],
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
        ],
        transitions: [
          {
            fromPhaseId: 'blitz',
            toPhaseId: 'wrap-up',
            condition: {
              kind: 'queueExhausted',
            },
          },
          {
            fromPhaseId: 'blitz',
            toPhaseId: 'breather',
            condition: {
              kind: 'always',
            },
          },
          {
            fromPhaseId: 'breather',
            toPhaseId: 'blitz',
            condition: {
              kind: 'always',
            },
          },
        ],
      },
      'Chore blitz routine',
      'Hand-authored routine file with queueExhausted terminal branch and completedItems batch write-back.',
    ),
    ...samples.map((s, i) => createNote(
      indexedPath('chore-blitz', i, s.title),
      {
        type: 'chore',
        area: s.area,
        priority: s.priority,
        due: ANCHOR_DATE.add({ days: s.dueOffsetDays }),
        status: 'todo',
        sessions: 0,
      },
      'Chore note for time-budgeted blitz execution.',
    )),
  ]
}
