/** Local diagnostics deliberately keep no message, context, stack, URL, or entity ID. */
const STORAGE_KEY = 'momentum_diagnostics_v1';
const MAX_ENTRIES = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 64 * 1024;

const areas = [
  'storage',
  'session',
  'import',
  'rsip',
  'auth',
  'ui',
  'application',
] as const;
const reasons = [
  'network',
  'quota',
  'permission',
  'schema',
  'timeout',
  'unknown',
] as const;
const vitalNames = ['CLS', 'FCP', 'LCP', 'TTFB', 'INP'] as const;
const operationNames = [
  'collection-save',
  'session-complete',
  'import',
] as const;
type StorageOperation = (typeof operationNames)[number];
type StorageMode = 'local' | 'supabase';
type ErrorEntry = {
  kind: 'error';
  at: number;
  area: (typeof areas)[number];
  reason: (typeof reasons)[number];
  severity: 'warning' | 'error';
};
type TimingEntry = {
  kind: 'timing';
  at: number;
  name: StorageOperation | (typeof vitalNames)[number];
  value: number;
  unit: 'ms' | 'score';
  outcome: 'success' | 'failed' | 'good' | 'needs-improvement' | 'poor';
  mode?: StorageMode;
};
type DiagnosticEntry = ErrorEntry | TimingEntry;
let entries: DiagnosticEntry[] | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && allowed.some((item) => item === value);
}

// Reconstruct only permitted fields, even if browser storage was edited externally.
function readEntry(value: unknown): DiagnosticEntry | null {
  if (
    !isRecord(value) ||
    typeof value.at !== 'number' ||
    !Number.isFinite(value.at)
  )
    return null;
  if (
    value.kind === 'error' &&
    isOneOf(value.area, areas) &&
    isOneOf(value.reason, reasons) &&
    isOneOf(value.severity, ['warning', 'error'])
  ) {
    return {
      kind: 'error',
      at: value.at,
      area: value.area,
      reason: value.reason,
      severity: value.severity,
    };
  }
  if (
    value.kind === 'timing' &&
    isOneOf(value.name, [...vitalNames, ...operationNames]) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    value.value >= 0 &&
    isOneOf(value.unit, ['ms', 'score']) &&
    isOneOf(value.outcome, [
      'success',
      'failed',
      'good',
      'needs-improvement',
      'poor',
    ])
  ) {
    return {
      kind: 'timing',
      at: value.at,
      name: value.name,
      value: value.value,
      unit: value.unit,
      outcome: value.outcome,
      ...(isOneOf(value.mode, ['local', 'supabase'])
        ? { mode: value.mode }
        : {}),
    };
  }
  return null;
}
function recent(items: DiagnosticEntry[]): DiagnosticEntry[] {
  const now = Date.now();
  return items
    .filter((entry) => entry.at > now - MAX_AGE_MS && entry.at <= now)
    .slice(-MAX_ENTRIES);
}
function load(): DiagnosticEntry[] {
  if (!entries) {
    entries = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw.length <= MAX_BYTES) {
        const data: unknown = JSON.parse(raw);
        if (Array.isArray(data))
          entries = data.flatMap((value) => {
            const entry = readEntry(value);
            return entry ? [entry] : [];
          });
      }
    } catch {
      /* Storage may be disabled; in-memory diagnostics still work. */
    }
  }
  entries = recent(entries);
  return entries;
}
function append(entry: DiagnosticEntry): void {
  const safeEntry = readEntry(entry);
  if (!safeEntry) return;
  entries = recent([...load(), safeEntry]);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* Diagnostics must never make an application operation fail. */
  }
}
function classifyArea(category: string): ErrorEntry['area'] {
  if (/import/i.test(category)) return 'import';
  if (/rsip/i.test(category)) return 'rsip';
  if (/session|completion|focus/i.test(category)) return 'session';
  if (/storage|database|supabase|migration|schema/i.test(category))
    return 'storage';
  if (/auth|account|user/i.test(category)) return 'auth';
  if (/layout|render|chunk|shell/i.test(category)) return 'ui';
  return 'application';
}
function classifyReason(error: unknown): ErrorEntry['reason'] {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  if (/quota|disk.{0,10}full/i.test(message)) return 'quota';
  if (/network|fetch|offline|connection/i.test(message)) return 'network';
  if (/timeout|timed out/i.test(message)) return 'timeout';
  if (
    /permission|unauthorized|forbidden|denied|row.level security/i.test(message)
  )
    return 'permission';
  if (/schema|column|relation.{0,40}exist|PGRST/i.test(message))
    return 'schema';
  return 'unknown';
}

export function recordDiagnosticError(
  category: string,
  error?: unknown,
  severity: ErrorEntry['severity'] = 'error',
): void {
  append({
    kind: 'error',
    at: Date.now(),
    area: classifyArea(category),
    reason: classifyReason(error),
    severity,
  });
}

export function recordWebVital(metric: {
  name: string;
  value: number;
  rating: string;
}): void {
  if (
    !isOneOf(metric.name, vitalNames) ||
    !Number.isFinite(metric.value) ||
    metric.value < 0 ||
    !isOneOf(metric.rating, ['good', 'needs-improvement', 'poor'])
  )
    return;
  append({
    kind: 'timing',
    at: Date.now(),
    name: metric.name,
    value: Number(metric.value.toFixed(3)),
    unit: metric.name === 'CLS' ? 'score' : 'ms',
    outcome: metric.rating,
  });
}

export async function measureStorageOperation<T>(
  operation: StorageOperation,
  mode: StorageMode,
  action: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  let outcome: 'success' | 'failed' = 'failed';
  try {
    const result = await action();
    outcome = 'success';
    return result;
  } finally {
    append({
      kind: 'timing',
      at: Date.now(),
      name: operation,
      value: Math.max(0, Math.round(performance.now() - start)),
      unit: 'ms',
      outcome,
      mode,
    });
  }
}

export function exportDiagnostics(): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      retentionDays: 7,
      entries: load(),
    },
    null,
    2,
  );
}
export function clearDiagnostics(): void {
  entries = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Clearing the memory buffer remains available. */
  }
}

export function installDiagnosticErrorHandlers(): () => void {
  const onError = (event: ErrorEvent) =>
    recordDiagnosticError('APPLICATION', event.error);
  const onRejection = (event: PromiseRejectionEvent) =>
    recordDiagnosticError('APPLICATION', event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
