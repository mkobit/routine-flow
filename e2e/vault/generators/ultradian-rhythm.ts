import fc from 'fast-check'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const ULTRADIAN_TASKS = [
  'Core engine architecture redesign',
  'Implement persistent cache indexing',
  'Write formal specification proof',
] as const

export function generateUltradianRhythmNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    title: fc.constantFrom(...ULTRADIAN_TASKS),
    dueOffsetDays: fc.integer({ min: 1, max: 7 }),
  })
  const samples = fc.sample(arb, { numRuns: 2, seed })
  return [
    routineReadme(
      'ultradian-rhythm',
      'The ultradian-rhythm routine aligns deep cognitive work with the human 90-minute ultradian cycle followed by a 20-minute restorative downtime.',
    ),
    routineFileNote(
      'ultradian-rhythm',
      'ultradian-rhythm-routine.md',
      {
        id: 'ultradian-rhythm',
        name: 'Ultradian 90/20 rhythm',
        phases: [
          {
            id: 'deep-work',
            label: 'Ultradian deep work',
            kind: 'focus',
            duration: 'PT90M',
            taskSourceId: 'ultradian-queue',
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'recovery',
            label: 'Cognitive recovery',
            kind: 'break',
            duration: 'PT20M',
            taskSourceId: null,
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
        ],
        transitions: [
          { fromPhaseId: 'deep-work', toPhaseId: 'recovery', condition: { kind: 'always' } },
          { fromPhaseId: 'recovery', toPhaseId: 'deep-work', condition: { kind: 'always' } },
        ],
      },
      'Ultradian 90/20 routine',
      'Hand-authored routine file for 90m deep work and 20m restorative downtime.',
    ),
    ...samples.map((s, i) => createNote(
      indexedPath('ultradian-rhythm', i, s.title),
      {
        type: 'ultradian-task',
        priority: 1,
        due: ANCHOR_DATE.add({ days: s.dueOffsetDays }),
        status: 'in-progress',
      },
      'Deep work project task note.',
    )),
  ]
}
