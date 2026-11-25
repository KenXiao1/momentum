/**
 * Stored as `reasonForFailure` when the user interrupts a session without
 * giving a reason. It is a code, not text, so history reads the same in every
 * language; the UI translates it when showing the record.
 */
export const USER_INTERRUPTED_REASON = 'user_interrupted';

/**
 * Text that earlier versions stored instead of the code: the Chinese default
 * and the English UI strings of the time.
 */
const LEGACY_USER_INTERRUPTED_REASONS: ReadonlySet<string> = new Set([
  '用户主动中断',
  'Interrupted by user',
  'User interrupted',
]);

export function isUserInterruptedReason(reason: string): boolean {
  return (
    reason === USER_INTERRUPTED_REASON ||
    LEGACY_USER_INTERRUPTED_REASONS.has(reason)
  );
}
