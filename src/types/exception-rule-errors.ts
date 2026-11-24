// 例外规则错误类型
export enum ExceptionRuleError {
  RULE_NOT_FOUND = 'RULE_NOT_FOUND',
  DUPLICATE_RULE_NAME = 'DUPLICATE_RULE_NAME',
  INVALID_RULE_TYPE = 'INVALID_RULE_TYPE',
  RULE_TYPE_MISMATCH = 'RULE_TYPE_MISMATCH',
  STORAGE_ERROR = 'STORAGE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export class ExceptionRuleException extends Error {
  constructor(
    public type: ExceptionRuleError,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ExceptionRuleException';
  }
}
