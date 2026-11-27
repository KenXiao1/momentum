import { describe, expect, it } from 'vitest';
import { createGroupChain, createUnitChain } from '../../test/factories';
import { buildChainTree } from '../../utils/chain-tree';
import { decodeChainTagSet } from '../../serialization';
import {
  ChainTagError,
  chainTagsFor,
  createTag,
  defaultChainTagSet,
  deleteTag,
  filterChainTreeByTags,
  mergeImportedTags,
  setChainTagIds,
  tagUsage,
  updateTag,
} from '../chainTags';

const defaults = defaultChainTagSet((type) => `Old ${type}`);
const ids = (tags: { id: string }[]) => tags.map((tag) => tag.id);

describe('chain tags', () => {
  it('starts with one tag per old category, with ids every device shares', () => {
    expect(ids(defaults.tags)).toEqual([
      'legacy:assault',
      'legacy:recon',
      'legacy:command',
      'legacy:special_ops',
      'legacy:engineering',
      'legacy:quartermaster',
    ]);
    expect(defaults.tags[0]).toMatchObject({
      name: 'Old assault',
      color: 'rose',
      legacyType: 'assault',
    });
  });

  it('shows the old category as a tag until the chain’s tags are set', () => {
    const study = createUnitChain({ id: 'study', type: 'assault' });
    const plain = createUnitChain({ id: 'plain', type: 'unit' });

    expect(ids(chainTagsFor(defaults, study))).toEqual(['legacy:assault']);
    expect(chainTagsFor(defaults, plain)).toEqual([]);

    const cleared = setChainTagIds(defaults, 'study', []);
    expect(chainTagsFor(cleared, study)).toEqual([]);
  });

  it('creates, renames, recolors and deletes tags', () => {
    const { set, tag } = createTag(
      defaults,
      { name: '  Deep work ', color: 'blue' },
      'tag-1',
    );
    expect(tag).toEqual({ id: 'tag-1', name: 'Deep work', color: 'blue' });

    const tagged = setChainTagIds(set, 'c1', ['tag-1', 'missing', 'tag-1']);
    expect(tagged.assignments.c1).toEqual(['tag-1']);

    const renamed = updateTag(tagged, 'tag-1', {
      name: 'Focus',
      color: 'cyan',
    });
    expect(renamed.tags[renamed.tags.length - 1]).toEqual({
      id: 'tag-1',
      name: 'Focus',
      color: 'cyan',
    });

    const removed = deleteTag(renamed, 'tag-1');
    expect(ids(removed.tags)).not.toContain('tag-1');
    expect(removed.assignments.c1).toEqual([]);
  });

  it('rejects empty, overlong and duplicate names', () => {
    const reason = (run: () => unknown) => {
      try {
        run();
      } catch (error) {
        return error instanceof ChainTagError ? error.reason : 'other';
      }
      return 'none';
    };
    expect(
      reason(() => createTag(defaults, { name: ' ', color: 'blue' }, 'x')),
    ).toBe('empty-name');
    expect(
      reason(() =>
        createTag(defaults, { name: 'x'.repeat(31), color: 'blue' }, 'x'),
      ),
    ).toBe('name-too-long');
    expect(
      reason(() =>
        createTag(defaults, { name: 'old ASSAULT', color: 'blue' }, 'x'),
      ),
    ).toBe('duplicate-name');
    expect(
      reason(() =>
        updateTag(defaults, 'legacy:recon', { name: 'Old assault' }),
      ),
    ).toBe('duplicate-name');
    expect(
      reason(() => updateTag(defaults, 'legacy:recon', { name: 'Old recon' })),
    ).toBe('none');
  });

  it('merges imported tags by id or name and moves assignments to new chain ids', () => {
    const current = createTag(
      defaults,
      { name: 'Focus', color: 'blue' },
      'mine',
    ).set;
    const imported = {
      tags: [
        { id: 'theirs', name: 'focus', color: 'rose' as const },
        { id: 'legacy:recon', name: 'Recon', color: 'emerald' as const },
        { id: 'new', name: 'Health', color: 'emerald' as const },
      ],
      assignments: { a: ['theirs', 'new'], b: ['legacy:recon'], gone: ['new'] },
    };

    const merged = mergeImportedTags(
      current,
      imported,
      new Map([
        ['a', 'a2'],
        ['b', 'b2'],
      ]),
    );

    expect(ids(merged.tags).filter((id) => !id.startsWith('legacy:'))).toEqual([
      'mine',
      'new',
    ]);
    expect(merged.assignments).toEqual({
      a2: ['mine', 'new'],
      b2: ['legacy:recon'],
    });
  });
});

describe('decodeChainTagSet', () => {
  it('keeps valid tags and assignments and drops the rest', () => {
    expect(
      decodeChainTagSet({
        tags: [
          { id: 't1', name: 'Focus', color: 'blue', legacyType: 'nope' },
          { id: 't2', name: 'Odd', color: 'neon' },
          { id: '', name: 'No id' },
          'junk',
        ],
        assignments: { c1: ['t1', 3], c2: 'bad' },
      }),
    ).toEqual({
      tags: [
        { id: 't1', name: 'Focus', color: 'blue' },
        { id: 't2', name: 'Odd', color: 'slate' },
      ],
      assignments: { c1: ['t1'] },
    });
    expect(decodeChainTagSet(null)).toBeNull();
    expect(decodeChainTagSet({ tags: 'x' })).toBeNull();
  });
  describe('filtering', () => {
    const study = createUnitChain({ id: 'study', type: 'assault' });
    const run = createUnitChain({ id: 'run', type: 'recon' });
    const group = createGroupChain({ id: 'group' });
    const nested = createUnitChain({
      id: 'nested',
      type: 'unit',
      parentId: 'group',
    });
    const set = setChainTagIds(defaults, 'nested', ['legacy:recon']);
    const chains = [study, run, group, nested];
    const tree = buildChainTree(chains);

    it('counts only the tags chains show, in list order', () => {
      expect(
        tagUsage(set, chains).map(({ tag, count }) => [tag.id, count]),
      ).toEqual([
        ['legacy:assault', 1],
        ['legacy:recon', 2],
      ]);
    });

    it('keeps chains with any chosen tag, and groups holding one', () => {
      expect(ids(filterChainTreeByTags(tree, set, new Set()))).toEqual(
        ids(tree),
      );
      expect(
        ids(filterChainTreeByTags(tree, set, new Set(['legacy:assault']))),
      ).toEqual(['study']);
      expect(
        ids(filterChainTreeByTags(tree, set, new Set(['legacy:recon']))),
      ).toEqual(['run', 'group']);
      expect(
        ids(
          filterChainTreeByTags(
            tree,
            set,
            new Set(['legacy:assault', 'legacy:recon']),
          ),
        ),
      ).toEqual(['study', 'run', 'group']);
    });
  });
});
