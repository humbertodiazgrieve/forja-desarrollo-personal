import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppState } from './domain';
import { AutoSyncEngine, checkpointKey } from './auto-sync-engine';
import { RemoteConflictError, type RemoteState } from './supabase-repository';

const makeRemote = (state: AppState, revision: number): RemoteState => ({
  state,
  schemaVersion: 1,
  revision,
  updatedAt: '2026-09-20T12:00:00Z',
});

const makeStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    values,
  };
};

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('AutoSyncEngine', () => {
  beforeEach(() => vi.useRealTimers());

  it('persists a per-user checkpoint and adopts newer remote data after reload', async () => {
    const storage = makeStorage();
    const local = { ...initialState('2026-09-14'), onboarded: true };
    const firstSave = vi.fn().mockResolvedValue(1);
    const first = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(null),
      saveRemote: firstSave,
      applyRemote: vi.fn(),
      onStatus: vi.fn(),
      storage,
    });
    first.setLocalState(local);
    first.setUser('same-account');
    await flush();

    expect(firstSave).toHaveBeenCalledWith(local, 0);
    const key = checkpointKey('same-account');
    expect(JSON.parse(storage.values.get(key)!)).toEqual({ state: local, revision: 1 });

    const newerRemote = { ...local, records: { '2026-09-20': { cardio: 1 } } };
    const applyRemote = vi.fn();
    const saveRemote = vi.fn();
    const status = vi.fn();
    const afterReload = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(makeRemote(newerRemote, 2)),
      saveRemote,
      applyRemote,
      onStatus: status,
      storage,
    });
    afterReload.setLocalState(local);
    afterReload.setUser('same-account');
    await flush();

    expect(applyRemote).toHaveBeenCalledWith(newerRemote);
    expect(saveRemote).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith('synced', 2);
  });

  it('keeps two divergent nondefault states in explicit conflict without a checkpoint', async () => {
    const local = { ...initialState('2026-09-14'), onboarded: true };
    const remote = { ...local, records: { '2026-09-20': { cardio: 1 } } };
    const saveRemote = vi.fn();
    const applyRemote = vi.fn();
    const onStatus = vi.fn();
    const engine = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(makeRemote(remote, 8)),
      saveRemote,
      applyRemote,
      onStatus,
      storage: makeStorage(),
    });
    engine.setLocalState(local);
    engine.setUser('account');
    await flush();

    expect(onStatus).toHaveBeenLastCalledWith('conflict', 8);
    expect(saveRemote).not.toHaveBeenCalled();
    expect(applyRemote).not.toHaveBeenCalled();
  });

  it('compares record keys canonically and recognizes generated default IDs', async () => {
    const local = initialState('2026-09-14');
    local.records['2026-09-20'] = { strength: 1, cardio: 2 };
    const remote = { ...local };
    remote.records['2026-09-20'] = { cardio: 2, strength: 1 };
    const applyRemote = vi.fn();
    const onStatus = vi.fn();
    const engine = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(makeRemote(remote, 3)),
      saveRemote: vi.fn(),
      applyRemote,
      onStatus,
    });
    engine.setLocalState(local);
    engine.setUser('account');
    await flush();

    expect(onStatus).toHaveBeenLastCalledWith('synced', 3);
    expect(applyRemote).not.toHaveBeenCalled();
  });

  it('adopts remote data over a default local state even when generated IDs differ', async () => {
    const local = initialState('2026-09-14');
    const remote = {
      ...initialState('2026-09-14'),
      records: { '2026-09-20': { cardio: 1 } },
    };
    const applyRemote = vi.fn();
    const engine = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(makeRemote(remote, 3)),
      saveRemote: vi.fn(),
      applyRemote,
      onStatus: vi.fn(),
    });
    engine.setLocalState(local);
    engine.setUser('account');
    await flush();

    expect(applyRemote).toHaveBeenCalledWith(remote);
  });

  it('retries a failed startup on refresh and does not cancel initialization on local edits', async () => {
    let finishLoad!: (value: RemoteState | null) => void;
    const latest = { ...initialState('2026-09-14'), onboarded: true };
    const remote = { ...latest, records: { '2026-09-20': { cardio: 1 } } };
    const loadRemote = vi
      .fn<() => Promise<RemoteState | null>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(() => new Promise((resolve) => (finishLoad = resolve)))
      .mockResolvedValue(makeRemote(remote, 4));
    const saveRemote = vi.fn().mockResolvedValue(5);
    const onStatus = vi.fn();
    const engine = new AutoSyncEngine({
      loadRemote,
      saveRemote,
      applyRemote: vi.fn(),
      onStatus,
      storage: makeStorage(),
    });
    engine.setLocalState(latest);
    engine.setUser('account');
    await flush();
    expect(onStatus).toHaveBeenLastCalledWith('error', null);

    engine.refresh();
    engine.setLocalState({ ...latest, model: 'latest local edit' });
    finishLoad(null);
    await flush();

    expect(saveRemote).toHaveBeenCalledWith(expect.objectContaining({ model: 'latest local edit' }), 0);
    expect(onStatus).toHaveBeenLastCalledWith('synced', 5);
  });

  it('ignores same-user auth refreshes after sync and isolates an in-flight old account response', async () => {
    const accountA = { ...initialState('2026-09-14'), onboarded: true };
    let finishA!: (value: RemoteState | null) => void;
    const loadRemote = vi
      .fn<() => Promise<RemoteState | null>>()
      .mockImplementationOnce(() => new Promise((resolve) => (finishA = resolve)))
      .mockResolvedValueOnce(null);
    const onStatus = vi.fn();
    const applyRemote = vi.fn();
    const engine = new AutoSyncEngine({
      loadRemote,
      saveRemote: vi.fn().mockResolvedValue(1),
      applyRemote,
      onStatus,
      storage: makeStorage(),
    });
    engine.setLocalState(accountA);
    engine.setUser('account-a');
    engine.setUser('account-b');
    finishA(makeRemote({ ...accountA, records: { '2026-09-20': { cardio: 1 } } }, 9));
    await flush();

    expect(applyRemote).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith('checking', null);
    expect(loadRemote).toHaveBeenCalledTimes(2);
  });

  it('treats compare-and-swap conflicts as explicit conflicts', async () => {
    const baseline = { ...initialState('2026-09-14'), onboarded: true };
    const local = { ...baseline, model: 'edited locally' };
    const storage = makeStorage();
    storage.setItem(checkpointKey('account'), JSON.stringify({ state: baseline, revision: 1 }));
    const loadRemote = vi
      .fn<() => Promise<RemoteState | null>>()
      .mockResolvedValue(makeRemote(baseline, 1));
    const onStatus = vi.fn();
    const engine = new AutoSyncEngine({
      loadRemote,
      saveRemote: vi.fn().mockRejectedValue(new RemoteConflictError()),
      applyRemote: vi.fn(),
      onStatus,
      storage,
    });
    engine.setLocalState(local);
    engine.setUser('account');
    await flush();

    expect(onStatus).toHaveBeenLastCalledWith('conflict', 1);
  });

  it('refreshes a clean initialized client when the remote revision advances', async () => {
    const baseline = { ...initialState('2026-09-14'), onboarded: true };
    const newer = { ...baseline, records: { '2026-09-20': { cardio: 1 } } };
    const loadRemote = vi
      .fn<() => Promise<RemoteState | null>>()
      .mockResolvedValueOnce(makeRemote(baseline, 2))
      .mockResolvedValueOnce(makeRemote(newer, 3));
    const applyRemote = vi.fn();
    const engine = new AutoSyncEngine({
      loadRemote,
      saveRemote: vi.fn(),
      applyRemote,
      onStatus: vi.fn(),
    });
    engine.setLocalState(baseline);
    engine.setUser('account');
    await flush();
    engine.refresh();
    await flush();

    expect(applyRemote).toHaveBeenCalledWith(newer);
  });

  it('does not checkpoint unsynced edits before a failed upload', async () => {
    const storage = makeStorage();
    const baseline = { ...initialState('2026-09-14'), onboarded: true };
    const synced = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(null),
      saveRemote: vi.fn().mockResolvedValue(1),
      applyRemote: vi.fn(),
      onStatus: vi.fn(),
      storage,
    });
    synced.setLocalState(baseline);
    synced.setUser('account');
    await flush();

    const unsynced = { ...baseline, model: 'local unsynced edit' };
    const failedWrite = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(makeRemote(baseline, 1)),
      saveRemote: vi.fn().mockRejectedValue(new Error('offline')),
      applyRemote: vi.fn(),
      onStatus: vi.fn(),
      storage,
    });
    failedWrite.setLocalState(unsynced);
    failedWrite.setUser('account');
    await flush();

    expect(JSON.parse(storage.values.get(checkpointKey('account'))!).state).toEqual(baseline);
    const retrySave = vi.fn().mockResolvedValue(2);
    const restarted = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(makeRemote(baseline, 1)),
      saveRemote: retrySave,
      applyRemote: vi.fn(),
      onStatus: vi.fn(),
      storage,
    });
    restarted.setLocalState(unsynced);
    restarted.setUser('account');
    await flush();

    expect(retrySave).toHaveBeenCalledWith(unsynced, 1);
  });

  it('keeps the acknowledged baseline when a post-initialization upload fails', async () => {
    const storage = makeStorage();
    const baseline = { ...initialState('2026-09-14'), onboarded: true };
    const localEdit = { ...baseline, model: 'must survive restart' };
    const loadRemote = vi
      .fn<() => Promise<RemoteState | null>>()
      .mockResolvedValue(makeRemote(baseline, 1));
    const engine = new AutoSyncEngine({
      loadRemote,
      saveRemote: vi.fn().mockRejectedValue(new Error('offline')),
      applyRemote: vi.fn(),
      onStatus: vi.fn(),
      storage,
    });
    engine.setLocalState(baseline);
    engine.setUser('account');
    await flush();
    engine.setLocalState(localEdit);
    engine.refresh();
    await flush();

    expect(JSON.parse(storage.values.get(checkpointKey('account'))!).state).toEqual(baseline);
  });

  it('does not report synced when a checkpoint exists but its remote row is missing', async () => {
    const storage = makeStorage();
    const baseline = { ...initialState('2026-09-14'), onboarded: true };
    storage.setItem(checkpointKey('account'), JSON.stringify({ state: baseline, revision: 1 }));
    const saveRemote = vi.fn();
    const onStatus = vi.fn();
    const engine = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(null),
      saveRemote,
      applyRemote: vi.fn(),
      onStatus,
      storage,
    });
    engine.setLocalState(baseline);
    engine.setUser('account');
    await flush();

    expect(onStatus).toHaveBeenLastCalledWith('conflict', 1);
    expect(saveRemote).not.toHaveBeenCalled();
  });

  it('acknowledges a sent snapshot without applying over a newer local edit', async () => {
    const baseline = { ...initialState('2026-09-14'), onboarded: true };
    const sent = { ...baseline, model: 'sent snapshot' };
    const latest = { ...baseline, model: 'newer local edit' };
    let finishSave!: (revision: number) => void;
    const applyRemote = vi.fn();
    const engine = new AutoSyncEngine({
      loadRemote: vi.fn().mockResolvedValue(makeRemote(baseline, 1)),
      saveRemote: vi.fn<
        (state: AppState, expectedRevision: number) => Promise<number>
      >(() => new Promise<number>((resolve) => (finishSave = resolve))),
      applyRemote,
      onStatus: vi.fn(),
      storage: makeStorage(),
    });
    engine.setLocalState(baseline);
    engine.setUser('account');
    await flush();
    engine.setLocalState(sent);
    engine.refresh();
    await flush();
    engine.setLocalState(latest);
    finishSave(2);
    await flush();

    expect(applyRemote).not.toHaveBeenCalled();
  });
});
