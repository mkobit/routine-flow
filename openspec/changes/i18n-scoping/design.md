## Context

flow-gu1.63 bundles two i18n-adjacent concerns Mike raised 2026-07-24: locale-aware duration/date formatting, and UI string translation infrastructure. Both were explicitly unscoped — no library chosen, no target-language list, no extraction workflow — and the bead's acceptance criteria calls for a scoping decision, not implementation.

Audit findings grounding this design:
- `src/timer/format.ts:11-19` (`formatPhaseHeader`) renders remaining time as an `mm:ss` numeral (`"Focus: 24:59 (running)"`), not translated words. This is the only place a `Temporal.Duration` becomes display text today.
- `src/settings.ts` has zero duration-as-words strings — its two `Setting` descriptions ("Frontmatter property incremented when a focus phase completes.", "Name and formula...") never render a duration value.
- No surface anywhere in `src/` renders a duration or date as words today (grepped `src/settings.ts`, `src/views/*.ts`, `src/main.ts`).
- The plugin's total user-facing string surface is small: `src/settings.ts`, `src/main.ts`, `src/views/{timer-view,side-panel-view,write-back-modal,routine-replace-modal,status-bar}.ts` (7 files, 848 lines total) contain roughly 53 hardcoded strings, across not just `setName`/`setDesc`/`setButtonText`/`setPlaceholder`/`new Notice`/`createEl(..., { text })`/`setText` but also `setTitle` (modal titles), `setTooltip`, `getDisplayText()`, `addRibbonIcon`/`addCommand` name/tooltip text, and `registerBasesView`'s `name`/`options().displayName` fields — the full set of Obsidian-API surfaces that render plugin-authored text, not just the `Setting`-builder subset.
- No i18n library is a dependency today (`dependencies`: `obsidian`, `remeda`, `temporal-polyfill`, `zod`).
- Obsidian exposes a public, purpose-built `getLanguage()` function (`obsidian.d.ts:3365`, `@since 1.8.7`) that returns the ISO code for the currently configured app language (Settings → General → Language), defaulting to `'en'`, and documents the canonical list of existing languages via the `obsidian-translations` repo. The plugin's `minAppVersion` (`manifest.json`: `1.10.0`) postdates 1.8.7, so `getLanguage()` is safe to depend on. This is the correct locale source — a purpose-built API for exactly this question — not the `moment` global's locale (`obsidian.d.ts:4561`), which is a side channel not documented for this use.
- No string in the current audit needs pluralization (`queueTitle` is a binary "Work queue"/"Break queue" choice, not a count).

## Goals / Non-Goals

**Goals:**
- Decide whether any surface needs `Intl.DurationFormat`/`Temporal.Duration`-based duration-as-words text today, and state the standard future surfaces (flow-gu1.56, flow-gu1.57) must follow.
- Decide whether to build UI string translation infrastructure now, and if so, which specific approach, grounded in the plugin's actual ~53-string surface and esbuild single-bundle build.
- State an initial target-language list and the trigger for adding more.
- State a string-extraction/enforcement workflow so a catalog (if built) doesn't silently get bypassed by new hardcoded strings.

