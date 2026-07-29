## ADDED Requirements

### Requirement: A settings-tab scripts-folder setting makes vault `.js` files selectable by name
The plugin settings tab SHALL expose a setting for a single designated vault folder. Every `.js` file directly inside that folder SHALL be selectable by name when creating or editing a script-to-event binding.

#### Scenario: A .js file in the configured folder becomes selectable
- **WHEN** the scripts-folder setting is configured to a vault folder containing `log-focus-complete.js`
- **THEN** `log-focus-complete.js` appears as a selectable script when adding a binding

#### Scenario: A file outside the configured folder is not selectable
- **WHEN** a `.js` file exists elsewhere in the vault, outside the configured scripts folder
- **THEN** that file does not appear as a selectable script

### Requirement: A binding pairs a chosen name with one selected script
The settings tab SHALL let a user create a named binding associating a chosen name with exactly one selected script. Each binding SHALL be editable and removable after creation. A binding carries no event association of its own — which Phase lifecycle event(s) reference a binding's name is decided entirely by a routine's own `onEnter`/`onComplete`/`onSkip`/`onExit` `HookReference` fields (`{ name, params }`, e.g. `phase-graph.ts`'s existing `onComplete: { name: WRITE_BACK_HOOK_NAME, params: {} }`), the same mechanism the built-in write-back hook already uses — `HookRegistry.resolve` takes a name only, with no event parameter, so there is nothing for a binding-level event selection to control.

#### Scenario: A binding's name becomes resolvable from any routine's HookReference
- **WHEN** a user creates a binding named `log-focus-complete` for the script `log-focus-complete.js` and confirms it
- **THEN** a routine whose `Phase.onComplete` is `{ name: 'log-focus-complete', params: {} }` resolves that script via `HookRegistry` when the phase completes — no separate event configuration on the binding itself is needed

#### Scenario: Removing a binding stops that name resolving
- **WHEN** a user removes an existing binding
- **THEN** a `HookReference` naming that binding no longer resolves via the configured `HookRegistry`

### Requirement: A new binding requires a one-time confirmation before it becomes active
When a user creates a binding, the settings tab SHALL present the selected script's current source for review and require explicit confirmation before the binding is enabled. An unconfirmed binding SHALL NOT resolve via `HookRegistry`.

#### Scenario: An unconfirmed binding does not resolve
- **WHEN** a binding is created but the confirmation step has not been completed
- **THEN** `HookRegistry.resolve` for that binding's name returns `undefined`

#### Scenario: Confirming a binding enables it without further per-firing prompts
- **WHEN** a user completes the confirmation step for a new binding
- **THEN** the binding resolves via `HookRegistry` on every subsequent firing of its bound event(s), with no further confirmation prompt shown

### Requirement: Bindings are populated from settings, not discovered by scanning the vault
The registry backing script-hook bindings SHALL be built and kept current from the plugin's settings-stored binding list, independent of any Bases view being open, and SHALL NOT perform a vault-wide scan for a frontmatter marker or similar ambient discovery signal.

#### Scenario: A binding resolves with no Bases view open
- **WHEN** a confirmed binding exists and no Bases view of any kind is currently open
- **THEN** the binding's script still resolves via `HookRegistry` when its bound event fires
