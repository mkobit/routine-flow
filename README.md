# Routine Flow

A customizable routine timer for Obsidian, built as a native [Bases](https://help.obsidian.md/bases) view.
The underlying model is a generic phase graph, not a hardcoded 25/5 cycle — a "routine" note can describe any sequence of timed or rep-based phases (a workout, a standup, a study block), so the timer isn't limited to classic Pomodoro.

## Features

- Adds a "Routine Timer" view type to Obsidian Bases, alongside the built-in Table/Cards views.
- Work and break queues are driven by the Base's own query — filter which notes count as "focus" or "break" tasks via a configured property/value pair.
- Optional custom routines: point a view at a note whose frontmatter includes `pomodoro-routine: true` to define an alternate phase graph, instead of the default focus/break cycle.
- Write-back on completion: increments a configurable frontmatter property (default `pomodoros`) on the active note when a focus phase finishes.

## Requirements

- Obsidian 1.12.7 or later.
- Desktop only.

## Installation

This plugin isn't yet listed in Obsidian's community plugin directory.
Until then, install manually or via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases).
2. Copy them into `<your-vault>/.obsidian/plugins/routine-flow/`.
3. Reload Obsidian and enable "Routine Flow" under Settings → Community plugins.

## Usage

1. Open or create a `.base` file.
2. Add a new view and select the "Routine Timer" view type.
3. In the view's options, set the focus/break task property and value to match your notes' frontmatter, and optionally point "Routine file" at a custom routine note.
4. Click **Start** to begin the first phase; **Pause**/**Reset** control the running session, and clicking a queued task starts a session against that note.

## Development

See [AGENTS.md](AGENTS.md) for the full command reference, architecture notes, and contribution conventions (strict TypeScript, functional-style domain code, bun-based tooling).

## License

[MIT](LICENSE)
