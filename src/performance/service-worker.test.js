import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

function worker(fetcher) {
  const handlers = new Map();
  const writes = [];
  const cache = { addAll: vi.fn(), put: vi.fn(async (key) => { writes.push(typeof key === 'string' ? key : new URL(key.url).pathname); }) };
  const cachesApi = {
    open: vi.fn(async () => cache),
    match: vi.fn(async () => undefined),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  };
  const selfApi = {
    location: { origin: 'https://forja.test' },
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
    addEventListener: (type, callback) => handlers.set(type, callback),
  };
  new Function('self', 'caches', 'fetch', 'Response', 'URL', source)(selfApi, cachesApi, fetcher, Response, URL);
  return { handlers, writes, cachesApi };
}

const response = () => new Response('ok', { status: 200 });

describe('Performance con caché PWA', () => {
  it('no guarda la navegación de Performance bajo la clave del shell raíz', async () => {
    const fetcher = vi.fn(async () => response());
    const { handlers, writes } = worker(fetcher);
    let result;
    handlers.get('fetch')({
      request: { url: 'https://forja.test/performance/index.html', method: 'GET', mode: 'navigate', destination: 'iframe' },
      respondWith: (promise) => { result = undefined; void promise.then((value) => { result = value; }); },
    });
    await vi.waitFor(() => expect(result?.status).toBe(200));
    expect(writes).toEqual(['/performance/index.html']);
    expect(writes).not.toContain('/index.html');
  });

  it('actualiza los assets de Performance desde red y conserva su propia clave', async () => {
    const fetcher = vi.fn(async () => response());
    const { handlers, writes, cachesApi } = worker(fetcher);
    let result;
    handlers.get('fetch')({
      request: { url: 'https://forja.test/performance/app.js', method: 'GET', mode: 'no-cors', destination: 'script' },
      respondWith: (promise) => { void promise.then((value) => { result = value; }); },
    });
    await vi.waitFor(() => expect(result?.status).toBe(200));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cachesApi.match).not.toHaveBeenCalled();
    expect(writes).toEqual(['/performance/app.js']);
  });
});


