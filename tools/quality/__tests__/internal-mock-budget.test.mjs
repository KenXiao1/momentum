import assert from 'node:assert/strict';
import test from 'node:test';
import { compareToBaseline, findInternalMocks } from '../internal-mocks.mjs';

test('reports relative mocks of project modules in every call form', () => {
  const source = `
    vi.mock('../../utils/logger', () => ({}));
    vi.doMock("../storage/useStorage");
    vi.mock(import('../services/ExceptionRuleManager'), async () => ({}));
  `;
  assert.deepEqual(findInternalMocks(source), [
    '../../utils/logger',
    '../storage/useStorage',
    '../services/ExceptionRuleManager',
  ]);
});

test('allows packages and native or cloud boundaries', () => {
  const source = `
    vi.mock('@tauri-apps/api/core');
    vi.mock('../../lib/supabase');
    vi.mock('../utils/tauri-bridge.ts');
    vi.mock('../../utils/platform-adapters/updater');
    vi.mock('../../../utils/platform-capabilities/center');
  `;
  assert.deepEqual(findInternalMocks(source), []);
});

test('fails only files that grew, and reports files that shrank', () => {
  const result = compareToBaseline(
    { 'a.test.ts': 3, 'b.test.ts': 1, 'new.test.ts': 1 },
    { 'a.test.ts': 2, 'b.test.ts': 4 },
  );
  assert.deepEqual(result.increases, [
    { file: 'a.test.ts', now: 3, allowed: 2 },
    { file: 'new.test.ts', now: 1, allowed: 0 },
  ]);
  assert.deepEqual(result.decreases, [
    { file: 'b.test.ts', now: 1, allowed: 4 },
  ]);
});
