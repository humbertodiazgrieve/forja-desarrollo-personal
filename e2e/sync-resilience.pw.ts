import { test, expect, type BrowserContext } from '@playwright/test';
import { addVersion, emptyJournal, initialState, totalXp, type AppState } from '../src/domain';

const origin = 'http://127.0.0.1:1421';
const supabaseHost = 'forja-sync-fixture.supabase.co';

test('two clients preserve offline edits, converge on refresh, and stop on concurrent edits', async ({ browser }) => {
  const user = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'sync-resilience@example.test',
    aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {},
    created_at: '2026-09-14T00:00:00Z',
  };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const authSession = {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.Zml4dHVyZQ`,
    refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600,
    expires_at: expiresAt, user,
  };
  const historicalJournal = {
    ...emptyJournal(),
    body: 'Entrada histórica que debe conservarse',
    good: 'Fui constante',
    bad: 'Me distraje',
    published: true,
    clarity: 4,
  };
  const initial = initialState('2026-09-14');
  const journalHabit = initial.habits.find((habit) => habit.id === 'journal')!;
  const withJournalHistory = addVersion(
    initial,
    { ...journalHabit, name: 'Diario personalizado histórico' },
    '2026-10-01',
  );
  const baseline = {
    ...withJournalHistory,
    onboarded: true,
    journals: { '2026-09-20': historicalJournal },
    records: { '2026-09-20': { journal: 1 } },
  };
  const historicalXp = totalXp(baseline, '2026-11-06');
  let remoteState: unknown = null;
  let revision = 0;
  let offlineA = false;
  const unexpected: string[] = [];
  const mutations: string[] = [];
  const contexts: BrowserContext[] = [];

  const makeClient = async (state: unknown) => {
    const context = await browser.newContext({ baseURL: origin, serviceWorkers: 'block', timezoneId: 'America/Lima' });
    contexts.push(context);
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname !== supabaseHost) {
        unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        return route.fulfill({ status: 503, body: 'External request blocked by fixture' });
      }
      if (offlineA && url.pathname === '/rest/v1/rpc/save_forja_state')
        return route.abort('internetdisconnected');
      if (url.pathname === '/auth/v1/user' && route.request().method() === 'GET')
        return route.fulfill({ status: 200, json: user });
      if (url.pathname === '/rest/v1/forja_states' && route.request().method() === 'GET')
        return route.fulfill({ status: 200, json: remoteState === null ? null : {
          state: remoteState, schema_version: 1, revision, updated_at: '2026-09-14T00:00:00.000Z',
        } });
      if (url.pathname === '/rest/v1/rpc/save_forja_state' && route.request().method() === 'POST') {
        mutations.push('save');
        const body = route.request().postDataJSON() as { p_state?: unknown; p_schema_version?: number; p_expected_revision?: number };
        if (body.p_schema_version !== 1 || body.p_expected_revision !== revision || body.p_state === undefined)
          return route.fulfill({ status: 400, json: { code: '40001', message: 'forja_conflict' } });
        remoteState = body.p_state;
        revision++;
        return route.fulfill({ status: 200, json: revision });
      }
      unexpected.push(`${route.request().method()} ${url.pathname}`);
      return route.fulfill({ status: 503, body: 'Unmocked Supabase request blocked' });
    });
    await context.routeWebSocket('**/*', (socket) => socket.close());
    await context.addInitScript(({ state, session, userId, checkpoint }) => {
      if (localStorage.getItem('forja-sync-fixture-seeded') === 'yes') return;
      localStorage.setItem('forja-preview-v1', JSON.stringify(state));
      localStorage.setItem('sb-forja-sync-fixture-auth-token', JSON.stringify(session));
      if (checkpoint) localStorage.setItem(`forja-sync-checkpoint-v1:${userId}`, JSON.stringify(checkpoint));
      localStorage.setItem('forja-sync-fixture-seeded', 'yes');
    }, { state, session: authSession, userId: user.id, checkpoint: remoteState === null ? null : { state: remoteState, revision } });
    const page = await context.newPage();
    return page;
  };

  const pageA = await makeClient(baseline);
  const pageB = await makeClient(initialState('2026-09-14'));
  try {
    await pageA.goto('/');
    await expect(pageA.locator('.topbar .remote-save-status')).toContainText('Sincronizado');
    await expect(pageA.getByRole('button', { name: 'Mi diario', exact: true })).toHaveCount(0);
    await expect(pageA.locator('.mission-card').filter({ hasText: /diario/i })).toHaveCount(0);
    await pageA.getByLabel('Mes del trimestre').selectOption('0');
    await expect(pageA.getByRole('rowheader', { name: /diario/i })).toHaveCount(0);
    expect(remoteState).toEqual(baseline);

    await pageA.getByRole('button', { name: 'Misiones de hoy', exact: true }).click();
    await pageA.getByLabel('Fecha de registro').fill('2026-09-20');
    await expect(pageA.locator('.topbar .date-control input')).toHaveValue('2026-09-20');
    await pageA.getByRole('button', { name: 'Mi refugio', exact: true }).click();
    await expect(pageA.locator('.mission-card').filter({ hasText: /diario/i })).toHaveCount(0);
    await expect(pageA.getByRole('rowheader', { name: /diario/i })).toHaveCount(0);
    await pageA.getByRole('button', { name: 'Misiones de hoy', exact: true }).click();
    await expect(pageA.locator('.mission-card').filter({ hasText: /diario/i })).toHaveCount(0);

    await pageA.getByRole('button', { name: 'Planificación', exact: true }).click();
    await expect(pageA.locator('.habit-plan-row').filter({ hasText: /diario/i })).toHaveCount(0);
    await expect(pageA.locator('.history-list').getByText(/diario/i)).toHaveCount(0);
    await expect(pageA.getByText('0 ajustes', { exact: true })).toBeVisible();
    await pageA.getByRole('button', { name: 'Mi refugio', exact: true }).click();
    await pageA.getByLabel('Fecha de registro').fill('2026-11-06');

    await pageB.goto('/');
    await expect(pageB.locator('.topbar .remote-save-status')).toContainText('Sincronizado');
    await expect.poll(() => pageB.evaluate(() => JSON.parse(localStorage.getItem('forja-preview-v1') ?? 'null')?.onboarded)).toBe(true);

    offlineA = true;
    await pageA.getByRole('button', { name: 'Ajustes' }).click();
    await pageA.getByLabel('Reducir animaciones y movimiento').check();
    await expect.poll(() => pageA.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('forja-preview-v1') ?? 'null') as AppState | null;
      return state?.reducedMotion;
    })).toBe(true);
    const offlineEdit = await pageA.evaluate(() => JSON.parse(localStorage.getItem('forja-preview-v1') ?? 'null') as AppState);
    expect(offlineEdit.journals).toEqual(baseline.journals);
    expect(totalXp(offlineEdit, '2026-11-06')).toBe(historicalXp);
    await expect(pageA.locator('.topbar .remote-save-status')).toContainText('Error de sincronización');
    expect(remoteState).toEqual(baseline);

    offlineA = false;
    await pageA.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(pageA.locator('.topbar .remote-save-status')).toContainText('Sincronizado');
    expect(remoteState).toEqual(offlineEdit);
    expect((remoteState as AppState).journals).toEqual(baseline.journals);
    expect(totalXp(remoteState as AppState, '2026-11-06')).toBe(historicalXp);

    await pageB.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(pageB.locator('.topbar .remote-save-status')).toContainText('Sincronizado');
    await expect.poll(() => pageB.evaluate(() => JSON.parse(localStorage.getItem('forja-preview-v1') ?? 'null'))).toEqual(offlineEdit);
    expect((remoteState as AppState).journals).toEqual(baseline.journals);
    expect(totalXp(remoteState as AppState, '2026-11-06')).toBe(historicalXp);

    const editA = { ...offlineEdit, model: 'concurrent edit A' };
    const editB = { ...offlineEdit, model: 'concurrent edit B' };
    await pageA.evaluate((state) => localStorage.setItem('forja-preview-v1', JSON.stringify(state)), editA);
    await pageB.evaluate((state) => localStorage.setItem('forja-preview-v1', JSON.stringify(state)), editB);
    await pageA.reload();
    await expect(pageA.locator('.topbar .remote-save-status')).toContainText('Sincronizado');
    expect(remoteState).toEqual(editA);
    await pageB.reload();
    await expect(pageB.locator('.topbar .remote-save-status')).toContainText('Conflicto remoto');
    expect(remoteState).toEqual(editA);
    expect(await pageB.evaluate(() => JSON.parse(localStorage.getItem('forja-preview-v1') ?? 'null'))).toEqual(editB);
    expect(unexpected).toEqual([]);
    expect(mutations.length).toBeGreaterThan(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
