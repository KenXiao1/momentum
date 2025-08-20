import { buildChainTree, getNextUnitInGroup, getGroupProgress, getGroupUnitProgress } from '../chainTree';
import { Chain, ChainTreeNode } from '../../types';

// Mock chain data for testing
const createMockChain = (overrides: Partial<Chain> = {}): Chain => ({
  id: 'test-id',
  name: 'Test Chain',
  parentId: undefined,
  type: 'unit',
  sortOrder: 0,
  trigger: 'Test trigger',
  duration: 30,
  description: 'Test description',
  currentStreak: 0,
  auxiliaryStreak: 0,
  totalCompletions: 0,
  totalFailures: 0,
  auxiliaryFailures: 0,
  exceptions: [],
  auxiliaryExceptions: [],
  auxiliarySignal: 'Test signal',
  auxiliaryDuration: 15,
  auxiliaryCompletionTrigger: 'Test completion',
  isDurationless: false,
  createdAt: new Date(),
  ...overrides,
});

describe('chainTree utilities', () => {
  describe('buildChainTree', () => {
    it('should handle empty input', () => {
      const result = buildChainTree([]);
      expect(result).toEqual([]);
    });

    it('should handle single chain', () => {
      const chains = [createMockChain({ id: 'chain1', name: 'Chain 1' })];
      const result = buildChainTree(chains);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('chain1');
      expect(result[0].children).toEqual([]);
    });

    it('should build proper parent-child relationships', () => {
      const chains = [
        createMockChain({ id: 'parent', name: 'Parent', type: 'group' }),
        createMockChain({ id: 'child1', name: 'Child 1', parentId: 'parent' }),
        createMockChain({ id: 'child2', name: 'Child 2', parentId: 'parent' }),
      ];
      
      const result = buildChainTree(chains);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('parent');
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children.map(c => c.id)).toEqual(['child1', 'child2']);
    });

    it('should treat orphaned chains as root nodes', () => {
      const chains = [
        createMockChain({ id: 'orphan', name: 'Orphan', parentId: 'nonexistent' }),
        createMockChain({ id: 'root', name: 'Root' }),
      ];
      
      const result = buildChainTree(chains);
      
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toContain('orphan');
      expect(result.map(c => c.id)).toContain('root');
      
      // Orphan should have parentId reset to undefined
      const orphanNode = result.find(c => c.id === 'orphan');
      expect(orphanNode?.parentId).toBeUndefined();
    });

    it('should handle circular references', () => {
      const chains = [
        createMockChain({ id: 'circular', name: 'Circular', parentId: 'circular' }),
        createMockChain({ id: 'normal', name: 'Normal' }),
      ];
      
      const result = buildChainTree(chains);
      
      expect(result).toHaveLength(2);
      const circularNode = result.find(c => c.id === 'circular');
      expect(circularNode?.parentId).toBeUndefined();
    });

    it('should sort chains by sortOrder', () => {
      const chains = [
        createMockChain({ id: 'third', name: 'Third', sortOrder: 3 }),
        createMockChain({ id: 'first', name: 'First', sortOrder: 1 }),
        createMockChain({ id: 'second', name: 'Second', sortOrder: 2 }),
      ];
      
      const result = buildChainTree(chains);
      
      expect(result.map(c => c.id)).toEqual(['first', 'second', 'third']);
    });

    it('should handle deep hierarchies', () => {
      const chains = [
        createMockChain({ id: 'root', name: 'Root', type: 'group' }),
        createMockChain({ id: 'level1', name: 'Level 1', parentId: 'root', type: 'group' }),
        createMockChain({ id: 'level2', name: 'Level 2', parentId: 'level1' }),
      ];
      
      const result = buildChainTree(chains);
      
      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].id).toBe('level2');
    });
  });

  describe('getNextUnitInGroup', () => {
    it('should return unit if it has not been completed', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ id: 'unit1', currentStreak: 0 }),
        children: [],
        depth: 0,
      };
      
      const result = getNextUnitInGroup(unit);
      expect(result?.id).toBe('unit1');
    });

    it('should return null for completed unit', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ id: 'unit1', currentStreak: 1 }),
        children: [],
        depth: 0,
      };
      
      const result = getNextUnitInGroup(unit);
      expect(result).toBeNull();
    });

    it('should handle task with repeat count', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ 
          id: 'unit1', 
          currentStreak: 1, 
          taskRepeatCount: 3 
        }),
        children: [],
        depth: 0,
      };
      
      const result = getNextUnitInGroup(unit);
      expect(result?.id).toBe('unit1'); // Still available since 1 < 3
    });

    it('should return null for unit that completed all repeats', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ 
          id: 'unit1', 
          currentStreak: 3, 
          taskRepeatCount: 3 
        }),
        children: [],
        depth: 0,
      };
      
      const result = getNextUnitInGroup(unit);
      expect(result).toBeNull(); // Completed all repeats
    });

    it('should find first incomplete unit in group', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [
          {
            ...createMockChain({ id: 'unit1', currentStreak: 1 }),
            children: [],
            depth: 1,
          },
          {
            ...createMockChain({ id: 'unit2', currentStreak: 0 }),
            children: [],
            depth: 1,
          },
          {
            ...createMockChain({ id: 'unit3', currentStreak: 0 }),
            children: [],
            depth: 1,
          },
        ],
        depth: 0,
      };
      
      const result = getNextUnitInGroup(group);
      expect(result?.id).toBe('unit2');
    });

    it('should skip units that completed their repeat counts', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [
          {
            // Unit 1: completed all repeats (2/2)
            ...createMockChain({ 
              id: 'unit1', 
              currentStreak: 2, 
              taskRepeatCount: 2 
            }),
            children: [],
            depth: 1,
          },
          {
            // Unit 2: completed all repeats (1/1)
            ...createMockChain({ 
              id: 'unit2', 
              currentStreak: 1, 
              taskRepeatCount: 1 
            }),
            children: [],
            depth: 1,
          },
          {
            // Unit 3: not completed (0/3) - should be next
            ...createMockChain({ 
              id: 'unit3', 
              currentStreak: 0, 
              taskRepeatCount: 3 
            }),
            children: [],
            depth: 1,
          },
          {
            // Unit 4: not completed (0/1)
            ...createMockChain({ 
              id: 'unit4', 
              currentStreak: 0, 
              taskRepeatCount: 1 
            }),
            children: [],
            depth: 1,
          },
        ],
        depth: 0,
      };
      
      const result = getNextUnitInGroup(group);
      expect(result?.id).toBe('unit3'); // First incomplete task
    });

    it('should return null when all units are completed', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [
          {
            ...createMockChain({ id: 'unit1', currentStreak: 1 }),
            children: [],
            depth: 1,
          },
          {
            ...createMockChain({ id: 'unit2', currentStreak: 1 }),
            children: [],
            depth: 1,
          },
        ],
        depth: 0,
      };
      
      const result = getNextUnitInGroup(group);
      expect(result).toBeNull();
    });

    it('should handle empty group', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [],
        depth: 0,
      };
      
      const result = getNextUnitInGroup(group);
      expect(result).toBeNull();
    });

    it('should handle nested groups', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [
          {
            ...createMockChain({ id: 'subgroup1', type: 'group' }),
            children: [
              {
                ...createMockChain({ id: 'unit1', currentStreak: 1 }),
                children: [],
                depth: 2,
              },
              {
                ...createMockChain({ id: 'unit2', currentStreak: 0 }),
                children: [],
                depth: 2,
              },
            ],
            depth: 1,
          },
        ],
        depth: 0,
      };
      
      const result = getNextUnitInGroup(group);
      expect(result?.id).toBe('unit2');
    });
  });

  describe('getGroupProgress', () => {
    it('should return correct progress for incomplete unit', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ id: 'unit1', currentStreak: 0 }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupProgress(unit);
      expect(result).toEqual({ completed: 0, total: 1 });
    });

    it('should return correct progress for completed unit', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ id: 'unit1', currentStreak: 1 }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupProgress(unit);
      expect(result).toEqual({ completed: 1, total: 1 });
    });

    it('should handle task with repeat count', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ 
          id: 'unit1', 
          currentStreak: 1, 
          taskRepeatCount: 3 
        }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupProgress(unit);
      expect(result).toEqual({ completed: 0, total: 1 }); // Not complete until currentStreak >= taskRepeatCount
    });

    it('should handle completed task with repeat count', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ 
          id: 'unit1', 
          currentStreak: 3, 
          taskRepeatCount: 3 
        }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupProgress(unit);
      expect(result).toEqual({ completed: 1, total: 1 });
    });

    it('should handle user issue scenario: 4 tasks, 2 completed their repeats', () => {
      // This replicates the user's issue: 4 subtasks, 2 have reached their repeat counts
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [
          {
            // Task 1: completed its repeat count (2/2)
            ...createMockChain({ 
              id: 'unit1', 
              currentStreak: 2, 
              taskRepeatCount: 2 
            }),
            children: [],
            depth: 1,
          },
          {
            // Task 2: completed its repeat count (1/1)
            ...createMockChain({ 
              id: 'unit2', 
              currentStreak: 1, 
              taskRepeatCount: 1 
            }),
            children: [],
            depth: 1,
          },
          {
            // Task 3: not completed (0/3)
            ...createMockChain({ 
              id: 'unit3', 
              currentStreak: 0, 
              taskRepeatCount: 3 
            }),
            children: [],
            depth: 1,
          },
          {
            // Task 4: not completed (0/1)
            ...createMockChain({ 
              id: 'unit4', 
              currentStreak: 0, 
              taskRepeatCount: 1 
            }),
            children: [],
            depth: 1,
          },
        ],
        depth: 0,
      };
      
      const result = getGroupProgress(group);
      expect(result).toEqual({ completed: 2, total: 4 });
    });

    it('should calculate progress for group with mixed completion', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [
          {
            ...createMockChain({ id: 'unit1', currentStreak: 1 }),
            children: [],
            depth: 1,
          },
          {
            ...createMockChain({ id: 'unit2', currentStreak: 0 }),
            children: [],
            depth: 1,
          },
          {
            ...createMockChain({ id: 'unit3', currentStreak: 1 }),
            children: [],
            depth: 1,
          },
        ],
        depth: 0,
      };
      
      const result = getGroupProgress(group);
      expect(result).toEqual({ completed: 2, total: 3 });
    });

    it('should handle empty group', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupProgress(group);
      expect(result).toEqual({ completed: 0, total: 0 });
    });
  });

  describe('getGroupUnitProgress', () => {
    it('should return correct progress for incomplete unit', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ id: 'unit1', currentStreak: 0 }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupUnitProgress(unit);
      expect(result).toEqual({ completed: 0, total: 1 });
    });

    it('should return correct progress for completed unit', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ id: 'unit1', currentStreak: 1 }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupUnitProgress(unit);
      expect(result).toEqual({ completed: 1, total: 1 });
    });

    it('should handle task with repeat count - incomplete', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ 
          id: 'unit1', 
          currentStreak: 1, 
          taskRepeatCount: 3 
        }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupUnitProgress(unit);
      expect(result).toEqual({ completed: 0, total: 1 }); // Unit not complete until currentStreak >= taskRepeatCount
    });

    it('should handle completed task with repeat count', () => {
      const unit: ChainTreeNode = {
        ...createMockChain({ 
          id: 'unit1', 
          currentStreak: 3, 
          taskRepeatCount: 3 
        }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupUnitProgress(unit);
      expect(result).toEqual({ completed: 1, total: 1 });
    });

    it('should solve user issue scenario: 3 tasks, 2 completed their repeats', () => {
      // This directly addresses the user's issue: 3 subtasks, 2 have reached their repeat counts
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [
          {
            // Task 1: completed its repeat count (2/2) - COMPLETED UNIT
            ...createMockChain({ 
              id: 'unit1', 
              currentStreak: 2, 
              taskRepeatCount: 2 
            }),
            children: [],
            depth: 1,
          },
          {
            // Task 2: completed its repeat count (1/1) - COMPLETED UNIT  
            ...createMockChain({ 
              id: 'unit2', 
              currentStreak: 1, 
              taskRepeatCount: 1 
            }),
            children: [],
            depth: 1,
          },
          {
            // Task 3: not completed (0/3) - INCOMPLETE UNIT
            ...createMockChain({ 
              id: 'unit3', 
              currentStreak: 0, 
              taskRepeatCount: 3 
            }),
            children: [],
            depth: 1,
          },
        ],
        depth: 0,
      };
      
      const unitResult = getGroupUnitProgress(group);
      expect(unitResult).toEqual({ completed: 2, total: 3 }); // 2 out of 3 units completed
      
      // Compare with old repeat-based progress
      const repeatResult = getGroupProgress(group);
      expect(repeatResult).toEqual({ completed: 3, total: 6 }); // 3 out of 6 total repeats (2+1+3)
    });

    it('should calculate unit progress for group with mixed completion', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [
          {
            ...createMockChain({ id: 'unit1', currentStreak: 1 }),
            children: [],
            depth: 1,
          },
          {
            ...createMockChain({ id: 'unit2', currentStreak: 0 }),
            children: [],
            depth: 1,
          },
          {
            ...createMockChain({ id: 'unit3', currentStreak: 1 }),
            children: [],
            depth: 1,
          },
        ],
        depth: 0,
      };
      
      const result = getGroupUnitProgress(group);
      expect(result).toEqual({ completed: 2, total: 3 });
    });

    it('should handle empty group', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [],
        depth: 0,
      };
      
      const result = getGroupUnitProgress(group);
      expect(result).toEqual({ completed: 0, total: 0 });
    });

    it('should handle nested groups correctly', () => {
      const group: ChainTreeNode = {
        ...createMockChain({ id: 'group1', type: 'group' }),
        children: [
          {
            ...createMockChain({ id: 'subgroup1', type: 'group' }),
            children: [
              {
                ...createMockChain({ id: 'unit1', currentStreak: 1 }),
                children: [],
                depth: 2,
              },
              {
                ...createMockChain({ id: 'unit2', currentStreak: 0 }),
                children: [],
                depth: 2,
              },
            ],
            depth: 1,
          },
          {
            ...createMockChain({ id: 'unit3', currentStreak: 1 }),
            children: [],
            depth: 1,
          },
        ],
        depth: 0,
      };
      
      const result = getGroupUnitProgress(group);
      expect(result).toEqual({ completed: 2, total: 3 }); // 2 units completed out of 3 total
    });
  });
});