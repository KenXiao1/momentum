import { describe, expect, it } from 'vitest';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
  toError,
} from '../errorMessage';

describe('errorMessage', () => {
  describe('getSafeErrorDetail', () => {
    it('returns original message when language and content are both Chinese', () => {
      const message = '这是一个中文错误';
      expect(getSafeErrorDetail(message, 'zh')).toBe(message);
    });

    it('returns translated known detail for zh when message is known English error', () => {
      const message =
        'cannot execute UPDATE in a read-only transaction (25006)';
      const detail = getSafeErrorDetail(message, 'zh');

      expect(detail).not.toBeNull();
      expect(detail).not.toBe(message);
    });

    it('extracts PGRST code for zh when message is not translatable', () => {
      const detail = getSafeErrorDetail(
        'Unexpected failure: PGRST204 missing column',
        'zh',
      );
      expect(detail).toContain('PGRST204');
    });

    it('extracts SQLSTATE code for English UI when source is Chinese', () => {
      const detail = getSafeErrorDetail('操作失败，错误码 42P01', 'en');
      expect(detail).toBe('Error code: 42P01');
    });

    it('returns original English detail for English UI', () => {
      const detail = getSafeErrorDetail(
        'Network timeout while connecting to Supabase',
        'en',
      );
      expect(detail).toBe('Network timeout while connecting to Supabase');
    });

    it('returns null for English UI when message is Chinese without known code', () => {
      expect(getSafeErrorDetail('纯中文错误信息', 'en')).toBeNull();
    });
  });

  describe('getSafeErrorDetailFromUnknown', () => {
    it('handles Error instances', () => {
      const detail = getSafeErrorDetailFromUnknown(
        new Error('PGRST116 no rows returned'),
        'en',
      );
      expect(detail).toBe('PGRST116 no rows returned');
    });

    it('handles plain strings', () => {
      const detail = getSafeErrorDetailFromUnknown('Network error', 'en');
      expect(detail).toBe('Network error');
    });

    it('handles objects with message field', () => {
      const detail = getSafeErrorDetailFromUnknown(
        { message: '操作失败 23514' },
        'en',
      );
      expect(detail).toBe('Error code: 23514');
    });

    it('returns null for unsupported input', () => {
      expect(
        getSafeErrorDetailFromUnknown({ reason: 'missing' }, 'en'),
      ).toBeNull();
    });
  });

  describe('toError', () => {
    it('returns the same Error instance when input is already Error', () => {
      const source = new Error('already error');
      const mapped = toError(source);
      expect(mapped).toBe(source);
    });

    it('converts string/object/primitive to Error', () => {
      expect(toError('plain string').message).toBe('plain string');
      expect(toError({ message: 'object message' }).message).toBe(
        'object message',
      );
      expect(toError(404).message).toBe('404');
    });

    it('uses a fallback message for empty payloads', () => {
      expect(toError('').message).toBe('Unknown error');
      expect(toError({ message: '  ' }).message).toBe('Unknown error');
    });
  });
});
