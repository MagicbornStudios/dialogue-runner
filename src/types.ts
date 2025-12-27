/**
 * Core types for the dialogue runner
 */

/** Variable value types supported by Yarn Spinner */
export type VariableValue = string | number | boolean;

/**
 * Types of events emitted by the runtime
 */
export type RuntimeEventType = 
  | 'line'
  | 'options'
  | 'command'
  | 'node_start'
  | 'node_complete'
  | 'dialogue_complete'
  | 'prepare_for_lines';

/**
 * Events emitted by the dialogue runtime
 */
export type RuntimeEvent = 
  | LineEvent
  | OptionsEvent
  | CommandEvent
  | NodeStartEvent
  | NodeCompleteEvent
  | DialogueCompleteEvent
  | PrepareForLinesEvent;

export interface LineEvent {
  type: 'line';
  /** Line ID for looking up localized text */
  lineId: string;
  /** Substitution values for format strings */
  substitutions: string[];
}

export interface OptionInfo {
  /** Index of this option (for selection) */
  id: number;
  /** Line ID for the option text */
  lineId: string;
  /** Whether this option is enabled */
  enabled: boolean;
  /** Optional destination node name */
  destinationNode?: string;
}

export interface OptionsEvent {
  type: 'options';
  options: OptionInfo[];
}

export interface CommandEvent {
  type: 'command';
  /** Full command text */
  text: string;
}

export interface NodeStartEvent {
  type: 'node_start';
  /** Name of the node being started */
  nodeName: string;
}

export interface NodeCompleteEvent {
  type: 'node_complete';
  /** Name of the completed node */
  nodeName: string;
}

export interface DialogueCompleteEvent {
  type: 'dialogue_complete';
}

export interface PrepareForLinesEvent {
  type: 'prepare_for_lines';
  /** Line IDs that will be needed */
  lineIds: string[];
}

/**
 * Interface for dialogue runtime implementations
 * 
 * This abstracts over different VM implementations (WASM, TypeScript, etc.)
 */
export interface DialogueRuntime {
  /**
   * Load a compiled Yarn program
   */
  loadProgram(programBytes: ArrayBuffer): void;
  
  /**
   * Set the current node
   */
  setNode(nodeName: string): void;
  
  /**
   * Continue execution until the next event
   * @returns The next event, or null if dialogue is complete
   */
  continue(): RuntimeEvent | null;
  
  /**
   * Select an option from the current options
   */
  setSelectedOption(optionId: number): void;
  
  /**
   * Get a variable value
   */
  getVariable(name: string): VariableValue | undefined;
  
  /**
   * Set a variable value
   */
  setVariable(name: string, value: VariableValue): void;
  
  /**
   * Get all current variable names
   */
  getVariableNames(): string[];
  
  /**
   * Check if the runtime is waiting for option selection
   */
  isWaitingForOption(): boolean;
  
  /**
   * Check if dialogue is complete
   */
  isDialogueComplete(): boolean;
  
  /**
   * Reset the runtime state
   */
  reset(): void;
}

