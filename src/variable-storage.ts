/**
 * Variable storage for Yarn Spinner runtime
 */

export type VariableValue = string | number | boolean;

/**
 * Interface for variable storage implementations
 */
export interface VariableStorage {
  get(name: string): VariableValue | undefined;
  set(name: string, value: VariableValue): void;
  has(name: string): boolean;
  delete(name: string): boolean;
  clear(): void;
  getAll(): Map<string, VariableValue>;
  getAllNames(): string[];
}

/**
 * Simple in-memory variable storage
 */
export class InMemoryVariableStorage implements VariableStorage {
  private variables = new Map<string, VariableValue>();
  
  constructor(initial?: Record<string, VariableValue>) {
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        this.variables.set(key, value);
      }
    }
  }
  
  get(name: string): VariableValue | undefined {
    return this.variables.get(name);
  }
  
  set(name: string, value: VariableValue): void {
    this.variables.set(name, value);
  }
  
  has(name: string): boolean {
    return this.variables.has(name);
  }
  
  delete(name: string): boolean {
    return this.variables.delete(name);
  }
  
  clear(): void {
    this.variables.clear();
  }
  
  getAll(): Map<string, VariableValue> {
    return new Map(this.variables);
  }
  
  getAllNames(): string[] {
    return Array.from(this.variables.keys());
  }
}

/**
 * Persistent variable storage that saves to localStorage (browser)
 */
export class LocalStorageVariableStorage implements VariableStorage {
  private storageKey: string;
  private cache: Map<string, VariableValue>;
  
  constructor(storageKey: string = 'yarn-variables') {
    this.storageKey = storageKey;
    this.cache = this.load();
  }
  
  private load(): Map<string, VariableValue> {
    if (typeof localStorage === 'undefined') {
      return new Map();
    }
    
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        return new Map(Object.entries(parsed));
      }
    } catch {
      // Ignore parse errors
    }
    
    return new Map();
  }
  
  private save(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    
    const obj: Record<string, VariableValue> = {};
    for (const [key, value] of this.cache) {
      obj[key] = value;
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(obj));
  }
  
  get(name: string): VariableValue | undefined {
    return this.cache.get(name);
  }
  
  set(name: string, value: VariableValue): void {
    this.cache.set(name, value);
    this.save();
  }
  
  has(name: string): boolean {
    return this.cache.has(name);
  }
  
  delete(name: string): boolean {
    const result = this.cache.delete(name);
    if (result) this.save();
    return result;
  }
  
  clear(): void {
    this.cache.clear();
    this.save();
  }
  
  getAll(): Map<string, VariableValue> {
    return new Map(this.cache);
  }
  
  getAllNames(): string[] {
    return Array.from(this.cache.keys());
  }
}

