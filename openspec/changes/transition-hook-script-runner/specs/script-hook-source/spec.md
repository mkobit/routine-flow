## ADDED Requirements

### Requirement: A settings-tab scripts-folder setting makes vault `.js` files selectable by name
The plugin settings tab SHALL expose a setting for a single designated vault folder. Every `.js` file directly inside that folder SHALL be selectable by name when creating or editing a script-to-event binding.

#### Scenario: A .js file in the configured folder becomes selectable
- **WHEN** the scripts-folder setting is configured to a vault folder containing `log-focus-complete.js`
- **THEN** `log-focus-complete.js` appears as a selectable script when adding a binding

#### Scenario: A file outside the configured folder is not selectable
- **WHEN** a `.js` file exists elsewhere in the vault, outside the configured scripts folder
- **THEN** that file does not appear as a selectable script

### Requirement: A binding pairs one script with one or more Phase lifecycle events
The settings tab SHALL let a user create a named binding associating exactly one selected script with one or more of `onEnter`, `onComplete`, `onSkip`, `onExit`. Each binding SHALL be editable and removable after creation.

#### Scenario: A binding can target multiple events
- **WHEN** a user creates a binding for `log-focus-complete.js` and selects both `onComplete` and `onSkip`
- **THEN** the binding is saved covering both events for that script

#### Scenario: Removing a binding stops that script resolving for its events
- **WHEN** a user removes an existing binding
- **THEN** a `HookReference` naming that binding's script no longer resolves via the configured `HookRegistry`

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
