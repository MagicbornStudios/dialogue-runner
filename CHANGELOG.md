# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and includes impact tiers for every change set.

## [Unreleased]
### Summary
- Pending changes will be documented here. Remember to classify impact and link to the touched modules.

### Impact
#### High
- _None yet_

#### Medium
- _None yet_

#### Low
- _None yet_

## [0.1.0] - 2024-06-07
### Summary
- Initial release of the dialogue runner components for orchestrating Yarn Spinner-style conversations.

### Impact
#### High
- Implemented `DialogueRunner` orchestration that wires runtime events to localization, commands, and variable storage for Dialogue Forge workflows. ([`src/runner.ts`](src/runner.ts))

#### Medium
- Added `DialogueTreeRuntime` to emit Yarn-compatible runtime events from native dialogue tree data without requiring the Yarn VM. ([`src/dialogue-tree-runtime.ts`](src/dialogue-tree-runtime.ts))
- Introduced command dispatching with built-in wait/stop/set handlers to extend runtime interactions. ([`src/command-dispatcher.ts`](src/command-dispatcher.ts))

#### Low
- Added map-based line provider utilities for localized text lookup. ([`src/line-provider.ts`](src/line-provider.ts))
- Included in-memory variable storage helpers for persisting dialogue state. ([`src/variable-storage.ts`](src/variable-storage.ts))
