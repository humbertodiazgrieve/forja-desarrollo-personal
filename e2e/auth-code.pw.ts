import { test, expect } from '@playwright/test';
import { initialState } from '../src/domain';

test('verifica código de correo con reintento y conserva la sesión al recargar', async ({
  page,
  context,
}) => {
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'code-fixture@example.test',
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
  const unexpected: string[] = [];
  let otpRequests = 0;
  let verifyRequests = 0;
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
      otpRequests++;
      return route.fulfill({ status: 200, json: {} });
    }
    if (url.pathname === '/auth/v1/verify' && route.request().method() === 'POST') {
      verifyRequests++;
      const body = route.request().postDataJSON() as { token?: string };
      if (body.token !== '12345678')
        return route.fulfill({
          status: 400,
          json: { error: 'invalid_token', error_description: 'Token has expired or is invalid' },
        });
      return route.fulfill({
        status: 200,
        json: {
          access_token: session.access_token,
          token_type: 'bearer',
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          refresh_token: session.refresh_token,
          user,
        },
      });
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
  await context.addInitScript(
    (state) => {
      localStorage.setItem('forja-preview-v1', JSON.stringify(state));
    },
    { ...initialState('2026-09-14'), onboarded: true },
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acceso opcional' })).toBeVisible();
  const email = page.getByLabel('Email');
  await email.fill(' code-fixture@example.test ');
  await page.getByRole('button', { name: 'Enviar enlace mágico', exact: true }).click();
  await expect.poll(() => otpRequests).toBe(1);
  await expect(
    page.getByText('Revisa tu correo y vuelve aquí para introducir el código.'),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.screenshot({ path: 'test-results/auth-code-mobile.png' });
  const code = page.getByLabel('Código del correo');
  await code.fill('bad-code');
  await page.getByRole('button', { name: 'Verificar código', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Código inválido o caducado');
  expect(verifyRequests).toBe(0);

  await code.fill('1234567');
  await page.getByRole('button', { name: 'Verificar código', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Código inválido o caducado');
  expect(verifyRequests).toBe(1);

  await code.fill('12345678');
  await page.getByRole('button', { name: 'Verificar código', exact: true }).click();
  await expect(page.getByText('Sesión iniciada como')).toContainText(user.email);
  expect(verifyRequests).toBe(2);
  await page.reload();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByText('Sesión iniciada como')).toContainText(user.email);
  expect(unexpected).toEqual([]);
});
