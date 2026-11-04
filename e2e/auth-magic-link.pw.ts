import { test, expect } from '@playwright/test';
import { initialState } from '../src/domain';

test('signs in through the email magic link and keeps the session after reload', async ({
  page,
  context,
}) => {
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'magic-link-fixture@example.test',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-09-14T00:00:00Z',
  };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.Zml4dHVyZQ`;
  const localState = {
    ...initialState('2026-09-14'),
    onboarded: true,
    records: { '2026-09-15': { strength: 1 } },
  };
  const unexpected: string[] = [];
  let linkRequests = 0;
  let remoteState: unknown = null;
  let remoteRevision = 0;

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:1421') return route.continue();
    if (url.hostname !== 'forja-sync-fixture.supabase.co') {
      unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
      return route.fulfill({ status: 503, body: 'External request blocked by fixture' });
    }
    if (url.pathname === '/auth/v1/otp' && route.request().method() === 'POST') {
      linkRequests++;
      return route.fulfill({ status: 200, json: {} });
    }
    if (url.pathname === '/auth/v1/verify' && route.request().method() === 'GET') {
      const callback = new URL(url.searchParams.get('redirect_to') ?? 'http://127.0.0.1:1421/');
      callback.hash = new URLSearchParams({
        access_token: accessToken,
        refresh_token: 'fixture-refresh-token',
        token_type: 'bearer',
        expires_in: '3600',
        type: 'magiclink',
      }).toString();
      return route.fulfill({ status: 302, headers: { location: callback.toString() } });
    }
    if (url.pathname === '/auth/v1/user' && route.request().method() === 'GET')
      return route.fulfill({ status: 200, json: user });
    if (url.pathname === '/rest/v1/forja_states' && route.request().method() === 'GET')
      return route.fulfill({
        status: 200,
        json:
          remoteState === null
            ? null
            : {
                state: remoteState,
                schema_version: 1,
                revision: remoteRevision,
                updated_at: '2026-09-14T00:00:00.000Z',
              },
      });
    if (url.pathname === '/rest/v1/rpc/save_forja_state' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as {
        p_state?: unknown;
        p_schema_version?: number;
        p_expected_revision?: number;
      };
      if (
        body.p_schema_version !== 1 ||
        body.p_expected_revision !== remoteRevision ||
        body.p_state === undefined
      )
        return route.fulfill({ status: 409, json: { message: 'Revision conflict' } });
      remoteState = body.p_state;
      remoteRevision += 1;
      return route.fulfill({ status: 200, json: remoteRevision });
    }
    unexpected.push(`${route.request().method()} ${url.pathname}`);
    return route.fulfill({ status: 503, body: 'Unmocked Supabase request blocked' });
  });
  await context.routeWebSocket('**/*', (socket) => socket.close());
  await context.addInitScript((state) => {
    if (!localStorage.getItem('forja-preview-v1'))
      localStorage.setItem('forja-preview-v1', JSON.stringify(state));
  }, localState);

  await page.goto('/');
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acceso opcional' })).toBeVisible();
  const email = page.getByLabel('Email');
  await email.fill(' magic-link-fixture@example.test ');
  await page.getByRole('button', { name: 'Enviar enlace mágico', exact: true }).click();
  await expect.poll(() => linkRequests).toBe(1);
  await expect(
    page.getByText('Revisa tu correo y abre el enlace mágico para continuar.'),
  ).toBeVisible();
  await expect(page.getByLabel('Código del correo')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Verificar código' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.screenshot({ path: 'test-results/auth-magic-link-mobile.png' });

  await page.goto(
    'https://forja-sync-fixture.supabase.co/auth/v1/verify?token=fixture-token&type=magiclink&redirect_to=http%3A%2F%2F127.0.0.1%3A1421%2F',
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByText('Nivel 1 · 10 XP')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByText('Sesión iniciada como')).toContainText(user.email);
  await page.reload();
  await expect(page.getByText('Nivel 1 · 10 XP')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByText('Sesión iniciada como')).toContainText(user.email);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('forja-preview-v1') ?? 'null').records['2026-09-15']
            ?.strength,
      ),
    )
    .toBe(1);
  expect(linkRequests).toBe(1);
  expect(remoteState).toEqual(localState);
  expect(unexpected).toEqual([]);
});
