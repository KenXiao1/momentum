import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'coverage',
      'dist',
      'stats.html',
      'archive',
      'tools',
      'src/**/__tests__/**',
      'src/**/__mocks__/**',
      'src/test/**',
      'src/**/*.test.*',
      'src/**/*.spec.*',
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintConfigPrettier,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      sonarjs,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
          message:
            'Do not use `as any`; use proper types or `unknown` + narrowing.',
        },
        {
          selector: "TSTypeAssertion[typeAnnotation.type='TSAnyKeyword']",
          message:
            'Do not use `<any>` type assertions; use proper types or `unknown` + narrowing.',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-identical-conditions': 'warn',
      'sonarjs/no-identical-expressions': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-inverted-boolean-check': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/no-redundant-boolean': 'warn',
      'sonarjs/no-redundant-jump': 'warn',
      'sonarjs/no-use-of-empty-return-value': 'warn',
      'sonarjs/no-duplicate-string': [
        'warn',
        {
          threshold: 5,
          ignoreStrings: 'application/json',
        },
      ],
    },
  },
  {
    files: [
      'src/components/BettingModal.tsx',
      'src/components/ChainCard.tsx',
      'src/components/ChainDetail.tsx',
      'src/components/MigrationDialog.tsx',
      'src/components/RecycleBinModal.tsx',
      'src/components/TaskGroupEditor.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
