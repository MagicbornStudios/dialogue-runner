/**
 * Main dialogue runner orchestration
 */

import type { DialogueRuntime, RuntimeEvent, LineEvent, OptionsEvent, CommandEvent } from './types';
import { LineProvider, MapLineProvider, type LocalizedLine } from './line-provider';
import { CommandDispatcher, createDefaultDispatcher, type CommandContext } from './command-dispatcher';
import { VariableStorage, InMemoryVariableStorage, type VariableValue } from './variable-storage';

export interface DialogueRunnerOptions {
  /** The runtime implementation (WASM, TypeScript, etc.) */
  runtime: DialogueRuntime;
  /** Line provider for resolving localized text */
  lineProvider?: LineProvider;
  /** Command dispatcher for handling commands */
  commandDispatcher?: CommandDispatcher;
  /** Variable storage for persistent variables */
  variableStorage?: VariableStorage;
}

export interface RunnerState {
  /** Current node name */
  currentNode: string | null;
  /** Is dialogue running */
  isRunning: boolean;
  /** Is waiting for option selection */
  isWaitingForOption: boolean;
  /** Is dialogue complete */
  isComplete: boolean;
  /** Last event */
  lastEvent: RuntimeEvent | null;
}

export type RunnerEventType = 
  | 'line'
  | 'options'
  | 'command'
  | 'nodeStart'
  | 'nodeComplete'
  | 'dialogueComplete'
  | 'error';

export interface RunnerLineEvent {
  type: 'line';
  lineId: string;
  text: string;
  substitutions: string[];
  metadata?: Record<string, string>;
}

export interface RunnerOptionsEvent {
  type: 'options';
  options: Array<{
    id: number;
    lineId: string;
    text: string;
    enabled: boolean;
    destinationNode?: string;
  }>;
}

export interface RunnerCommandEvent {
  type: 'command';
  command: string;
  handled: boolean;
}

export interface RunnerNodeEvent {
  type: 'nodeStart' | 'nodeComplete';
  nodeName: string;
}

export interface RunnerDialogueCompleteEvent {
  type: 'dialogueComplete';
}

export interface RunnerErrorEvent {
  type: 'error';
  error: Error;
}

export type RunnerEvent = 
  | RunnerLineEvent
  | RunnerOptionsEvent
  | RunnerCommandEvent
  | RunnerNodeEvent
  | RunnerDialogueCompleteEvent
  | RunnerErrorEvent;

export type RunnerEventHandler = (event: RunnerEvent) => void | Promise<void>;

/**
 * Main dialogue runner
 * 
 * Orchestrates the runtime, line provider, command dispatcher, and variable storage.
 */
export class DialogueRunner {
  private runtime: DialogueRuntime;
  private lineProvider: LineProvider;
  private commandDispatcher: CommandDispatcher;
  private variableStorage: VariableStorage;
  private eventHandlers = new Map<RunnerEventType, Set<RunnerEventHandler>>();
  private state: RunnerState = {
    currentNode: null,
    isRunning: false,
    isWaitingForOption: false,
    isComplete: false,
    lastEvent: null,
  };
  private stopped = false;
  
  constructor(options: DialogueRunnerOptions) {
    this.runtime = options.runtime;
    this.lineProvider = options.lineProvider || new MapLineProvider({});
    this.commandDispatcher = options.commandDispatcher || createDefaultDispatcher();
    this.variableStorage = options.variableStorage || new InMemoryVariableStorage();
  }
  
  /**
   * Start dialogue from a node
   */
  async start(nodeName: string): Promise<void> {
    this.stopped = false;
    this.state = {
      currentNode: nodeName,
      isRunning: true,
      isWaitingForOption: false,
      isComplete: false,
      lastEvent: null,
    };
    
    // Sync variables from storage to runtime
    this.syncVariablesToRuntime();
    
    this.runtime.setNode(nodeName);
    await this.runUntilPause();
  }
  
  /**
   * Continue dialogue after a pause (e.g., after displaying a line)
   */
  async continue(): Promise<void> {
    if (this.state.isWaitingForOption) {
      throw new Error('Cannot continue while waiting for option selection');
    }
    
    if (this.state.isComplete) {
      throw new Error('Dialogue is already complete');
    }
    
    await this.runUntilPause();
  }
  
  /**
   * Select an option
   */
  async selectOption(optionId: number): Promise<void> {
    if (!this.state.isWaitingForOption) {
      throw new Error('Not waiting for option selection');
    }
    
    this.runtime.setSelectedOption(optionId);
    this.state.isWaitingForOption = false;
    await this.runUntilPause();
  }
  
