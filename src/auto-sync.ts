import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { initialState, type AppState } from './domain';
import { getCurrentSession, isSupabaseAuthConfigured, subscribeToAuthChanges } from './supabase-auth';
import {
  loadRemoteState,
  RemoteConflictError,
  saveRemoteState,
  type RemoteState,
} from './supabase-repository';

export type AutoSyncStatus = 'disabled' | 'checking' | 'syncing' | 'synced' | 'conflict' | 'error';
export type AutoSyncState = { status: AutoSyncStatus; revision: number | null; message: string };

type SyncResolutionDetail = { state: AppState; revision: number };
type AutoSyncOptions = {
  state: AppState | null;
  setState: Dispatch<SetStateAction<AppState | null>>;
  notify?: (message: string) => void;
};

const SYNC_DEBOUNCE_MS = 1200;
const SYNC_POLL_MS = 30000;
const RESOLUTION_EVENT = 'forja-sync-resolved';

function serialize(state: AppState): string {
  return JSON.stringify(state);
}

function isDefaultState(state: AppState): boolean {
  return serialize(state) === serialize(initialState(state.cycleStart));
}

function statusMessage(status: AutoSyncStatus): string {
  if (status === 'checking') return 'Comprobando sincronización';
  if (status === 'syncing') return 'Sincronizando';
  if (status === 'synced') return 'Sincronizado';
  if (status === 'conflict') return 'Conflicto remoto';
  if (status === 'error') return 'Error de sincronización';
  return '';
}

export function markAutoSyncResolved(state: AppState, revision: number) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent<SyncResolutionDetail>(RESOLUTION_EVENT, { detail: { state, revision } }));
}

