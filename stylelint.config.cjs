module.exports = {
  extends: ['stylelint-config-recommended', 'stylelint-config-tailwindcss'],
  ignoreFiles: [
    '**/node_modules/**',
    'dist/**',
    'coverage/**',
    'reports/**',
    'tools/quality/reports/**',
  ],
  rules: {
    'no-empty-source': null,
    // Local-dev friendly: keep Stylelint focused on correctness.
    'property-no-vendor-prefix': null,
    'property-no-deprecated': null,
    'declaration-property-value-keyword-no-deprecated': null,
    'media-feature-name-value-no-unknown': null,
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
    // Stylelint 18 cannot parse Tailwind variants or arbitrary values in @apply.
    'at-rule-prelude-no-invalid': [true, { ignoreAtRules: ['apply'] }],
  },
};