  /**
   * Stop the dialogue
   */
  stop(): void {
    this.stopped = true;
    this.state.isRunning = false;
    this.state.isComplete = true;
  }
  
  /**
   * Get current state
   */
  getState(): Readonly<RunnerState> {
    return { ...this.state };
  }
  
  /**
   * Subscribe to events
   */
  on(eventType: RunnerEventType, handler: RunnerEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }
  
  /**
   * Subscribe to all events
   */
  onAny(handler: RunnerEventHandler): () => void {
    const unsubscribers = [
      this.on('line', handler),
      this.on('options', handler),
      this.on('command', handler),
      this.on('nodeStart', handler),
      this.on('nodeComplete', handler),
      this.on('dialogueComplete', handler),
      this.on('error', handler),
    ];
    
    return () => unsubscribers.forEach(u => u());
  }
  
  /**
   * Get a variable value
   */
  getVariable(name: string): VariableValue | undefined {
    return this.variableStorage.get(name) ?? this.runtime.getVariable(name);
  }
  
  /**
   * Set a variable value
   */
  setVariable(name: string, value: VariableValue): void {
    this.variableStorage.set(name, value);
    this.runtime.setVariable(name, value);
  }
  
  /**
   * Reset the runner
   */
  reset(): void {
    this.stopped = false;
    this.runtime.reset();
    this.state = {
      currentNode: null,
      isRunning: false,
      isWaitingForOption: false,
      isComplete: false,
      lastEvent: null,
    };
  }
  
  // Private methods
  
  private async runUntilPause(): Promise<void> {
    while (!this.stopped && !this.runtime.isDialogueComplete()) {
      const event = this.runtime.continue();
      if (!event) break;
      
      this.state.lastEvent = event;
      
      const shouldPause = await this.handleRuntimeEvent(event);
      if (shouldPause) break;
    }
    
    if (this.runtime.isDialogueComplete()) {
      this.state.isComplete = true;
      this.state.isRunning = false;
      await this.emit({ type: 'dialogueComplete' });
    }
  }
  
  private async handleRuntimeEvent(event: RuntimeEvent): Promise<boolean> {
    switch (event.type) {
      case 'line':
        return await this.handleLine(event);
      case 'options':
        return await this.handleOptions(event);
      case 'command':
        return await this.handleCommand(event);
      case 'node_start':
        await this.emit({ type: 'nodeStart', nodeName: event.nodeName });
        this.state.currentNode = event.nodeName;
        return false;
      case 'node_complete':
        await this.emit({ type: 'nodeComplete', nodeName: event.nodeName });
        return false;
      case 'dialogue_complete':
        return true;
      case 'prepare_for_lines':
        await this.lineProvider.prepareLines(event.lineIds);
        return false;
      default:
        return false;
    }
  }
  
  private async handleLine(event: LineEvent): Promise<boolean> {
    const localizedLine = this.lineProvider.getLine(event.lineId, event.substitutions);
    
    await this.emit({
      type: 'line',
      lineId: event.lineId,
      text: localizedLine?.text || `[Missing: ${event.lineId}]`,
      substitutions: event.substitutions,
      metadata: localizedLine?.metadata,
    });
    
    return true; // Pause after line
  }
  
  private async handleOptions(event: OptionsEvent): Promise<boolean> {
    this.state.isWaitingForOption = true;
    
    const options = event.options.map(opt => {
      const localizedLine = this.lineProvider.getLine(opt.lineId);
      return {
        id: opt.id,
        lineId: opt.lineId,
        text: localizedLine?.text || `[Missing: ${opt.lineId}]`,
        enabled: opt.enabled,
        destinationNode: opt.destinationNode,
      };
    });
    
    await this.emit({ type: 'options', options });
    
    return true; // Pause for option selection
  }
  
  private async handleCommand(event: CommandEvent): Promise<boolean> {
    const context: CommandContext = {
      getVariable: (name) => this.getVariable(name),
      setVariable: (name, value) => this.setVariable(name, value),
      stop: () => this.stop(),
      continue: () => {}, // No-op, we continue automatically after command
    };
    
    const handled = await this.commandDispatcher.dispatch(event.text, context);
    
    await this.emit({
      type: 'command',
      command: event.text,
      handled,
    });
    
    // Don't pause for commands by default
    return false;
  }
  
  private async emit(event: RunnerEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        await handler(event);
      }
    }
  }
  
  private syncVariablesToRuntime(): void {
    const vars = this.variableStorage.getAll();
    for (const [name, value] of vars) {
      this.runtime.setVariable(name, value);
    }
  }
}

