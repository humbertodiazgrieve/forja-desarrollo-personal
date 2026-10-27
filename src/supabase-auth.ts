import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase-client';

export type AuthStateHandler = (event: AuthChangeEvent, session: Session | null) => void;

const notConfiguredMessage =
  'Supabase no esta configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.';

let cachedSession: Session | null | undefined;
let sessionRequest: Promise<Session | null> | null = null;

export function isSupabaseAuthConfigured(): boolean {
  return supabaseConfigured && supabase !== null;
}

function requireClient() {
  if (!isSupabaseAuthConfigured()) throw new Error(notConfiguredMessage);
  return supabase!;
}

function defaultRedirectTo(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.location.origin;
}

export async function requestMagicLink(email: string, redirectTo?: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);

  const client = requireClient();
  const emailRedirectTo = redirectTo?.trim() || defaultRedirectTo();
  const options = emailRedirectTo ? { emailRedirectTo } : undefined;
  const { error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    ...(options ? { options } : {}),
  });
  if (error) throw error;
}

export function normalizeEmail(email: string): string {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) throw new Error('El email es obligatorio.');
  return normalizedEmail;
}

export function normalizeEmailOtpToken(token: string): string {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new Error('El código es obligatorio.');
  if (!/^\d+$/.test(normalizedToken)) throw new Error('El código debe contener solo números.');
  return normalizedToken;
}

export async function verifyEmailCode(email: string, token: string): Promise<Session> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedToken = normalizeEmailOtpToken(token);
  const { data, error } = await requireClient().auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'email',
  });
  if (error) throw error;
  if (!data.session) throw new Error('Supabase no devolvió una sesión para este código.');
  cachedSession = data.session;
  return data.session;
}

export async function getCurrentSession(): Promise<Session | null> {
  if (cachedSession !== undefined) return cachedSession;
  if (sessionRequest) return sessionRequest;

  const client = requireClient();
  sessionRequest = client.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) throw error;
      cachedSession = data.session;
      return cachedSession;
    })
    .finally(() => {
      sessionRequest = null;
    });
  return sessionRequest;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function signOut(): Promise<void> {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
  cachedSession = null;
}

export function subscribeToAuthChanges(handler: AuthStateHandler): () => void {
  const {
    data: { subscription },
  } = requireClient().auth.onAuthStateChange((event, session) => {
    cachedSession = session;
    handler(event, session);
  });
  return () => subscription.unsubscribe();
}
