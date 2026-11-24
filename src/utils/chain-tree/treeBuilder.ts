import type { Chain, ChainTreeNode } from '../../types';

const bySortOrder = (a: ChainTreeNode, b: ChainTreeNode) =>
  a.sortOrder - b.sortOrder;

/**
 * 将扁平的链数组转换为按 sortOrder 排序的树。
 *
 * 父节点缺失或指向自身的链作为根节点，parentId 置空。没有 id 的损坏记录
 * 不显示：解码层不校验 id，而在加载时丢弃会让下一次整表保存删掉它。
 */
export const buildChainTree = (chains: Chain[]): ChainTreeNode[] => {
  const nodeMap = new Map<string, ChainTreeNode>();
  const valid = chains.filter((chain) => chain.id);
  for (const chain of valid) {
    nodeMap.set(chain.id, { ...chain, children: [] });
  }

  const roots: ChainTreeNode[] = [];
  for (const chain of valid) {
    const node = nodeMap.get(chain.id)!;
    const parent =
      chain.parentId && chain.parentId !== chain.id
        ? nodeMap.get(chain.parentId)
        : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      node.parentId = undefined;
      roots.push(node);
    }
  }

  const sortChildren = (node: ChainTreeNode) => {
    node.children.sort(bySortOrder);
    node.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);
  return roots.sort(bySortOrder);
};
