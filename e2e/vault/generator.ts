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

const POMODORO_TASK_TITLES = [
  'Write the proposal',
  'Refactor auth module',
  'Draft release notes',
  'Fix flaky test',
  'Update onboarding docs',
  'Review PR feedback',
  'Migrate config schema',
] as const

/** Mirrors TaskQueueItemCycleStatusSchema (src/domain/queue/task-source.ts) — kept as a literal tuple so this fixture generator has no src/domain dependency. */
const POMODORO_CYCLE_STATUSES = ['pending', 'active', 'done', 'skipped', 'deferred'] as const

/**
 * Work tasks a `focus` phase's queue pulls from (see the `focus-queue` row in
 * dev-docs/examples/pomodoro.md's domain mapping — this is what the "Default"
 * sub-view's Work queue renders, via `focusProperty: note.type`/`focusValue:
 * work`). `routinePriority` is `fc.option`'d so some notes exercise
 * BaseQuerySource's "missing priority sorts as 0" default.
 *
 * The frontmatter key is plain `type`, not `note.type` — Bases' property id
 * format is itself `<source>.<name>` (e.g. `note.type` means source=note,
 * name=type), so a frontmatter key literally containing a dot needs
 * `note.<key>` (i.e. `note.note.type`) to resolve, not `note.<key>` read
 * naively. Keeping the frontmatter key undotted avoids the collision
 * entirely and matches `focusProperty`'s declared default.
 */
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
  return [routineReadme(
    'pomodoro',
    'The pomodoro routine (see dev-docs/examples/pomodoro.md) alternates 25m focus with a 5m break, extending the break to 15m every 4th cycle, repeating until you stop.\nThe notes in this folder are the work-task queue a focus phase pulls from — `type: work` items the shipped default graph\'s `focus-queue` matches.',
  ), ...samples.map((s, i) => createNote(
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
  ))]
}

const STANDUP_NAME_POOL = ['Alice', 'Bob', 'Priya', 'Diego', 'Sana', 'Owen'] as const

/** A roster note — descriptive only; standup phases are hand-mapped one per person, not queue-driven. */
function generateStandupNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.uniqueArray(fc.constantFrom(...STANDUP_NAME_POOL), { minLength: 3, maxLength: STANDUP_NAME_POOL.length })
  const [members] = fc.sample(arb, { numRuns: 1, seed })
  return [
    routineReadme(
      'standup',
      'The standup routine (see dev-docs/examples/standup.md) gives each member a fixed time box, advancing to the next person when their time is up or they finish early.\nNo queue, no write-back — just a rotation through phases; `Roster.md` lists the members, one PhaseGraph phase per person.',
    ),
    createNote(
      'standup/Roster.md',
      { members: members ?? [] },
      'Generated test data for the standup routine (see dev-docs/examples/standup.md) — one PhaseGraph phase per member here.',
    ),
  ]
}

const WORKOUT_EXERCISE_POOL = ['Squats', 'Push-ups', 'Lunges', 'Plank', 'Rows', 'Deadlifts', 'Burpees'] as const

