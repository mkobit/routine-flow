---
sidebar_position: 5
---

# Bases integration

Routine Flow runs as a native Obsidian Bases view.
You can pair `routine-timer` views with Kanban boards, tables, and dashboards in the same `.base` file.

## Status property and done value

By default, Routine Flow reads and writes task completion status on the `routine-status` frontmatter key with the value `done`.
If your vault or Kanban board uses a different property (such as `status`) or a different completion value (such as `Done` or `Completed`), configure **Status property** and **Done status value**.

### Global settings vs per-view options

You can configure both fields in two places:

- **Global plugin settings**: Open **Settings → Routine Flow** and set **Status property** and **Done status value**. These defaults apply to every view in your vault.
- **Per-view `.base` options**: Open the Routine Timer view options (or edit the `.base` YAML) and set `statusProperty` and `doneStatusValue`. Per-view options override global settings for that view and for the active routine started from that view.

Precedence order for reads and writes:

1. Per-view `.base` option (`statusProperty` / `doneStatusValue`), if non-empty.
2. Global plugin setting (`statusProperty` / `doneStatusValue`), if non-empty.
3. Built-in default (`routine-status` / `done`).

### The `note.` prefix and YAML keys

Obsidian Bases property pickers store note frontmatter properties with a `note.` prefix (for example, `note.status`).
Routine Flow strips one leading `note.` prefix when reading or writing YAML frontmatter:

- `note.status` maps to the `status` key in note frontmatter.
- `status` also maps to the `status` key in note frontmatter.
- `file.*` and `formula.*` properties are read-only in Bases and fall back to `routine-status`.

### Queue actions and Bases filters

Queue actions update the configured status property directly:

- `markDone` writes the configured **Done status value** (default `done`) to the configured **Status property** (default `routine-status`).
- `deferDuration` writes `deferred` to the configured **Status property** and sets `routine-deferred-until` to the target timestamp.
- Deferred items stay hidden from the queue until the deferral timestamp arrives.

To hide completed tasks from your Routine Timer or Table view, add a Bases `filters:` block in your `.base` file:

```yaml
filters:
  and:
    - note.type == "work"
    - note.status != "Done"
```

## Multi-view `.base` files

A single `.base` file can hold a `routine-timer` view alongside `kanban` and `table` views.
All views in the file query the same vault notes and react immediately when frontmatter changes.

```yaml
type: base
properties:
  note.status:
    displayName: Status
  note.type:
    displayName: Type
  note.sessions:
    displayName: Sessions
views:
  - type: routine-timer
    name: Focus timer
    focusProperty: note.type
    focusValue: work
    statusProperty: note.status
    doneStatusValue: Done
    filters:
      and:
        - note.type == "work"
        - note.status != "Done"
  - type: kanban
    name: Task board
    groupBy:
      property: note.status
      direction: ASC
    filters:
      and:
        - note.type == "work"
  - type: table
    name: Active tasks
    filters:
      and:
        - note.type == "work"
        - note.status != "Done"
```

## Split-pane and right-sidebar workflows

You do not need to keep the `Routine Timer` view visible while you work on a Kanban board or edit notes.

- **Right sidebar (`Routine panel`)**: Open the **Routine panel** in the right sidebar (from the ribbon icon or the **Open routine panel** command). It stays visible while you switch the main pane to your Kanban view or task notes.
- **Live queue updates (`FallbackTaskSourceManager`)**: When you switch a `.base` leaf away from `Routine Timer` to `Kanban`, `FallbackTaskSourceManager` retains the active routine's task sources and refreshes them from Obsidian's metadata cache and rename events. Dragging a card to your done column on the Kanban board updates the running routine's queue automatically.
- **Starting a stopped routine**: A stopped routine must be started from a `Routine Timer` view (or via a scheduled cadence command). The right-sidebar **Routine panel** controls and displays an already-active or paused routine.

## Dashboard embeds

You can embed views from a `.base` file into any Markdown dashboard note with standard Obsidian embed syntax:

```markdown
## Timer

![[Kanban-Workflow.base#Focus timer]]

## Board

![[Kanban-Workflow.base#Task board]]
```

See `Kanban-Workflow.base` and `Kanban-Dashboard.md` in the example vault for a complete working example.
