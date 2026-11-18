import { describe, expect, it } from 'vitest';
import type { RSIPNode, RSIPNodeGroup } from '../../../../types';
import {
  assessViolationGroup,
  getViolationDescendants,
} from '../viewInteractionRules';

const createdAt = new Date('2026-07-01T00:00:00.000Z');

function node(overrides: Partial<RSIPNode> = {}): RSIPNode {
  return {
    id: overrides.id ?? 'node-1',
    title: overrides.title ?? 'Policy',
    rule: overrides.rule ?? 'Rule',
    sortOrder: overrides.sortOrder ?? 1,
    createdAt: overrides.createdAt ?? createdAt,
    ...overrides,
  };
}

describe('RSIP view interaction rules', () => {
  it('uses the matching group rather than the first group', () => {
    const unrelatedGroup: RSIPNodeGroup = {
      id: 'unrelated-group',
      title: 'Unrelated',
      faultTolerance: 9,
      createdAt,
    };
    const targetGroup: RSIPNodeGroup = {
      id: 'target-group',
      title: 'Core',
      faultTolerance: 1,
      createdAt,
    };
    const nodes = [
      node({ id: 'unrelated-node', groupId: unrelatedGroup.id }),
      node({ id: 'target-peer', groupId: targetGroup.id }),
      node({ id: 'target-node', groupId: targetGroup.id }),
    ];

    expect(
      assessViolationGroup(nodes[2], [unrelatedGroup, targetGroup]),
    ).toEqual({
      status: 'tolerated',
      groupTitle: 'Core',
    });
    expect(
      assessViolationGroup(nodes[2], [
        unrelatedGroup,
        { ...targetGroup, faultTolerance: 0 },
      ]),
    ).toEqual({ status: 'collapse', groupTitle: 'Core' });
  });

  it('returns no group assessment for ungrouped and missing-group nodes', () => {
    const group: RSIPNodeGroup = {
      id: 'known-group',
      title: 'Known',
      faultTolerance: 1,
      createdAt,
    };

    expect(assessViolationGroup(node(), [group])).toEqual({
      status: 'none',
    });
    expect(
      assessViolationGroup(node({ id: 'orphan', groupId: 'missing-group' }), [
        group,
      ]),
    ).toEqual({ status: 'none' });
  });

  it('returns the exact descendants of a non-first target', () => {
    const unrelated = node({ id: 'unrelated' });
    const root = node({ id: 'root' });
    const child = node({ id: 'child', parentId: 'root' });
    const grandchild = node({ id: 'grandchild', parentId: 'child' });
    const nodes = [unrelated, root, child, grandchild];

    expect(getViolationDescendants(nodes, 'root')).toEqual([child, grandchild]);
  });

  it('uses reinforcement to absorb a group violation before assessing collapse', () => {
    const group: RSIPNodeGroup = {
      id: 'protected-group',
      title: 'Protected',
      faultTolerance: 0,
      createdAt,
    };
    const protectedNode = node({ groupId: group.id, reinforcementLevel: 1 });
    expect(assessViolationGroup(protectedNode, [group])).toEqual({
      status: 'none',
    });
    expect(
      assessViolationGroup({ ...protectedNode, reinforcementLevel: 0 }, [
        group,
      ]),
    ).toEqual({ status: 'collapse', groupTitle: 'Protected' });
  });
});
