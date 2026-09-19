import { useEffect, useMemo, useState } from 'react';
import type { ExceptionRule } from '../../types';
import {
  RuleSearchOptimizer,
  type SearchResult,
} from '../../utils/ruleSearchOptimizer';

export function useRuleSearchResults(rules: ExceptionRule[], query: string) {
  const optimizer = useMemo(() => new RuleSearchOptimizer(), []);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!rules.length || !query.trim()) {
      setResults(optimizer.searchRules(rules, ''));
      return;
    }
    const timer = setTimeout(() => {
      setResults(optimizer.searchRules(rules, query));
    }, 200);
    return () => clearTimeout(timer);
  }, [optimizer, query, rules]);

  return {
    results,
    detectDuplicates: (name: string) => optimizer.detectDuplicates(name, rules),
  };
}
