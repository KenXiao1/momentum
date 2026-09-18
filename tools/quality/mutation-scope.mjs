export const CRITICAL_MUTATION_TARGETS = Object.freeze([
  'src/components/betting-modal/betPlacementRules.ts',
  'src/hooks/domains/sessions/scheduling.ts',
  'src/hooks/domains/rsip/viewInteractionRules.ts',
]);

export const CRITICAL_MUTATION_TEST_FILES = Object.freeze([
  'src/components/betting-modal/betPlacementRules.test.ts',
  'src/hooks/domains/sessions/__tests__/scheduling.test.ts',
  'src/hooks/domains/rsip/__tests__/viewInteractionRules.test.ts',
]);

export const CRITICAL_MUTATION_THRESHOLDS = Object.freeze({
  minimumScore: 100,
  maximumNoCoverage: 0,
});

export const SEMANTIC_MUTATION_ROOTS = Object.freeze([
  'src/hooks/domains/sessions',
  'src/hooks/domains/rsip',
]);

export const SEMANTIC_MUTATION_FILES = Object.freeze([
  'src/components/betting-modal/betPlacementRules.ts',
  'src/hooks/domains/appStateAccess.ts',
  'src/hooks/domains/importPersistence.ts',
  'src/hooks/domains/useSafeSaveChains.ts',
]);

export const MUTATION_SCOPE_EXCLUSIONS = Object.freeze([
  Object.freeze({
    file: 'src/hooks/domains/rsip/types.ts',
    reason: 'Type-only declarations do not produce runtime mutants.',
    owner: 'frontend-platform',
    expiresAt: '2027-01-31',
  }),
]);

const semanticPatterns = [
  ...SEMANTIC_MUTATION_ROOTS.flatMap((root) => [
    `${root}/**/*.ts`,
    `${root}/**/*.tsx`,
  ]),
  ...SEMANTIC_MUTATION_FILES,
];

const establishedPatterns = [
  'src/hooks/domains/use*Domain.ts',
  'src/utils/storage/chains.ts',
  'src/utils/storage/sessions.ts',
  'src/utils/storage/rsip.ts',
  'src/utils/storage/pet.ts',
  'src/utils/chain-tree/groupOperations.ts',
  'src/utils/chain-tree/treeBuilder.ts',
  'src/domain/errors.ts',
  'src/domain/result.ts',
  'src/infra/storage/supabase/retry.ts',
  'src/services/errorClassification/ErrorClassifiers.ts',
  'src/services/rule-classification/RuleTypeValidator.ts',
  'src/services/rule-classification/ruleValidator.ts',
  'src/services/recovery/RecoveryStrategy.ts',
  'src/utils/local-preferences/timerState.ts',
];

export const FULL_MUTATION_SCOPE = Object.freeze([
  ...semanticPatterns,
  ...establishedPatterns,
  '!src/hooks/domains/**/__tests__/**',
  '!src/hooks/domains/**/*.{test,spec}.ts',
  ...MUTATION_SCOPE_EXCLUSIONS.map(({ file }) => `!${file}`),
]);
