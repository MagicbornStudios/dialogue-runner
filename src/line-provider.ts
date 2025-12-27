/**
 * Line Provider for resolving line IDs to localized text
 */

export interface LocalizedLine {
  /** The resolved text */
  text: string;
  /** Original line ID */
  lineId: string;
  /** Substitutions applied */
  substitutions: string[];
  /** Metadata from the line table */
  metadata?: Record<string, string>;
}

export interface LineProviderOptions {
  /** Locale code (e.g., 'en-US') */
  locale?: string;
  /** Fallback locale if primary not found */
  fallbackLocale?: string;
}

export interface LineEntry {
  id: string;
  text: string;
  metadata?: Record<string, string>;
}

/**
 * Base class for line providers
 */
export abstract class LineProvider {
  protected locale: string;
  protected fallbackLocale: string;
  
  constructor(options: LineProviderOptions = {}) {
    this.locale = options.locale || 'en-US';
    this.fallbackLocale = options.fallbackLocale || 'en-US';
  }
  
  /**
   * Resolve a line ID to localized text
   */
  abstract getLine(lineId: string, substitutions?: string[]): LocalizedLine | null;
  
  /**
   * Prepare lines for upcoming dialogue (for preloading assets, etc.)
   */
  abstract prepareLines(lineIds: string[]): Promise<void>;
  
  /**
   * Set the current locale
   */
  setLocale(locale: string): void {
    this.locale = locale;
  }
  
  /**
   * Apply substitutions to text
   */
  protected applySubstitutions(text: string, substitutions: string[]): string {
    let result = text;
    substitutions.forEach((sub, idx) => {
      result = result.replace(`{${idx}}`, sub);
    });
    return result;
  }
}

/**
 * Simple in-memory line provider using a Map
 */
export class MapLineProvider extends LineProvider {
  private lines: Map<string, LineEntry>;
  
  constructor(
    lines: Map<string, LineEntry> | Record<string, string>,
    options: LineProviderOptions = {}
  ) {
    super(options);
    
    if (lines instanceof Map) {
      this.lines = lines;
    } else {
      this.lines = new Map();
      for (const [id, text] of Object.entries(lines)) {
        this.lines.set(id, { id, text });
      }
    }
  }
  
  getLine(lineId: string, substitutions: string[] = []): LocalizedLine | null {
    const entry = this.lines.get(lineId);
    if (!entry) {
      return null;
    }
    
    return {
      text: this.applySubstitutions(entry.text, substitutions),
      lineId,
      substitutions,
      metadata: entry.metadata,
    };
  }
  
  async prepareLines(_lineIds: string[]): Promise<void> {
    // No-op for in-memory provider
  }
  
  /**
   * Add or update a line
   */
  setLine(lineId: string, text: string, metadata?: Record<string, string>): void {
    this.lines.set(lineId, { id: lineId, text, metadata });
  }
  
  /**
   * Load lines from CSV entries
   */
  loadFromCsv(entries: Array<{ id: string; text: string }>): void {
    for (const entry of entries) {
      this.lines.set(entry.id, { id: entry.id, text: entry.text });
    }
  }
}

/**
 * Line provider that fetches from a URL
 */
export class FetchLineProvider extends LineProvider {
  private baseUrl: string;
  private cache: Map<string, LineEntry> = new Map();
  private loadedLocales: Set<string> = new Set();
  
  constructor(baseUrl: string, options: LineProviderOptions = {}) {
    super(options);
    this.baseUrl = baseUrl;
  }
  
  getLine(lineId: string, substitutions: string[] = []): LocalizedLine | null {
    const entry = this.cache.get(lineId);
    if (!entry) {
      return null;
    }
    
    return {
      text: this.applySubstitutions(entry.text, substitutions),
      lineId,
      substitutions,
      metadata: entry.metadata,
    };
  }
  
  async prepareLines(lineIds: string[]): Promise<void> {
    // If locale already loaded, no need to fetch again
    if (this.loadedLocales.has(this.locale)) {
      return;
    }
    
    try {
      const url = `${this.baseUrl}/${this.locale}.json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (this.locale !== this.fallbackLocale) {
          // Try fallback
          const fallbackUrl = `${this.baseUrl}/${this.fallbackLocale}.json`;
          const fallbackResponse = await fetch(fallbackUrl);
          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            this.loadLines(data);
            this.loadedLocales.add(this.fallbackLocale);
          }
        }
        return;
      }
      
      const data = await response.json();
      this.loadLines(data);
      this.loadedLocales.add(this.locale);
    } catch {
      // Ignore fetch errors
    }
  }
  
  private loadLines(data: Record<string, string | { text: string; metadata?: Record<string, string> }>): void {
    for (const [id, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        this.cache.set(id, { id, text: value });
      } else {
        this.cache.set(id, { id, text: value.text, metadata: value.metadata });
      }
    }
  }
}

