import type { RSIPNode, RSIPNodeGroup } from '../../../types';
import { planRSIPViolation } from '../../../domain/rsip';
import { getDescendantIds } from '../../../utils/rsipTree';

type ViolationGroupAssessment =
  | { status: 'none' }
  | { status: 'tolerated' | 'collapse'; groupTitle: string };

export function assessViolationGroup(
  node: RSIPNode,
  groups: RSIPNodeGroup[],
  nodes: RSIPNode[] = [node],
): ViolationGroupAssessment {
  const group = groups.find((item) => item.id === node.groupId);
  if (!group || (node.reinforcementLevel ?? 0) > 0) {
    return { status: 'none' };
  }

  return {
    status: planRSIPViolation(node.id, nodes, groups).collapsedGroupIds.has(
      group.id,
    )
      ? 'collapse'
      : 'tolerated',
    groupTitle: group.title,
  };
}

export function getViolationDescendants(
  nodes: RSIPNode[],
  nodeId: string,
): RSIPNode[] {
  const descendantIds = new Set(getDescendantIds(nodes, nodeId));
  return nodes.filter((node) => descendantIds.has(node.id));
}
