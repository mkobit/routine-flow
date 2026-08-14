import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import fc from 'fast-check'
import { Temporal } from 'temporal-polyfill'
import { createNote } from './note'
import type { NoteDefinition } from './schema'
import { writeVault } from './vault'

/** Fixed so a fresh checkout without VAULT_SEED set reproduces the same vault every run. */
export const DEFAULT_VAULT_SEED = 424_242

/** All generated due/rest-day dates offset from this — fixed so output never depends on the real calendar date. */
const ANCHOR_DATE = Temporal.PlainDate.from('2026-01-01')

/** Reads VAULT_SEED so a flaky e2e run can be regenerated exactly for debugging, falling back to the fixed default. */
export function resolveVaultSeed(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env.VAULT_SEED
  if (raw === undefined) {
    return DEFAULT_VAULT_SEED
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`VAULT_SEED must be a finite number, got: "${raw}"`)
  }
  return parsed
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function indexedPath(dir: string, index: number, title: string): string {
  return `${dir}/${String(index + 1).padStart(2, '0')}-${slugify(title)}.md`
}

/**
 * An in-vault README, mirroring stretch-break/README.md: a short orientation for
 * someone browsing the vault, pointing at the full dev-docs/examples/ writeup
 * rather than reproducing its domain-model detail. Empty frontmatter, prose body.
 */
function routineReadme(folder: string, body: string): NoteDefinition {
  return createNote(`${folder}/README.md`, {}, body)
}

function routineFileNote(folder: string, filename: string, jsonGraph: object, title: string, description: string): NoteDefinition {
  const body = `# ${title}\n\n${description}\n\n\`\`\`json\n${JSON.stringify(jsonGraph, null, 2)}\n\`\`\``
  return createNote(`${folder}/${filename}`, { 'is-routine': true }, body)
}

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

function generatePomodoroNotes(seed: number): readonly NoteDefinition[] {
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

const STANDUP_NAME_POOL = ['Alice', 'Bob', 'Priya', 'Diego', 'Sana', 'Owen'] as const

function generateStandupNotes(seed: number): readonly NoteDefinition[] {
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

const WORKOUT_EXERCISE_POOL = ['Squats', 'Push-ups', 'Lunges', 'Plank', 'Rows', 'Deadlifts', 'Burpees'] as const

function generateWorkoutNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.uniqueArray(fc.constantFrom(...WORKOUT_EXERCISE_POOL), { minLength: 4, maxLength: 6 })
  const [sequence] = fc.sample(arb, { numRuns: 1, seed })
  return [
    routineReadme(
      'workout',
      'The workout routine (see dev-docs/examples/workout.md) runs a warm-up, then loops rep-based set / timed rest cycles, where a set ends when you say you\'re done rather than on a clock.\n`Exercises.md` is the ordered, fixed-sequence exercise list the `set` phase steps through — no Bases query involved.',
    ),
    routineFileNote(
      'workout',
      'workout-routine.md',
      {
        id: 'workout',
        name: 'Workout',
        phases: [
          {
            id: 'warmup',
            label: 'Warm-up',
            kind: 'warm-up',
            duration: 'PT5S',
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
            id: 'set',
            label: 'Set',
            kind: 'set',
            duration: null,
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
            id: 'rest',
            label: 'Rest',
            kind: 'rest',
            duration: 'PT5S',
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
          { fromPhaseId: 'warmup', toPhaseId: 'set', condition: { kind: 'always' } },
          { fromPhaseId: 'set', toPhaseId: 'rest', condition: { kind: 'always' } },
          { fromPhaseId: 'rest', toPhaseId: 'set', condition: { kind: 'always' } },
        ],
      },
      'Workout routine',
      'Hand-authored routine file for workout warm-up/set/rest.',
    ),
    createNote(
      'workout/Exercises.md',
      { sequence: sequence ?? [] },
      'Generated test data for the workout routine (see dev-docs/examples/workout.md).',
    ),
  ]
}

const REVIEW_CARD_TITLES = [
  'Capital of France',
  'Photosynthesis equation',
  'Binary search complexity',
  'Spanish word for "bridge"',
  'React useEffect cleanup',
  'Difference between TCP and UDP',
] as const

function generateSpacedRepetitionNotes(seed: number): readonly NoteDefinition[] {
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

function generateStretchBreakNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'stretch-break',
      'The stretch-break routine (see dev-docs/examples/stretch-break.md) has no queue — taskSourceId is null on its one phase, so there is nothing to generate here.',
    ),
    routineFileNote(
      'stretch-break',
      'stretch-break-routine.md',
      {
        id: 'stretch-break',
        name: 'Stretch break',
        phases: [
          {
            id: 'stretch',
            label: 'Stretch interval',
            kind: 'break',
            duration: 'PT45S',
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
            id: 'rest',
            label: 'Rest interval',
            kind: 'break',
            duration: 'PT15S',
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
            id: 'done',
            label: 'Routine complete',
            kind: 'break',
            duration: 'PT0S',
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
          { fromPhaseId: 'rest', toPhaseId: 'done', condition: { kind: 'everyNth', n: 5 } },
          { fromPhaseId: 'stretch', toPhaseId: 'rest', condition: { kind: 'always' } },
          { fromPhaseId: 'rest', toPhaseId: 'stretch', condition: { kind: 'always' } },
        ],
      },
      'Stretch break routine',
      'Hand-authored routine file for desk stretch breaks.',
    ),
  ]
}

function generateHabitTrackingNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    dayOffset: fc.integer({ min: 0, max: 6 }),
    restDay: fc.boolean(),
  })
  const samples = fc.sample(arb, { numRuns: 5, seed })
  return [
    routineReadme(
      'habit-tracking',
      'The habit-tracking routine (see dev-docs/examples/habit-tracking.md) runs a daily weights-then-cardio session, skipping the weights phase entirely on rest days.\nThe `day-*.md` notes are the daily habit notes those hooks target; each carries a `date` and a `restDay` marker.',
    ),
    routineFileNote(
      'habit-tracking',
      'habit-tracking-routine.md',
      {
        id: 'habit-tracking',
        name: 'Habit tracking',
        phases: [
          {
            id: 'weights',
            label: 'Strength / Weights',
            kind: 'exercise',
            duration: 'PT10S',
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
            id: 'cardio',
            label: 'Cardio session',
            kind: 'exercise',
            duration: 'PT10S',
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
          { fromPhaseId: 'weights', toPhaseId: 'cardio', condition: { kind: 'always' } },
          { fromPhaseId: 'cardio', toPhaseId: 'weights', condition: { kind: 'always' } },
        ],
      },
      'Habit tracking routine',
      'Hand-authored routine file for habit tracking.',
    ),
    ...samples.map((s, i) => createNote(
      `habit-tracking/day-${i + 1}.md`,
      {
        date: ANCHOR_DATE.add({ days: s.dayOffset }),
        restDay: s.restDay,
      },
      'Generated test data for the habit-tracking routine (see dev-docs/examples/habit-tracking.md).',
    )),
  ]
}

