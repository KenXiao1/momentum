import type { ExceptionRule } from '../../types';
import { calculateSimilarity } from '../stringUtils';
import { getFirstLetters, getPinyin } from './pinyin';
import { applyUsageBonuses, scoreRule } from './scoring';
import type { SearchResult } from './types';

export class RuleSearchIndex {
  private lastIndexedRulesRef: ExceptionRule[] | null = null;
  private indexRevision = 0;

  private indexedRules: ExceptionRule[] = [];
  private indexedRuleNamesLower: string[] = [];
  private indexedRulePinyinLower: string[] = [];
  private indexedRuleFirstLettersLower: string[] = [];

  private prefixIndex: Map<string, Set<number>> = new Map();
  private bigramIndex: Map<string, Set<number>> = new Map();

  private readonly maxPrefixLen = 10;

  updateIndex(rules: ExceptionRule[]): void {
    this.lastIndexedRulesRef = rules;
    this.indexRevision += 1;

    this.prefixIndex.clear();
    this.bigramIndex.clear();

    this.indexedRules = rules;
    this.indexedRuleNamesLower = new Array(rules.length);
    this.indexedRulePinyinLower = new Array(rules.length);
    this.indexedRuleFirstLettersLower = new Array(rules.length);

    rules.forEach((rule, idx) => {
      const nameLower = String(rule.name || '').toLowerCase();
      const pinyinLower = getPinyin(String(rule.name || '')).toLowerCase();
      const firstLettersLower = getFirstLetters(
        String(rule.name || ''),
      ).toLowerCase();

      this.indexedRuleNamesLower[idx] = nameLower;
      this.indexedRulePinyinLower[idx] = pinyinLower;
      this.indexedRuleFirstLettersLower[idx] = firstLettersLower;

      const keys = [nameLower, pinyinLower, firstLettersLower].filter(Boolean);
      for (const key of keys) {
        this.indexKeyPrefixes(key, idx);
        this.indexKeyBigrams(key, idx);
      }
    });
  }

  ensureIndexUpToDate(rules: ExceptionRule[]): boolean {
    if (this.lastIndexedRulesRef === rules) return false;
    this.updateIndex(rules);
    return true;
  }

  getIndexRevision(): number {
    return this.indexRevision;
  }

  search(normalizedQuery: string): SearchResult[] {
    const results: SearchResult[] = [];

    const candidates = this.getCandidateRuleIndexes(normalizedQuery);
    if (candidates.size > 0) {
      for (const idx of candidates) {
        const searchResult = this.scoreRuleAtIndex(idx, normalizedQuery);
        if (searchResult.score > 0) results.push(searchResult);
      }
    } else {
      for (let idx = 0; idx < this.indexedRules.length; idx++) {
        const searchResult = this.scoreRuleAtIndex(idx, normalizedQuery);
        if (searchResult.score > 0) results.push(searchResult);
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.rule.usageCount || 0) - (a.rule.usageCount || 0);
    });

    return results;
  }

  private indexKeyPrefixes(key: string, ruleIndex: number): void {
    const maxLen = Math.min(this.maxPrefixLen, key.length);
    for (let i = 1; i <= maxLen; i++) {
      const prefix = key.slice(0, i);
      let bucket = this.prefixIndex.get(prefix);
      if (!bucket) {
        bucket = new Set<number>();
        this.prefixIndex.set(prefix, bucket);
      }
      bucket.add(ruleIndex);
    }
  }

  private indexKeyBigrams(key: string, ruleIndex: number): void {
    if (key.length < 2) return;
    for (let i = 0; i < key.length - 1; i++) {
      const gram = key.slice(i, i + 2);
      let bucket = this.bigramIndex.get(gram);
      if (!bucket) {
        bucket = new Set<number>();
        this.bigramIndex.set(gram, bucket);
      }
      bucket.add(ruleIndex);
    }
  }

  private addAll(target: Set<number>, source: Set<number> | undefined): void {
    if (!source) return;
    for (const idx of source) target.add(idx);
  }

  private getBigrams(text: string): string[] {
    if (text.length < 2) return [];
    const grams: string[] = [];
    for (let i = 0; i < text.length - 1; i++) {
      grams.push(text.slice(i, i + 2));
    }
    return grams;
  }

  private intersectBuckets(buckets: Set<number>[]): Set<number> {
    if (buckets.length === 0) return new Set<number>();

    const sorted = [...buckets].sort((a, b) => a.size - b.size);
    let intersection = new Set<number>(sorted[0]);

    for (let i = 1; i < sorted.length; i++) {
      const bucket = sorted[i];
      const next = new Set<number>();
      for (const idx of intersection) {
        if (bucket.has(idx)) next.add(idx);
      }
      intersection = next;
      if (intersection.size === 0) break;
    }

    return intersection;
  }

  private getCandidateRuleIndexes(normalizedQuery: string): Set<number> {
    const candidates = new Set<number>();

    this.addAll(candidates, this.prefixIndex.get(normalizedQuery));

    const grams = this.getBigrams(normalizedQuery);
    if (grams.length === 0) return candidates;

    const buckets: Set<number>[] = [];
    for (const gram of grams) {
      const bucket = this.bigramIndex.get(gram);
      if (!bucket) return candidates;
      buckets.push(bucket);
    }

    this.addAll(candidates, this.intersectBuckets(buckets));

    return candidates;
  }

  private scoreRuleAtIndex(
    ruleIndex: number,
    normalizedQuery: string,
  ): SearchResult {
    const rule = this.indexedRules[ruleIndex];

    const base = scoreRule(rule, normalizedQuery);
    if (base.score > 0) return base;

    const pinyin = this.indexedRulePinyinLower[ruleIndex] || '';
    const firstLetters = this.indexedRuleFirstLettersLower[ruleIndex] || '';
    const nameLower = this.indexedRuleNamesLower[ruleIndex] || '';

    let baseScore = 0;
    let matchType: SearchResult['matchType'] = 'fuzzy';

    if (pinyin === normalizedQuery || firstLetters === normalizedQuery) {
      baseScore = 700;
      matchType = 'exact';
    } else if (
      pinyin.startsWith(normalizedQuery) ||
      firstLetters.startsWith(normalizedQuery)
    ) {
      baseScore = 550;
      matchType = 'prefix';
    } else if (
      pinyin.includes(normalizedQuery) ||
      firstLetters.includes(normalizedQuery)
    ) {
      baseScore = 450;
      matchType = 'contains';
    } else {
      const similarity = Math.max(
        calculateSimilarity(pinyin, normalizedQuery),
        calculateSimilarity(firstLetters, normalizedQuery),
        calculateSimilarity(nameLower, normalizedQuery),
      );
      if (similarity > 0.3) {
        baseScore = Math.floor(similarity * 300);
      }
    }

    if (baseScore <= 0) {
      return { rule, score: 0, matchType: 'fuzzy', highlightRanges: [] };
    }

    return {
      rule,
      score: applyUsageBonuses(rule, baseScore),
      matchType,
      highlightRanges: [],
    };
  }
}
