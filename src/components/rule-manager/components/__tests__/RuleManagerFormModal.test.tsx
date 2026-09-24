import { createTranslator } from '../../../../i18n/translate';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExceptionRuleType, type ExceptionRule } from '../../../../types';
import type { RuleManagerFormData } from '../../types';
import { RuleManagerFormModal } from '../RuleManagerFormModal';

function createRule(overrides?: Partial<ExceptionRule>): ExceptionRule {
  return {
    id: overrides?.id ?? 'rule-1',
    name: overrides?.name ?? 'Rule 1',
    description: overrides?.description,
    type: overrides?.type ?? ExceptionRuleType.PAUSE_ONLY,
    scope: overrides?.scope ?? 'global',
    createdAt: overrides?.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    usageCount: overrides?.usageCount ?? 0,
    isActive: overrides?.isActive ?? true,
    chainId: overrides?.chainId,
    lastUsedAt: overrides?.lastUsedAt,
    isArchived: overrides?.isArchived,
  };
}

function createProps(overrides?: {
  isOpen?: boolean;
  editingRule?: ExceptionRule | null;
  formData?: RuleManagerFormData;
  formErrors?: string[];
  formWarnings?: string[];
  duplicateSuggestions?: string[];
  savingOperations?: Set<string>;
}) {
  const setFormData = vi.fn();
  const setShowCreateForm = vi.fn();
  const setEditingRule = vi.fn();
  const resetForm = vi.fn();
  const handleCreateRule = vi.fn(async () => undefined);
  const handleUpdateRule = vi.fn(async () => undefined);

  return {
    props: {
      isOpen: overrides?.isOpen ?? true,
      editingRule: overrides?.editingRule ?? null,
      t: createTranslator('en'),
      formErrors: overrides?.formErrors ?? [],
      formWarnings: overrides?.formWarnings ?? [],
      duplicateSuggestions: overrides?.duplicateSuggestions ?? [],
      formData: overrides?.formData ?? {
        name: 'Morning walk',
        type: ExceptionRuleType.PAUSE_ONLY,
        description: 'Walk outside',
      },
      setFormData,
      setShowCreateForm,
      setEditingRule,
      resetForm,
      handleCreateRule,
      handleUpdateRule,
      savingOperations: overrides?.savingOperations ?? new Set(),
    },
    setFormData,
    setShowCreateForm,
    setEditingRule,
    resetForm,
    handleCreateRule,
    handleUpdateRule,
  };
}

describe('RuleManagerFormModal', () => {
  it('renders nothing when closed', () => {
    const { props } = createProps({ isOpen: false });
    const { container } = render(<RuleManagerFormModal {...props} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders create mode and submits create action', async () => {
    const { props, handleCreateRule } = createProps();
    render(<RuleManagerFormModal {...props} />);

    expect(screen.getByText('Create rule')).toBeInTheDocument();
    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).not.toBeDisabled();

    fireEvent.click(createButton);
    expect(handleCreateRule).toHaveBeenCalledTimes(1);
  });

  it('renders edit mode and submits update action', () => {
    const { props, handleUpdateRule } = createProps({
      editingRule: createRule(),
    });
    render(<RuleManagerFormModal {...props} />);

    expect(screen.getByText('Edit rule')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(handleUpdateRule).toHaveBeenCalledTimes(1);
  });

  it('renders errors/warnings/suggestions and handles suggestion + field updates', () => {
    const { props, setFormData } = createProps({
      formErrors: ['error-1'],
      formWarnings: ['warning-1'],
      duplicateSuggestions: ['Rule A', 'Rule B'],
    });
    render(<RuleManagerFormModal {...props} />);

    expect(screen.getByText('error-1')).toBeInTheDocument();
    expect(screen.getByText('warning-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rule A' }));
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rule A',
      }),
    );

    fireEvent.change(
      screen.getByPlaceholderText('e.g. bathroom break, water, phone call'),
      {
        target: { value: 'Renamed rule' },
      },
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: ExceptionRuleType.EARLY_COMPLETION_ONLY },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Describe this exception...'),
      {
        target: { value: 'Updated description' },
      },
    );

    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Renamed rule',
      }),
    );
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      }),
    );
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Updated description',
      }),
    );
  });

  it('disables submit when name is blank or save is in progress and handles cancel', () => {
    const { props, setShowCreateForm, setEditingRule, resetForm } = createProps(
      {
        formData: {
          name: '   ',
          type: ExceptionRuleType.PAUSE_ONLY,
          description: '',
        },
        savingOperations: new Set(['saving']),
      },
    );
    render(<RuleManagerFormModal {...props} />);

    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setShowCreateForm).toHaveBeenCalledWith(false);
    expect(setEditingRule).toHaveBeenCalledWith(null);
    expect(resetForm).toHaveBeenCalledTimes(1);
  });
});
