// @vitest-environment jsdom
import React, { StrictMode, act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppState } from './domain';

const mocks = vi.hoisted(() => ({
  authHandler: undefined as ((event: string, session: { user: { id: string } } | null) => void) | undefined,
  getCurrentSession: vi.fn(),
  loadRemoteState: vi.fn(),
  saveRemoteState: vi.fn(),
}));

vi.mock('./supabase-auth', () => ({
  isSupabaseAuthConfigured: () => true,
  getCurrentSession: mocks.getCurrentSession,
  subscribeToAuthChanges: (handler: typeof mocks.authHandler) => {
    mocks.authHandler = handler;
    return vi.fn();
  },
}));

vi.mock('./supabase-repository', () => ({
  RemoteConflictError: class RemoteConflictError extends Error {},
  loadRemoteState: mocks.loadRemoteState,
  saveRemoteState: mocks.saveRemoteState,
}));

import { useAutoSync } from './auto-sync';

let root: Root;
let status: ReturnType<typeof useAutoSync>;

function Harness({ initial, strict = false }: { initial: AppState; strict?: boolean }) {
  const [state, setState] = useState<AppState | null>(initial);
  status = useAutoSync({ state, setState });
  return null;
}

async function render(initial: AppState, strict = false) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(strict ? React.createElement(StrictMode, null, React.createElement(Harness, { initial })) : React.createElement(Harness, { initial }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.authHandler = undefined;
  mocks.getCurrentSession.mockResolvedValue(null);
  mocks.loadRemoteState.mockResolvedValue(null);
  mocks.saveRemoteState.mockResolvedValue(1);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(async () => {
  if (root)
    await act(async () => {
      root.unmount();
    });
  document.body.replaceChildren();
});

describe('useAutoSync lifecycle', () => {
  it('settles an initially signed-out session as disabled', async () => {
    await render(initialState('2026-09-14'));
    expect(status.status).toBe('disabled');
    expect(mocks.loadRemoteState).not.toHaveBeenCalled();
  });

  it('keeps synced status through same-user SIGNED_IN and TOKEN_REFRESHED events', async () => {
    const state = initialState('2026-09-14');
    mocks.getCurrentSession.mockResolvedValue({ user: { id: 'same-user' } });
    mocks.loadRemoteState.mockResolvedValue({
      state,
      schemaVersion: 1,
      revision: 4,
      updatedAt: '2026-09-20T12:00:00Z',
    });
    await render(state);
    expect(status.status).toBe('synced');

    await act(async () => {
      mocks.authHandler?.('SIGNED_IN', { user: { id: 'same-user' } });
      mocks.authHandler?.('TOKEN_REFRESHED', { user: { id: 'same-user' } });
      await Promise.resolve();
    });

    expect(status.status).toBe('synced');
    expect(mocks.loadRemoteState).toHaveBeenCalledTimes(1);
  });

  it('keeps conflict status through same-user token refreshes', async () => {
    const local = { ...initialState('2026-09-14'), onboarded: true };
    const remote = { ...local, records: { '2026-09-20': { cardio: 1 } } };
    mocks.getCurrentSession.mockResolvedValue({ user: { id: 'same-user' } });
    mocks.loadRemoteState.mockResolvedValue({
      state: remote,
      schemaVersion: 1,
      revision: 4,
      updatedAt: '2026-09-20T12:00:00Z',
    });
    await render(local);
    expect(status.status).toBe('conflict');

    await act(async () => {
      mocks.authHandler?.('TOKEN_REFRESHED', { user: { id: 'same-user' } });
      await Promise.resolve();
    });

    expect(status.status).toBe('conflict');
    expect(mocks.loadRemoteState).toHaveBeenCalledTimes(1);
  });

  it('completes startup through React StrictMode effect teardown and setup', async () => {
    const state = initialState('2026-09-14');
    mocks.getCurrentSession.mockResolvedValue({ user: { id: 'same-user' } });
    mocks.loadRemoteState.mockResolvedValue({
      state,
      schemaVersion: 1,
      revision: 7,
      updatedAt: '2026-09-20T12:00:00Z',
    });
    await render(state, true);

    expect(status.status).toBe('synced');
    expect(mocks.loadRemoteState).toHaveBeenCalled();
  });
});
