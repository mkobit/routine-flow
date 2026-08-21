import fc from 'fast-check'
import { indexedPath, routineFileNote, routineReadme } from '../routine-note'
import { ANCHOR_DATE } from '../seed'
import { createNote } from '../note'
import type { NoteDefinition } from '../schema'

const POMODORO_TASK_TITLES = [
  'Write the proposal',
  'Refactor auth module',
  'Draft release notes',
  'Fix flaky test',
  'Update onboarding docs',
  'Review PR feedback',
  'Migrate config schema',
] as const

const POMODORO_CYCLE_STATUSES = ['pending', 'active', 'done', 'skipped', 'deferred'] as const

export function generatePomodoroNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    title: fc.constantFrom(...POMODORO_TASK_TITLES),
    status: fc.constantFrom('todo', 'in-progress', 'done'),
    dueOffsetDays: fc.integer({ min: -2, max: 14 }),
    priority: fc.constantFrom(1, 2, 3),
    sessions: fc.integer({ min: 0, max: 6 }),
    routineCycleStatus: fc.constantFrom(...POMODORO_CYCLE_STATUSES),
    routinePriority: fc.option(fc.integer({ min: -1000, max: 1000 }), { nil: undefined }),
  })
  const samples = fc.sample(arb, { numRuns: 5, seed })
  return [
    routineReadme(
      'pomodoro',
      'The pomodoro routine (see dev-docs/examples/pomodoro.md) alternates 25m focus with a 5m break, extending the break to 15m every 4th cycle, repeating until you stop.\nThe notes in this folder are the work-task queue a focus phase pulls from — `type: work` items the shipped default graph\'s `focus-queue` matches.',
    ),
    routineFileNote(
      'pomodoro',
      'pomodoro-routine.md',
      {
        id: 'pomodoro',
        name: 'Pomodoro',
        phases: [
          {
            id: 'focus',
            label: 'Focus',
            kind: 'focus',
            duration: 'PT25S',
            taskSourceId: 'focus-queue',
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'break',
            label: 'Short break',
            kind: 'break',
            duration: 'PT5S',
            taskSourceId: 'break-queue',
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: null,
            onSkip: null,
            onExit: null,
          },
          {
            id: 'long-break',
            label: 'Long break',
            kind: 'break',
            duration: 'PT15S',
            taskSourceId: 'break-queue',
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
          { fromPhaseId: 'focus', toPhaseId: 'long-break', condition: { kind: 'everyNth', n: 4 } },
          { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
          { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
          { fromPhaseId: 'long-break', toPhaseId: 'focus', condition: { kind: 'always' } },
        ],
      },
      'Pomodoro routine',
      'Hand-authored routine file for the standard Pomodoro workflow.',
    ),
    ...samples.map((s, i) => createNote(
      indexedPath('pomodoro', i, s.title),
      {
        'status': s.status,
        'due': ANCHOR_DATE.add({ days: s.dueOffsetDays }),
        'priority': s.priority,
        'type': 'work',
        'sessions': s.sessions,
        'routine-status': s.routineCycleStatus,
        ...(s.routinePriority === undefined ? {} : { 'routine-priority': s.routinePriority }),
      },
      'Generated test data for the pomodoro routine (see dev-docs/examples/pomodoro.md).',
    )),
  ]
}