/** A fixedSequence TaskSource — an ordered list, no Bases query involved. */
function generateWorkoutNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.uniqueArray(fc.constantFrom(...WORKOUT_EXERCISE_POOL), { minLength: 4, maxLength: 6 })
  const [sequence] = fc.sample(arb, { numRuns: 1, seed })
  return [
    routineReadme(
      'workout',
      'The workout routine (see dev-docs/examples/workout.md) runs a warm-up, then loops rep-based set / timed rest cycles, where a set ends when you say you\'re done rather than on a clock.\n`Exercises.md` is the ordered, fixed-sequence exercise list the `set` phase steps through — no Bases query involved.',
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

/** Review cards a `cards` baseQuery TaskSource could pull from, some due, some not. */
function generateSpacedRepetitionNotes(seed: number): readonly NoteDefinition[] {
  const cardArb = fc.record({
    title: fc.constantFrom(...REVIEW_CARD_TITLES),
    dueOffsetDays: fc.integer({ min: -3, max: 10 }),
    ease: fc.constantFrom(1, 2, 3, 4, 5),
  })
  // uniqueArray by title so each of the REVIEW_CARD_TITLES pool appears at most once per generated vault.
  const arb = fc.uniqueArray(cardArb, { selector: card => card.title, minLength: REVIEW_CARD_TITLES.length, maxLength: REVIEW_CARD_TITLES.length })
  const [cards] = fc.sample(arb, { numRuns: 1, seed })
  return [routineReadme(
    'spaced-repetition',
    'The spaced-repetition routine (see dev-docs/examples/spaced-repetition.md) reviews one due card at a time; marking a review done defers that card to a future date, then it reappears.\nThe notes in this folder are review cards carrying a `dueDate` — some due, some not — that a `cards` query pulls from.',
  ), ...(cards ?? []).map((s, i) => createNote(
    indexedPath('spaced-repetition', i, s.title),
    {
      dueDate: ANCHOR_DATE.add({ days: s.dueOffsetDays }),
      ease: s.ease,
    },
    'Generated test data for the spaced-repetition routine (see dev-docs/examples/spaced-repetition.md).',
  ))]
}

/** No queue at all (taskSourceId is null) — a descriptive note only, so the folder still exists. */
function generateStretchBreakNotes(): readonly NoteDefinition[] {
  return [routineReadme(
    'stretch-break',
    'The stretch-break routine (see dev-docs/examples/stretch-break.md) has no queue — taskSourceId is null on its one phase, so there is nothing to generate here.',
  )]
}

/** Daily habit notes; onEnter/onExit hooks (see dev-docs/examples/habit-tracking.md) target these. restDay marks days the (currently unimplemented, flow-b74) custom TransitionCondition should skip weights on. */
function generateHabitTrackingNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.record({
    dayOffset: fc.integer({ min: 0, max: 6 }),
    restDay: fc.boolean(),
  })
  const samples = fc.sample(arb, { numRuns: 5, seed })
  return [routineReadme(
    'habit-tracking',
    'The habit-tracking routine (see dev-docs/examples/habit-tracking.md) runs a daily weights-then-cardio session, skipping the weights phase entirely on rest days.\nThe `day-*.md` notes are the daily habit notes those hooks target; each carries a `date` and a `restDay` marker.',
  ), ...samples.map((s, i) => createNote(
    `habit-tracking/day-${i + 1}.md`,
    {
      date: ANCHOR_DATE.add({ days: s.dayOffset }),
      restDay: s.restDay,
    },
    'Generated test data for the habit-tracking routine (see dev-docs/examples/habit-tracking.md).',
  ))]
}

const CHORE_POOL = ['Dishes', 'Laundry', 'Tidy up', 'Vacuum', 'Water plants', 'Take out trash'] as const

/** A chores note — descriptive only; chore-list phases are hand-mapped one per chore, not queue-driven (same shape as the standup roster). */
function generateChoreListNotes(seed: number): readonly NoteDefinition[] {
  const arb = fc.uniqueArray(fc.constantFrom(...CHORE_POOL), { minLength: 3, maxLength: CHORE_POOL.length })
  const [chores] = fc.sample(arb, { numRuns: 1, seed })
  return [
    routineReadme(
      'chore-list',
      'The chore-list routine (see dev-docs/examples/chore-list.md) rotates through a fixed list of chores, one duration-less phase per chore, each cleared manually (Done, then Clear) rather than on a timer.\nNo queue, no write-back — `Chores.md` lists the chores, one PhaseGraph phase per chore.',
    ),
    createNote(
      'chore-list/Chores.md',
      { chores: chores ?? [] },
      'Generated test data for the chore-list routine (see dev-docs/examples/chore-list.md) — one PhaseGraph phase per chore here.',
    ),
  ]
}

/** Distinct per-routine offsets so each routine's sampling is independent of the others under the same top-level seed. */
const ROUTINE_SEED_OFFSETS = {
  pomodoro: 0,
  standup: 1,
  workout: 2,
  spacedRepetition: 3,
  habitTracking: 4,
  choreList: 5,
} as const

/** All seven dev-docs/examples/ routines' vault content, deterministic for a given seed. Defaults to resolveVaultSeed(). */
export function generateVault(seed: number = resolveVaultSeed()): readonly NoteDefinition[] {
  return [
    ...generatePomodoroNotes(seed + ROUTINE_SEED_OFFSETS.pomodoro),
    ...generateStandupNotes(seed + ROUTINE_SEED_OFFSETS.standup),
    ...generateWorkoutNotes(seed + ROUTINE_SEED_OFFSETS.workout),
    ...generateSpacedRepetitionNotes(seed + ROUTINE_SEED_OFFSETS.spacedRepetition),
    ...generateStretchBreakNotes(),
    ...generateHabitTrackingNotes(seed + ROUTINE_SEED_OFFSETS.habitTracking),
    ...generateChoreListNotes(seed + ROUTINE_SEED_OFFSETS.choreList),
  ]
}

/** Top-level folders generateVault owns. Used to clear stale notes before rebuilding (e.g. a routine that generated 7 notes last run and generates 5 this run would otherwise leave 2 stale files behind). */
export const GENERATED_VAULT_FOLDERS = [
  'pomodoro',
  'standup',
  'workout',
  'spaced-repetition',
  'stretch-break',
  'habit-tracking',
  'chore-list',
] as const

/** Deletes any previously generated routine folders, then writes a fresh generateVault(seed) — a rebuild, not an overlay. */
export async function rebuildGeneratedVault(baseDir: string, seed: number = resolveVaultSeed()): Promise<readonly Error[]> {
  await Promise.all(GENERATED_VAULT_FOLDERS.map(folder =>
    fs.rm(path.join(baseDir, folder), { recursive: true, force: true }),
  ))
  return writeVault(baseDir, generateVault(seed))
}
