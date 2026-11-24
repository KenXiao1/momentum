import type { Chain } from '../../types';

type ChainById = Map<string, Chain>;
type ChildrenByParentId = Map<string, Chain[]>;

function buildChainLookups(chains: Chain[]): {
  chainById: ChainById;
  childrenByParentId: ChildrenByParentId;
} {
  const chainById: ChainById = new Map(chains.map((c) => [c.id, c]));
  const childrenByParentId: ChildrenByParentId = new Map();

  for (const chain of chains) {
    if (!chain.parentId) continue;
    const bucket = childrenByParentId.get(chain.parentId) ?? [];
    bucket.push(chain);
    childrenByParentId.set(chain.parentId, bucket);
  }

  return { chainById, childrenByParentId };
}

/**
 * 重置任务群中所有任务的完成进度
 *
 * 注意：只递归进入 group 节点；非 group 节点被视为执行单元（即使它意外拥有 children）
 */
function resetGroupTaskProgress(chains: Chain[], groupId: string): Chain[] {
  const { chainById, childrenByParentId } = buildChainLookups(chains);
  const groupNode = chainById.get(groupId);

  if (groupNode?.type !== 'group') return chains;

  const childUnitIds = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [groupId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId) continue;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const children = childrenByParentId.get(currentId) ?? [];
    for (const child of children) {
      if (child.type !== 'group') {
        childUnitIds.add(child.id);
      } else {
        stack.push(child.id);
      }
    }
  }

  if (childUnitIds.size === 0) return chains;

  return chains.map((chain) =>
    childUnitIds.has(chain.id) ? { ...chain, currentStreak: 0 } : chain,
  );
}

/**
 * 增加任务群的完成计数并重置子任务进度
 */
export const incrementGroupCompletionCount = (
  chains: Chain[],
  groupId: string,
): Chain[] => {
  // 首先增加任务群的完成计数
  const updatedChains = chains.map((chain) => {
    if (chain.id === groupId && chain.type === 'group') {
      return {
        ...chain,
        currentStreak: chain.currentStreak + 1,
        totalCompletions: chain.totalCompletions + 1,
        lastCompletedAt: new Date(),
      };
    }
    return chain;
  });

  // 然后重置子任务进度，准备下一轮重复
  return resetGroupTaskProgress(updatedChains, groupId);
};

/**
 * 重置任务群完成计数（当任务群失败或被中断时）
 */
export const resetGroupCompletionCount = (
  chains: Chain[],
  groupId: string,
): Chain[] => {
  return chains.map((chain) => {
    if (chain.id === groupId && chain.type === 'group') {
      return {
        ...chain,
        currentStreak: 0, // 重置任务群完成计数为0
        totalFailures: chain.totalFailures + 1, // 增加失败次数
      };
    }
    return chain;
  });
};
