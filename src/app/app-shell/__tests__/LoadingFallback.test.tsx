import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { translations, type TranslationKey } from '../../../i18n/translations';
import { LoadingFallback } from '../LoadingFallback';

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    t: (key: TranslationKey) => translations.en[key],
  }),
}));

describe('LoadingFallback', () => {
  it('renders loading state copy', () => {
    render(<LoadingFallback />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
});
