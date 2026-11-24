import { describe, expect, it } from 'vitest';
import {
  ExceptionRuleError,
  ExceptionRuleException,
} from '../exception-rule-errors';

describe('types/exception-rule-errors', () => {
  it('builds base ExceptionRuleException with type/details metadata', () => {
    const details = { source: 'unit-test' };
    const error = new ExceptionRuleException(
      ExceptionRuleError.RULE_NOT_FOUND,
      'Rule missing',
      details,
    );

    expect(error.name).toBe('ExceptionRuleException');
    expect(error.type).toBe(ExceptionRuleError.RULE_NOT_FOUND);
    expect(error.message).toBe('Rule missing');
    expect(error.details).toEqual(details);
  });
});
