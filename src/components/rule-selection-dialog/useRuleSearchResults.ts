import { useEffect, useMemo, useState } from 'react';
import type { ExceptionRule } from '../../types';
import { RuleSearchOptimizer } from '../../utils/ruleSearchOptimizer';

const SEARCH_DEBOUNCE_MS = 200;

interface SearchInput {
  rules: ExceptionRule[];
  query: string;
}

export function useRuleSearchResults(rules: ExceptionRule[], query: string) {
  const optimizer = useMemo(() => new RuleSearchOptimizer(), []);
  // Input of the last debounced search. A typed query keeps showing the
  // previous results until the debounce fires; no query lists rules at once.
  const [searched, setSearched] = useState<SearchInput | null>(null);
  const isFiltering = rules.length > 0 && query.trim().length > 0;

  useEffect(() => {
    const timer = setTimeout(
      () => setSearched({ rules, query: isFiltering ? query : '' }),
      isFiltering ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [isFiltering, query, rules]);

  const results = useMemo(() => {
    if (!isFiltering) return optimizer.searchRules(rules, '');
    if (!searched) return [];
    return optimizer.searchRules(searched.rules, searched.query);
  }, [optimizer, isFiltering, rules, searched]);

  return {
    results,
    detectDuplicates: (name: string) => optimizer.detectDuplicates(name, rules),
  };
}
