import '@stryker-mutator/vitest-runner';
import { FULL_MUTATION_SCOPE } from './tools/quality/mutation-scope.mjs';

export default {
  testRunner: 'vitest',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  mutate: FULL_MUTATION_SCOPE,
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  thresholds: {
    high: 90,
    low: 80,
    break: 84,
  },
  vitest: {
    configFile: 'vitest.config.ts',
  },
  timeoutMS: 60000,
  concurrency: 4,
  tempDirName: '.stryker-tmp',
};
