import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../../i18n';
import { IntroScreen } from '../intro/IntroScreen';

const renderIntro = () => {
  return render(
    <I18nProvider>
      <IntroScreen onSignIn={() => {}} onSignUp={() => {}} />
    </I18nProvider>,
  );
};

describe('IntroScreen language toggle', () => {
  it('allows switching between EN and CN', async () => {
    window.localStorage.setItem('language', 'en');
    renderIntro();

    const enToggle = screen.getByRole('radio', { name: 'EN' });
    const cnToggle = screen.getByRole('radio', { name: 'CN' });

    expect(enToggle).toHaveAttribute('aria-checked', 'true');
    expect(cnToggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();

    fireEvent.click(cnToggle);

    await waitFor(() => {
      expect(cnToggle).toHaveAttribute('aria-checked', 'true');
    });

    expect(window.localStorage.getItem('language')).toBe('zh');
    expect(
      screen.queryByRole('button', { name: 'Sign In' }),
    ).not.toBeInTheDocument();

    fireEvent.click(enToggle);

    await waitFor(() => {
      expect(enToggle).toHaveAttribute('aria-checked', 'true');
    });

    expect(window.localStorage.getItem('language')).toBe('en');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });
});
