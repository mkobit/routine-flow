# Audio chime and desktop notification routine

The audio-chime-notifications routine demonstrates Web Audio synthesizer chimes, desktop notifications, and interval warning alerts triggered across phase lifecycle transitions.

## Overview

This example showcases:
- Synthesizing harmonic chord chimes via the standard Web Audio API without relying on external media files.
- Firing native OS desktop notifications on phase completion and long-break entry.
- Delivering in-app Obsidian notices on phase starts and interval transitions.
- Hooking custom scripts into `onEnter`, `onComplete`, and `onSkip` lifecycle triggers.

## Available sample scripts

The `scripts/` subfolder includes reference implementations of routine hooks:
- `web-audio-chime.js`: Synthesizes musical chimes using `AudioContext`, `OscillatorNode`, and `GainNode`.
- `interval-warning-hook.js`: Synthesizes distinct alert tones for interval warnings and phase skip events.
- `desktop-notification-hook.js`: Triggers system desktop notifications with fallback in-app notices.
