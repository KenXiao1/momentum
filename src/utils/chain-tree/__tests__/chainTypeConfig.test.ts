import { describe, expect, it } from 'vitest';
import { getChainTypeConfig } from '../chainTypeConfig';

describe('chain-tree/chainTypeConfig', () => {
  it('distinguishes task groups from single chains', () => {
    expect(getChainTypeConfig('group', 'en')).toMatchObject({
      icon: 'layers',
      name: 'Group',
    });
    expect(getChainTypeConfig('unit', 'en')).toMatchObject({
      icon: 'link',
      name: 'Unit',
    });
  });

  it('shows old categories as plain chains, since they are tags now', () => {
    expect(getChainTypeConfig('special_ops', 'zh')).toEqual(
      getChainTypeConfig('unit', 'zh'),
    );
  });
});
