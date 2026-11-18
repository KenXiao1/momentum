/**
 * Finds vi.mock / vi.doMock calls that replace the project's own modules.
 * Mocking a package or a native/cloud boundary is allowed; mocking internal
 * code makes a test assert calls instead of behavior.
 */
const MOCK_CALL =
  /\bvi\.(?:doMock|mock)\(\s*(?:import\(\s*)?(['"`])([^'"`]+)\1/g;

export const ALLOWED_INTERNAL_BOUNDARIES = [
  /(^|\/)lib\/supabase$/,
  /(^|\/)utils\/tauri-bridge$/,
  /(^|\/)utils\/platform-adapters(\/|$)/,
  /(^|\/)utils\/platform-capabilities(\/|$)/,
];

export function findInternalMocks(source) {
  const found = [];
  for (const match of source.matchAll(MOCK_CALL)) {
    const specifier = match[2];
    if (!specifier.startsWith('.')) continue;
    const target = specifier.replace(/\.[cm]?[jt]sx?$/, '');
    if (ALLOWED_INTERNAL_BOUNDARIES.some((pattern) => pattern.test(target)))
      continue;
    found.push(specifier);
  }
  return found;
}

/** Files whose internal-mock count rose above, or fell below, the baseline. */
export function compareToBaseline(counts, baseline) {
  const increases = [];
  const decreases = [];
  const files = new Set([...Object.keys(counts), ...Object.keys(baseline)]);
  for (const file of [...files].sort()) {
    const now = counts[file] ?? 0;
    const allowed = baseline[file] ?? 0;
    if (now > allowed) increases.push({ file, now, allowed });
    else if (now < allowed) decreases.push({ file, now, allowed });
  }
  return { increases, decreases };
}
