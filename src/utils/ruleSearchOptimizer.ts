/**
 * Rule search optimizer facade.
 * Coordinates indexing, caching, duplicate detection, and suggestions.
 */

import { ExceptionRuleType } from '../types';
import type { ExceptionRule } from '../types';
import {
  getCompletionSuggestions,
  getSimilarSuggestions,
  RuleDuplicateDetector,
  RuleSearchCache,
  RuleSearchIndex,
  type SearchResult,
  type SearchSuggestion,
} from './rule-search-optimizer';

export type { SearchResult } from './rule-search-optimizer';

export class RuleSearchOptimizer {
  private readonly index = new RuleSearchIndex();
  private readonly cache = new RuleSearchCache();
  private readonly duplicates = new RuleDuplicateDetector();

  updateIndex(rules: ExceptionRule[]): void {
    this.cache.clearCache(); // Clear stale cache entries after index updates.
    this.index.updateIndex(rules);
  }

  searchRules(rules: ExceptionRule[], query: string): SearchResult[] {
    if (!query.trim()) {
      return rules
        .map((rule) => ({
          rule,
          score: rule.usageCount || 0,
          matchType: 'exact' as const,
          highlightRanges: [],
        }))
        .sort((a, b) => b.score - a.score);
    }

    const normalizedQuery = query.toLowerCase().trim();

    if (this.index.ensureIndexUpToDate(rules)) {
      this.cache.clearCache();
    }

    const cacheKey = `${normalizedQuery}_${this.index.getIndexRevision()}`;
    const cached = this.cache.getCachedSearchResults(cacheKey);
    if (cached) return cached;

    const results = this.index.search(normalizedQuery);

    this.cache.cacheSearchResult(cacheKey, results);
    this.cache.recordSearch(query);

    return results;
  }

  getSearchSuggestions(
    query: string,
    rules: ExceptionRule[],
  ): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
      suggestions.push(...this.cache.getHistorySuggestions());
      suggestions.push(...this.cache.getPopularSuggestions());
      return suggestions.slice(0, 5);
    }

    suggestions.push(...getSimilarSuggestions(normalizedQuery, rules));
    suggestions.push(...getCompletionSuggestions(normalizedQuery, rules));

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  detectDuplicates(
    name: string,
    existingRules: ExceptionRule[],
  ): {
    hasExactMatch: boolean;
    exactMatches: ExceptionRule[];
    similarRules: ExceptionRule[];
  } {
    return this.duplicates.detectDuplicates(name, existingRules);
  }

  generateNameSuggestions(
    partialName: string,
    actionType: ExceptionRuleType,
  ): string[] {
    return this.duplicates.generateNameSuggestions(partialName, actionType);
  }

  clearCache(): void {
    this.cache.clearCache();
  }

  getSearchStats(): {
    cacheSize: number;
    historySize: number;
    popularSearches: Array<{ query: string; count: number }>;
  } {
    return this.cache.getSearchStats();
  }
}
