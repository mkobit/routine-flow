import fc from 'fast-check'
import { createNote } from '../note'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import type { NoteDefinition } from '../schema'

const LEITNER_CARDS = [
  {
    title: 'Binary search complexity',
    body: '# Binary search complexity\n\nWhat is the worst-case time complexity of binary search on a sorted array of size $N$?\n\n**Answer**: $O(\\log N)$',
  },
  {
    title: 'Difference between TCP and UDP',
    body: '# Difference between TCP and UDP\n\nWhat are the key trade-offs between TCP and UDP?\n\n**Answer**: TCP provides connection-oriented, reliable, ordered byte streams with congestion control; UDP provides connectionless, lightweight, unordered datagrams without retransmission overhead.',
  },
  {
    title: 'React useEffect cleanup',
    body: '# React useEffect cleanup\n\nWhen does the cleanup function returned by `useEffect` execute?\n\n**Answer**: It runs before the component unmounts and before re-running the effect on subsequent renders when dependencies change.',
  },
  {
    title: 'Photosynthesis equation',
    body: '# Photosynthesis equation\n\nWhat is the net balanced equation for oxygenic photosynthesis?\n\n**Answer**: $6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{light} \\rightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$',
  },
  {
    title: 'Spanish word for bridge',
    body: '# Spanish word for bridge\n\nWhat is the Spanish translation for "bridge"?\n\n**Answer**: *el puente*',
  },
  {
    title: 'Capital of France',
    body: '# Capital of France\n\nWhat is the capital city of France?\n\n**Answer**: Paris',
  },
] as const

const REQUIRED_CARDS = [
  { card: LEITNER_CARDS[0], box: 1, dueOffsetDays: -1 },
  { card: LEITNER_CARDS[1], box: 2, dueOffsetDays: 0 },
  { card: LEITNER_CARDS[2], box: 3, dueOffsetDays: 1 },
  { card: LEITNER_CARDS[3], box: 4, dueOffsetDays: 3 },
  { card: LEITNER_CARDS[4], box: 5, dueOffsetDays: 7 },
] as const

const extraCardArb = fc.record({
  box: fc.integer({ min: 1, max: 5 }),
  dueOffsetDays: fc.integer({ min: -3, max: 10 }),
})

export function generateLeitnerBoxNotes(seed: number): readonly NoteDefinition[] {
  const [extraCard] = fc.sample(extraCardArb, { numRuns: 1, seed })
  const cards = [
    ...REQUIRED_CARDS,
    ...(extraCard === undefined ? [] : [{ card: LEITNER_CARDS[5], ...extraCard }]),
  ]

  return [
    routineReadme(
      'leitner-box',
      'The Leitner box spaced review portfolio demonstrates flashcard reviews organized into spaced repetition boxes.\nReviewing cards triggers grade actions (`Again`, `Hard`, `Good`, `Easy`) that adjust box tiers and set `routine-due` via `deferDuration`.\nCards deferred into future dates disappear from the review queue and reappear on their due date.',
    ),
    routineFileNote(
      'leitner-box',
      'leitner-box-routine.md',
      {
        id: 'leitner-box',
        name: 'Leitner box spaced review',
        phases: [
          {
            id: 'review',
            label: 'Card review',
            kind: 'review',
            duration: null,
            taskSourceId: 'review-queue',
            completionPolicy: { kind: 'manualClear' },
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
            actions: [
              { id: 'grade-again', label: 'Again (10m)', style: 'destructive', payload: { kind: 'deferDuration', after: 'PT10M', property: 'routine-due', box: 1 } },
              { id: 'grade-hard', label: 'Hard (1d)', payload: { kind: 'deferDuration', after: 'P1D', property: 'routine-due', box: 2 } },
              { id: 'grade-good', label: 'Good (3d)', style: 'primary', payload: { kind: 'deferDuration', after: 'P3D', property: 'routine-due', box: 3 } },
              { id: 'grade-easy', label: 'Easy (7d)', payload: { kind: 'deferDuration', after: 'P7D', property: 'routine-due', box: 4 } },
            ],
          },
        ],
        transitions: [
          { fromPhaseId: 'review', toPhaseId: 'review', condition: { kind: 'always' } },
        ],
      },
      'Leitner box spaced review',
      'Hand-authored routine definition for Leitner box spaced repetition reviews.',
    ),
    ...cards.map(({ card, box, dueOffsetDays }, index) => createNote(
      indexedPath('leitner-box', index, card.title),
      {
        box,
        'routine-status': dueOffsetDays > 0 ? 'deferred' : 'pending',
        'routine-due': ANCHOR_DATE.add({ days: dueOffsetDays }),
      },
      card.body,
    )),
  ]
}
