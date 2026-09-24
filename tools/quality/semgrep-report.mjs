export function validateSemgrepReport(report) {
  if (!report || typeof report.version !== 'string' || !report.version.trim()) {
    throw new Error('Semgrep report has no scanner version');
  }
  if (!Array.isArray(report.errors) || report.errors.length !== 0) {
    throw new Error('Semgrep scan reported errors or omitted error status');
  }
  if (!Array.isArray(report.results)) {
    throw new Error('Semgrep report has no results array');
  }
  if (
    !Array.isArray(report.paths?.scanned) ||
    !report.paths.scanned.some((file) => /^src\/.*\.[jt]sx?$/.test(file))
  ) {
    throw new Error('Semgrep did not scan application source files');
  }
  if (report.results.length !== 0) {
    throw new Error(`Semgrep found ${report.results.length} blocking findings`);
  }
  return report.paths.scanned.length;
}
