// Web shim for @tauri-apps/plugin-store
// Uses localStorage instead of Tauri's native store

export class Store {
  private name: string;
  private cache: Map<string, unknown> = new Map();

  constructor(name: string) {
    this.name = name;
    this.loadFromStorage();
  }

  // Static load method matching Tauri API
  static async load(name: string): Promise<Store> {
    return new Store(name);
  }

  private getStorageKey(key: string): string {
    return `${this.name}:${key}`;
  }

  private loadFromStorage(): void {
    try {
      const prefix = `${this.name}:`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              this.cache.set(key.slice(prefix.length), JSON.parse(value));
            } catch {
              this.cache.set(key.slice(prefix.length), value);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached as T;

    try {
      const value = localStorage.getItem(this.getStorageKey(key));
      if (value) {
        const parsed = JSON.parse(value);
        this.cache.set(key, parsed);
        return parsed as T;
      }
    } catch (e) {
      console.warn('Failed to get from localStorage:', e);
    }
    return null;
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      this.cache.set(key, value);
      localStorage.setItem(this.getStorageKey(key), JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to set in localStorage:', e);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      this.cache.delete(key);
      localStorage.removeItem(this.getStorageKey(key));
      return true;
    } catch (e) {
      console.warn('Failed to delete from localStorage:', e);
      return false;
    }
  }

  async save(): Promise<void> {
    // localStorage auto-saves, nothing to do
  }

  async clear(): Promise<void> {
    try {
      const prefix = `${this.name}:`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      this.cache.clear();
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  }
}

// LazyStore is the same as Store in web mode
export class LazyStore extends Store {
  constructor(name: string) {
    super(name);
  }
}

// load function returns a Store instance
export async function load(name: string): Promise<Store> {
  return new Store(name);
}
