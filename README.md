# Dialogue Runner

`@magicborn/dialogue-runner` is a TypeScript orchestration engine for running Yarn Spinner dialogues. It provides a runtime-agnostic wrapper so you can plug in your preferred Yarn Spinner VM (TypeScript or WASM) and connect it to UI, command handling, and save data.

## Yarn Spinner integration goals
- Work with any Yarn Spinner runtime that implements the `DialogueRuntime` interface (e.g., TypeScript or WASM builds).
- Keep presentation concerns separate by emitting events instead of enforcing a UI framework.
- Provide helpers for localized line lookup, command dispatching, and variable storage so game code can stay focused on presentation and persistence.

## Installation
```bash
npm install
```

## Build and test
```bash
npm run build
npm run test
```

## Entry points
- `src/index.ts` re-exports the main primitives so downstream apps can import from the package root.
- `DialogueRunner` orchestrates the runtime, line provider, command dispatcher, and variable storage, emitting high-level events as dialogue progresses.

## Component layout
- **Dialogue runner**: Coordinates progression through a Yarn script using the provided runtime, emitting events for lines, options, commands, and lifecycle transitions.
- **Command dispatcher**: Parses Yarn commands and routes them to handlers, exposing helpers to access variables or control flow during command execution.
- **Line provider**: Resolves localized line text and substitutions based on line IDs emitted by the runtime.
- **Variable storage**: Persists values between runs and keeps runtime variables in sync before and after execution.

### Interaction flow
1. `DialogueRunner` sets the active node on the runtime and syncs variables from storage.
2. The runtime emits events for lines, options, and commands; the runner resolves lines through the line provider and dispatches commands through the command dispatcher.
3. When commands or options update variables, the runner writes back to the variable storage, keeping state consistent across sessions.

## Quick start
```ts
import {
  DialogueRunner,
  MapLineProvider,
  createDefaultDispatcher,
  InMemoryVariableStorage,
  type DialogueRuntime,
} from '@magicborn/dialogue-runner';

// Implement or import a Yarn Spinner runtime that matches DialogueRuntime
const runtime: DialogueRuntime = createYourRuntimeSomehow();

const lineProvider = new MapLineProvider({
  LINE_1: { text: 'Hello, <player>!', substitutions: ['Alex'] },
});

const runner = new DialogueRunner({
  runtime,
  lineProvider,
  commandDispatcher: createDefaultDispatcher(),
  variableStorage: new InMemoryVariableStorage(),
});

runner.on('line', event => {
  console.log(`Line: ${event.text}`);
});

await runner.start('Start');
```

## Contributing
- Follow TypeScript best practices; prefer explicit types for public APIs.
- Write tests with Vitest for new behavior and keep existing suites green.
- Run `npm run build` before submitting changes to ensure ESM and CJS outputs compile.
- Use clear naming and keep orchestration logic in the runner while delegating formatting and IO to callers.
