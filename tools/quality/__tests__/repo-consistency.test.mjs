import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('package.json, tauri.conf.json and Cargo.toml carry one app version', () => {
  const npmVersion = JSON.parse(read('package.json')).version;
  const tauriVersion = JSON.parse(read('src-tauri/tauri.conf.json')).version;
  const cargoVersion = read('src-tauri/Cargo.toml').match(
    /^\[package\][^[]*?^version = "([^"]+)"/ms,
  )?.[1];
  assert.equal(npmVersion, tauriVersion, 'package.json vs tauri.conf.json');
  assert.equal(cargoVersion, tauriVersion, 'Cargo.toml vs tauri.conf.json');
});

test('AGENTS.md and CLAUDE.md give agents the same instructions', () => {
  assert.equal(read('AGENTS.md'), read('CLAUDE.md'));
});
