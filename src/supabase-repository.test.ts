import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from './domain';

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  const client = {
    from: vi.fn(() => query),
    rpc: vi.fn(),
  };
  return { configured: true, client, query };
});

vi.mock('./supabase-client', () => ({
  get supabase() {
    return mocks.configured ? mocks.client : null;
  },
}));

async function loadRepository() {
  vi.resetModules();
  return import('./supabase-repository');
}

const state = initialState('2026-09-14');

beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured = true;
  mocks.query.select.mockReturnValue(mocks.query);
  mocks.query.maybeSingle.mockResolvedValue({
    data: {
      state,
      schema_version: 1,
      revision: '4',
      updated_at: '2026-09-20T12:00:00Z',
    },
    error: null,
  });
  mocks.client.rpc.mockResolvedValue({ data: 5, error: null });
});

describe('Supabase remote repository', () => {
  it('is disabled and fails clearly when the nullable client is absent', async () => {
    mocks.configured = false;
    const repository = await loadRepository();

    expect(repository.isRemoteRepositoryConfigured()).toBe(false);
    await expect(repository.loadRemoteState()).rejects.toThrow('Supabase no esta configurado');
    await expect(repository.saveRemoteState(state, 0)).rejects.toThrow(
      'Supabase no esta configurado',
    );
    expect(mocks.client.from).not.toHaveBeenCalled();
    expect(mocks.client.rpc).not.toHaveBeenCalled();
  });

  it('loads and validates a remote row', async () => {
    const repository = await loadRepository();

    await expect(repository.loadRemoteState()).resolves.toEqual({
      state,
      schemaVersion: 1,
      revision: 4,
      updatedAt: '2026-09-20T12:00:00Z',
    });
    expect(mocks.client.from).toHaveBeenCalledWith('forja_states');
    expect(mocks.query.select).toHaveBeenCalledWith(
      'state, schema_version, revision, updated_at',
    );
    expect(mocks.query.maybeSingle).toHaveBeenCalledOnce();
  });

  it('returns null when the user has no remote row', async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    const repository = await loadRepository();

    await expect(repository.loadRemoteState()).resolves.toBeNull();
  });

  it('rejects invalid remote state before returning it', async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: {
        state: { schema: 2 },
        schema_version: 1,
        revision: 4,
        updated_at: '2026-09-20T12:00:00Z',
      },
      error: null,
    });
    const repository = await loadRepository();

    await expect(repository.loadRemoteState()).rejects.toThrow();
  });

  it('rejects an invalid remote update timestamp', async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: {
        state,
        schema_version: 1,
        revision: 4,
        updated_at: 'not-a-date',
      },
      error: null,
    });
    const repository = await loadRepository();

    await expect(repository.loadRemoteState()).rejects.toThrow(
      'fecha de actualizacion valida',
    );
  });

  it('propagates remote load errors', async () => {
    const failure = new Error('network failed');
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: failure });
    const repository = await loadRepository();

    await expect(repository.loadRemoteState()).rejects.toBe(failure);
  });

  it('validates state and revision before calling the RPC', async () => {
    const repository = await loadRepository();

    await expect(repository.saveRemoteState({ ...state, habits: [] }, 0)).rejects.toThrow();
    await expect(repository.saveRemoteState(state, -1)).rejects.toThrow();
    await expect(repository.saveRemoteState(state, 1.5)).rejects.toThrow();
    expect(mocks.client.rpc).not.toHaveBeenCalled();
  });

  it('saves through the RPC and returns the new revision', async () => {
    const repository = await loadRepository();

    await expect(repository.saveRemoteState(state, 4)).resolves.toBe(5);
    expect(mocks.client.rpc).toHaveBeenCalledWith('save_forja_state', {
      p_state: state,
      p_schema_version: 1,
      p_expected_revision: 4,
    });
  });

  it('converts SQL conflicts to an identifiable error', async () => {
    mocks.client.rpc.mockResolvedValue({
      data: null,
      error: { code: '40001', message: 'forja_conflict' },
    });
    const repository = await loadRepository();

    await expect(repository.saveRemoteState(state, 4)).rejects.toBeInstanceOf(
      repository.RemoteConflictError,
    );
    await expect(repository.saveRemoteState(state, 4)).rejects.toMatchObject({
      code: 'forja_conflict',
      message: 'forja_conflict',
    });
  });

  it('propagates non-conflict RPC errors unchanged', async () => {
    const failure = new Error('backend unavailable');
    mocks.client.rpc.mockResolvedValue({ data: null, error: failure });
    const repository = await loadRepository();

    await expect(repository.saveRemoteState(state, 4)).rejects.toBe(failure);
  });
});