const CHORE_POOL = ['Dishes', 'Laundry', 'Tidy up', 'Vacuum', 'Water plants', 'Take out trash'] as const

function generateChoreListNotes(seed: number): readonly NoteDefinition[] {
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

function generateSprintRetrospectiveNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'sprint-retrospective',
      'The sprint-retrospective routine (see dev-docs/examples/sprint-retrospective.md) runs facilitator-paced discussion segments (What went well, What didn\'t, Action items), each duration-less (`duration: null`) with `manualClear` completion.\n`Agenda.md` lists the retrospective segments.',
    ),
    routineFileNote(
      'sprint-retrospective',
      'sprint-retrospective-routine.md',
      {
        id: 'sprint-retrospective',
        name: 'Sprint retrospective',
        phases: [
          {
            id: 'what-went-well',
            label: 'What went well',
            kind: 'discussion',
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
            id: 'what-didnt',
            label: 'What didn\'t go well',
            kind: 'discussion',
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
            id: 'action-items',
            label: 'Action items',
            kind: 'discussion',
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
          { fromPhaseId: 'what-went-well', toPhaseId: 'what-didnt', condition: { kind: 'always' } },
          { fromPhaseId: 'what-didnt', toPhaseId: 'action-items', condition: { kind: 'always' } },
          { fromPhaseId: 'action-items', toPhaseId: 'what-went-well', condition: { kind: 'always' } },
        ],
      },
      'Sprint retrospective routine',
      'Hand-authored routine file for team sprint retrospectives.',
    ),
    createNote(
      'sprint-retrospective/Agenda.md',
      { segments: ['What went well', 'What didn\'t', 'Action items'] },
      'Generated test data for the sprint-retrospective routine (see dev-docs/examples/sprint-retrospective.md).',
    ),
  ]
}

function generateManualClearNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'manual-clear',
      'The manual-clear routine tests explicit manual clearing of timed phases.',
    ),
    routineFileNote(
      'manual-clear',
      'manual-clear-routine.md',
      {
        id: 'manual-clear',
        name: 'Manual clear',
        phases: [
          {
            id: 'focus',
            label: 'Focus',
            kind: 'focus',
            duration: 'PT5S',
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
            id: 'break',
            label: 'Break',
            kind: 'break',
            duration: 'PT3S',
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
          { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
          { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
        ],
      },
      'Manual clear routine',
      'Hand-authored routine file for testing manualClear completion.',
    ),
  ]
}

function generateWriteBackVariantsNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'write-back-variants',
      'The write-back-variants routine tests activeItem vs callback write-back behavior.',
    ),
    routineFileNote(
      'write-back-variants',
      'write-back-variants-routine.md',
      {
        id: 'write-back-variants',
        name: 'Write-back variants',
        phases: [
          {
            id: 'active-write',
            label: 'Active item write-back',
            kind: 'focus',
            duration: 'PT10S',
            taskSourceId: 'focus-queue',
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'activeItem' },
            onEnter: null,
            onComplete: 'write-back',
            onSkip: null,
            onExit: null,
          },
          {
            id: 'callback-write',
            label: 'Callback write-back',
            kind: 'focus',
            duration: 'PT10S',
            taskSourceId: 'focus-queue',
            completionPolicy: null,
            notification: null,
            logTarget: { kind: 'callback', name: 'dailyNote' },
            onEnter: null,
            onComplete: 'write-back',
            onSkip: null,
            onExit: null,
          },
          {
            id: 'no-write',
            label: 'No write-back',
            kind: 'focus',
            duration: 'PT10S',
            taskSourceId: 'focus-queue',
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
          { fromPhaseId: 'active-write', toPhaseId: 'callback-write', condition: { kind: 'always' } },
          { fromPhaseId: 'callback-write', toPhaseId: 'no-write', condition: { kind: 'always' } },
          { fromPhaseId: 'no-write', toPhaseId: 'active-write', condition: { kind: 'always' } },
        ],
      },
      'Write-back variants routine',
      'Hand-authored routine file for verifying write-back targets.',
    ),
  ]
}

function generateBreakDurationVariantsNotes(): readonly NoteDefinition[] {
  return [
    routineReadme(
      'break-duration-variants',
      'The break-duration-variants routine tests break duration selection using stacked everyNth conditions.',
    ),
    routineFileNote(
      'break-duration-variants',
      'break-duration-variants-routine.md',
      {
        id: 'break-duration-variants',
        name: 'Break-duration variants',
        phases: [
          {
            id: 'focus',
            label: 'Focus',
            kind: 'focus',
            duration: 'PT10S',
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
            id: 'short-break',
            label: 'Short break',
            kind: 'break',
            duration: 'PT2S',
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
            id: 'medium-break',
            label: 'Medium break',
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
            duration: 'PT10S',
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
          { fromPhaseId: 'focus', toPhaseId: 'long-break', condition: { kind: 'everyNth', n: 8 } },
          { fromPhaseId: 'focus', toPhaseId: 'medium-break', condition: { kind: 'everyNth', n: 4 } },
          { fromPhaseId: 'focus', toPhaseId: 'short-break', condition: { kind: 'always' } },
          { fromPhaseId: 'short-break', toPhaseId: 'focus', condition: { kind: 'always' } },
          { fromPhaseId: 'medium-break', toPhaseId: 'focus', condition: { kind: 'always' } },
          { fromPhaseId: 'long-break', toPhaseId: 'focus', condition: { kind: 'always' } },
        ],
      },
      'Break-duration variants routine',
      'Hand-authored routine file for testing multi-tier break ladder.',
    ),
  ]
}

const ROUTINE_SEED_OFFSETS = {
  pomodoro: 0,
  standup: 1,
  workout: 2,
  spacedRepetition: 3,
  habitTracking: 4,
  choreList: 5,
} as const

export function generateVault(seed: number = resolveVaultSeed()): readonly NoteDefinition[] {
  return [
    ...generatePomodoroNotes(seed + ROUTINE_SEED_OFFSETS.pomodoro),
    ...generateStandupNotes(seed + ROUTINE_SEED_OFFSETS.standup),
    ...generateWorkoutNotes(seed + ROUTINE_SEED_OFFSETS.workout),
    ...generateSpacedRepetitionNotes(seed + ROUTINE_SEED_OFFSETS.spacedRepetition),
    ...generateStretchBreakNotes(),
    ...generateHabitTrackingNotes(seed + ROUTINE_SEED_OFFSETS.habitTracking),
    ...generateChoreListNotes(seed + ROUTINE_SEED_OFFSETS.choreList),
    ...generateSprintRetrospectiveNotes(),
    ...generateManualClearNotes(),
    ...generateWriteBackVariantsNotes(),
    ...generateBreakDurationVariantsNotes(),
  ]
}

export const GENERATED_VAULT_FOLDERS = [
  'pomodoro',
  'standup',
  'workout',
  'spaced-repetition',
  'stretch-break',
  'habit-tracking',
  'chore-list',
  'sprint-retrospective',
  'manual-clear',
  'write-back-variants',
  'break-duration-variants',
] as const

export async function rebuildGeneratedVault(baseDir: string, seed: number = resolveVaultSeed()): Promise<readonly Error[]> {
  await Promise.all(GENERATED_VAULT_FOLDERS.map(folder =>
    fs.rm(path.join(baseDir, folder), { recursive: true, force: true }),
  ))
  return writeVault(baseDir, generateVault(seed))
}
