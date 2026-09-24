import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as diagnostics from '../diagnostics';

const KEY = 'momentum_diagnostics_v1';
function report() {
  return JSON.parse(diagnostics.exportDiagnostics()) as {
    schemaVersion: number;
    entries: Array<Record<string, unknown>>;
  };
}
beforeEach(() => diagnostics.clearDiagnostics());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('local production diagnostics', () => {
  it('persists error categories while excluding all raw sensitive data', async () => {
    diagnostics.recordDiagnosticError(
      'SUPABASE_user-private',
      new Error(
        'Network failed https://secret.example/?token=secret-token user@example.com private task text',
      ),
    );
    const raw = localStorage.getItem(KEY);
    expect(raw).toContain('network');
    expect(raw).not.toMatch(/secret|example|private|token|user@|https/);
    vi.resetModules();
    const refreshed = await import('../diagnostics');
    expect(JSON.parse(refreshed.exportDiagnostics()).entries).toEqual([
      {
        kind: 'error',
        at: expect.any(Number),
        area: 'storage',
        reason: 'network',
        severity: 'error',
      },
    ]);
  });

  it('caps the buffer and expires old records', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    for (let index = 0; index < 205; index += 1)
      diagnostics.recordDiagnosticError('RSIP');
    expect(report().entries).toHaveLength(200);
    vi.spyOn(Date, 'now').mockReturnValue(now + 8 * 24 * 60 * 60 * 1000);
    expect(report().entries).toEqual([]);
  });

  it('revalidates persisted records and never exports injected fields', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        {
          kind: 'error',
          at: Date.now(),
          area: 'storage',
          reason: 'quota',
          severity: 'error',
          token: 'secret',
        },
        {
          kind: 'error',
          at: Date.now(),
          area: 'user@example.com',
          reason: 'quota',
          severity: 'error',
        },
      ]),
    );
    vi.resetModules();
    const refreshed = await import('../diagnostics');
    const exported = refreshed.exportDiagnostics();
    expect(JSON.parse(exported).entries).toHaveLength(1);
    expect(exported).not.toMatch(/secret|token|user@example/);
  });

  it('keeps original operation results and errors when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    await expect(
      diagnostics.measureStorageOperation('import', 'local', async () => 42),
    ).resolves.toBe(42);
    const failure = new Error('Save failed');
    await expect(
      diagnostics.measureStorageOperation(
        'session-complete',
        'supabase',
        async () => {
          throw failure;
        },
      ),
    ).rejects.toBe(failure);
    expect(
      report().entries.map((entry) => [entry.name, entry.mode, entry.outcome]),
    ).toEqual([
      ['import', 'local', 'success'],
      ['session-complete', 'supabase', 'failed'],
    ]);
  });

  it('records metric units and rejects unknown or invalid vitals', () => {
    diagnostics.recordWebVital({
      name: 'CLS',
      value: 0.15,
      rating: 'needs-improvement',
    });
    diagnostics.recordWebVital({ name: 'LCP', value: 1450, rating: 'good' });
    diagnostics.recordWebVital({
      name: 'user@example.com',
      value: 1,
      rating: 'good',
    });
    diagnostics.recordWebVital({ name: 'LCP', value: NaN, rating: 'good' });
    expect(
      report().entries.map((entry) => [entry.name, entry.value, entry.unit]),
    ).toEqual([
      ['CLS', 0.15, 'score'],
      ['LCP', 1450, 'ms'],
    ]);
  });

  it('captures production logger errors without their payloads', async () => {
    vi.resetModules();
    vi.stubEnv('MODE', 'production');
    const { logger } = await import('../logger');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error(
      'IMPORT',
      'private task',
      { token: 'secret-token' },
      new Error('permission denied user@example.com'),
    );
    const stored = localStorage.getItem(KEY);
    expect(stored).toContain('permission');
    expect(stored).not.toMatch(/private|secret|token|user@/);
  });

  it('can remove global handlers and clear persisted events', () => {
    const uninstall = diagnostics.installDiagnosticErrorHandlers();
    const event = new ErrorEvent('error');
    window.dispatchEvent(event);
    expect(report().entries).toHaveLength(1);
    uninstall();
    window.dispatchEvent(event);
    expect(report().entries).toHaveLength(1);
    diagnostics.clearDiagnostics();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(report().entries).toEqual([]);
  });
});
