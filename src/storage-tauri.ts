import { invoke } from '@tauri-apps/api/core';
import type { StorageAdapter } from './storage-adapter';

export const tauriStorage: StorageAdapter = {
  loadState: () => invoke<unknown>('load_state'),
  saveState: (state) => invoke<void>('save_state', { data: state }),
  exportBackup: (state) => invoke<string | null>('export_backup', { data: state }),
  readBackup: () => invoke<unknown>('read_backup'),
  restoreBackup: (state) => invoke<void>('restore_backup', { data: state }),
  recoverPrevious: () => invoke<unknown>('recover_previous'),
};
