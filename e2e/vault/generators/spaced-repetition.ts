import fc from 'fast-check'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const REVIEW_CARD_TITLES = [
  'Capital of France',
  'Photosynthesis equation',
  'Binary search complexity',
  'Spanish word for "bridge"',
  'React useEffect cleanup',
  'Difference between TCP and UDP',
] as const

export function generateSpacedRepetitionNotes(seed: number): readonly NoteDefinition[] {
  const cardArb = fc.record({
    title: fc.constantFrom(...REVIEW_CARD_TITLES),
    dueOffsetDays: fc.integer({ min: -3, max: 10 }),
    ease: fc.constantFrom(1, 2, 3, 4, 5),
  })
  const arb = fc.uniqueArray(cardArb, { selector: card => card.title, minLength: REVIEW_CARD_TITLES.length, maxLength: REVIEW_CARD_TITLES.length })
  const [cards] = fc.sample(arb, { numRuns: 1, seed })
  return [
    routineReadme(
      'spaced-repetition',
      'The spaced-repetition routine (see dev-docs/examples/spaced-repetition.md) reviews one due card at a time; marking a review done defers that card to a future date, then it reappears.\nThe notes in this folder are review cards carrying a `dueDate` — some due, some not — that a `cards` query pulls from.',
    ),
    routineFileNote(
      'spaced-repetition',
      'spaced-repetition-routine.md',
      {
        id: 'spaced-repetition',
        name: 'Spaced repetition',
        phases: [
          {
            id: 'review',
            label: 'Card review',
            kind: 'review',
            duration: null,
            taskSourceId: 'cards',
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
          { fromPhaseId: 'review', toPhaseId: 'review', condition: { kind: 'always' } },
        ],
      },
      'Spaced repetition routine',
      'Hand-authored routine file for spaced repetition reviews.',
    ),
    ...(cards ?? []).map((s, i) => createNote(
      indexedPath('spaced-repetition', i, s.title),
      {
        dueDate: ANCHOR_DATE.add({ days: s.dueOffsetDays }),
        ease: s.ease,
      },
      'Generated test data for the spaced-repetition routine (see dev-docs/examples/spaced-repetition.md).',
    )),
  ]
}
