import { type Translator } from '../../i18n';
import type { ExceptionRule, ExceptionRuleType } from '../../types';
import type { Dispatch, SetStateAction } from 'react';

export interface RuleManagerViewProps {
  onClose: () => void;
  initialFilter?: ExceptionRuleType;
  onRuleSelected?: (rule: ExceptionRule) => void;
}

export type SortBy = 'name' | 'usage' | 'created' | 'lastUsed';

export interface RuleManagerFormData {
  name: string;
  type: ExceptionRuleType;
  description: string;
}

export interface RuleManagerViewViewProps {
  onClose: () => void;
  onRuleSelected?: (rule: ExceptionRule) => void;
  t: Translator;
  loading: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  deleteConfirmationRule: ExceptionRule | null;
  setDeleteConfirmationRule: Dispatch<SetStateAction<ExceptionRule | null>>;
  confirmDeleteRule: () => Promise<void>;
  handleExportRules: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  typeFilter: ExceptionRuleType | 'all';
  setTypeFilter: Dispatch<SetStateAction<ExceptionRuleType | 'all'>>;
  sortBy: SortBy;
  setSortBy: Dispatch<SetStateAction<SortBy>>;
  filteredRules: ExceptionRule[];
  optimisticUpdates: Map<string, ExceptionRule>;
  handleEditRule: (rule: ExceptionRule) => void;
  handleDeleteRule: (rule: ExceptionRule) => void;
  showCreateForm: boolean;
  setShowCreateForm: Dispatch<SetStateAction<boolean>>;
  editingRule: ExceptionRule | null;
  setEditingRule: Dispatch<SetStateAction<ExceptionRule | null>>;
  resetForm: () => void;
  formData: RuleManagerFormData;
  setFormData: Dispatch<SetStateAction<RuleManagerFormData>>;
  formErrors: string[];
  formWarnings: string[];
  duplicateSuggestions: string[];
  handleCreateRule: () => Promise<void>;
  handleUpdateRule: () => Promise<void>;
  savingOperations: Set<string>;
}
