import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

function parseCsp(policy) {
  return new Map(
    policy
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  );
}

function netlifyHeader(name) {
  const match = read('netlify.toml').match(
    new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, 'm'),
  );
  assert.ok(match, `netlify.toml must set ${name}`);
  return match[1];
}

const webCsp = parseCsp(netlifyHeader('Content-Security-Policy'));
const tauriCsp = parseCsp(
  JSON.parse(read('src-tauri/tauri.conf.json')).app.security.csp,
);

test('index.html has no inline scripts for the strict CSP to block', () => {
  const scripts = [...read('index.html').matchAll(/<script\b([^>]*)>/g)];
  assert.ok(scripts.length > 0);
  for (const [tag, attributes] of scripts)
    assert.match(attributes, /\bsrc=/, `inline script: ${tag}`);
});

test('web CSP only runs same-origin scripts and cannot be framed', () => {
  assert.deepEqual(webCsp.get('script-src'), ["'self'"]);
  assert.deepEqual(webCsp.get('object-src'), ["'none'"]);
  assert.deepEqual(webCsp.get('frame-ancestors'), ["'none'"]);
  assert.equal(netlifyHeader('X-Content-Type-Options'), 'nosniff');
  assert.equal(netlifyHeader('X-Frame-Options'), 'DENY');
});

test('web and Tauri CSPs allow the same script and API origins', () => {
  for (const directive of ['script-src', 'connect-src'])
    assert.deepEqual(
      [...webCsp.get(directive)].sort(),
      [...tauriCsp.get(directive)].sort(),
      directive,
    );
});