**Non-Goals:**
- Translating any string into a non-English language now — no demand signal exists yet.
- Implementing the message-catalog module or `t()` helper in this change — this change is documentation only (see proposal.md's Impact).
- Designing flow-gu1.56/flow-gu1.57's notification copy or UX — this only states the duration-formatting standard those beads must follow when built.
- RTL/bidirectional layout — no target language in D3's initial list needs it; revisit if an RTL locale (e.g. Arabic, Hebrew) is ever requested.

## Decisions

### D1: `Intl.DurationFormat`/`Temporal.Duration` — no surface needs it today; adopt as the standard for future duration-as-words text

No shipped surface renders a duration or date as words. `src/timer/format.ts`'s `mm:ss` display is a numeral, not translated text, and doesn't need `Intl.DurationFormat` — converting it would be a regression (a numeral countdown reads faster than "24 minutes, 59 seconds" and Obsidian's own timers/statusbar conventions use numerals).

Standard for when a future surface needs duration/date as words (flow-gu1.56/flow-gu1.57 notification copy, or future settings descriptions that mention a specific configured duration): use `Intl.DurationFormat` (Baseline since March 2025) fed by a `Temporal.Duration` value, with locale sourced per D2's `getLanguage()` read — not hand-built strings like `` `${mins} minutes` ``, which breaks pluralization and word order in other locales. This is a convention to apply at that bead's implementation time, not code to write now (no call site exists yet). Because Baseline status can lag behind a given Electron build, the implementing bead should reverify `Intl.DurationFormat` is actually supported by the Chromium version Obsidian bundles at the plugin's then-current `minAppVersion`, rather than trusting this doc's March-2025 Baseline date indefinitely.

**Alternatives considered:** Hand-formatting duration strings with template literals — rejected, breaks immediately for any non-English locale and for plurals (`1 minute` vs `2 minutes`) even in English. Pulling in a formatting library (e.g. `date-fns`) — rejected, `Intl.DurationFormat` is a native, zero-dependency Baseline API that does exactly this.

### D2: UI string translation infrastructure — build a minimal hand-rolled flat-key catalog, not a full i18n framework

Given ~53 strings across 7 files, a vanilla-TypeScript codebase with no view framework (no React/Vue), and an esbuild single-file bundle, the right-sized approach is a hand-rolled catalog: one module (e.g. `src/i18n/strings.ts`) exporting a per-locale flat-key dictionary (`{ 'settings.writeBackProperty.name': 'Write-back property', ... }`) and a `t(key)` lookup helper that resolves the active locale (falling back to `en`), with the active locale read from Obsidian's `getLanguage()` per the Context findings — not `moment.locale()` or `navigator.language`, since a user can set Obsidian's display language independently of their OS locale and `getLanguage()` is Obsidian's own documented API for this exact question.

**Rejected alternatives:**
- `i18next` / `@formatjs` (`react-intl`) / `lingui` — the core libraries themselves are not strictly framework-bound (`i18next` core is usable standalone outside React/Vue), so framework-coupling alone isn't disqualifying. The deciding factor is bundle weight and setup cost relative to scale: each adds a runtime ICU MessageFormat parser and, for `i18next`/`lingui`, a plugin/backend/extraction-tooling system sized for hundreds-to-thousands of strings — meaningfully more code and configuration than ~53 strings justify, and their extraction CLIs are tuned for JSX/template call-site conventions this codebase doesn't use. Revisit if the string count grows an order of magnitude (500+) or ICU features (plural/select/gender) are actually needed — neither is true today.
- No catalog at all (status quo, hardcoded strings) — rejected only if translation is ever pursued; see D3 on why that's not being triggered yet.

Pluralization/number formatting, if a future string needs it, uses native `Intl.PluralRules`/`Intl.NumberFormat` directly in that string's lookup function rather than embedding ICU plural syntax in the catalog — consistent with "no dependency until a real need exists."

### D3: Target-language list — English only, for now; no infrastructure built yet either

No non-English locale has a stated demand signal (no user request, no market requirement raised). Building the D2 catalog module and translating strings today would be speculative work with no consumer. Initial target-language list: **English only.**

Trigger for adding a locale: a concrete request (a user, or Mike, naming a specific language) — at that point, file a bead to (a) build the D2 catalog module and migrate the ~53 audited strings into it, and (b) produce the first non-English translation. Until that trigger fires, no sub-bead is filed for D2/D3's implementation (see D5).

### D4: String-extraction workflow — deferred alongside the catalog itself

Since D3 defers building the catalog until a locale is actually requested, there's no catalog yet to bypass, so no enforcement mechanism (lint rule, extraction script) is being built now either. Once the D3 trigger fires and the catalog module exists, the follow-up bead should add an eslint rule (this project already runs a custom FP-focused eslint config, per AGENTS.md) flagging string literals passed to any of the Context-audited API surfaces — `setName`/`setDesc`/`setButtonText`/`setPlaceholder`/`setTitle`/`setTooltip`/`setText`/`new Notice`/`createEl(..., { text })`/`getDisplayText()`/`addRibbonIcon`/`addCommand`'s `name`/`registerBasesView`'s `name` and `options().displayName` — outside the catalog module. The full API-surface list matters here: a rule that only checks the `Setting`-builder methods would miss the view-registration and command/ribbon call sites the Context audit found. Cheaper to write once there's an actual catalog to check against than to speculatively build now.

### D5: Sub-bead split — none filed now

All of D1–D4 resolve to "state the standard, defer the build until triggered" — no implementation work is being scoped for immediate execution. No sub-beads are filed under flow-gu1.63. When D3's trigger fires (a specific language is requested), file one bead covering: the D2 catalog module + migration of existing strings, the D4 eslint rule, and the first translation.

## Risks / Trade-offs

- **[Risk]** Deferring the catalog build means flow-gu1.56/flow-gu1.57 (and any other future string-adding bead) will keep hardcoding English strings in the interim → **Mitigation:** acceptable — English-only is the explicit D3 decision, and D2's flat-key design means retrofitting existing strings into the catalog later is a mechanical migration (wrap each literal in `t('key')`, add the key to the `en` dictionary), not a rearchitecture.
- **[Risk]** A hand-rolled catalog has no built-in ICU plural/select support, so if a plural-needing string appears before this is revisited, it'll need ad hoc `Intl.PluralRules` handling → **Mitigation:** D2 already states this fallback; revisit the "full framework" rejection if plural/select needs become common rather than one-off.
- **[Risk]** `getLanguage()` reflects Obsidian's configured display language, which may not match a language the plugin actually has strings for once translation starts → **Mitigation:** D2's `t()` helper falls back to `en` for any locale without a dictionary entry, so missing locales degrade to English rather than erroring or showing raw keys.

## Migration Plan

Not applicable — this change ships no code. When D3's trigger fires, the follow-up bead's migration is: introduce the catalog module with an `en` dictionary seeded from the ~53 currently-hardcoded strings, replace each call site's literal with `t('key')`, add the D4 eslint rule, then add the first non-English locale's dictionary.

## Open Questions

None — D1–D5 each state a decision (including "defer, and state the trigger" as the decision for D3–D5) rather than leaving the question open.
