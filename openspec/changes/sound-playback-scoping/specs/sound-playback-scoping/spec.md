## Purpose

Defines the technical architecture, audio playback abstractions, sound sourcing, settings hierarchy, and release timeline for per-phase sound/alert playback.

## ADDED Requirements

### Requirement: Sound Playback Architecture Scoping

The system SHALL define audio playback abstractions via an `AudioPort` interface and handle audio failures gracefully without interrupting phase transitions.

#### Scenario: Audio failure handling
- **WHEN** audio playback fails due to browser autoplay policy or missing audio files
- **THEN** the error is caught and logged, and phase transitions in `EngineStore` proceed normally

### Requirement: Sound Sourcing and Settings Controls

The system SHALL support built-in preset sounds and vault-relative custom audio paths controlled by global master settings and per-phase routine authoring.

#### Scenario: Sound preset resolution
- **WHEN** a phase specifies a sound preset or default key
- **THEN** the audio dispatcher resolves the preset sound key or vault file path and applies master volume multipliers

### Requirement: Release Timeline & Deferred Implementation

The sound playback implementation SHALL be deferred from `0.1.0` to `0.2.0+`, keeping `NotificationPolicySchema.sound` cleanly defined in domain models.

#### Scenario: Release schedule decision
- **WHEN** evaluating sound playback for release inclusion
- **THEN** implementation is scheduled for `0.2.0+` to maintain `0.1.0` release scope stability
