import type { ErrorEvent } from '@sentry/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  close: vi.fn(async () => true),
}));
vi.mock('@sentry/browser', () => sdk);

async function loadModule() {
  vi.resetModules();
  return import('../errorReporting');
}

describe('errorReporting', () => {
  beforeEach(() => {
    localStorage.clear();
    sdk.init.mockClear();
    sdk.captureException.mockClear();
    sdk.close.mockClear();
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/2');
    vi.stubEnv('PROD', true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is unavailable without a DSN or outside production builds', async () => {
    const { isErrorReportingAvailable } = await loadModule();
    expect(isErrorReportingAvailable()).toBe(true);

    vi.stubEnv('VITE_SENTRY_DSN', '');
    expect(isErrorReportingAvailable()).toBe(false);

    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/2');
    vi.stubEnv('PROD', false);
    expect(isErrorReportingAvailable()).toBe(false);
  });

  it('sends nothing until the user opts in', async () => {
    const { reportError, startErrorReportingIfEnabled } = await loadModule();

    await startErrorReportingIfEnabled();
    reportError(new Error('boom'), 'STORAGE');

    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it('starts without user data, reports, and stops when turned off', async () => {
    const { reportError, setErrorReporting } = await loadModule();

    await setErrorReporting(true);
    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@o1.ingest.sentry.io/2',
        dataCollection: expect.objectContaining({
          userInfo: false,
          cookies: false,
          urlQueryParams: false,
        }),
      }),
    );
    const error = new Error('boom');
    reportError(error, 'STORAGE');
    expect(sdk.captureException).toHaveBeenCalledWith(error, {
      tags: { category: 'STORAGE' },
    });

    await setErrorReporting(false);
    reportError(new Error('after'), 'STORAGE');
    expect(sdk.close).toHaveBeenCalledTimes(1);
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('momentum_error_reporting_enabled')).toBe(
      'false',
    );
  });

  it('resumes reporting at launch after an earlier opt-in', async () => {
    localStorage.setItem('momentum_error_reporting_enabled', 'true');
    const { startErrorReportingIfEnabled } = await loadModule();

    await startErrorReportingIfEnabled();

    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  it('strips user, request details, query strings and console breadcrumbs', async () => {
    const { scrubEvent } = await loadModule();
    const event = {
      type: undefined,
      user: { id: 'user-1', email: 'me@example.com' },
      server_name: 'laptop',
      request: {
        url: 'https://app.test/?view=detail&chain=abc#top',
        headers: { Authorization: 'Bearer token' },
        cookies: { session: 'secret' },
        query_string: 'view=detail',
      },
      breadcrumbs: [
        { category: 'console', message: 'chain "Write thesis" saved' },
        {
          category: 'fetch',
          data: {
            url: 'https://x.supabase.co/rest/v1/chains?user_id=eq.123',
            status_code: 500,
          },
        },
      ],
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.server_name).toBeUndefined();
    expect(scrubbed.request).toEqual({ url: 'https://app.test/' });
    expect(scrubbed.breadcrumbs).toEqual([
      {
        category: 'fetch',
        data: {
          url: 'https://x.supabase.co/rest/v1/chains',
          status_code: 500,
        },
      },
    ]);
  });
});
