---
sidebar_position: 10
---

# Reference

Technical reference for routine JSON schemas, plugin settings, commands, custom predicate formulas, and script hooks.

## Routine JSON schema

A routine note is a Markdown file containing **one** fenced `json` code block (` ```json ... ``` `).
Add `is-routine: true` to the note's frontmatter so Routine Flow lists it in the routine picker modal.

### Top-level `PhaseGraph`

| Field | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | Non-empty graph identifier. |
| `name` | `string` | Yes | Non-empty display name. |
| `phases` | `Phase[]` | Yes | At least one phase; duplicate `id` values are rejected. |
| `transitions` | `TransitionEdge[]` | Yes | All `from` and `to` IDs must exist in `phases`. |
| `trackerFilePath` | `string` | No | Vault path to a tracker note used by `tracker.*` formula references and the accumulator hook. Alias: `trackerFile`. |

### `Phase`

| Field | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `string` | — | Required, non-empty, unique within the graph. |
| `name` | `string` | — | Required, non-empty. Falls back to `label` if omitted. |
| `label` | `string` | `name` | Display label. Falls back to `name` if omitted. |
| `kind` | `string` | `"focus"` | Non-empty semantic category (built-in kinds: `"focus"`, `"break"`, `"selector"`). |
| `duration` | `string \| null` | — | Required. Positive ISO 8601 duration (for example `"PT25M"`, `"PT30S"`) or `null` for untimed phases. |
| `onCompletion` | `"autoAdvance" \| "waitForManual"` | `"autoAdvance"` | Completion behavior. Also accepts `completionPolicy: { "kind": "manualClear" }` as an alias for `"waitForManual"`. |
| `taskSourceId` | `string \| null` | `null` | Task source ID for this phase's queue. Alias: `taskSource`. |
| `queryFilter` | `PhaseQueryFilter` | `undefined` | `{ "property": string, "value": string }`. `property` must start with `note.`, `file.`, or `formula.` (bare names are prefixed with `note.`). |
| `notification` | `NotificationPolicy \| null` | `null` | `{ "sound": string \| null, "systemNotification": boolean }`. |
| `logTarget` | `PhaseLogTarget \| null` | `null` | Where write-back targets: `{ "kind": "activeItem" }`, `{ "kind": "completedItems" }`, or `{ "kind": "callback", "name": string }`. |
| `handlers` | `PhaseNodeHandlers` | `{}` (all `[]`) | Lifecycle hooks: `onEnter`, `onComplete`, `onSkip`, `onExit` (each `Handler[]`). Also accepts top-level `onEnter`/`onComplete`/`onSkip`/`onExit` shorthand `{ "name": string, "params"?: object }`. |
| `actions` | `QueueItemAction[]` | `[]` | Per-item action buttons rendered on queue items during this phase. |
| `badges` | `PhaseQueueBadge[]` | `[]` | Frontmatter/metadata badges rendered on queue items during this phase. |
| `timeFormat` | `"mm:ss" \| "hh:mm:ss" \| "ss.s" \| "ms"` | `undefined` | Display format override for the countdown timer. |
| `selector` | `PhaseSelectorConfig` | `undefined` | `{ "autoSpin"?: boolean, "promoteToFront"?: boolean }` (both default `false`). Also accepts top-level `autoSpin` and `promoteToFront`. |
| `guidance` | `string[]` | `undefined` | Non-empty checklist/guidance lines shown during the phase. Alias: `checklist`. |

### `handlers` (`Handler`)

Each lifecycle array (`onEnter`, `onComplete`, `onSkip`, `onExit`) holds `Handler` objects:

| Variant | Fields | Notes |
| :--- | :--- | :--- |
| `preset` | `kind: "preset"`, `preset`, `params?` | Built-in preset name: `"markDone"`, `"queueCycle"`, `"deferDuration"`, `"setFrontmatter"`, `"notify"`, `"resetReward"`, `"deductReward"`, `"accumulateReward"`. |
| `script` | `kind: "script"`, `scriptPath`, `params?` | References a bound script hook name (or path) registered in Settings. |

### `actions` (`QueueItemAction`)

Each action has `{ id: string, label: string, style?: "default" | "primary" | "destructive", payload: QueueItemActionPayload }`:

| `payload.kind` | Additional fields |
| :--- | :--- |
| `"queueCycle"` | None. |
| `"markDone"` | None. |
| `"deferDuration"` | `after` (positive ISO 8601 duration), optional `property`, `box` (non-negative integer), `boxProperty`, `setProperties` (`Record<string, number \| string \| boolean>`). |
| `"setFrontmatter"` | `property` (non-empty string), `value` (`number \| string \| boolean`). |

