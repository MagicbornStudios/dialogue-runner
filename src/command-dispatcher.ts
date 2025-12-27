/**
 * Command dispatcher for handling Yarn commands
 */

import type { VariableValue } from './variable-storage';

export interface CommandContext {
  /** Get a variable value */
  getVariable(name: string): VariableValue | undefined;
  /** Set a variable value */
  setVariable(name: string, value: VariableValue): void;
  /** Stop the current dialogue */
  stop(): void;
  /** Continue to next content */
  continue(): void;
}

export type CommandHandler = (
  args: string[],
  context: CommandContext
) => void | Promise<void>;

/**
 * Dispatcher for Yarn commands like <<wait>>, <<camera>>, etc.
 */
export class CommandDispatcher {
  private handlers = new Map<string, CommandHandler>();
  private defaultHandler: CommandHandler | null = null;
  
  /**
   * Register a command handler
   */
  on(command: string, handler: CommandHandler): this {
    this.handlers.set(command.toLowerCase(), handler);
    return this;
  }
  
  /**
   * Remove a command handler
   */
  off(command: string): this {
    this.handlers.delete(command.toLowerCase());
    return this;
  }
  
  /**
   * Set a default handler for unknown commands
   */
  setDefault(handler: CommandHandler): this {
    this.defaultHandler = handler;
    return this;
  }
  
  /**
   * Dispatch a command
   * @returns true if command was handled, false otherwise
   */
  async dispatch(commandText: string, context: CommandContext): Promise<boolean> {
    const parsed = this.parseCommand(commandText);
    if (!parsed) return false;
    
    const { command, args } = parsed;
    const handler = this.handlers.get(command.toLowerCase());
    
    if (handler) {
      await handler(args, context);
      return true;
    }
    
    if (this.defaultHandler) {
      await this.defaultHandler([command, ...args], context);
      return true;
    }
    
    return false;
  }
  
  /**
   * Parse a command string into command name and arguments
   */
  private parseCommand(text: string): { command: string; args: string[] } | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    
    // Split by whitespace, respecting quotes
    const tokens = this.tokenize(trimmed);
    if (tokens.length === 0) return null;
    
    return {
      command: tokens[0],
      args: tokens.slice(1),
    };
  }
  
  /**
   * Tokenize a string, respecting quoted strings
   */
  private tokenize(text: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      tokens.push(current);
    }
    
    return tokens;
  }
  
  /**
   * Check if a command has a registered handler
   */
  hasHandler(command: string): boolean {
    return this.handlers.has(command.toLowerCase()) || this.defaultHandler !== null;
  }
  
  /**
   * Get all registered command names
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Create a dispatcher with common built-in commands
 */
export function createDefaultDispatcher(): CommandDispatcher {
  const dispatcher = new CommandDispatcher();
  
  // Wait command: <<wait 1.5>>
  dispatcher.on('wait', async (args, context) => {
    const seconds = parseFloat(args[0] || '1');
    if (!isNaN(seconds)) {
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }
    context.continue();
  });
  
  // Stop command: <<stop>>
  dispatcher.on('stop', (_args, context) => {
    context.stop();
  });
  
  // Set command is typically handled by the VM, but we can provide a fallback
  dispatcher.on('set', (args, context) => {
    if (args.length >= 2) {
      const varName = args[0].replace(/^\$/, '');
      const value = parseValue(args.slice(1).join(' '));
      context.setVariable(varName, value);
    }
    context.continue();
  });
  
  return dispatcher;
}

function parseValue(valueStr: string): VariableValue {
  // Remove quotes
  if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
    return valueStr.slice(1, -1);
  }
  
  // Boolean
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  
  // Number
  const num = parseFloat(valueStr);
  if (!isNaN(num)) return num;
  
  // String
  return valueStr;
}

