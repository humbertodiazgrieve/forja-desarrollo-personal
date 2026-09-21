import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { initialState, validateState } from './domain';
import { createPersistence, type StorageAdapter } from './storage-adapter';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Persistence boundary', () => {
  const state = initialState('2026-09-14');
  const adapter = {
    loadState: vi.fn<StorageAdapter['loadState']>(),
    saveState: vi.fn<StorageAdapter['saveState']>(),
    exportBackup: vi.fn<StorageAdapter['exportBackup']>(),
    readBackup: vi.fn<StorageAdapter['readBackup']>(),
    restoreBackup: vi.fn<StorageAdapter['restoreBackup']>(),
    recoverPrevious: vi.fn<StorageAdapter['recoverPrevious']>(),
  } satisfies StorageAdapter;
  const persistence = createPersistence(adapter);

  beforeEach(() => vi.resetAllMocks());

  it('initializes an empty store without writing it', async () => {
    adapter.loadState.mockResolvedValue(null);
    const loaded = await persistence.loadState();
    expect(validateState(loaded)).toEqual(loaded);
    expect(loaded.onboarded).toBe(false);
    expect(adapter.saveState).not.toHaveBeenCalled();
  });

  it.each(['loadState', 'readBackup', 'recoverPrevious'] as const)(
    '%s validates backend data and propagates read failures',
    async (method) => {
      adapter[method].mockResolvedValue(state);
      await expect(persistence[method]()).resolves.toEqual(state);
      adapter[method].mockResolvedValue({ ...state, habits: [] });
      await expect(persistence[method]()).rejects.toThrow();
      const failure = new Error('read failed');
      adapter[method].mockRejectedValue(failure);
      await expect(persistence[method]()).rejects.toBe(failure);
      expect(adapter.saveState).not.toHaveBeenCalled();
      expect(adapter.restoreBackup).not.toHaveBeenCalled();
    },
  );

  it.each(['readBackup', 'recoverPrevious'] as const)(
    '%s preserves cancellation',
    async (method) => {
      adapter[method].mockResolvedValue(null);
      await expect(persistence[method]()).resolves.toBeNull();
    },
  );

  it.each(['saveState', 'exportBackup', 'restoreBackup'] as const)(
    '%s validates before any backend effect and propagates failures',
    async (method) => {
      await expect(persistence[method]({ ...state, habits: [] })).rejects.toThrow();
      expect(adapter[method]).not.toHaveBeenCalled();
      await persistence[method](state);
      expect(adapter[method]).toHaveBeenCalledWith(state);
      const failure = new Error('write failed');
      adapter[method].mockRejectedValue(failure);
      await expect(persistence[method](state)).rejects.toBe(failure);
    },
  );
});

describe('Tauri through the public facade', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  it('keeps all native commands and payloads without browser storage', async () => {
    const storage = await import('./storage');
    const state = initialState('2026-09-14');
    expect(storage.desktop).toBe(true);
    vi.mocked(invoke).mockResolvedValue(state);
    await expect(storage.loadState()).resolves.toEqual(state);
    await expect(storage.readBackup()).resolves.toEqual(state);
    await expect(storage.recoverPrevious()).resolves.toEqual(state);
    vi.mocked(invoke).mockResolvedValue(undefined);
    await storage.saveState(state);
    await storage.restoreBackup(state);
    vi.mocked(invoke).mockResolvedValue('backup.json');
    await expect(storage.exportBackup(state)).resolves.toBe('backup.json');
    expect(vi.mocked(invoke).mock.calls).toEqual([
      ['load_state'],
      ['read_backup'],
      ['recover_previous'],
      ['save_state', { data: state }],
      ['restore_backup', { data: state }],
      ['export_backup', { data: state }],
    ]);
  });

  it('keeps cancelled native dialogs and rejects invalid backups before restore', async () => {
    const storage = await import('./storage');
    vi.mocked(invoke).mockResolvedValue(null);
    await expect(storage.readBackup()).resolves.toBeNull();
    await expect(storage.exportBackup(initialState())).resolves.toBeNull();
    vi.mocked(invoke).mockResolvedValue({ schema: 2 });
    await expect(storage.readBackup()).rejects.toThrow();
    expect(vi.mocked(invoke).mock.calls.some(([command]) => command === 'restore_backup')).toBe(
      false,
    );
  });
});

