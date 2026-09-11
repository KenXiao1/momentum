/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-domain-to-ui',
      comment:
        'Pure domain logic must not depend on React components or the app shell.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/(components|app)/' },
    },
    {
      name: 'no-storage-to-domain-hooks',
      comment: 'Storage implementations must not import React domain hooks.',
      severity: 'error',
      from: { path: '^src/(storage|infra)/' },
      to: { path: '^src/hooks/domains/' },
    },
    {
      name: 'no-component-to-supabase-infra',
      comment:
        'UI components must go through the storage abstraction — never import Supabase infra directly.',
      severity: 'error',
      from: { path: '^src/components/' },
      to: { path: '^src/infra/storage/supabase/' },
    },
    {
      name: 'no-component-storage-implementation',
      comment:
        'UI may use public storage ports and context hooks, but never concrete adapters or storage internals.',
      severity: 'error',
      from: { path: '^src/components/' },
      to: {
        path: '^src/storage/',
        pathNot: '^src/storage/(ports|useStorage|useStorageMode)[.](?:ts|tsx)$',
      },
    },
    {
      name: 'no-app-to-supabase-infra',
      comment:
        'Application coordinators must use the storage abstraction, never Supabase infrastructure.',
      severity: 'error',
      from: { path: '^src/app/' },
      to: { path: '^src/infra/storage/supabase/' },
    },
    {
      name: 'no-app-storage-implementation',
      comment:
        'Application coordinators may use public storage ports and context hooks, but never concrete adapters or storage internals.',
      severity: 'error',
      from: { path: '^src/app/' },
      to: {
        path: '^src/storage/',
        pathNot: '^src/storage/(ports|useStorage|useStorageMode)[.](?:ts|tsx)$',
      },
    },
  ],
  options: {
    exclude: {
      path: ['(^|/)__tests__/', '[.](?:spec|test)[.](?:js|jsx|ts|tsx)$'],
    },
    doNotFollow: {
      path: 'node_modules',
    },
    moduleSystems: ['es6', 'cjs'],
    tsConfig: {
      fileName: 'tsconfig.app.json',
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
