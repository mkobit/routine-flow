import fc from 'fast-check'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const BUG_TITLES = [
  'Fix tooltip clipping on mobile',
  'Resolve memory leak in ticker loop',
  'Handle null frontmatter in cache reader',
  'Escape markdown in notification toast',
] as const

export function generateBugTriageBlitzNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    title: fc.constantFrom(...BUG_TITLES),
    severity: fc.constantFrom('P1', 'P2', 'P3'),
    dueOffsetDays: fc.integer({ min: 0, max: 4 }),
  })
  const samples = fc.sample(arb, { numRuns: 3, seed })
  return [
    routineReadme(
      'bug-triage-blitz',
      'The bug-triage-blitz routine crunches bug tickets in 15m focus sprints with 3m breathers, automatically branching to terminal wrap-up when the queue is exhausted.',
    ),
    routineFileNote(
      'bug-triage-blitz',
      'bug-triage-blitz-routine.md',
      {
        id: 'bug-triage-blitz',
        name: 'Bug triage blitz',
        phases: [
          {
            id: 'triage-sprint',
            label: 'Bug triage sprint',
            kind: 'focus',
            duration: 'PT15M',
            taskSourceId: 'bug-queue',
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
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
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'wrap-up',
            label: 'PR wrap-up and submission',
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
          { fromPhaseId: 'triage-sprint', toPhaseId: 'wrap-up', condition: { kind: 'queueExhausted' } },
          { fromPhaseId: 'triage-sprint', toPhaseId: 'breather', condition: { kind: 'always' } },
          { fromPhaseId: 'breather', toPhaseId: 'triage-sprint', condition: { kind: 'always' } },
        ],
      },
      'Bug triage blitz routine',
      'Hand-authored routine file with queueExhausted terminal branch.',
    ),
    ...samples.map((s, i) => createNote(
      indexedPath('bug-triage-blitz', i, s.title),
      {
        type: 'bug-ticket',
        severity: s.severity,
        due: ANCHOR_DATE.add({ days: s.dueOffsetDays }),
        status: 'open',
      },
      'Bug ticket note for triage sprint.',
    )),
  ]
}
