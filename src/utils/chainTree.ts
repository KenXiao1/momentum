import { Chain, ChainTreeNode } from '../types';

/**
 * 将扁平的链数组转换为树状结构
 */
export const buildChainTree = (chains: Chain[]): ChainTreeNode[] => {
  // 创建ID到节点的映射
  const nodeMap = new Map<string, ChainTreeNode>();
  
  console.log('buildChainTree - 输入的chains:', chains.length, chains.map(c => ({ id: c.id, name: c.name, parentId: c.parentId, type: c.type })));
  
  // 修复循环引用：将自引用的链条的 parentId 设置为 undefined
  const cleanedChains = chains.map(chain => {
    if (chain.parentId === chain.id) {
      console.warn(`修复循环引用: 链条 ${chain.name} (${chain.id}) 的父节点是自己，重置为根节点`);
      return { ...chain, parentId: undefined };
    }
    return chain;
  });

  // 初始化所有节点
  cleanedChains.forEach(chain => {
    nodeMap.set(chain.id, {
      ...chain,
      children: [],
      depth: 0,
    });
  });

  const rootNodes: ChainTreeNode[] = [];

  // 构建树结构
  cleanedChains.forEach(chain => {
    const node = nodeMap.get(chain.id)!;
    
    if (chain.parentId) {
      const parent = nodeMap.get(chain.parentId);
      if (parent) {
        parent.children.push(node);
        node.depth = parent.depth + 1;
        console.log(`节点 ${chain.name} 作为 ${parent.name} 的子节点`);
      } else {
        // 父节点不存在，作为根节点处理
        console.warn(`父节点 ${chain.parentId} 不存在，节点 ${chain.name} (${chain.id}) 将不会被添加到树中`);
        // Do not push to rootNodes
      }
    } else {
      console.log(`节点 ${chain.name} 是根节点`);
      rootNodes.push(node);
    }
  });

  // 对每个节点的子节点按 sortOrder 排序
  const sortChildren = (node: ChainTreeNode) => {
    node.children.sort((a, b) => a.sortOrder - b.sortOrder);
    node.children.forEach(sortChildren);
  };

  rootNodes.forEach(sortChildren);
  
  // 对根节点也进行排序
  rootNodes.sort((a, b) => a.sortOrder - b.sortOrder);

  console.log('buildChainTree - 构建的根节点:', rootNodes.length, rootNodes.map(r => ({ id: r.id, name: r.name, childrenCount: r.children.length })));
  return rootNodes;
};

/**
 * 获取任务群的完成进度
 */
export const getGroupProgress = (group: ChainTreeNode): { completed: number; total: number } => {
  if (group.type === 'unit') {
    return { completed: group.currentStreak > 0 ? 1 : 0, total: 1 };
  }

  let completed = 0;
  let total = 0;

  group.children.forEach(child => {
    const progress = getGroupProgress(child);
    completed += progress.completed;
    total += progress.total;
  });

  return { completed, total };
};

/**
 * 获取任务群中下一个待执行的单元
 */
export const getNextUnitInGroup = (group: ChainTreeNode): ChainTreeNode | null => {
  if (group.type === 'unit') {
    return group;
  }

  for (const child of group.children) {
    const nextUnit = getNextUnitInGroup(child);
    if (nextUnit && nextUnit.currentStreak === 0) {
      return nextUnit;
    }
  }

  return null;
};

/**
 * 完成任务群时更新所有子单元的完成次数
 */
export const updateGroupCompletions = (chains: Chain[], groupId: string): Chain[] => {
  const chainTree = buildChainTree(chains);
  const groupNode = chainTree.find(node => node.id === groupId);
  
  if (!groupNode || groupNode.type !== 'group') {
    return chains;
  }
  
  // 获取所有子单元的ID
  const getAllChildIds = (node: ChainTreeNode): string[] => {
    let ids: string[] = [];
    if (node.type === 'unit') {
      ids.push(node.id);
    }
    node.children.forEach(child => {
      ids = ids.concat(getAllChildIds(child));
    });
    return ids;
  };
  
  const childIds = getAllChildIds(groupNode);
  
  // 更新任务群和所有子单元的完成次数
  return chains.map(chain => {
    if (chain.id === groupId || childIds.includes(chain.id)) {
      return {
        ...chain,
        currentStreak: chain.currentStreak + 1,
        totalCompletions: chain.totalCompletions + 1,
        lastCompletedAt: new Date(),
      };
    }
    return chain;
  });
};

/**
 * 获取所有顶层任务（用于仪表盘显示）
 */
export const getTopLevelChains = (chainTree: ChainTreeNode[]): ChainTreeNode[] => {
  return chainTree.filter(node => !node.parentId);
};

/**
 * 根据类型获取对应的图标和颜色
 */
export const getChainTypeConfig = (type: Chain['type']) => {
  const configs = {
    unit: { icon: 'fas fa-link', color: 'text-gray-500', bgColor: 'bg-gray-500/10', name: '基础单元' },
    group: { icon: 'fas fa-layer-group', color: 'text-blue-500', bgColor: 'bg-blue-500/10', name: '任务群' },
    assault: { icon: 'fas fa-bolt', color: 'text-red-500', bgColor: 'bg-red-500/10', name: '突击单元' },
    recon: { icon: 'fas fa-search', color: 'text-green-500', bgColor: 'bg-green-500/10', name: '侦查单元' },
    command: { icon: 'fas fa-chess-king', color: 'text-purple-500', bgColor: 'bg-purple-500/10', name: '指挥单元' },
    special_ops: { icon: 'fas fa-tools', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', name: '特勤单元' },
    engineering: { icon: 'fas fa-dumbbell', color: 'text-orange-500', bgColor: 'bg-orange-500/10', name: '工程单元' },
    quartermaster: { icon: 'fas fa-utensils', color: 'text-pink-500', bgColor: 'bg-pink-500/10', name: '炊事单元' },
  };

  return configs[type] || configs.unit;
};