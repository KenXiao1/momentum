import { describe, expect, it } from 'vitest';
import { getRsipTypeLabel } from '../rsipUi';

describe('getRsipTypeLabel', () => {
  it('translates supported types and keeps the English locale fallback', () => {
    expect(getRsipTypeLabel('zh', 'policy')).toBe('国策');
    expect(getRsipTypeLabel('en', 'policy')).toBe('Policy');
    expect(getRsipTypeLabel('fr', 'policy')).toBe('Policy');
  });

  it.each(['custom type', '__proto__', 'constructor', 'toString'])(
    'preserves unknown type %s as renderable text',
    (type) => {
      expect(getRsipTypeLabel('zh', type)).toBe(type);
      expect(getRsipTypeLabel('en', type)).toBe(type);
    },
  );
});
