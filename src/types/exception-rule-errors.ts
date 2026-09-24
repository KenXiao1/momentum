import { t } from '../utils/runtimeI18n';

// 例外规则错误类型
export enum ExceptionRuleError {
  // 现有错误类型
  RULE_NOT_FOUND = 'RULE_NOT_FOUND',
  DUPLICATE_RULE_NAME = 'DUPLICATE_RULE_NAME',
  INVALID_RULE_TYPE = 'INVALID_RULE_TYPE',
  RULE_TYPE_MISMATCH = 'RULE_TYPE_MISMATCH',
  STORAGE_ERROR = 'STORAGE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // 新增错误类型
  DATA_INTEGRITY_ERROR = 'DATA_INTEGRITY_ERROR',
  TEMPORARY_ID_CONFLICT = 'TEMPORARY_ID_CONFLICT',
  RULE_STATE_INCONSISTENT = 'RULE_STATE_INCONSISTENT',
  RECOVERY_FAILED = 'RECOVERY_FAILED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
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

export type ExceptionRuleExceptionSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';
export type ExceptionRuleExceptionCategory =
  | 'user_error'
  | 'system_error'
  | 'data_error'
  | 'network_error';

export interface EnhancedExceptionRuleExceptionSerialized {
  name: string;
  type: ExceptionRuleError;
  message: string;
  userMessage?: string;
  severity?: ExceptionRuleExceptionSeverity;
  recoverable?: boolean;
  suggestedActions?: string[];
  context?: unknown;
  technicalDetails?: unknown;
  category: ExceptionRuleExceptionCategory;
  timestamp: string;
  stack?: string;
}

// 增强的异常类
export class EnhancedExceptionRuleException extends ExceptionRuleException {
  constructor(
    type: ExceptionRuleError,
    message: string,
    public context?: unknown,
    public recoverable?: boolean,
    public suggestedActions?: string[],
    public severity?: ExceptionRuleExceptionSeverity,
    public userMessage?: string,
    public technicalDetails?: unknown,
  ) {
    super(type, message, context);
    this.name = 'EnhancedExceptionRuleException';
    this.recoverable = recoverable ?? true;
    this.severity = severity ?? 'medium';
    this.userMessage = userMessage ?? message;
  }

  static createUserFriendly(
    type: ExceptionRuleError,
    userMessage: string,
    technicalMessage?: string,
    context?: unknown,
  ): EnhancedExceptionRuleException {
    return new EnhancedExceptionRuleException(
      type,
      technicalMessage || userMessage,
      context,
      true,
      [],
      'medium',
      userMessage,
      { technicalMessage },
    );
  }

  static createCritical(
    type: ExceptionRuleError,
    message: string,
    context?: unknown,
  ): EnhancedExceptionRuleException {
    return new EnhancedExceptionRuleException(
      type,
      message,
      context,
      false,
      [t('types.exceptionRuleErrors.contactSupport')],
      'critical',
      t('types.exceptionRuleErrors.aCriticalErrorOccurredPleaseContactSupport'),
      { originalMessage: message },
    );
  }

  static createRecoverable(
    type: ExceptionRuleError,
    message: string,
    suggestedActions: string[],
    context?: unknown,
  ): EnhancedExceptionRuleException {
    return new EnhancedExceptionRuleException(
      type,
      message,
      context,
      true,
      suggestedActions,
      'medium',
      message,
    );
  }

  addSuggestedAction(action: string): this {
    if (!this.suggestedActions) {
      this.suggestedActions = [];
    }
    this.suggestedActions.push(action);
    return this;
  }

  setSeverity(severity: ExceptionRuleExceptionSeverity): this {
    this.severity = severity;
    return this;
  }

  setUserMessage(message: string): this {
    this.userMessage = message;
    return this;
  }

  isRecoverable(): boolean {
    return this.recoverable === true;
  }

  isCritical(): boolean {
    return this.severity === 'critical';
  }

  getCategory(): ExceptionRuleExceptionCategory {
    switch (this.type) {
      case ExceptionRuleError.VALIDATION_ERROR:
      case ExceptionRuleError.DUPLICATE_RULE_NAME:
      case ExceptionRuleError.RULE_TYPE_MISMATCH:
      case ExceptionRuleError.PERMISSION_DENIED:
        return 'user_error';

      case ExceptionRuleError.STORAGE_ERROR:
      case ExceptionRuleError.OPERATION_TIMEOUT:
      case ExceptionRuleError.CONCURRENT_MODIFICATION:
      case ExceptionRuleError.RECOVERY_FAILED:
        return 'system_error';

      case ExceptionRuleError.DATA_INTEGRITY_ERROR:
      case ExceptionRuleError.RULE_STATE_INCONSISTENT:
      case ExceptionRuleError.TEMPORARY_ID_CONFLICT:
        return 'data_error';

      case ExceptionRuleError.NETWORK_ERROR:
        return 'network_error';

      default:
        return 'system_error';
    }
  }

  toJSON(): EnhancedExceptionRuleExceptionSerialized {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      recoverable: this.recoverable,
      suggestedActions: this.suggestedActions,
      context: this.context,
      technicalDetails: this.technicalDetails,
      category: this.getCategory(),
      timestamp: new Date().toISOString(),
      stack: this.stack,
    };
  }

  static fromJSON(
    data: EnhancedExceptionRuleExceptionSerialized,
  ): EnhancedExceptionRuleException {
    const error = new EnhancedExceptionRuleException(
      data.type,
      data.message,
      data.context,
      data.recoverable,
      data.suggestedActions,
      data.severity,
      data.userMessage,
      data.technicalDetails,
    );

    if (data.stack) {
      error.stack = data.stack;
    }

    return error;
  }
}