describe('Browser through the public facade', () => {
  const key = 'forja-preview-v1';
  let values: Map<string, string>;
  let setItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
    values = new Map();
    setItem = vi.fn((key: string, value: string) => {
      values.set(key, value);
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem,
    });
  });

  afterEach(() => expect(invoke).not.toHaveBeenCalled());

  it('keeps the storage key and preserves the previous state before restoring', async () => {
    const storage = await import('./storage');
    expect(storage.desktop).toBe(false);
    const state = initialState('2026-09-14');
    await storage.saveState(state);
    expect(JSON.parse(values.get(key)!)).toEqual(state);
    await expect(storage.loadState()).resolves.toEqual(state);
    const next = { ...state, onboarded: true };
    await storage.restoreBackup(next);
    const restoreCalls = setItem.mock.calls.slice(-2);
    expect(restoreCalls[0][0]).toBe(key + '-before-restore');
    expect(JSON.parse(restoreCalls[0][1] as string)).toEqual(state);
    expect(restoreCalls[1][0]).toBe(key);
    expect(JSON.parse(restoreCalls[1][1] as string)).toEqual(next);
    await expect(storage.recoverPrevious()).resolves.toEqual(state);
    await expect(storage.loadState()).resolves.toEqual(next);
  });

  it('does not invent a previous backup when restoring into an empty store', async () => {
    const storage = await import('./storage');
    await storage.restoreBackup(initialState());
    expect(values.has(key + '-before-restore')).toBe(false);
    await expect(storage.recoverPrevious()).resolves.toBeNull();
  });

  it('rejects corrupt data without overwriting either stored copy', async () => {
    const storage = await import('./storage');
    values.set(key, '{broken');
    values.set(key + '-before-restore', JSON.stringify({ schema: 2 }));
    await expect(storage.loadState()).rejects.toThrow();
    await expect(storage.recoverPrevious()).rejects.toThrow();
    await expect(storage.restoreBackup({ ...initialState(), goals: [] })).rejects.toThrow();
    expect(setItem).not.toHaveBeenCalled();
    expect(values.get(key)).toBe('{broken');
  });

  it('leaves the current state intact if saving the safety copy fails', async () => {
    const storage = await import('./storage');
    const state = initialState();
    values.set(key, JSON.stringify(state));
    setItem.mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    await expect(storage.restoreBackup({ ...state, onboarded: true })).rejects.toThrow(
      'quota exceeded',
    );
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(values.get(key)!)).toEqual(state);
  });

  it('reads and validates file content, including parse errors and cancellation', async () => {
    const storage = await import('./storage');
    const state = initialState();
    const file = (text: string) => ({ text: vi.fn().mockResolvedValue(text) }) as unknown as File;
    await expect(storage.readBackup(file(JSON.stringify(state)))).resolves.toEqual(state);
    await expect(storage.readBackup(file('{broken'))).rejects.toThrow();
    await expect(storage.readBackup(file('{"schema":2}'))).rejects.toThrow();
    await expect(storage.readBackup()).resolves.toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('downloads formatted JSON and releases its URL after one second', async () => {
    const storage = await import('./storage');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
    const state = initialState('2026-09-14');
    const anchor = { href: '', download: '', click: vi.fn() };
    const createElement = vi.fn().mockReturnValue(anchor);
    vi.stubGlobal('document', { createElement });
    const createURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup');
    const revokeURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await expect(storage.exportBackup(state)).resolves.toBe('Descargas');
    const blob = createURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(await blob.text())).toEqual(state);
    expect(createElement).toHaveBeenCalledWith('a');
    expect(anchor.href).toBe('blob:backup');
    expect(anchor.download).toBe('forja-2026-09-19.json');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(revokeURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeURL).toHaveBeenCalledWith('blob:backup');
  });
});
