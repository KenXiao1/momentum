import { createTranslator } from '../../../i18n/translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExceptionRuleError, ExceptionRuleException } from '../../../types';
import { ErrorMessageFormatter } from '../ErrorMessageFormatter';

const runtimeI18n = vi.hoisted(() => ({
  getCurrentLanguage: vi.fn(() => 'en'),
  t: vi.fn(),
}));

const safeErrorMessage = vi.hoisted(() => ({
  getSafeErrorDetail: vi.fn((message: string) => message),
}));

vi.mock('../../../utils/runtimeI18n', () => runtimeI18n);
vi.mock('../../../utils/errorMessage', () => safeErrorMessage);

describe('ErrorMessageFormatter', () => {
  const formatter = new ErrorMessageFormatter();

  beforeEach(() => {
    vi.clearAllMocks();
    runtimeI18n.getCurrentLanguage.mockReturnValue('en');
    runtimeI18n.t.mockImplementation(createTranslator('en'));
    safeErrorMessage.getSafeErrorDetail.mockImplementation(
      (message: string) => message,
    );
  });

  it('formats not-found and duplicate-name messages with context', () => {
    const notFoundWithId = new ExceptionRuleException(
      ExceptionRuleError.RULE_NOT_FOUND,
      'Rule ID=abc missing',
    );
    const duplicateWithExisting = new ExceptionRuleException(
      ExceptionRuleError.DUPLICATE_RULE_NAME,
      'dup',
      {
        existingRules: [{ id: 'r1' }],
      },
    );

    expect(formatter.getUserFriendlyMessage(notFoundWithId)).toContain(
      'selected rule no longer exists',
    );
    expect(formatter.getUserFriendlyMessage(duplicateWithExisting)).toContain(
      'already exists',
    );
  });

  it('formats validation errors with safe detail and without detail', () => {
    const validationError = new ExceptionRuleException(
      ExceptionRuleError.VALIDATION_ERROR,
      'bad input',
    );

    expect(formatter.getUserFriendlyMessage(validationError)).toBe(
      'Validation failed: bad input',
    );

    safeErrorMessage.getSafeErrorDetail.mockReturnValueOnce('');
    expect(formatter.getUserFriendlyMessage(validationError)).toBe(
      'Validation failed',
    );
  });

  it('handles default and storage/type mismatch cases', () => {
    const storageError = new ExceptionRuleException(
      ExceptionRuleError.STORAGE_ERROR,
      'disk full',
    );
    const mismatchError = new ExceptionRuleException(
      ExceptionRuleError.RULE_TYPE_MISMATCH,
      'wrong type',
    );
    const unknownError = new ExceptionRuleException(
      'UNKNOWN' as ExceptionRuleError,
      'opaque failure',
    );

    expect(formatter.getUserFriendlyMessage(storageError)).toContain(
      'Failed to save data',
    );
    expect(formatter.getUserFriendlyMessage(mismatchError)).toContain(
      'does not match the current action',
    );
    expect(formatter.getUserFriendlyMessage(unknownError)).toBe(
      'opaque failure',
    );
  });

  it('returns translated titles for known and unknown error types', () => {
    expect(formatter.getErrorTitle(ExceptionRuleError.RULE_NOT_FOUND)).toBe(
      'Rule not found',
    );
    expect(formatter.getErrorTitle(ExceptionRuleError.INVALID_RULE_TYPE)).toBe(
      'Invalid rule type',
    );
    expect(
      formatter.getErrorTitle('SOMETHING_ELSE' as ExceptionRuleError),
    ).toBe('Operation failed');
  });
});
