import { initialState, validateState, type AppState } from './domain';
import { RemoteConflictError, type RemoteState } from './supabase-repository';

type Checkpoint = { state: AppState; revision: number };
type Dependencies = {
  loadRemote: () => Promise<RemoteState | null>;
  saveRemote: (state: AppState, expectedRevision: number) => Promise<number>;
  applyRemote: (state: AppState) => void;
  onStatus: (status: 'checking' | 'syncing' | 'synced' | 'conflict' | 'error', revision: number | null) => void;
  notify?: (message: string) => void;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
};

const DEBOUNCE_MS = 1200;
const CHECKPOINT_PREFIX = 'forja-sync-checkpoint-v1:';

function serialize(state: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
      );
    return value;
  };
  return JSON.stringify(canonical(state));
}

function isDefaultState(state: AppState): boolean {
  const withoutGeneratedIds = (value: AppState) => ({
    ...value,
    habits: value.habits.map(({ versionId: _versionId, ...habit }) => habit),
  });
  return serialize(withoutGeneratedIds(state)) === serialize(withoutGeneratedIds(initialState(state.cycleStart)));
}

export function checkpointKey(userId: string): string {
  return `${CHECKPOINT_PREFIX}${encodeURIComponent(userId)}`;
}

export class AutoSyncEngine {
  private userId: string | null = null;
  private generation = 0;
  private latest: AppState | null = null;
  private baseline: string | null = null;
  private revision: number | null = null;
  private initialized = false;
  private conflicted = false;
  private conflictNotified = false;
  private running: Promise<void> | null = null;
  private rerunAfterCurrent = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly dependencies: Dependencies) {}

  setLocalState(state: AppState | null) {
    this.latest = state;
    if (state && this.userId && !this.initialized && !this.conflicted && !this.running)
      this.requestRun(false);
    else if (state && this.initialized && !this.conflicted && serialize(state) !== this.baseline) {
      this.dependencies.onStatus('syncing', this.revision);
      this.requestRun(true);
    }
  }

  setUser(userId: string | null) {
    if (userId === this.userId) return;
    this.generation++;
    this.clearTimer();
    this.userId = userId;
    this.baseline = null;
    this.revision = null;
    this.initialized = false;
    this.conflicted = false;
    this.conflictNotified = false;
    if (userId) this.dependencies.onStatus('checking', null);
    if (userId && this.latest) this.requestRun(false);
  }

  refresh() {
    if (this.userId && this.latest && !this.conflicted) this.requestRun(false);
  }

  resolve(state: AppState, revision: number, source: 'download' | 'upload' = 'upload') {
    if (!this.userId) return;
    this.generation++;
    this.clearTimer();
    this.conflicted = false;
    this.conflictNotified = false;
    if (source === 'download') this.latest = state;
    this.baseline = serialize(state);
    this.revision = revision;
    this.initialized = true;
    this.persistCheckpoint(state, revision);
    this.dependencies.onStatus('syncing', revision);
    if (this.running) this.rerunAfterCurrent = true;
    else if (this.latest) this.requestRun(false);
  }

  stop() {
    this.stopped = true;
    this.generation++;
    this.clearTimer();
  }

  start() {
    this.stopped = false;
    if (this.userId && this.latest && !this.initialized && !this.conflicted) this.requestRun(false);
  }

  private requestRun(debounce: boolean) {
    if (this.stopped) return;
    if (this.timer) this.clearTimer();
    if (debounce) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.run();
      }, DEBOUNCE_MS);
    } else void this.run();
  }

  private async run() {
    if (this.running) {
      this.rerunAfterCurrent = true;
      return this.running;
    }
    const userId = this.userId;
    if (!userId || !this.latest || this.stopped || this.conflicted) return;
    const generation = this.generation;
    this.running = this.runForUser(userId, generation).finally(() => {
      this.running = null;
      if (this.rerunAfterCurrent) {
        this.rerunAfterCurrent = false;
        this.clearTimer();
        void this.run();
      }
    });
    return this.running;
  }

  private isCurrent(userId: string, generation: number) {
    return !this.stopped && this.userId === userId && this.generation === generation;
  }

  private async runForUser(userId: string, generation: number) {
    this.dependencies.onStatus(this.initialized ? 'syncing' : 'checking', this.revision);
    try {
      const remote = await this.dependencies.loadRemote();
      if (!this.isCurrent(userId, generation)) return;
      const local = this.latest;
      if (!local) return;

      if (this.initialized) {
        const localChanged = serialize(local) !== this.baseline;
        if (!remote) {
          this.setConflict('Los datos remotos ya no están disponibles. Revisa Ajustes antes de continuar.');
          return;
        }
        const remoteChanged = serialize(remote.state) !== this.baseline;
        if (serialize(local) === serialize(remote.state)) {
          this.accept(remote.state, remote.revision);
          return;
        }
        if (!localChanged && remoteChanged) {
          this.accept(remote.state, remote.revision);
          return;
        }
        if (localChanged && remoteChanged) {
          this.raiseConflict(remote, 'Hay cambios locales y remotos distintos. Revisa Ajustes para elegir cuál conservar.');
          return;
        }
        this.revision = remote.revision;
        this.persistCheckpoint(remote.state, remote.revision);
      }

      if (!this.initialized) {
        const checkpoint = this.readCheckpoint(userId);
        if (remote && serialize(local) === serialize(remote.state)) {
          this.accept(remote.state, remote.revision);
          return;
        }
        if (remote && checkpoint) {
          const localChanged = serialize(local) !== serialize(checkpoint.state);
          const remoteChanged = serialize(remote.state) !== serialize(checkpoint.state);
          if (!localChanged && remoteChanged) {
            this.accept(remote.state, remote.revision);
            return;
          }
          if (localChanged && remoteChanged) {
            this.raiseConflict(remote, 'Hay cambios locales y remotos distintos. Revisa Ajustes para elegir cuál conservar.');
            return;
          }
          this.baseline = serialize(checkpoint.state);
          this.revision = remote.revision;
        } else if (remote && !isDefaultState(local)) {
          this.raiseConflict(remote, 'Hay cambios locales y remotos distintos. Revisa Ajustes para elegir cuál conservar.');
          return;
        } else if (remote) {
          this.accept(remote.state, remote.revision);
          return;
        } else if (checkpoint) {
          this.revision = checkpoint.revision;
          this.setConflict('Los datos remotos asociados a esta cuenta ya no existen. Revisa Ajustes antes de continuar.');
          return;
        } else {
          this.baseline = null;
          this.revision = 0;
        }
        this.initialized = true;
      }

      const current = this.latest;
      if (!current) return;
      if (serialize(current) === this.baseline) {
        this.dependencies.onStatus('synced', this.revision);
        return;
      }
      const expectedRevision = this.revision;
      if (expectedRevision === null) return;
      this.dependencies.onStatus('syncing', expectedRevision);
      const savedRevision = await this.dependencies.saveRemote(current, expectedRevision);
      if (!this.isCurrent(userId, generation)) return;
      this.acknowledge(current, savedRevision);
    } catch (error) {
      if (!this.isCurrent(userId, generation)) return;
      if (error instanceof RemoteConflictError) {
        const remote = await this.dependencies.loadRemote().catch(() => null);
        if (!this.isCurrent(userId, generation)) return;
        if (remote && this.latest && serialize(this.latest) === serialize(remote.state))
          this.accept(remote.state, remote.revision);
        else if (remote)
          this.raiseConflict(remote, 'Los datos remotos cambiaron en otro dispositivo. Revisa Ajustes antes de continuar.');
        else this.dependencies.onStatus('conflict', this.revision);
      } else this.dependencies.onStatus('error', this.revision);
    }
  }

  private accept(state: AppState, revision: number) {
    const changed = !this.latest || serialize(this.latest) !== serialize(state);
    this.baseline = serialize(state);
    this.revision = revision;
    this.initialized = true;
    this.conflicted = false;
    this.persistCheckpoint(state, revision);
    if (changed) {
      this.latest = state;
      this.dependencies.applyRemote(state);
    }
    this.dependencies.onStatus('synced', revision);
  }

  private acknowledge(state: AppState, revision: number) {
    this.baseline = serialize(state);
    this.revision = revision;
    this.initialized = true;
    this.persistCheckpoint(state, revision);
    if (this.latest && serialize(this.latest) !== this.baseline) {
      this.dependencies.onStatus('syncing', revision);
      this.requestRun(true);
    } else this.dependencies.onStatus('synced', revision);
  }

  private raiseConflict(remote: RemoteState, message: string) {
    this.conflicted = true;
    this.initialized = false;
    this.dependencies.onStatus('conflict', remote.revision);
    this.notifyConflict(message);
  }

  private setConflict(message: string) {
    this.conflicted = true;
    this.initialized = false;
    this.dependencies.onStatus('conflict', this.revision);
    this.notifyConflict(message);
  }

  private notifyConflict(message: string) {
    if (!this.conflictNotified) {
      this.conflictNotified = true;
      this.dependencies.notify?.(message);
    }
  }

  private readCheckpoint(userId: string): Checkpoint | null {
    try {
      const raw = this.dependencies.storage?.getItem(checkpointKey(userId));
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') return null;
      const candidate = value as Partial<Checkpoint>;
      if (!candidate.state || !Number.isSafeInteger(candidate.revision) || candidate.revision! < 0)
        return null;
      return { state: validateState(candidate.state), revision: candidate.revision! };
    } catch {
      return null;
    }
  }

  private persistCheckpoint(state: AppState, revision: number) {
    if (!this.userId) return;
    try {
      this.dependencies.storage?.setItem(
        checkpointKey(this.userId),
        JSON.stringify({ state, revision } satisfies Checkpoint),
      );
    } catch {
      // Sync remains usable when browser storage is unavailable.
    }
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
