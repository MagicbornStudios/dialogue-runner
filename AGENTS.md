# Agent Guidelines for `dialogue-runner`

## Repository goals
- Provide a reliable TypeScript library for orchestrating Yarn Spinner dialogues in games and interactive applications.
- Keep the API surface minimal, predictable, and well-documented for both ESM and CJS consumers.
- Preserve fast builds and straightforward testing to make iteration easy for contributors.

## Coding standards
- Write code in TypeScript using modern syntax (ES2020+), keeping modules tree-shakable and side-effect free when possible.
- Follow a readable, consistent style: prefer named exports, avoid default exports unless the module exposes a single primary concept, and keep functions small and pure.
- Mirror existing patterns in `src/`: keep types close to their usage, avoid broad `any`, and document non-obvious control flow with short comments.
- Error handling: surface actionable errors with clear messages; avoid swallowing errors or wrapping imports in try/catch.
- Testing: add or update Vitest coverage for new behavior (`npm test`). Keep tests fast and isolated. Favor unit tests over integration unless needed to verify Yarn flow.

## Documentation conventions
- Update `README.md` and `CHANGELOG.md` when behavior, APIs, or developer workflows change. Include brief usage examples for new public APIs and summarize changes in the changelog.
- Keep inline JSDoc concise: describe arguments, return types, side effects, and error cases when they are not obvious from the signature.
- Prefer markdown tables or bullet lists for option/flag descriptions.

## Roadmap (short-term)
- Expand dialogue execution states (pausing, resuming, branching visibility).
- Add adapters for common game engines (e.g., Unity and Godot bindings).
- Improve observability hooks for debugging Yarn scripts.

## Component ownership and placement
- Core execution and state machines live in `src/` (e.g., parsers, runners, context/state utilities).
- Public-facing types and entrypoints belong near `src/index.ts` and should re-export stable APIs.
- Testing utilities stay under `src/**/__tests__` alongside the code they verify.
- New documentation belongs in the repo root (`README.md`, `CHANGELOG.md`) or near the code it describes (local `README` files are acceptable when scoped).

## Workflow expectations
- Run `npm test` before submitting changes and ensure builds remain clean (`npm run build` when altering build output).
- Maintain concise commit messages and include relevant documentation updates with each functional change.
