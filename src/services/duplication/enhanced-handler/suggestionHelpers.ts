import type { ExceptionRule } from '../../../types';
import { getCurrentLanguage, t } from '../../../utils/runtimeI18n';
import type { DuplicationConflictType, DuplicationSuggestion } from './types';

export function generateNameSuggestions(
  baseName: string,
  existingNames: string[],
): string[] {
  const suggestions: string[] = [];

  for (let i = 2; i <= 5; i++) {
    const suggestion = `${baseName} ${i}`;
    if (
      !existingNames.some(
        (name) => name.toLowerCase() === suggestion.toLowerCase(),
      )
    ) {
      suggestions.push(suggestion);
    }
  }

  const language = getCurrentLanguage();
  const descriptiveSuffixes = [
    t('duplication.nameSuffix.new'),
    t('duplication.nameSuffix.spare'),
    t('duplication.nameSuffix.temp'),
    t('duplication.nameSuffix.special'),
  ];
  for (const suffix of descriptiveSuffixes) {
    const suggestion = `${baseName}(${suffix})`;
    if (
      !existingNames.some(
        (name) => name.toLowerCase() === suggestion.toLowerCase(),
      )
    ) {
      suggestions.push(suggestion);
    }
  }

  const timestamp = new Date()
    .toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/\//g, '');
  const timestampSuggestion = `${baseName}_${timestamp}`;
  if (
    !existingNames.some(
      (name) => name.toLowerCase() === timestampSuggestion.toLowerCase(),
    )
  ) {
    suggestions.push(timestampSuggestion);
  }

  return suggestions.slice(0, 3);
}

export function generateSuggestions(
  name: string,
  conflictType: DuplicationConflictType,
  existingRules: ExceptionRule[],
): DuplicationSuggestion[] {
  const suggestions: DuplicationSuggestion[] = [];

  if (conflictType === 'exact') {
    const existingRule = existingRules[0];

    suggestions.push({
      type: 'use_existing',
      title: t('duplication.enhancedHandler.suggestionHelpers.useExistingRule'),
      description: t(
        'duplication.enhancedHandler.suggestionHelpers.useTheExistingRuleExistingRuleName',
        { existingRuleName: existingRule.name },
      ),
      rule: existingRule,
      handler: async () => existingRule,
    });

    const nameSuggestions = generateNameSuggestions(
      name,
      existingRules.map((r) => r.name),
    );

    nameSuggestions.forEach((suggestedName) => {
      suggestions.push({
        type: 'modify_name',
        title: t('duplication.enhancedHandler.suggestionHelpers.changeName'),
        description: t(
          'duplication.enhancedHandler.suggestionHelpers.useTheSuggestedNameSuggestedName',
          { suggestedName: suggestedName },
        ),
        suggestedName,
        handler: async () => null,
      });
    });
  } else if (conflictType === 'similar') {
    suggestions.push({
      type: 'create_anyway',
      title: t('enhancedDuplicationHandler.continue'),
      description: t(
        'duplication.enhancedHandler.suggestionHelpers.nameIsSimilarButNotIdenticalYouCanContinue',
      ),
      handler: async () => null,
    });

    if (existingRules.length > 0) {
      const mostSimilar = existingRules[0];
      suggestions.push({
        type: 'use_existing',
        title: t(
          'duplication.enhancedHandler.suggestionHelpers.useSimilarRule',
        ),
        description: t(
          'duplication.enhancedHandler.suggestionHelpers.considerUsingTheSimilarRuleMostSimilarName',
          { mostSimilarName: mostSimilar.name },
        ),
        rule: mostSimilar,
        handler: async () => mostSimilar,
      });
    }
  }

  return suggestions;
}

export function getConflictMessage(
  conflictType: DuplicationConflictType,
  existingRules: ExceptionRule[],
): string {
  if (conflictType === 'exact') {
    return t(
      'duplication.enhancedHandler.suggestionHelpers.ruleNameExistingRules0nameAlreadyExists',
      { existingRules0Name: existingRules[0].name },
    );
  }

  if (conflictType === 'similar') {
    const similarNames = existingRules.map((r) => r.name).join('", "');
    return t(
      'duplication.enhancedHandler.suggestionHelpers.foundSimilarRuleNameSSimilarNames',
      { similarNames: similarNames },
    );
  }

  return t('duplication.enhancedHandler.suggestionHelpers.noConflictDetected');
}