export function useAutoSync({ state, setState, notify }: AutoSyncOptions): AutoSyncState {
  const configured = isSupabaseAuthConfigured();
  const [userId, setUserId] = useState<string | null>(null);
  const [sync, setSync] = useState<AutoSyncState>({
    status: configured ? 'checking' : 'disabled',
    revision: null,
    message: statusMessage(configured ? 'checking' : 'disabled'),
  });
  const latestState = useRef<AppState | null>(state),
    mounted = useRef(true),
    userRef = useRef<string | null>(null),
    revisionRef = useRef<number | null>(null),
    baselineRef = useRef<string | null>(null),
    readyRef = useRef(false),
    conflictRef = useRef<RemoteState | null>(null),
    applyingRemote = useRef(false),
    initializedUser = useRef<string | null>(null),
    uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    conflictNotified = useRef(false);

  const updateStatus = (status: AutoSyncStatus, revision = revisionRef.current) =>
    mounted.current && setSync({ status, revision, message: statusMessage(status) });

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  useEffect(() => {
    latestState.current = state;
  }, [state]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const changeUser = (next: string | null) => {
      if (!active) return;
      if (next !== userRef.current) {
        userRef.current = next;
        initializedUser.current = null;
        revisionRef.current = null;
        baselineRef.current = null;
        readyRef.current = false;
        conflictRef.current = null;
        conflictNotified.current = false;
      }
      setUserId(next);
      updateStatus(next ? 'checking' : 'disabled', null);
    };
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToAuthChanges((_event, session) => changeUser(session?.user.id ?? null));
      getCurrentSession()
        .then((session) => changeUser(session?.user.id ?? null))
        .catch(() => updateStatus('error', null));
    } catch {
      updateStatus('error', null);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [configured]);

  useEffect(() => {
    if (!userId || !state || initializedUser.current === userId) return;
    let cancelled = false;
    initializedUser.current = userId;
    updateStatus('checking', null);
    const initialize = async () => {
      try {
        const remote = await loadRemoteState();
        if (cancelled || userRef.current !== userId) return;
        if (!remote) {
          updateStatus('syncing', 0);
          const revision = await saveRemoteState(state, 0);
          if (cancelled || userRef.current !== userId) return;
          revisionRef.current = revision;
          baselineRef.current = serialize(state);
          readyRef.current = true;
          updateStatus('synced', revision);
          return;
        }
        const localSerialized = serialize(state);
        if (localSerialized === serialize(remote.state)) {
          revisionRef.current = remote.revision;
          baselineRef.current = localSerialized;
          readyRef.current = true;
          updateStatus('synced', remote.revision);
        } else if (isDefaultState(state)) {
          applyingRemote.current = true;
          setState(remote.state);
          applyingRemote.current = false;
          revisionRef.current = remote.revision;
          baselineRef.current = serialize(remote.state);
          readyRef.current = true;
          updateStatus('synced', remote.revision);
        } else {
          conflictRef.current = remote;
          readyRef.current = false;
          updateStatus('conflict', remote.revision);
          if (!conflictNotified.current) {
            conflictNotified.current = true;
            notify?.('Hay cambios locales y remotos distintos. Revisa Ajustes para elegir cuál conservar.');
          }
        }
      } catch {
        if (!cancelled && userRef.current === userId) updateStatus('error');
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [state, setState, userId]);

  useEffect(() => {
    if (!userId || !state || !readyRef.current || applyingRemote.current || conflictRef.current) return;
    const current = serialize(state);
    if (current === baselineRef.current) return;
    if (uploadTimer.current) clearTimeout(uploadTimer.current);
    uploadTimer.current = setTimeout(async () => {
      const expectedRevision = revisionRef.current;
      const currentState = latestState.current;
      if (expectedRevision === null || !currentState || userRef.current !== userId) return;
      updateStatus('syncing', expectedRevision);
      try {
        const revision = await saveRemoteState(currentState, expectedRevision);
        if (userRef.current !== userId) return;
        revisionRef.current = revision;
        baselineRef.current = serialize(currentState);
        updateStatus('synced', revision);
      } catch (error) {
        if (userRef.current !== userId) return;
        conflictRef.current = error instanceof RemoteConflictError ? await loadRemoteState().catch(() => null) : null;
        updateStatus(error instanceof RemoteConflictError ? 'conflict' : 'error');
        if (error instanceof RemoteConflictError && !conflictNotified.current) {
          conflictNotified.current = true;
          notify?.('Los datos remotos cambiaron en otro dispositivo. Revisa Ajustes antes de continuar.');
        }
      }
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (uploadTimer.current) clearTimeout(uploadTimer.current);
    };
  }, [state, userId, notify]);

  useEffect(() => {
    const refresh = async () => {
      if (!userId || !readyRef.current || conflictRef.current) return;
      const remote = await loadRemoteState().catch(() => null);
      if (!remote || userRef.current !== userId || remote.revision <= (revisionRef.current ?? 0)) return;
      const local = latestState.current;
      if (!local || serialize(local) !== baselineRef.current) {
        conflictRef.current = remote;
        updateStatus('conflict', remote.revision);
        if (!conflictNotified.current) {
          conflictNotified.current = true;
          notify?.('Hay cambios remotos pendientes. Revisa Ajustes para resolverlos.');
        }
        return;
      }
      applyingRemote.current = true;
      setState(remote.state);
      applyingRemote.current = false;
      revisionRef.current = remote.revision;
      baselineRef.current = serialize(remote.state);
      updateStatus('synced', remote.revision);
    };
    if (!userId) return;
    const interval = setInterval(() => void refresh(), SYNC_POLL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [setState, userId, notify]);

  useEffect(() => {
    const resolve = (event: Event) => {
      const detail = (event as CustomEvent<SyncResolutionDetail>).detail;
      if (!detail || !userRef.current) return;
      conflictRef.current = null;
      conflictNotified.current = false;
      revisionRef.current = detail.revision;
      baselineRef.current = serialize(detail.state);
      readyRef.current = true;
      updateStatus('synced', detail.revision);
    };
    window.addEventListener(RESOLUTION_EVENT, resolve);
    return () => window.removeEventListener(RESOLUTION_EVENT, resolve);
  }, []);

  useEffect(() => () => {
    if (uploadTimer.current) clearTimeout(uploadTimer.current);
  }, []);

  return sync;
}
