import fc from 'fast-check'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const READING_ITEMS = [
  'Refactoring by Martin Fowler (Ch 3)',
  'Designing Data-Intensive Applications (Ch 7)',
  'Structure and Interpretation of Computer Programs',
  'Staff Engineer by Will Larson',
] as const

export function generateEveningWindDownNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    title: fc.constantFrom(...READING_ITEMS),
    dueOffsetDays: fc.integer({ min: -1, max: 3 }),
  })
  const samples = fc.sample(arb, { numRuns: 2, seed })
  return [
    routineReadme(
      'evening-wind-down',
      'The evening-wind-down routine disconnects from digital screens, shifts into quiet reading, and terminal meditation prep for sleep.',
    ),
    routineFileNote(
      'evening-wind-down',
      'evening-wind-down-routine.md',
      {
        id: 'evening-wind-down',
        name: 'Evening digital sunset and wind-down',
        phases: [
          {
            id: 'digital-sunset',
            label: 'Mute notifications and close laptop',
            kind: 'ritual',
            duration: 'PT5M',
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
            id: 'leisure-reading',
            label: 'Leisure reading',
            kind: 'review',
            duration: 'PT25M',
            taskSourceId: 'reading-queue',
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'sleep-prep',
            label: 'Dark room and breathwork meditation',
            kind: 'ritual',
            duration: 'PT10M',
            taskSourceId: null,
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
          { fromPhaseId: 'digital-sunset', toPhaseId: 'leisure-reading', condition: { kind: 'always' } },
          { fromPhaseId: 'leisure-reading', toPhaseId: 'sleep-prep', condition: { kind: 'always' } },
        ],
      },
      'Evening wind-down routine',
      'Hand-authored routine file for screen disconnection and calm sleep prep.',
    ),
    ...samples.map((s, i) => createNote(
      indexedPath('evening-wind-down', i, s.title),
      {
        type: 'reading-item',
        due: ANCHOR_DATE.add({ days: s.dueOffsetDays }),
        status: 'reading',
      },
      'Reading item note for evening review.',
    )),
  ]
}