### `badges` (`PhaseQueueBadge`)

| Field | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `property` | `string` | — | Required, non-empty property name. |
| `label` | `string` | `undefined` | Optional display label. |
| `icon` | `string` | `undefined` | Optional Lucide icon name. |
| `prefix` | `string` | `undefined` | Optional text before the value. |
| `suffix` | `string` | `undefined` | Optional text after the value. |
| `variant` | `"default" \| "accent" \| "muted"` | `"default"` | Visual badge variant. |

### `transitions` (`TransitionEdge`) and `TransitionCondition`

| Field | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `from` | `string` | — | Source phase ID. Alias: `fromPhaseId`. |
| `to` | `string` | — | Target phase ID. Alias: `toPhaseId`. |
| `guard` | `TransitionCondition` | `{ "kind": "always" }` | Routing guard. Alias: `condition`. |

Supported `TransitionCondition` (`EdgeGuard`) variants:

| `kind` | Fields | Notes |
| :--- | :--- | :--- |
| `"always"` | `kind: "always"` | Unconditional transition. |
| `"everyNth"` | `kind: "everyNth"`, `count: number` | Matches every `count`th completion (positive integer). Alias: `n`. |
| `"queueExhausted"` | `kind: "queueExhausted"` | Matches when the active phase's task queue is empty. |
| `"custom"` | `kind: "custom"`, `predicateName: string`, `params?: object` | Evaluates a named custom predicate from Settings. Alias: `predicate`. |

## Plugin settings

Settings are stored in the plugin's `data.json` and configured under **Settings → Routine Flow**.

| Setting key | UI label | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `writeBackProperty` | Write-back property | `string` | `"sessions"` | Frontmatter property incremented when a focus phase completes. |
| `confirmWriteBack` | Confirm write-back | `boolean` | `true` | Show a confirmation modal before applying frontmatter write-back mutations. |
| `statusProperty` | Status property | `string` | `"routine-status"` | Frontmatter property used to read and write task completion status. |
| `doneStatusValue` | Done status value | `string` | `"done"` | Status value written when marking a task done and recognized as completed. |
| `progressMeterStyle` | Progress meter style | `"radial" \| "fill-bar" \| "battery-drain" \| "tick-marks"` | `"radial"` | Visual style for the timer panel's progress meter (`Radial ring`, `Fill bar`, `Battery drain`, `Tick marks`). |
| `clockSpeedMultiplier` | Clock speedup multiplier | `number` (`1`–`60`) | `1` | Fast-forward multiplier for testing and dev usage (UI options: `1`, `2`, `5`, `10`, `60`). |
| `formulaPredicates` | Custom predicates | `{ name: string, formula: string }[]` | `[]` | Named formula predicates for `"custom"` transition conditions. |
| `scriptsFolder` | Scripts folder | `string` | `""` | Vault folder containing `.js` script hook files. |
| `scriptHookBindings` | Script hooks | `{ name: string, scriptPath: string, scriptSource: string }[]` | `[]` | Named, trust-confirmed script hook bindings. |
| `cadenceRules` | — | `CadenceRule[]` | `[]` | Scheduled cadence rules (`{ id, routinePath, daysOfWeek?, startTime?, endTime?, tags? }`) evaluated by **Run scheduled cadence**. `daysOfWeek` uses ISO 1 (Monday)–7 (Sunday); `startTime`/`endTime` use `HH:mm` or `HH:mm:ss`. |

## Commands and UI entry points

### Commands

| Command ID | Command palette name | Action |
| :--- | :--- | :--- |
| `open-routine-panel` | Open routine panel | Opens or reveals the Routine Flow side panel in the right sidebar. |
| `open-routine-gallery` | Browse routine templates | Opens the routine template gallery modal. |
| `seed-example-routine` | Seed example routine | Creates starter example routine files in the vault. |
| `run-scheduled-cadence` | Run scheduled cadence | Matches `cadenceRules` against the current time and active note tags, then starts the matching routine. |

### Ribbon, Bases view, status bar, and file menu

- **Ribbon icon**: `timer` icon (**Open routine panel**) opens or reveals the side panel.
- **Bases view**: `routine-timer` (**Routine Timer**, `timer` icon) registers as a native Obsidian Bases view.
- **Status bar**: displays live timer status when a routine is active.
- **File menu**: right-clicking a Markdown note (where `is-routine` is not `true`) shows:
  - **Focus in active routine** when a routine is currently active (not stopped).
  - **Start routine for task** when no routine is active (opens the routine picker if any `is-routine: true` notes exist, or starts the default routine).

