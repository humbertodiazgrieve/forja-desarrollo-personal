import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AppState } from './domain';
import { getCurrentSession, isSupabaseAuthConfigured, subscribeToAuthChanges } from './supabase-auth';
import { loadRemoteState, saveRemoteState } from './supabase-repository';
import { AutoSyncEngine } from './auto-sync-engine';

export type AutoSyncStatus = 'disabled' | 'checking' | 'syncing' | 'synced' | 'conflict' | 'error';
export type AutoSyncState = { status: AutoSyncStatus; revision: number | null; message: string };

type SyncResolutionDetail = { state: AppState; revision: number; source: 'download' | 'upload' };
type AutoSyncOptions = {
  state: AppState | null;
  setState: Dispatch<SetStateAction<AppState | null>>;
  notify?: (message: string) => void;
};

const SYNC_POLL_MS = 30000;
const RESOLUTION_EVENT = 'forja-sync-resolved';

function getBrowserStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function statusMessage(status: AutoSyncStatus): string {
  if (status === 'checking') return 'Comprobando sincronización';
  if (status === 'syncing') return 'Sincronizando';
  if (status === 'synced') return 'Sincronizado';
  if (status === 'conflict') return 'Conflicto remoto';
  if (status === 'error') return 'Error de sincronización';
  return '';
}

export function markAutoSyncResolved(
  state: AppState,
  revision: number,
  source: 'download' | 'upload' = 'upload',
) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent<SyncResolutionDetail>(RESOLUTION_EVENT, { detail: { state, revision, source } }),
    );
}

export function useAutoSync({ state, setState, notify }: AutoSyncOptions): AutoSyncState {
  const configured = isSupabaseAuthConfigured();
  const [sync, setSync] = useState<AutoSyncState>({
    status: configured ? 'checking' : 'disabled',
    revision: null,
    message: statusMessage(configured ? 'checking' : 'disabled'),
  });
  const mounted = useRef(false);
  const setStateRef = useRef(setState);
  const notifyRef = useRef(notify);
  setStateRef.current = setState;
  notifyRef.current = notify;
  const engineRef = useRef<AutoSyncEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AutoSyncEngine({
      loadRemote: loadRemoteState,
      saveRemote: saveRemoteState,
      applyRemote: (remoteState) => setStateRef.current(remoteState),
      onStatus: (status, revision) => {
        if (mounted.current)
          setSync({ status, revision, message: statusMessage(status) });
      },
      notify: (message) => notifyRef.current?.(message),
      storage: getBrowserStorage(),
    });
  }
  const engine = engineRef.current;

  useEffect(() => {
    mounted.current = true;
    engine.start();
    return () => {
      mounted.current = false;
      engine.stop();
    };
  }, [engine]);

  useEffect(() => {
    engine.setLocalState(state);
  }, [engine, state]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    let knownUserId: string | null | undefined;
    const changeUser = (nextUserId: string | null) => {
      if (!active) return;
      if (nextUserId === knownUserId) return;
      knownUserId = nextUserId;
      engine.setUser(nextUserId);
      if (!nextUserId && mounted.current)
        setSync({ status: 'disabled', revision: null, message: '' });
    };
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToAuthChanges((_event, session) =>
        changeUser(session?.user.id ?? null),
      );
      getCurrentSession()
        .then((session) => changeUser(session?.user.id ?? null))
        .catch(() => {
          if (active && mounted.current)
            setSync({ status: 'error', revision: null, message: statusMessage('error') });
        });
    } catch {
      if (mounted.current)
        setSync({ status: 'error', revision: null, message: statusMessage('error') });
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [configured, engine]);

  useEffect(() => {
    if (!configured) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') engine.refresh();
    };
    const interval = setInterval(refresh, SYNC_POLL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [configured, engine]);

  useEffect(() => {
    const resolve = (event: Event) => {
      const detail = (event as CustomEvent<SyncResolutionDetail>).detail;
      if (detail) engine.resolve(detail.state, detail.revision, detail.source);
    };
    window.addEventListener(RESOLUTION_EVENT, resolve);
    return () => window.removeEventListener(RESOLUTION_EVENT, resolve);
  }, [engine]);

  return sync;
}
