import assert from 'node:assert/strict';
import test from 'node:test';
import { findErrorHandlingViolations } from '../error-handling.mjs';

const rules = (source) =>
  findErrorHandlingViolations(source).map((violation) => violation.rule);

test('flags a catch that only logs and rethrows the same error', () => {
  assert.deepEqual(
    rules(`async function load() {
      try { await read(); } catch (error) {
        logger.error('X', 'failed', { id }, toError(error));
        throw error;
      }
    }`),
    ['log-and-rethrow'],
  );
});

test('allows a catch that adds handling before rethrowing', () => {
  assert.deepEqual(
    rules(`async function load() {
      try { await read(); } catch (error) {
        logger.error('X', 'failed');
        await rollback();
        throw error;
      }
    }`),
    [],
  );
});

test('flags a write function that silently swallows a failure', () => {
  assert.deepEqual(
    rules(`export function saveRules(data) {
      try { localStorage.setItem('k', data); } catch {
        // ignore quota errors
      }
    }`),
    ['swallowed-write'],
  );
});

test('accepts a documented best-effort write and a reported failure', () => {
  assert.deepEqual(
    rules(`export const setTheme = (theme) => {
      try { localStorage.setItem('t', theme); } catch {
        // best-effort: a lost theme preference falls back to the system theme
      }
    };
    export async function saveChains(chains) {
      try { await write(chains); } catch (error) {
        toast.error('Save failed');
        return false;
      }
    }`),
    [],
  );
});

test('ignores swallowing outside write functions and honors the opt-out marker', () => {
  assert.deepEqual(
    rules(`export function readTheme() {
      try { return localStorage.getItem('t'); } catch { return null; }
    }
    async function load() {
      try { await read(); } catch (error) {
        // error-handling: the retry wrapper above reads these logs
        logger.warn('X', 'retrying');
        throw error;
      }
    }`),
    [],
  );
});
