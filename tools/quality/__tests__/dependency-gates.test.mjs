import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectBlockingAdvisories,
  findIntroducedAdvisories,
} from '../npm-audit-gate.mjs';
import {
  findTauriMismatches,
  parseCargoLockVersions,
} from '../tauri-versions.mjs';

const advisory = (name, severity, id) => ({
  name,
  severity,
  title: `${name} issue`,
  url: `https://github.com/advisories/${id}`,
});

const report = (...vias) => ({
  vulnerabilities: Object.fromEntries(
    vias.map((via) => [via.name, { severity: via.severity, via: [via] }]),
  ),
});

test('npm audit gate blocks only high and critical advisories', () => {
  const blocking = collectBlockingAdvisories({
    vulnerabilities: {
      braces: { via: [advisory('braces', 'high', 'GHSA-a')] },
      micromatch: { via: ['braces'] },
      minimatch: { via: [advisory('minimatch', 'moderate', 'GHSA-b')] },
      tar: { via: [advisory('tar', 'critical', 'GHSA-c')] },
    },
  });

  assert.deepEqual(
    [...blocking.values()].map((via) => via.name),
    ['braces', 'tar'],
  );
});

test('npm audit gate ignores advisories already present on the base', () => {
  const base = collectBlockingAdvisories(
    report(advisory('braces', 'high', 'GHSA-a')),
  );
  const head = collectBlockingAdvisories(
    report(
      advisory('braces', 'high', 'GHSA-a'),
      advisory('tar', 'critical', 'GHSA-c'),
    ),
  );

  assert.deepEqual(
    findIntroducedAdvisories(head, base).map((via) => via.name),
    ['tar'],
  );
  assert.deepEqual(findIntroducedAdvisories(base, head), []);
});

test('npm audit gate fails closed when the audit itself fails', () => {
  assert.throws(
    () => collectBlockingAdvisories({ error: { code: 'ENOTFOUND' } }),
    /npm audit failed/,
  );
  assert.throws(() => collectBlockingAdvisories({}), /no vulnerabilities/);
});

test('tauri version check pairs crates with their npm packages by major.minor', () => {
  const crates = parseCargoLockVersions(`
[[package]]
name = "tauri"
version = "2.10.2"

[[package]]
name = "tauri-plugin-notification"
version = "2.5.0"

[[package]]
name = "tauri-plugin-os"
version = "2.3.2"

[[package]]
name = "serde"
version = "1.0.228"
`);
  const packageLock = {
    packages: {
      'node_modules/@tauri-apps/api': { version: '2.10.1' },
      'node_modules/@tauri-apps/plugin-notification': { version: '2.3.3' },
    },
  };

  assert.deepEqual(findTauriMismatches(crates, packageLock), [
    {
      crate: 'tauri-plugin-notification',
      crateVersion: '2.5.0',
      npmName: '@tauri-apps/plugin-notification',
      npmVersion: '2.3.3',
    },
  ]);
});
