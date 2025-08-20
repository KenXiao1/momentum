import { Chain, ChainTreeNode } from '../types';

/**
 * 验证链数据的完整性
 */
const validateChainData = (chains: Chain[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const ids = new Set<string>();
  
  for (const chain of chains) {
    // Check for required fields
    if (!chain.id) {
      errors.push(`链条缺少ID: ${JSON.stringify(chain)}`);
      continue;
    }
    
    if (!chain.name) {
      errors.push(`链条 ${chain.id} 缺少名称`);
    }
    
    // Check for duplicate IDs
    if (ids.has(chain.id)) {
      errors.push(`重复的链条ID: ${chain.id}`);
    }
    ids.add(chain.id);
    
    // Check for invalid parent references (will be handled in tree building)
    if (chain.parentId === chain.id) {
      errors.push(`链条 ${chain.id} (${chain.name}) 存在循环引用`);
    }
  }
  
  return { isValid: errors.length === 0, errors };
};

/**
 * 将扁平的链数组转换为树状结构
 */
export const buildChainTree = (chains: Chain[]): ChainTreeNode[] => {
  try {
    // Validate input data
    if (!Array.isArray(chains)) {
      console.error('buildChainTree: 输入不是数组');
      return [];
    }
    
    if (chains.length === 0) {
      console.log('buildChainTree: 输入为空数组');
      return [];
    }
    
    // Validate chain data integrity
    const validation = validateChainData(chains);
    if (!validation.isValid) {
      console.warn('buildChainTree: 数据完整性检查发现问题:', validation.errors);
      // Continue processing but log warnings
    }
    
    // 创建ID到节点的映射
    const nodeMap = new Map<string, ChainTreeNode>();
    
    console.log('buildChainTree - 输入的chains:', chains.length, chains.map(c => ({ id: c.id, name: c.name, parentId: c.parentId, type: c.type })));
    
    // 修复循环引用和其他数据问题
    const cleanedChains = chains.map(chain => {
      if (!chain.id) {
        console.error(`跳过无效链条（缺少ID）:`, chain);
        return null;
      }
      
      if (chain.parentId === chain.id) {
        console.warn(`修复循环引用: 链条 ${chain.name} (${chain.id}) 的父节点是自己，重置为根节点`);
        return { ...chain, parentId: undefined };
      }
      
      return chain;
    }).filter((chain): chain is Chain => chain !== null);

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
        console.warn(`父节点 ${chain.parentId} 不存在，节点 ${chain.name} (${chain.id}) 将作为根节点处理`);
        // Reset parentId to undefined and add to rootNodes
        node.parentId = undefined;
        rootNodes.push(node);
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
  
  // Final validation - ensure all input chains are represented in the tree
  const treeNodeIds = new Set<string>();
  const collectIds = (nodes: ChainTreeNode[]) => {
    nodes.forEach(node => {
      treeNodeIds.add(node.id);
      collectIds(node.children);
    });
  };
  collectIds(rootNodes);
  
  const inputIds = new Set(cleanedChains.map(c => c.id));
  const missingIds = [...inputIds].filter(id => !treeNodeIds.has(id));
  
  if (missingIds.length > 0) {
    console.error('buildChainTree: 以下链条在树中丢失:', missingIds);
  }
  
  return rootNodes;
  } catch (error) {
    console.error('buildChainTree: 构建树时发生错误:', error);
    // Return empty array to prevent app crash
    return [];
  }
};

/**
 * 获取任务群的完成进度（基于重复次数）
 */
export const getGroupProgress = (group: ChainTreeNode): { completed: number; total: number } => {
  if (group.type === 'unit') {
    const requiredRepeats = group.taskRepeatCount || 1;
    const completedRepeats = Math.min(group.currentStreak, requiredRepeats);
    return { completed: completedRepeats, total: requiredRepeats };
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
 * 获取任务群的单元完成进度（基于单元数量，更直观）
 */
export const getGroupUnitProgress = (group: ChainTreeNode): { completed: number; total: number } => {
  if (group.type === 'unit') {
    const requiredRepeats = group.taskRepeatCount || 1;
    const isCompleted = group.currentStreak >= requiredRepeats;
    return { completed: isCompleted ? 1 : 0, total: 1 };
  }

  let completed = 0;
  let total = 0;

  group.children.forEach(child => {
    const progress = getGroupUnitProgress(child);
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
    // 检查该单元是否已完成其重复次数
    const requiredRepeats = group.taskRepeatCount || 1;
    return group.currentStreak < requiredRepeats ? group : null;
  }

  // For groups, find the first incomplete unit in order
  for (const child of group.children) {
    const nextUnit = getNextUnitInGroup(child);
    if (nextUnit) {
      return nextUnit;
    }
  }

  return null;
};

/**
 * 检查任务群中的所有任务是否都已完成其重复次数
 */
export const isGroupFullyCompleted = (groupNode: ChainTreeNode): boolean => {
  if (groupNode.type === 'unit') {
    const requiredRepeats = groupNode.taskRepeatCount || 1;
    return groupNode.currentStreak >= requiredRepeats;
  }

  // 对于任务群，检查所有子任务是否都已完成
  return groupNode.children.every(child => isGroupFullyCompleted(child));
};

/**
 * 检查单个任务是否已完成其重复次数
 */
export const isTaskCompleted = (task: ChainTreeNode): boolean => {
  if (task.type !== 'unit') {
    return false;
  }
  
  const requiredRepeats = task.taskRepeatCount || 1;
  return task.currentStreak >= requiredRepeats;
};

/**
 * 获取任务还需要重复的次数
 */
export const getRemainingRepeats = (task: ChainTreeNode): number => {
  if (task.type !== 'unit') {
    return 0;
  }
  
  const requiredRepeats = task.taskRepeatCount || 1;
  const remaining = requiredRepeats - task.currentStreak;
  return Math.max(0, remaining);
};

/**
 * 重置任务群中所有任务的完成进度
 */
export const resetGroupTaskProgress = (chains: Chain[], groupId: string): Chain[] => {
  const chainTree = buildChainTree(chains);
  const groupNode = chainTree.find(node => node.id === groupId);
  
  if (!groupNode || groupNode.type !== 'group') {
    return chains;
  }
  
  // 获取所有子单元的ID
  const getAllChildIds = (node: ChainTreeNode): string[] => {
    let ids: string[] = [];
    node.children.forEach(child => {
      if (child.type === 'unit') {
        ids.push(child.id);
      } else {
        ids = ids.concat(getAllChildIds(child));
      }
    });
    return ids;
  };
  
  const childIds = getAllChildIds(groupNode);
  
  // 重置所有子单元的完成进度
  return chains.map(chain => {
    if (childIds.includes(chain.id)) {
      return {
        ...chain,
        currentStreak: 0, // 重置当前连续完成数
      };
    }
    return chain;
  });
};

/**
 * 增加任务群的完成计数并重置子任务进度
 */
export const incrementGroupCompletionCount = (chains: Chain[], groupId: string): Chain[] => {
  // 首先增加任务群的完成计数
  const updatedChains = chains.map(chain => {
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
export const resetGroupCompletionCount = (chains: Chain[], groupId: string): Chain[] => {
  return chains.map(chain => {
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

/**
 * 完成任务群时更新所有子单元的完成次数（保持向后兼容）
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
 * buildChainTree 已经返回了正确的根节点，无需再次过滤
 */
export const getTopLevelChains = (chainTree: ChainTreeNode[]): ChainTreeNode[] => {
  // buildChainTree 函数已经正确构建了树结构，返回的就是根节点
  // 不需要再次过滤，直接返回即可
  return chainTree;
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