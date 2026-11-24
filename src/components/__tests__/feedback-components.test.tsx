import { describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { ToastViewport } from '../ToastViewport';
import { toast } from '../../utils/toast';
import { I18nProvider } from '../../i18n';

describe('Feedback components', () => {
  describe('ConfirmationDialog', () => {
    it('does not render when closed', () => {
      const { container } = render(
        <ConfirmationDialog
          isOpen={false}
          title="Delete"
          message="Are you sure?"
          confirmText="Confirm"
          cancelText="Cancel"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
        { wrapper: I18nProvider },
      );

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('handles confirm/cancel buttons and escape key', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <ConfirmationDialog
          isOpen
          title="Delete"
          message="Are you sure?"
          confirmText="Confirm"
          cancelText="Cancel"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
        { wrapper: I18nProvider },
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalledTimes(2);
    });
  });

  describe('ToastViewport', () => {
    it('renders and auto-dismisses a toast after duration + exit animation', async () => {
      render(<ToastViewport />);

      act(() => {
        toast.success('Saved', { title: 'Done', durationMs: 10 });
      });

      expect(screen.getByText('Saved')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();

      await waitFor(
        () => {
          expect(screen.queryByText('Saved')).not.toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it('allows manual dismissal and limits list to latest five toasts', async () => {
      render(<ToastViewport />);

      act(() => {
        toast.error('Critical failure', { durationMs: 0 });
      });

      expect(screen.getByText('Critical failure')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: 'Close notification' }),
      );
      await waitFor(
        () => {
          expect(
            screen.queryByText('Critical failure'),
          ).not.toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it('keeps only the latest five toasts', async () => {
      render(<ToastViewport />);

      act(() => {
        for (let i = 0; i < 6; i++) {
          toast.info(`message-${i}`, { durationMs: 0 });
        }
      });

      expect(screen.getByText('message-5')).toBeInTheDocument();
      expect(screen.queryByText('message-0')).not.toBeInTheDocument();
      expect(
        screen.getAllByRole('button', { name: 'Close notification' }),
      ).toHaveLength(5);
    });
  });
});
