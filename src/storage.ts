import { invoke, isTauri } from '@tauri-apps/api/core';
import { initialState, validateState, type AppState } from './domain';
export const desktop = isTauri();
const key = 'forja-preview-v1';
export async function loadState(): Promise<AppState> {
  const data = desktop
    ? await invoke<unknown>('load_state')
    : JSON.parse(localStorage.getItem(key) || 'null');
  return data ? validateState(data) : initialState();
}
export async function saveState(state: AppState) {
  if (desktop) await invoke('save_state', { data: state });
  else localStorage.setItem(key, JSON.stringify(state));
}
export async function exportBackup(state: AppState) {
  if (desktop) return invoke<string | null>('export_backup', { data: state });
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `forja-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'Descargas';
}
export async function readBackup(file?: File) {
  const raw = desktop
    ? await invoke<unknown>('read_backup')
    : file
      ? JSON.parse(await file.text())
      : null;
  return raw ? validateState(raw) : null;
}
export async function restoreBackup(state: AppState) {
  if (desktop) await invoke('restore_backup', { data: state });
  else {
    const previous = localStorage.getItem(key);
    if (previous) localStorage.setItem(key + '-before-restore', previous);
    localStorage.setItem(key, JSON.stringify(state));
  }
}
