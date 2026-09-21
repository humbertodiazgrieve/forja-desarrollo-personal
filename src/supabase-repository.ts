import type { AppState } from './domain';
import { validateState } from './domain';
import { supabase } from './supabase-client';

export type RemoteState = {
  state: AppState;
  schemaVersion: number;
  revision: number;
  updatedAt: string;
};

export class RemoteConflictError extends Error {
  readonly code = 'forja_conflict';

  constructor() {
    super('forja_conflict');
    this.name = 'RemoteConflictError';
  }
}

type RemoteRow = {
  state: unknown;
  schema_version: unknown;
  revision: unknown;
  updated_at: unknown;
};

export function isRemoteRepositoryConfigured(): boolean {
  return supabase !== null;
}

function requireClient() {
  if (!supabase) {
    throw new Error(
      'Supabase no esta configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  return supabase;
}

function parseRevision(value: unknown): number {
  const revision = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('La respuesta remota contiene una revision invalida.');
  return revision;
}

function parseSchemaVersion(value: unknown): number {
  const schemaVersion = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(schemaVersion) || schemaVersion <= 0)
    throw new Error('La respuesta remota contiene una version de esquema invalida.');
  return schemaVersion;
}

function parseRemoteRow(row: RemoteRow): RemoteState {
  if (
    typeof row.updated_at !== 'string' ||
    !row.updated_at ||
    Number.isNaN(Date.parse(row.updated_at))
  )
    throw new Error('La respuesta remota no contiene una fecha de actualizacion valida.');
  return {
    state: validateState(row.state),
    schemaVersion: parseSchemaVersion(row.schema_version),
    revision: parseRevision(row.revision),
    updatedAt: row.updated_at,
  };
}

function isConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === '40001' || candidate.message === 'forja_conflict';
}

function throwRemoteError(error: unknown): never {
  if (isConflict(error)) throw new RemoteConflictError();
  throw error;
}

export async function loadRemoteState(): Promise<RemoteState | null> {
  const { data, error } = await requireClient()
    .from('forja_states')
    .select('state, schema_version, revision, updated_at')
    .maybeSingle();
  if (error) throw error;
  return data ? parseRemoteRow(data as RemoteRow) : null;
}

export async function saveRemoteState(state: AppState, expectedRevision: number): Promise<number> {
  const client = requireClient();
  const validatedState = validateState(state);
  const revision = parseRevision(expectedRevision);
  const schemaVersion =
    'schemaVersion' in validatedState
      ? Number((validatedState as AppState & { schemaVersion: unknown }).schemaVersion)
      : validatedState.schema;
  const validatedSchemaVersion = parseSchemaVersion(schemaVersion);
  const { data, error } = await client.rpc('save_forja_state', {
    p_state: validatedState,
    p_schema_version: validatedSchemaVersion,
    p_expected_revision: revision,
  });
  if (error) throwRemoteError(error);
  return parseRevision(data);
}
