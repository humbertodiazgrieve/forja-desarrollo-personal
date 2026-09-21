import { initialState, validateState, type AppState } from './domain';

export interface Persistence {
  loadState(): Promise<AppState>;
  saveState(state: AppState): Promise<void>;
  exportBackup(state: AppState): Promise<string | null>;
  readBackup(file?: File): Promise<AppState | null>;
  restoreBackup(state: AppState): Promise<void>;
  recoverPrevious(): Promise<AppState | null>;
}

// Backend reads are untrusted; validation belongs to the shared boundary.
export interface StorageAdapter {
  loadState(): Promise<unknown>;
  saveState(state: AppState): Promise<void>;
  exportBackup(state: AppState): Promise<string | null>;
  readBackup(file?: File): Promise<unknown>;
  restoreBackup(state: AppState): Promise<void>;
  recoverPrevious(): Promise<unknown>;
}

export function createPersistence(adapter: StorageAdapter): Persistence {
  return {
    async loadState() {
      const data = await adapter.loadState();
      return data ? validateState(data) : initialState();
    },
    async saveState(state) {
      await adapter.saveState(validateState(state));
    },
    async exportBackup(state) {
      return adapter.exportBackup(validateState(state));
    },
    async readBackup(file) {
      const data = await adapter.readBackup(file);
      return data ? validateState(data) : null;
    },
    async restoreBackup(state) {
      await adapter.restoreBackup(validateState(state));
    },
    async recoverPrevious() {
      const data = await adapter.recoverPrevious();
      return data ? validateState(data) : null;
    },
  };
}
