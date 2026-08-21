import fc from 'fast-check'
import { routineFileNote, routineReadme } from '../routine-note'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const CHORE_POOL = ['Dishes', 'Laundry', 'Tidy up', 'Vacuum', 'Water plants', 'Take out trash'] as const

export function generateChoreListNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.uniqueArray(fc.constantFrom(...CHORE_POOL), { minLength: 3, maxLength: CHORE_POOL.length })
  const [chores] = fc.sample(arb, { numRuns: 1, seed })
  return [
    routineReadme(
      'chore-list',
      'The chore-list routine (see dev-docs/examples/chore-list.md) rotates through a fixed list of chores, one duration-less phase per chore, each cleared manually (Done, then Clear) rather than on a timer.\nNo queue, no write-back — `Chores.md` lists the chores, one PhaseGraph phase per chore.',
    ),
    routineFileNote(
      'chore-list',
      'chore-list-routine.md',
      {
        id: 'chore-list',
        name: 'Chore list',
        phases: [
          {
            id: 'dishes',
            label: 'Dishes',
            kind: 'chore',
            duration: null,
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
            id: 'laundry',
            label: 'Laundry',
            kind: 'chore',
            duration: null,
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
            id: 'vacuum',
            label: 'Vacuum',
            kind: 'chore',
            duration: null,
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
          { fromPhaseId: 'dishes', toPhaseId: 'laundry', condition: { kind: 'always' } },
          { fromPhaseId: 'laundry', toPhaseId: 'vacuum', condition: { kind: 'always' } },
          { fromPhaseId: 'vacuum', toPhaseId: 'dishes', condition: { kind: 'always' } },
        ],
      },
      'Chore list routine',
      'Hand-authored routine file for chore list rotation.',
    ),
    createNote(
      'chore-list/Chores.md',
      { chores: chores ?? [] },
      'Generated test data for the chore-list routine (see dev-docs/examples/chore-list.md) — one PhaseGraph phase per chore here.',
    ),
  ]
}
