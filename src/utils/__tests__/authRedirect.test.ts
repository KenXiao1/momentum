import { describe, expect, it, vi } from 'vitest';
import {
  captureInitialAuthRedirect,
  getInitialAuthRedirect,
  parseAuthRedirect,
} from '../authRedirect';

function fakeWindow(url: string) {
  const location = new URL(url);
  return {
    location,
    history: { state: { kept: true }, replaceState: vi.fn() },
  } as unknown as Window & {
    history: { replaceState: ReturnType<typeof vi.fn> };
  };
}

describe('parseAuthRedirect', () => {
  it.each([
    ['#access_token=abc&refresh_token=r&type=recovery', 'password-recovery'],
    ['#access_token=abc&type=signup', 'none'],
    ['#type=recovery', 'none'],
    [
      '#error=access_denied&error_code=otp_expired&error_description=expired',
      'invalid-link',
    ],
    ['', 'none'],
  ])('reads %s as %s', (hash, expected) => {
    expect(parseAuthRedirect(hash)).toBe(expected);
  });
});

describe('captureInitialAuthRedirect', () => {
  it('keeps a recovery hash for the Supabase SDK to consume', () => {
    const win = fakeWindow(
      'https://app.test/?view=rsip#access_token=abc&type=recovery',
    );

    captureInitialAuthRedirect(win);

    expect(getInitialAuthRedirect()).toBe('password-recovery');
    expect(win.history.replaceState).not.toHaveBeenCalled();
  });

  it('removes a failed link from the URL so a reload does not repeat it', () => {
    const win = fakeWindow(
      'https://app.test/?view=rsip#error=access_denied&error_code=otp_expired',
    );

    captureInitialAuthRedirect(win);

    expect(getInitialAuthRedirect()).toBe('invalid-link');
    expect(win.history.replaceState).toHaveBeenCalledWith(
      { kept: true },
      '',
      '/?view=rsip',
    );
  });
});
