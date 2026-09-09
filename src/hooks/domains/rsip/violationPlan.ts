import type { RSIPNode, RSIPNodeGroup } from '../../../types';
import { getDescendantIds } from '../../../utils/rsipTree';

function addSubtree(
  removedIds: Set<string>,
  nodes: RSIPNode[],
  nodeId: string,
) {
  removedIds.add(nodeId);
  for (const id of getDescendantIds(nodes, nodeId)) removedIds.add(id);
}

export function planRSIPViolation(
  nodeId: string,
  nodes: RSIPNode[],
  groups: RSIPNodeGroup[],
) {
  const removedIds = new Set([nodeId, ...getDescendantIds(nodes, nodeId)]);
  const collapsedGroupIds = new Set<string>();
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const group of groups) {
      if (collapsedGroupIds.has(group.id)) continue;
      const members = nodes.filter((node) => node.groupId === group.id);
      const losses = members.filter((node) => removedIds.has(node.id)).length;
      if (
        losses === 0 ||
        (group.faultToleranceUsed ?? 0) + losses <= group.faultTolerance
      )
        continue;
      collapsedGroupIds.add(group.id);
      for (const member of members) {
        addSubtree(removedIds, nodes, member.id);
      }
      expanded = true;
    }
  }
  const updatedGroups = groups.map((group) => {
    const losses = nodes.filter(
      (node) => node.groupId === group.id && removedIds.has(node.id),
    ).length;
    return losses
      ? {
          ...group,
          faultToleranceUsed: (group.faultToleranceUsed ?? 0) + losses,
        }
      : group;
  });
  return { removedIds, collapsedGroupIds, updatedGroups };
}
