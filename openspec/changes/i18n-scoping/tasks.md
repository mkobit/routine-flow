## 1. Audit

- [x] 1.1 Grep `src/settings.ts`, `src/views/*.ts`, `src/main.ts` for `setName`/`setDesc`/`setButtonText`/`setPlaceholder`/`new Notice`/`createEl(..., { text })` call sites; confirm string count and affected files.
- [x] 1.2 Read `src/timer/format.ts` to confirm the `mm:ss` display is a numeral, not translated text.
- [x] 1.3 Confirm no existing i18n dependency in `package.json`.
- [x] 1.4 Confirm Obsidian's `moment` global and its locale source (`obsidian.d.ts`).

## 2. Decide

- [x] 2.1 Write `design.md` D1: duration-formatting standard (no surface needs it today; `Intl.DurationFormat` standard for future surfaces).
- [x] 2.2 Write `design.md` D2: message-catalog approach decision (hand-rolled flat-key catalog, rejected frameworks and why).
- [x] 2.3 Write `design.md` D3: target-language list and trigger (English only now; trigger = concrete request).
- [x] 2.4 Write `design.md` D4: string-extraction workflow (deferred alongside the catalog; eslint rule sketch for when it's built).
- [x] 2.5 Write `design.md` D5: sub-bead split decision (none filed now; one bead to file when D3's trigger fires).

## 3. Close out

- [x] 3.1 Close flow-gu1.63 — no sub-beads filed; D5 defers all implementation until the D3 trigger fires.
- [x] 3.2 Run `openspec validate i18n-scoping --strict`.
