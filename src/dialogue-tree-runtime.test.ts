import { describe, it, expect } from 'vitest';
import { DialogueRunner } from './runner';
import {
  DialogueTreeRuntime,
  NODE_TYPE,
  type DialogueTree,
  type PlayerChoice,
} from './dialogue-tree-runtime';
import { InMemoryVariableStorage } from './variable-storage';
import type { DialogueRuntime, RuntimeEvent, VariableValue, LineEvent } from './types';

function collectEvents(runtime: DialogueTreeRuntime): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  while (!runtime.isDialogueComplete()) {
    const event = runtime.continue();
    if (!event) {
      break;
    }
    events.push(event);
  }
  return events;
}

describe('DialogueTreeRuntime NPC flow', () => {
  it('emits node lifecycle, prepares lines, and completes dialogue', () => {
    const tree: DialogueTree = {
      id: 'demo',
      title: 'Demo',
      startNodeId: 'npc_1',
      nodes: {
        npc_1: {
          id: 'npc_1',
          type: NODE_TYPE.NPC,
          speaker: 'Guide',
          content: 'Welcome',
          nextNodeId: 'npc_2',
        },
        npc_2: {
          id: 'npc_2',
          type: NODE_TYPE.NPC,
          content: 'Farewell',
        },
      },
    };

    const runtime = new DialogueTreeRuntime(tree);
    const events = collectEvents(runtime);

    expect(events.map(event => event.type)).toEqual([
      'node_start',
      'prepare_for_lines',
      'line',
      'node_complete',
      'node_start',
      'prepare_for_lines',
      'line',
      'node_complete',
      'dialogue_complete',
    ]);

    const lineIds = events
      .filter((event): event is LineEvent => event.type === 'line')
      .map(event => event.lineId);
    expect(lineIds).toEqual(['npc_1', 'npc_2']);
    expect(runtime.isDialogueComplete()).toBe(true);
  });
});

describe('DialogueTreeRuntime player choices', () => {
  it('surfaces options, accepts selection, and advances to the destination node', () => {
    const buyChoice: PlayerChoice = { id: 'buy', text: 'Buy', nextNodeId: 'npc_buy' };
    const chatChoice: PlayerChoice = { id: 'chat', text: 'Chat', nextNodeId: 'npc_chat' };

    const tree: DialogueTree = {
      id: 'shop',
      title: 'Shop',
      startNodeId: 'player',
      nodes: {
        player: {
          id: 'player',
          type: NODE_TYPE.PLAYER,
          choices: [buyChoice, chatChoice],
        },
        npc_buy: {
          id: 'npc_buy',
          type: NODE_TYPE.NPC,
          content: 'Here are the wares.',
        },
        npc_chat: {
          id: 'npc_chat',
          type: NODE_TYPE.NPC,
          content: 'Gossip time.',
        },
      },
    };

    const runtime = new DialogueTreeRuntime(tree);

    // First event should start the player node.
    expect(runtime.continue()).toEqual({ type: 'node_start', nodeName: 'player' });

    // Next call should surface options.
    const optionsEvent = runtime.continue();
    expect(optionsEvent?.type).toBe('prepare_for_lines');

    const optionsPayload = runtime.continue();
    expect(optionsPayload?.type).toBe('options');
    if (!optionsPayload || optionsPayload.type !== 'options') {
      throw new Error('Options not returned');
    }

    expect(optionsPayload.options).toEqual([
      {
        id: 0,
        lineId: buyChoice.id,
        enabled: true,
        destinationNode: buyChoice.nextNodeId,
      },
      {
        id: 1,
        lineId: chatChoice.id,
        enabled: true,
        destinationNode: chatChoice.nextNodeId,
      },
    ]);

    expect(runtime.isWaitingForOption()).toBe(true);

    // Select the second option (chat), then continue.
    runtime.setSelectedOption(1);

    const remainingEvents = collectEvents(runtime).map(event => event.type);
    expect(remainingEvents).toEqual([
      'node_complete',
      'node_start',
      'prepare_for_lines',
      'line',
      'node_complete',
      'dialogue_complete',
    ]);
    expect(runtime.isDialogueComplete()).toBe(true);
  });
});

describe('DialogueTreeRuntime program loading', () => {
  it('resets state and starts at the new program start node', () => {
    const initialTree: DialogueTree = {
      id: 'first',
      startNodeId: 'npc_a',
      nodes: {
        npc_a: {
          id: 'npc_a',
          type: NODE_TYPE.NPC,
          content: 'Alpha',
        },
      },
    };

    const runtime = new DialogueTreeRuntime(initialTree);
    runtime.continue(); // node_start npc_a

    const secondTree: DialogueTree = {
      id: 'second',
      startNodeId: 'npc_b',
      nodes: {
        npc_b: {
          id: 'npc_b',
          type: NODE_TYPE.NPC,
          content: 'Beta',
        },
      },
    };

    const encoded = new TextEncoder().encode(JSON.stringify(secondTree));
    runtime.loadProgram(encoded.buffer);

    const event = runtime.continue();
    expect(event).toEqual({ type: 'node_start', nodeName: 'npc_b' });
  });
});

describe('DialogueRunner variable synchronization and commands', () => {
  class ScriptedRuntime implements DialogueRuntime {
    private events: RuntimeEvent[];
    private index = 0;
    private complete = false;
    private variables = new Map<string, VariableValue>();

    constructor(events: RuntimeEvent[]) {
      this.events = events;
    }

    loadProgram(): void {}

    setNode(): void {
      this.index = 0;
      this.complete = false;
    }

    continue(): RuntimeEvent | null {
      if (this.index >= this.events.length) {
        return null;
      }
      const event = this.events[this.index++];
      if (event.type === 'dialogue_complete') {
        this.complete = true;
      }
      return event;
    }

    setSelectedOption(): void {
      throw new Error('Options not supported');
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
      return false;
    }

    isDialogueComplete(): boolean {
      return this.complete;
    }

    reset(): void {
      this.index = 0;
      this.complete = false;
      this.variables.clear();
    }
  }

  it('applies game flags to the runtime and persists updates from commands', async () => {
    const events: RuntimeEvent[] = [
      { type: 'command', text: 'set $stat_gold 150' },
      { type: 'command', text: "set $quest_dragon 'complete'" },
      { type: 'dialogue_complete' },
    ];

    const runtime = new ScriptedRuntime(events);
    const initialFlags = new InMemoryVariableStorage({
      stat_gold: 100,
      quest_dragon: 'started',
    });

    const runner = new DialogueRunner({ runtime, variableStorage: initialFlags });
    await runner.start('intro');

    expect(runner.getVariable('stat_gold')).toBe(150);
    expect(runner.getVariable('quest_dragon')).toBe('complete');
    expect(runtime.getVariable('stat_gold')).toBe(150);
    expect(runtime.getVariable('quest_dragon')).toBe('complete');
  });
});
