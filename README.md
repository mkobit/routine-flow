# Routine Flow

A customizable routine timer for Obsidian, built as a native [Bases](https://help.obsidian.md/bases) view.
The underlying model is a generic phase graph, not a hardcoded 25/5 cycle — a "routine" note can describe any sequence of timed or rep-based phases (a workout, a standup, a study block), so the timer isn't limited to classic Pomodoro.

Full docs, including a getting-started walkthrough, live at the [documentation site](https://mkobit.github.io/routine-flow/).

![Routine Flow demo](docs/static/img/demo.webp)

## Features

- Adds a "Routine Timer" view type to Obsidian Bases, alongside the built-in Table/Cards views.
- Work and break queues are driven by the Base's own query — filter which notes count as "focus" or "break" tasks via a configured property/value pair.
- Optional custom routines: point a view at a note whose frontmatter includes `is-routine: true` to define an alternate phase graph, instead of the default focus/break cycle.
- Write-back on completion: increments a configurable frontmatter property (default `sessions`) on the active note when a phase finishes.

## Requirements

- Obsidian 1.15.1 or later.

## Installation

This plugin isn't yet listed in Obsidian's community plugin directory.
Until then, install manually or via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases).
2. Copy them into `<your-vault>/.obsidian/plugins/routine-flow/`.
3. Reload Obsidian and enable "Routine Flow" under Settings → Community plugins.

## Usage

See the [getting-started walkthrough](https://mkobit.github.io/routine-flow/getting-started) for the full install→configure→run path.

Quick start: add a Routine Timer view to a `.base` file, set the focus/break task property and value to match your notes' frontmatter, then click **Start**.

## Screenshots

The Routine Timer view, idle and running:

![Routine Timer view, idle](docs/static/img/screenshots/timer-idle.png)

![Routine Timer view, running](docs/static/img/screenshots/timer-running.png)

The [screenshot gallery](https://mkobit.github.io/routine-flow/screenshots) has the rest — side panel, status bar, settings tab, and the confirmation modals.

## Development

Run `bun run vault:dev` to launch a sandboxed Obsidian testing vault, or `bun run vault:install` to install a local build into a vault.
See [AGENTS.md](AGENTS.md) for the full command reference, architecture notes, and contribution conventions (strict TypeScript, functional-style domain code, bun-based tooling).

## Release policy

Stable plugin releases use unprefixed UTC Calendar Versioning in the form `YYYY.M.D`, for example `2026.11.5`.
Unpadded month and day values fit the three-number version format Obsidian requires.
Sort by the numeric fields to put releases in date order.
Publish one stable release per UTC day.
The Obsidian release workflow accepts stable versions only.

1. Squash merge a PR with a `Release-As: 2026.11.5` trailer in the resulting commit message, using the planned UTC release date.
2. Review the release PR from Release Please and check that the version in `manifest.json` matches the planned release tag.
3. If the minimum Obsidian version changes, update `versions.json` in the release PR.
4. Merge the release PR after CI passes.
   The workflow builds the plugin, attaches its assets to a draft, and then publishes the release.

If the asset upload fails, run the Release workflow with the existing draft's tag.
Existing releases keep their current tags.

[Obsidian release requirements](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin) · [Release Please version overrides](https://github.com/googleapis/release-please#how-do-i-change-the-version-number)

## License

[MIT](LICENSE)
