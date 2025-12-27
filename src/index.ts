/**
 * @magicborn/dialogue-runner
 * 
 * Orchestration engine for running Yarn Spinner dialogues.
 * Provides a runtime-agnostic runner that works with any VM implementation.
 */

export { DialogueRunner, type DialogueRunnerOptions } from './runner';
export { type DialogueRuntime, type RuntimeEvent, type RuntimeEventType } from './types';
export { CommandDispatcher, type CommandHandler, type CommandContext } from './command-dispatcher';
export { VariableStorage, InMemoryVariableStorage, type VariableValue } from './variable-storage';
export { LineProvider, type LineProviderOptions, type LocalizedLine } from './line-provider';

