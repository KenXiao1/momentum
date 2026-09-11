export const QUALITY_CHECKS = Object.freeze([
  {
    id: 'mutation-critical',
    label: 'Critical mutation tests',
    script: 'test:mutation:critical',
    lanes: ['nightly'],
    reports: ['reports/mutation/critical.json'],
  },
  {
    id: 'mutation',
    label: 'Mutation tests',
    script: 'test:mutation',
    lanes: ['nightly'],
    reports: [],
  },
  {
    id: 'knip',
    label: 'Knip',
    script: 'quality:knip',
    lanes: ['smell-audit'],
    reports: [],
    textReportPath: 'reports/quality/knip.txt',
  },
  {
    id: 'jscpd',
    label: 'JSCPD',
    script: 'quality:jscpd',
    lanes: ['info', 'smell-audit'],
    reports: ['reports/jscpd/jscpd-report.json'],
  },
  {
    id: 'sonarjs',
    label: 'ESLint SonarJS',
    script: 'quality:sonar:report',
    lanes: ['info', 'smell-audit'],
    reports: ['reports/quality/eslint-sonarjs.json'],
    textReportPath: 'reports/quality/eslint-sonarjs.txt',
  },
  {
    id: 'npm-audit',
    label: 'npm audit',
    script: 'security:npm-audit',
    lanes: ['info'],
    reports: [],
  },
  {
    id: 'sqlfluff',
    label: 'SQL lint',
    script: 'lint:sql',
    lanes: ['info'],
    reports: [],
  },
  {
    id: 'test-runtime-budget',
    label: 'Test runtime budget',
    script: 'quality:test:runtime',
    lanes: ['info'],
    reports: ['reports/quality/test-runtime-budget.json'],
  },
  {
    id: 'mutation-hotspots-required',
    label: 'Mutation hotspots freshness gate',
    script: 'quality:test:mutation-hotspots:required',
    lanes: ['nightly'],
    reports: ['reports/quality/test-mutation-hotspots.json'],
  },
]);

export const QUALITY_LANES = Object.freeze({
  info: {
    id: 'info',
    label: 'Informational quality lane',
    exitPolicy: 'info',
    summaryJsonPath: 'reports/quality/info-summary.json',
    summaryMarkdownPath: 'reports/quality/info-summary.md',
    logsDir: 'reports/quality/info-logs',
    checks: QUALITY_CHECKS.filter((check) => check.lanes.includes('info')).map(
      (check) => check.id,
    ),
  },
  'smell-audit': {
    id: 'smell-audit',
    label: 'Smell audit',
    exitPolicy: 'info',
    summaryJsonPath: 'reports/quality/smell-audit-summary.json',
    summaryMarkdownPath: 'reports/quality/smell-audit-summary.md',
    logsDir: 'reports/quality/smell-audit-logs',
    checks: QUALITY_CHECKS.filter((check) =>
      check.lanes.includes('smell-audit'),
    ).map((check) => check.id),
  },
  nightly: {
    id: 'nightly',
    label: 'Nightly quality lane',
    exitPolicy: 'required',
    summaryJsonPath: 'reports/quality/nightly-summary.json',
    summaryMarkdownPath: 'reports/quality/nightly-summary.md',
    logsDir: 'reports/quality/nightly-logs',
    checks: QUALITY_CHECKS.filter((check) =>
      check.lanes.includes('nightly'),
    ).map((check) => check.id),
  },
});

export function getLaneChecks(laneId) {
  const lane = QUALITY_LANES[laneId];
  if (!lane) {
    throw new Error(`Unknown quality lane "${laneId}".`);
  }

  return lane.checks.map((checkId) => {
    const check = QUALITY_CHECKS.find((entry) => entry.id === checkId);
    if (!check) {
      throw new Error(
        `Unknown quality check "${checkId}" in lane "${laneId}".`,
      );
    }
    return check;
  });
}

export function getLaneConfig(laneId) {
  const lane = QUALITY_LANES[laneId];
  if (!lane) {
    throw new Error(`Unknown quality lane "${laneId}".`);
  }

  return lane;
}
