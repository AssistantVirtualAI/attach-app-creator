// Persist SIP status + last error and a rolling SIP event log across app restarts.
// Pure browser localStorage — safe in SSR / non-browser by no-op.

export interface PersistedSipError {
  error: string;
  extension: string;
  domain: string;
  time: number; // epoch ms
}

export interface SipLogEntry {
  time: number;
  level: 'info' | 'warn' | 'error';
  event: string;
  detail?: string;
}

const STATUS_KEY = 'ava.sip.status';
const ERROR_KEY = 'ava.sip.lastError';
const LOG_KEY = 'ava.sip.log';
const MAX_LOG = 200;

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export function loadPersistedStatus(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return safe(() => localStorage.getItem(STATUS_KEY), null);
}

export function savePersistedStatus(status: string) {
  if (typeof localStorage === 'undefined') return;
  safe(() => localStorage.setItem(STATUS_KEY, status), undefined);
}

export function loadPersistedError(): PersistedSipError | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = safe(() => localStorage.getItem(ERROR_KEY), null);
  if (!raw) return null;
  return safe(() => JSON.parse(raw) as PersistedSipError, null);
}

export function savePersistedError(err: PersistedSipError | null) {
  if (typeof localStorage === 'undefined') return;
  if (!err) safe(() => localStorage.removeItem(ERROR_KEY), undefined);
  else safe(() => localStorage.setItem(ERROR_KEY, JSON.stringify(err)), undefined);
}

export function loadSipLog(): SipLogEntry[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = safe(() => localStorage.getItem(LOG_KEY), null);
  if (!raw) return [];
  return safe(() => JSON.parse(raw) as SipLogEntry[], []);
}

export function appendSipLog(entry: SipLogEntry): SipLogEntry[] {
  const current = loadSipLog();
  const next = [...current, entry].slice(-MAX_LOG);
  if (typeof localStorage !== 'undefined') {
    safe(() => localStorage.setItem(LOG_KEY, JSON.stringify(next)), undefined);
  }
  return next;
}

export function clearSipLog() {
  if (typeof localStorage === 'undefined') return;
  safe(() => localStorage.removeItem(LOG_KEY), undefined);
}

/** Exponential back-off with cap (ms). Skipped entirely for auth failures. */
export const RETRY_BACKOFF_MS = [3000, 6000, 12000, 24000, 45000, 60000];