## Custom predicate formula syntax

Custom predicates use a non-Turing-complete expression language modeled on Obsidian Bases formulas.
Every formula must statically type-check to `boolean`.

### Grammar

```text
formula     = orExpr
orExpr      = andExpr { "or" andExpr }
andExpr     = notExpr { "and" notExpr }
notExpr     = "not" notExpr | comparison
comparison  = primary [ compareOp primary ]
compareOp   = "==" | "!=" | ">=" | "<=" | ">" | "<"
primary     = ifExpr | literal | reference | "(" orExpr ")"
ifExpr      = "if" "(" orExpr "," orExpr "," orExpr ")"
literal     = number | string | "true" | "false"
reference   = "fromPhaseId" | "visitCounts" "." identifier | "tracker" "." identifier
```

### References and type rules

- `fromPhaseId` (`string`): ID of the phase being transitioned from.
- `visitCounts.<phaseId>` (`number`): number of times `<phaseId>` has been visited in the current session (`0` if unvisited).
- `tracker.<property>` (`number | string`): frontmatter property on the graph's `trackerFilePath` note (`0` if missing).
- Prototype-chain property names (`constructor`, `__proto__`, `prototype`, `hasOwnProperty`, etc.) are rejected at parse time.
- **Type rules**:
  - `and`, `or`, `not`, and the condition of `if(cond, then, else)` require `boolean`.
  - Comparison operators (`==`, `!=`, `>=`, `<=`, `>`, `<`) cannot be applied to `boolean` values and require compatible operand types.
  - Both branches of `if(...)` must agree in type.

### Examples

```text
visitCounts.focus >= 4
fromPhaseId == "focus" and visitCounts.focus >= 2
tracker.stars >= 5 or visitCounts.long_break == 0
```

## Script hook API

Script hooks are `.js` files bound in **Settings → Routine Flow → Script hooks** and referenced from phase lifecycle handlers.

### Execution environment and `ScriptHookContext`

Each script body runs inside an `async` wrapper function receiving a single `context` argument (`ScriptHookContext`):

| Property | Type | Description |
| :--- | :--- | :--- |
| `phase` | `Phase` | The phase definition firing the hook. |
| `instance` | `PhaseInstance` | Current phase occurrence (`id`, `phaseId`, `phaseDisplayName`, `phaseKind`, `plannedDuration`, `actualDuration`, `startedAt`, `endedAt`, `endReason`, `itemsTouched`, `mutationsApplied`, `hookFailures`). |
| `session` | `Session` | Current session (`id`, `phaseGraphId`, `startedAt`, `endedAt`, `currentInstance`, `history`). |
| `activeFilePath` | `string \| null` | Vault path of the active queue item note, or `null`. |
| `params` | `Readonly<Record<string, unknown>>` | The handler's `params` object from the routine JSON. |
| `activeFileFrontmatter` | `Readonly<Record<string, unknown>> \| null` | Pre-resolved, read-only frontmatter of `activeFilePath`, or `null`. |

### Return contract (`FileMutation[]`)

A script must return an array of `FileMutation` objects (or resolve to one):

| `kind` | Required fields | Notes |
| :--- | :--- | :--- |
| `"frontmatter"` | `filePath: string`, `property: string`, `value: number \| string \| boolean` | Sets a frontmatter property on `filePath`. |
| `"append"` | `filePath: string`, `text: string` | Appends `text` to `filePath`. |
| `"queueReorder"` | `itemId: string`, `position: "front" \| "back"` | Moves a queue item to the front or back. |
| `"queueStatusChange"` | `itemId: string`, `status: "pending" \| "active" \| "done" \| "skipped" \| "deferred"` | Updates a queue item's cycle status. |

### Timeout and trust model

- **5-second soft timeout**: invocations that do not settle within `5000` ms fail with a timeout error (`Script hook invocation timed out after 5000ms`). Because scripts run in-process on the main thread, an already-started script is not preempted if it exceeds 5 seconds.
- **Folder restriction**: selectable `.js` files must live directly inside the configured `scriptsFolder` (subfolders are excluded).
- **Bind-time confirmation**: adding or reconfirming a binding opens a confirmation modal displaying the script source, then snapshots `scriptSource` into `scriptHookBindings`. Scripts run unsandboxed in-process; editing the `.js` file on disk later does not take effect or re-prompt until you reconfirm or re-add the binding in Settings.
