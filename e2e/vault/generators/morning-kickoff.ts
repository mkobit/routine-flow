import fc from 'fast-check'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const MORNING_PRIORITIES = [
  'Architect auth boundary',
  'Review open pull requests',
  'Design query view layout',
  'Draft system documentation',
] as const

export function generateMorningKickoffNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    title: fc.constantFrom(...MORNING_PRIORITIES),
    dueOffsetDays: fc.integer({ min: 0, max: 2 }),
  })
  const samples = fc.sample(arb, { numRuns: 3, seed })
  return [
    routineReadme(
      'morning-kickoff',
      'The morning-kickoff routine transitions from physical morning hydration into daily planning and directly into the day\'s top priority sprint.',
    ),
    routineFileNote(
      'morning-kickoff',
      'morning-kickoff-routine.md',
      {
        id: 'morning-kickoff',
        name: 'Morning kickoff and focus launch',
        phases: [
          {
            id: 'morning-hydrate',
            label: 'Hydration and light stretch',
            kind: 'ritual',
            duration: 'PT10M',
            taskSourceId: null,
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'plan-day',
            label: 'Calendar review and top 3 priorities',
            kind: 'ritual',
            duration: 'PT5M',
            taskSourceId: null,
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'priority-sprint',
            label: 'Top priority deep sprint',
            kind: 'focus',
            duration: 'PT45M',
            taskSourceId: 'morning-queue',
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
        ],
        transitions: [
          { fromPhaseId: 'morning-hydrate', toPhaseId: 'plan-day', condition: { kind: 'always' } },
          { fromPhaseId: 'plan-day', toPhaseId: 'priority-sprint', condition: { kind: 'always' } },
        ],
      },
      'Morning kickoff routine',
      'Hand-authored routine file for morning launch with terminal priority sprint.',
    ),
    ...samples.map((s, i) => createNote(
      indexedPath('morning-kickoff', i, s.title),
      {
        type: 'morning-priority',
        priority: 1,
        due: ANCHOR_DATE.add({ days: s.dueOffsetDays }),
        status: 'todo',
      },
      'Top priority task note for morning kickoff sprint.',
    )),
  ]
}
