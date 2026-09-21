import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeWindow = {
  location: { origin: string };
  matchMedia: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
};

const createWindow = (installed = false) => {
  const handlers = new Map<string, EventListener>();
  const media = {
    matches: installed,
    addEventListener: vi.fn(),
  };
  const fakeWindow: FakeWindow = {
    location: { origin: 'https://forja.example.test' },
    matchMedia: vi.fn().mockReturnValue(media),
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      handlers.set(type, handler);
    }),
  };
  return { fakeWindow, handlers, media };
};

async function loadInstallApi() {
  vi.resetModules();
  return import('./pwa-install');
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('PWA installation service', () => {
  it('reports unavailable outside a browser and does not prompt', async () => {
    const api = await loadInstallApi();
    expect(api.getPwaInstallState()).toEqual({ installed: false, canInstall: false });
    await expect(api.promptPwaInstall()).resolves.toBe('unavailable');
  });

  it('captures beforeinstallprompt, notifies subscribers, and consumes one event once', async () => {
    const { fakeWindow, handlers } = createWindow();
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('navigator', { standalone: false });
    const api = await loadInstallApi();
    const states: { installed: boolean; canInstall: boolean }[] = [];
    const unsubscribe = api.subscribeToPwaInstallChanges((state) => states.push(state));
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = {
      preventDefault: vi.fn(),
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    } as unknown as Event;

    handlers.get('beforeinstallprompt')!(event);
    await expect(api.promptPwaInstall()).resolves.toBe('accepted');
    await expect(api.promptPwaInstall()).resolves.toBe('unavailable');
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(prompt).toHaveBeenCalledOnce();
    expect(states.at(-1)).toEqual({ installed: false, canInstall: false });
    unsubscribe();
  });

  it('reports installed mode from display-mode and navigator.standalone', async () => {
    const displayWindow = createWindow(true);
    vi.stubGlobal('window', displayWindow.fakeWindow);
    vi.stubGlobal('navigator', { standalone: false });
    const displayApi = await loadInstallApi();
    expect(displayApi.isPwaInstalled()).toBe(true);

    vi.resetModules();
    const iosWindow = createWindow(false);
    vi.stubGlobal('window', iosWindow.fakeWindow);
    vi.stubGlobal('navigator', { standalone: true });
    const iosApi = await loadInstallApi();
    expect(iosApi.isPwaInstalled()).toBe(true);
  });

  it('handles a dismissed prompt without throwing', async () => {
    const { fakeWindow, handlers } = createWindow();
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('navigator', { standalone: false });
    const api = await loadInstallApi();
    api.getPwaInstallState();
    const event = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
    } as unknown as Event;
    handlers.get('beforeinstallprompt')!(event);

    await expect(api.promptPwaInstall()).resolves.toBe('dismissed');
  });
});
