import { translate } from '../i18n/translate';
import type { Language } from '../i18n';

const CHINESE_CHAR_REGEX = /[\u4e00-\u9fff]/;

function containsChinese(text: string): boolean {
  return CHINESE_CHAR_REGEX.test(text);
}

function extractErrorCode(errorMessage: string): string | null {
  const message = errorMessage || '';

  const pgrst = message.match(/\bPGRST\d+\b/);
  if (pgrst) return pgrst[0];

  // Common Postgres SQLSTATE codes (5 chars, digits/letters). Keep a conservative match to reduce false positives.
  // SQLSTATE always starts with two digits (e.g. 23514, 42P01, 25006).
  const sqlstate = message.match(/\b\d{2}[0-9A-Z]{3}\b/);
  if (sqlstate) return sqlstate[0];

  return null;
}

function includesAny(message: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => message.includes(fragment));
}

function includesAll(message: string, fragments: readonly string[]): boolean {
  return fragments.every((fragment) => message.includes(fragment));
}

function isReadOnlyModeError(lower: string): boolean {
  return (
    includesAny(lower, ['read-only', 'readonly', 'read only', '25006']) ||
    includesAll(lower, ['cannot execute', 'read', 'only'])
  );
}

function isNetworkError(lower: string): boolean {
  return (
    includesAny(lower, [
      'failed to fetch',
      'fetch failed',
      'network error',
      'timeout',
    ]) || includesAll(lower, ['connection', 'supabase'])
  );
}

function isAuthError(lower: string): boolean {
  return includesAny(lower, [
    'jwt expired',
    'invalid jwt',
    'not authenticated',
    'authentication',
    'auth',
  ]);
}

function isRlsError(lower: string): boolean {
  return includesAny(lower, [
    'row-level security',
    'rls',
    'violates row-level security policy',
  ]);
}

function isRateLimitedError(lower: string): boolean {
  return includesAny(lower, ['too many requests', '429']);
}

function isProjectPausedError(lower: string): boolean {
  return (
    lower.includes('project is paused') ||
    includesAll(lower, ['paused', 'project'])
  );
}

function translateKnownErrorsZh(lower: string): string | null {
  if (isReadOnlyModeError(lower)) {
    return translate('zh', 'errors.detail.databaseReadOnly');
  }

  if (isNetworkError(lower)) {
    return translate('zh', 'errors.detail.network');
  }

  if (isAuthError(lower)) {
    return translate('zh', 'errors.detail.auth');
  }

  if (isRlsError(lower)) {
    return translate('zh', 'errors.detail.rls');
  }

  if (lower.includes('chains_time_limit_check')) {
    return translate('zh', 'errors.detail.timeLimitRequired');
  }

  if (lower.includes('chains_time_limit_hours_check')) {
    return translate('zh', 'errors.detail.timeLimitPositive');
  }

  if (isRateLimitedError(lower)) {
    return translate('zh', 'errors.detail.rateLimited');
  }

  if (isProjectPausedError(lower)) {
    return translate('zh', 'errors.detail.projectPaused');
  }

  return null;
}

function translateKnownErrors(
  errorMessage: string,
  language: Language,
): string | null {
  const message = (errorMessage || '').trim();
  if (!message) return null;
  if (language !== 'zh') return null;
  return translateKnownErrorsZh(message.toLowerCase());
}

/**
 * Returns an error detail string only when it's likely written in the current UI language,
 * to avoid mixed-language UI. Otherwise returns null.
 */
export function getSafeErrorDetail(
  errorMessage: string,
  language: Language,
): string | null {
  const message = (errorMessage || '').trim();
  if (!message) return null;

  const hasChinese = containsChinese(message);
  if (language === 'zh') {
    if (hasChinese) return message;

    const translated = translateKnownErrors(message, language);
    if (translated) return translated;

    const code = extractErrorCode(message);
    return code ? translate(language, 'errors.detail.code', { code }) : null;
  }

  if (!hasChinese) return message;

  const code = extractErrorCode(message);
  return code ? translate(language, 'errors.detail.code', { code }) : null;
}

export function getSafeErrorDetailFromUnknown(
  error: unknown,
  language: Language,
): string | null {
  if (error instanceof Error) {
    return getSafeErrorDetail(error.message, language);
  }

  if (typeof error === 'string') {
    return getSafeErrorDetail(error, language);
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const candidateMessage = (error as { message?: unknown }).message;
    if (typeof candidateMessage === 'string') {
      return getSafeErrorDetail(candidateMessage, language);
    }
  }

  return null;
}

/**
 * 将 unknown 类型的错误转换为 Error 对象
 * 消除重复的 `error instanceof Error ? error : new Error(String(error))` 模式
 *
 * @param error - 任意类型的错误
 * @returns Error 对象
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string') {
      return new Error(msg);
    }
  }

  return new Error(String(error));
}

/**
 * 从 unknown 错误中提取错误消息
 *
 * @param error - 任意类型的错误
 * @returns 错误消息字符串
 */
export function getErrorMessage(error: unknown): string {
  return toError(error).message;
}
