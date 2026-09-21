import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => {
  const auth = {
    signInWithOtp: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  };
  return {
    configured: true,
    client: { auth },
    auth,
  };
});

vi.mock('./supabase-client', () => ({
  get supabaseConfigured() {
    return mocks.configured;
  },
  get supabase() {
    return mocks.configured ? mocks.client : null;
  },
}));

async function loadAuth() {
  vi.resetModules();
  return import('./supabase-auth');
}

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: 1890000000,
  token_type: 'bearer',
  user: { id: 'user-1', email: 'warrior@example.test' },
} as unknown as Session;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured = true;
  mocks.auth.getSession.mockResolvedValue({ data: { session }, error: null });
  mocks.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
  mocks.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe('Supabase auth service', () => {
  it('reports missing configuration and fails clearly without calling the client', async () => {
    mocks.configured = false;
    const auth = await loadAuth();

    expect(auth.isSupabaseAuthConfigured()).toBe(false);
    await expect(auth.requestMagicLink('warrior@example.test')).rejects.toThrow(
      'Supabase no esta configurado',
    );
    await expect(auth.getCurrentSession()).rejects.toThrow('Supabase no esta configurado');
    await expect(auth.getCurrentUser()).rejects.toThrow('Supabase no esta configurado');
    await expect(auth.signOut()).rejects.toThrow('Supabase no esta configurado');
    expect(() => auth.subscribeToAuthChanges(vi.fn())).toThrow('Supabase no esta configurado');
    expect(mocks.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(mocks.auth.getSession).not.toHaveBeenCalled();
  });

  it('requests a magic link with the explicit redirect and normalized email', async () => {
    const auth = await loadAuth();

    await auth.requestMagicLink('  warrior@example.test  ', 'https://app.example.test/auth');

    expect(mocks.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'warrior@example.test',
      options: { emailRedirectTo: 'https://app.example.test/auth' },
    });
  });

  it('uses the current origin when available and omits redirect in non-browser runtimes', async () => {
    const auth = await loadAuth();
    vi.stubGlobal('window', { location: { origin: 'https://local.example.test' } });

    await auth.requestMagicLink('warrior@example.test');
    expect(mocks.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'warrior@example.test',
      options: { emailRedirectTo: 'https://local.example.test' },
    });

    vi.unstubAllGlobals();
    await auth.requestMagicLink('warrior@example.test');
    expect(mocks.auth.signInWithOtp).toHaveBeenLastCalledWith({
      email: 'warrior@example.test',
    });
  });

  it('caches an existing session for session and user reads', async () => {
    const auth = await loadAuth();

    await expect(auth.getCurrentSession()).resolves.toEqual(session);
    await expect(auth.getCurrentSession()).resolves.toEqual(session);
    await expect(auth.getCurrentUser()).resolves.toEqual(session.user);
    expect(mocks.auth.getSession).toHaveBeenCalledOnce();
  });

  it('caches an absent user without repeating the session request', async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const auth = await loadAuth();

    await expect(auth.getCurrentSession()).resolves.toBeNull();
    await expect(auth.getCurrentUser()).resolves.toBeNull();
    expect(mocks.auth.getSession).toHaveBeenCalledOnce();
  });

  it('signs out and clears the cached session', async () => {
    const auth = await loadAuth();

    await auth.getCurrentSession();
    await auth.signOut();
    expect(mocks.auth.signOut).toHaveBeenCalledOnce();
    mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(auth.getCurrentSession()).resolves.toBeNull();
    expect(mocks.auth.getSession).toHaveBeenCalledOnce();
  });

  it('subscribes, updates the cache, forwards events, and unsubscribes', async () => {
    const unsubscribe = vi.fn();
    mocks.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
    const auth = await loadAuth();
    const handler = vi.fn();
    const stop = auth.subscribeToAuthChanges(handler);
    const callback = mocks.auth.onAuthStateChange.mock.calls[0][0] as (
      event: AuthChangeEvent,
      session: Session | null,
    ) => void;

    callback('SIGNED_IN', session);
    expect(handler).toHaveBeenCalledWith('SIGNED_IN', session);
    await expect(auth.getCurrentUser()).resolves.toEqual(session.user);
    expect(mocks.auth.getSession).not.toHaveBeenCalled();
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it.each([
    ['requestMagicLink', () => mocks.auth.signInWithOtp.mockResolvedValue({ error: new Error('otp failed') })],
    ['getCurrentSession', () => mocks.auth.getSession.mockRejectedValue(new Error('session failed'))],
    ['signOut', () => mocks.auth.signOut.mockResolvedValue({ error: new Error('signout failed') })],
  ])('propagates %s errors', async (method, configureFailure) => {
    configureFailure();
    const auth = await loadAuth();

    if (method === 'requestMagicLink')
      await expect(auth.requestMagicLink('warrior@example.test')).rejects.toThrow('otp failed');
    if (method === 'getCurrentSession')
      await expect(auth.getCurrentSession()).rejects.toThrow('session failed');
    if (method === 'signOut') await expect(auth.signOut()).rejects.toThrow('signout failed');
  });
});
