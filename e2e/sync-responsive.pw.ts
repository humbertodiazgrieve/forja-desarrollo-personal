import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { initialState } from '../src/domain';

async function assertGeometry(page: Page) {
  await expect(page.locator('.topbar .remote-save-status')).toBeVisible();
  const geometry = await page.evaluate(() => {
    const topbar = document.querySelector<HTMLElement>('.topbar')!;
    const main = document.querySelector<HTMLElement>('main')!;
    const sync = document.querySelector<HTMLElement>('.topbar .remote-save-status')!;
    const rect = (element: Element) => {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const controls = [...topbar.querySelectorAll('.save-indicator, .date-control, .user-monogram')]
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => ({ name: element.className, ...rect(element) }));
    const overlaps = controls.flatMap((a, index) => controls.slice(index + 1)
      .filter((b) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1)
      .map((b) => [a.name, b.name]));
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      mainWidth: main.clientWidth,
      mainScrollWidth: main.scrollWidth,
      topbarWidth: topbar.clientWidth,
      topbarScrollWidth: topbar.scrollWidth,
      topbar: rect(topbar),
      sync: rect(sync),
      syncTextFits: sync.scrollWidth <= sync.clientWidth + 1,
      overlaps,
    };
  });
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.mainScrollWidth).toBeLessThanOrEqual(geometry.mainWidth + 1);
  expect(geometry.topbarScrollWidth).toBeLessThanOrEqual(geometry.topbarWidth + 1);
  expect(geometry.sync.width).toBeGreaterThan(0);
  expect(geometry.sync.x).toBeGreaterThanOrEqual(geometry.topbar.x);
  expect(geometry.sync.right).toBeLessThanOrEqual(geometry.topbar.right);
  expect(geometry.sync.bottom).toBeLessThanOrEqual(geometry.topbar.bottom);
  expect(geometry.syncTextFits).toBe(true);
  expect(geometry.overlaps).toEqual([]);
  return geometry;
}

for (const width of [320, 390, 768, 1440]) {
  test(`real sync state and read-only query at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = {
      ...initialState('2026-09-14'),
      onboarded: true,
      reducedMotion: true,
      records: { '2026-09-22': { cardio: 1 } },
    };
    const user = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'fixture@example.test',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-09-14T00:00:00Z',
    };
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const session = {
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.Zml4dHVyZQ`,
      refresh_token: 'fixture-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      user,
    };
    let hold = true;
    let fail = false;
    let revision = 6;
    let requests = 0;
    let release: (() => void)[] = [];
    const mutations: string[] = [];
    const unexpected: string[] = [];

    // Install before navigation. Only local assets may leave this interceptor.
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:1421') return route.continue();
      if (url.hostname !== 'forja-sync-fixture.supabase.co') {
        unexpected.push(url.origin + url.pathname);
        return route.fulfill({ status: 503, body: 'External request blocked by fixture' });
      }
      if (route.request().method() !== 'GET') {
        mutations.push(url.pathname);
        return route.fulfill({ status: 403, json: { message: 'Fixture is read-only' } });
      }
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.pathname === '/rest/v1/forja_states') {
        requests++;
        if (hold) await new Promise<void>((resolve) => release.push(resolve));
        if (fail) return route.fulfill({ status: 401, json: { message: 'Fictional read failure' } });
        return route.fulfill({ json: {
          state, revision, schema_version: 1, updated_at: '2026-09-22T19:35:28Z',
        } });
      }
      unexpected.push(url.pathname);
      return route.fulfill({ status: 503, body: 'Unmocked Supabase request blocked' });
    });
    await context.routeWebSocket('**/*', (socket) => socket.close());
    await context.addInitScript(({ state, session, userId }) => {
      localStorage.setItem('forja-preview-v1', JSON.stringify(state));
      localStorage.setItem('sb-forja-sync-fixture-auth-token', JSON.stringify(session));
      localStorage.setItem(`forja-sync-checkpoint-v1:${userId}`, JSON.stringify({ state, revision: 6 }));
    }, { state, session, userId: user.id });

    const unblock = () => {
      hold = false;
      release.forEach((resolve) => resolve());
      release = [];
    };
    await page.goto('/');
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
    const indicator = page.locator('.topbar .remote-save-status');
    const persistent = page.locator('.settings-sync-status');
    const query = page.getByRole('button', { name: 'Consultar copia remota', exact: true });
    const results: Record<string, unknown> = {};
    await expect(indicator).toContainText('Comprobando sincronización');
    await expect(persistent).toContainText('Comprobando sincronización');
    await expect(query).toBeDisabled();
    await page.locator('.remote-sync-settings').scrollIntoViewIfNeeded();
    results.checking = await assertGeometry(page);
    await page.screenshot({ path: `test-results/sync-ui-${width}-checking.png` });

    unblock();
    await expect(indicator).toContainText('Sincronizado');
    await expect(persistent).toContainText('Sincronizado');
    await expect(query).toBeEnabled();
    await expect(page.locator('.remote-sync-settings')).toContainText('Revisión 6');
    results.synced = await assertGeometry(page);
    await page.screenshot({ path: `test-results/sync-ui-${width}-synced.png` });

    const before = await page.evaluate(() => localStorage.getItem('forja-preview-v1'));
    const priorRequests = requests;
    hold = true;
    await query.click();
    await expect(query).toBeDisabled();
    await expect.poll(() => requests).toBeGreaterThan(priorRequests);
    revision = 7;
    unblock();
    await expect(query).toBeEnabled();
    await expect(page.locator('.remote-sync-settings')).toContainText('Revisión 7');
    expect(await page.evaluate(() => localStorage.getItem('forja-preview-v1'))).toBe(before);
    expect(mutations).toEqual([]);

    hold = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(indicator).toContainText('Sincronizando');
    await expect(persistent).toContainText('Sincronizando');
    results.syncing = await assertGeometry(page);
    fail = true;
    unblock();
    await expect(indicator).toContainText('Error de sincronización');
    await expect(persistent).toContainText('Error de sincronización');
    await expect(query).toBeEnabled();
    results.error = await assertGeometry(page);
    await page.screenshot({ path: `test-results/sync-ui-${width}-error.png` });
    expect(mutations).toEqual([]);
    expect(unexpected).toEqual([]);
    await writeFile(`test-results/sync-ui-${width}-geometry.json`, JSON.stringify(results, null, 2));
  });
}
