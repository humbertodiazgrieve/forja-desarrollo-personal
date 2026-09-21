import type { StorageAdapter } from './storage-adapter';

const key = 'forja-preview-v1';

export const browserStorage: StorageAdapter = {
  async loadState() {
    return JSON.parse(localStorage.getItem(key) || 'null');
  },
  async saveState(state) {
    localStorage.setItem(key, JSON.stringify(state));
  },
  async exportBackup(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `forja-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'Descargas';
  },
  async readBackup(file) {
    return file ? JSON.parse(await file.text()) : null;
  },
  async restoreBackup(state) {
    const previous = localStorage.getItem(key);
    if (previous) localStorage.setItem(key + '-before-restore', previous);
    localStorage.setItem(key, JSON.stringify(state));
  },
  async recoverPrevious() {
    return JSON.parse(localStorage.getItem(key + '-before-restore') || 'null');
  },
};
