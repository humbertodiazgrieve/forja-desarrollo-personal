export type PwaInstallState = {
  installed: boolean;
  canInstall: boolean;
};

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface PwaInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type PwaInstallListener = (state: PwaInstallState) => void;

let initialized = false;
let deferredPrompt: PwaInstallPromptEvent | null = null;
const listeners = new Set<PwaInstallListener>();

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || standaloneNavigator.standalone);
}

function currentState(): PwaInstallState {
  return { installed: isStandalone(), canInstall: deferredPrompt !== null };
}

function notify() {
  const state = currentState();
  listeners.forEach((listener) => listener(state));
}

function captureInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt = event as PwaInstallPromptEvent;
  notify();
}

function markInstalled() {
  deferredPrompt = null;
  notify();
}

function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', captureInstallPrompt);
  window.addEventListener('appinstalled', markInstalled);
  const media = window.matchMedia?.('(display-mode: standalone)');
  media?.addEventListener?.('change', notify);
}

export function getPwaInstallState(): PwaInstallState {
  initialize();
  return currentState();
}

export function isPwaInstalled(): boolean {
  return getPwaInstallState().installed;
}

export function subscribeToPwaInstallChanges(listener: PwaInstallListener): () => void {
  initialize();
  listeners.add(listener);
  listener(currentState());
  return () => listeners.delete(listener);
}

export async function promptPwaInstall(): Promise<PwaInstallOutcome> {
  initialize();
  const event = deferredPrompt;
  if (!event) return 'unavailable';

  deferredPrompt = null;
  notify();
  await event.prompt();
  const choice = await event.userChoice;
  notify();
  return choice.outcome;
}
