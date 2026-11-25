import type { Breadcrumb, ErrorEvent } from '@sentry/browser';
import {
  getErrorReportingEnabled,
  setErrorReportingEnabled,
} from './local-preferences/errorReporting';
import { platform } from './platform';

// This module must not import the logger: the logger reports through it.

type Sentry = typeof import('./sentryClient');

let sentry: Sentry | null = null;
let starting: Promise<void> | null = null;

/** Reports can be sent only from production builds configured with a DSN. */
export function isErrorReportingAvailable(): boolean {
  return Boolean(import.meta.env.VITE_SENTRY_DSN) && import.meta.env.PROD;
}

function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * Keeps what a stack trace needs and drops what identifies the user or their
 * data: the user, cookies, headers, request bodies and URL queries (Supabase
 * filters carry the user id).
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.server_name;
  if (event.request) {
    event.request = event.request.url
      ? { url: withoutQuery(event.request.url) }
      : {};
  }
  event.breadcrumbs = event.breadcrumbs
    ?.map(scrubBreadcrumb)
    .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);
  return event;
}

/** Console breadcrumbs can echo app data, so they are never sent. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;
  const url = breadcrumb.data?.url;
  if (typeof url === 'string') {
    return {
      ...breadcrumb,
      data: { ...breadcrumb.data, url: withoutQuery(url) },
    };
  }
  return breadcrumb;
}

/** Loads the SDK on demand, so users who never opt in never download it. */
function start(): Promise<void> {
  if (sentry || !isErrorReportingAvailable()) return Promise.resolve();
  starting ??= import('./sentryClient')
    .then((module) => {
      module.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        release: `momentum@${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'}`,
        environment: platform,
        // Collect nothing about the user or their requests; scrubEvent
        // below also removes anything an integration adds anyway.
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
        tracesSampleRate: 0,
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      });
      sentry = module;
    })
    .finally(() => {
      starting = null;
    });
  return starting;
}

/** Starts reporting at launch when the user turned it on earlier. */
export function startErrorReportingIfEnabled(): Promise<void> {
  return getErrorReportingEnabled() ? start() : Promise.resolve();
}

export async function setErrorReporting(enabled: boolean): Promise<void> {
  setErrorReportingEnabled(enabled);
  if (enabled) {
    await start();
    return;
  }
  await starting;
  const running = sentry;
  sentry = null;
  await running?.close();
}

/** Sends an error the app logged; does nothing while reporting is off. */
export function reportError(error: Error, category: string): void {
  sentry?.captureException(error, { tags: { category } });
}
