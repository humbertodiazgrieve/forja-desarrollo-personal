import { isTauri } from '@tauri-apps/api/core';
import { createPersistence } from './storage-adapter';
import { browserStorage } from './storage-browser';
import { tauriStorage } from './storage-tauri';

export const desktop = isTauri();

export const { loadState, saveState, exportBackup, readBackup, restoreBackup, recoverPrevious } =
  createPersistence(desktop ? tauriStorage : browserStorage);
