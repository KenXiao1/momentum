/// <reference types="vite/client" />

/** The app version from package.json, injected by Vite at build time. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Sentry project DSN; error reporting is unavailable without it. */
  readonly VITE_SENTRY_DSN?: string;
}
