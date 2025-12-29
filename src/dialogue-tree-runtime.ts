import { DialogueRuntime, OptionInfo, RuntimeEvent, VariableValue } from './types';

export const NODE_TYPE = {
  NPC: 'NPC',
  PLAYER: 'PLAYER',
} as const;

export type NodeType = (typeof NODE_TYPE)[keyof typeof NODE_TYPE];

export interface DialogueTree {
  id: string;
  title?: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

interface BaseNode {
  id: string;
  type: NodeType;
  metadata?: Record<string, string>;
}

export interface NpcNode extends BaseNode {
  type: typeof NODE_TYPE.NPC;
  speaker?: string;
  content: string;
  lineId?: string;
  substitutions?: string[];
  nextNodeId?: string;
}

export interface PlayerChoice {
  id: string;
  text: string;
  nextNodeId?: string;
  lineId?: string;
  enabled?: boolean;
}

export interface PlayerNode extends BaseNode {
  type: typeof NODE_TYPE.PLAYER;
  choices: PlayerChoice[];
}

export type DialogueNode = NpcNode | PlayerNode;

interface OptionsCache {
  choices: PlayerChoice[];
  nodeId: string;
}

/**
 * Minimal runtime implementation for Dialogue Forge's native DialogueTree structure.
 *
 * Emits the same RuntimeEvents expected by DialogueRunner so the presentation layer
 * can render lines and options without a Yarn VM.
 */
export class DialogueTreeRuntime implements DialogueRuntime {
  private tree: DialogueTree;
  private currentNodeId: string | null;
  private isComplete = false;
  private waitingForOption = false;
  private pendingEvents: RuntimeEvent[] = [];
  private pendingNextNodeId: string | null = null;
  private startedNodes = new Set<string>();
  private variables = new Map<string, VariableValue>();
  private optionCache: OptionsCache | null = null;

  constructor(tree: DialogueTree) {
    this.tree = tree;
    this.currentNodeId = tree.startNodeId;
  }

  loadProgram(programBytes: ArrayBuffer): void {
    const text = new TextDecoder().decode(programBytes);
    const parsed = JSON.parse(text) as DialogueTree;
    this.tree = parsed;
    this.reset();
    this.currentNodeId = this.tree.startNodeId;
  }

  setNode(nodeName: string): void {
    this.currentNodeId = nodeName;
    this.waitingForOption = false;
    this.pendingEvents = [];
    this.pendingNextNodeId = null;
    this.optionCache = null;
  }

  continue(): RuntimeEvent | null {
    if (this.isComplete || this.waitingForOption) {
      return null;
    }

    if (this.pendingEvents.length === 0) {
      this.populateEventsForCurrentNode();
    }

    const nextEvent = this.pendingEvents.shift() ?? null;
    if (!nextEvent) {
      return null;
    }

    if (nextEvent.type === 'options') {
      this.waitingForOption = true;
    }

    if (nextEvent.type === 'node_complete') {
      this.currentNodeId = this.pendingNextNodeId;
      this.pendingNextNodeId = null;
    }

    if (nextEvent.type === 'dialogue_complete') {
      this.isComplete = true;
    }

    return nextEvent;
  }

  setSelectedOption(optionId: number): void {
    if (!this.optionCache || !this.waitingForOption) {
      throw new Error('Not currently waiting for an option');
    }

    const choice = this.optionCache.choices[optionId];
    if (!choice) {
      throw new Error(`Invalid option id ${optionId}`);
    }

    this.waitingForOption = false;
    this.pendingNextNodeId = choice.nextNodeId ?? null;
    this.pendingEvents.push({ type: 'node_complete', nodeName: this.optionCache.nodeId });
    this.optionCache = null;
  }

  getVariable(name: string): VariableValue | undefined {
    return this.variables.get(name);
  }

  setVariable(name: string, value: VariableValue): void {
    this.variables.set(name, value);
  }

  getVariableNames(): string[] {
    return Array.from(this.variables.keys());
  }

  isWaitingForOption(): boolean {
    return this.waitingForOption;
  }

  isDialogueComplete(): boolean {
    return this.isComplete;
  }

  reset(): void {
    this.currentNodeId = this.tree.startNodeId;
    this.waitingForOption = false;
    this.isComplete = false;
    this.pendingEvents = [];
    this.pendingNextNodeId = null;
    this.startedNodes.clear();
    this.optionCache = null;
  }

  private populateEventsForCurrentNode(): void {
    if (this.isComplete) {
      return;
    }

    if (!this.currentNodeId) {
      this.pendingEvents.push({ type: 'dialogue_complete' });
      return;
    }

    const node = this.tree.nodes[this.currentNodeId];
    if (!node) {
      this.pendingEvents.push({ type: 'dialogue_complete' });
      this.isComplete = true;
      return;
    }

    if (!this.startedNodes.has(node.id)) {
      this.startedNodes.add(node.id);
      this.pendingEvents.push({ type: 'node_start', nodeName: node.id });
      return;
    }

    if (node.type === NODE_TYPE.NPC) {
      const lineId = node.lineId || node.id;
      const substitutions = node.substitutions || [];
      this.pendingNextNodeId = node.nextNodeId ?? null;

      this.pendingEvents.push({ type: 'prepare_for_lines', lineIds: [lineId] });
      this.pendingEvents.push({ type: 'line', lineId, substitutions });
      this.pendingEvents.push({ type: 'node_complete', nodeName: node.id });
      return;
    }

    if (node.type === NODE_TYPE.PLAYER) {
      const options: OptionInfo[] = node.choices.map((choice, idx) => ({
        id: idx,
        lineId: choice.lineId || choice.id,
        enabled: choice.enabled ?? true,
        destinationNode: choice.nextNodeId,
      }));

      this.pendingEvents.push({
        type: 'prepare_for_lines',
        lineIds: options.map(opt => opt.lineId),
      });
      this.pendingEvents.push({ type: 'options', options });
      this.optionCache = { choices: node.choices, nodeId: node.id };
      return;
    }

    // Unknown node type ends the dialogue
    this.pendingEvents.push({ type: 'dialogue_complete' });
    this.isComplete = true;
  }
}
