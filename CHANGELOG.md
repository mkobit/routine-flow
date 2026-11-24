# Changelog

All notable changes to Routine Flow are documented in this file.

## [Unreleased]

Preparation for the `0.1.0` initial public release.
Release-please manages versioned release headings above this section when a release PR merges.
Note: `release-please` updates `manifest.json` `version`, and `bun run release:sync-versions` keeps `versions.json` aligned with `manifest.json` `minAppVersion`.

### Features

- **Bases integration**: Added a native **Routine Timer** view type for `.base` files with live focus and break queues, inline view options, per-phase task source filtering, and extra property badges.
- **Timer engine and phase graphs**: Added a default 25-minute focus / 5-minute break cycle (with a 15-minute long break every four focus phases), custom `is-routine: true` JSON phase graphs, stage progress, and guidance checklists.
- **Workspace surfaces**: Added a compact timer-bar layout, sidebar panel runner, status bar indicator, file-menu start action, and a built-in routine template gallery with one-click vault import.
- **Completion and notifications**: Added frontmatter write-back confirmation (with per-phase and global opt-out, batch resolution, and reward bank accumulators), queue item actions (`markDone`, `queueCycle`, `futureDate`, Leitner review grading), early phase termination on queue exhaustion, in-app notices, desktop notifications, and audio chime hooks.
