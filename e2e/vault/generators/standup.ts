import fc from 'fast-check'
import { routineFileNote, routineReadme } from '../routine-note'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const STANDUP_NAME_POOL = ['Alice', 'Bob', 'Priya', 'Diego', 'Sana', 'Owen'] as const

export function generateStandupNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.uniqueArray(fc.constantFrom(...STANDUP_NAME_POOL), { minLength: 3, maxLength: STANDUP_NAME_POOL.length })
  const [members] = fc.sample(arb, { numRuns: 1, seed })
  return [
    routineReadme(
      'standup',
      'The standup routine (see dev-docs/examples/standup.md) gives each member a fixed time box, advancing to the next person when their time is up or they finish early.\nNo queue, no write-back — just a rotation through phases; `Roster.md` lists the members, one PhaseGraph phase per person.',
    ),
    routineFileNote(
      'standup',
      'standup-routine.md',
      {
        id: 'standup',
        name: 'Standup',
        phases: [
          {
            id: 'alice',
            label: 'Alice\'s turn',
            kind: 'turn',
            duration: 'PT10S',
            taskSourceId: null,
            completionPolicy: { kind: 'noOp' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'bob',
            label: 'Bob\'s turn',
            kind: 'turn',
            duration: 'PT10S',
            taskSourceId: null,
            completionPolicy: { kind: 'noOp' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
        ],
        transitions: [
          { fromPhaseId: 'alice', toPhaseId: 'bob', condition: { kind: 'always' } },
          { fromPhaseId: 'bob', toPhaseId: 'alice', condition: { kind: 'always' } },
        ],
      },
      'Standup routine',
      'Hand-authored routine file for standup turns.',
    ),
    createNote(
      'standup/Roster.md',
      { members: members ?? [] },
      'Generated test data for the standup routine (see dev-docs/examples/standup.md) — one PhaseGraph phase per member here.',
    ),
  ]
}
