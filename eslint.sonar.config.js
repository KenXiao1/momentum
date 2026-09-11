import baseConfig from './eslint.config.js';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  ...baseConfig,
  { ignores: ['src/lib/database.types.ts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: sonarjs.configs.recommended.rules,
  },
];
