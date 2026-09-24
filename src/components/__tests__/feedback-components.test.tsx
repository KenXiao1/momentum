import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { ToastViewport } from '../ToastViewport';
import { UserFeedbackDisplay } from '../UserFeedbackDisplay';
import { toast } from '../../utils/toast';
import { userFeedbackHandler } from '../../services/UserFeedbackHandler';
import { logger } from '../../utils/logger';
import { I18nProvider } from '../../i18n';

describe('Feedback components', () => {
  beforeEach(() => {
    userFeedbackHandler.clearMessages();
    userFeedbackHandler.hideProgress();
  });

  afterEach(() => {
    userFeedbackHandler.clearMessages();
    userFeedbackHandler.hideProgress();
  });

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

  describe('UserFeedbackDisplay', () => {
    it('renders messages, progress and closes non-persistent items', async () => {
      const { container } = render(<UserFeedbackDisplay />);

      act(() => {
        userFeedbackHandler.showProgress('Importing', 40, 'phase 1');
        userFeedbackHandler.showSuccess('Done', 'Saved successfully', false);
      });

      expect(await screen.findByText('Importing')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText('Saved successfully')).toBeInTheDocument();

      const closeButton = container.querySelector('button.text-gray-400');
      expect(closeButton).not.toBeNull();
      if (!closeButton) throw new Error('Close button not found');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText('Saved successfully'),
        ).not.toBeInTheDocument();
      });
    });

    it('executes action handlers and logs errors from failed actions', async () => {
      const actionOk = vi.fn().mockResolvedValue(undefined);
      const actionFail = vi.fn().mockRejectedValue(new Error('boom'));
      const loggerSpy = vi
        .spyOn(logger, 'error')
        .mockImplementation(() => undefined);

      render(<UserFeedbackDisplay />);

      act(() => {
        userFeedbackHandler.showWarning('Warning', 'Review this', [
          { id: 'ok', label: 'Retry', type: 'primary', handler: actionOk },
          { id: 'fail', label: 'Force', type: 'danger', handler: actionFail },
        ]);
      });

      expect(await screen.findByText('Review this')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      fireEvent.click(screen.getByRole('button', { name: 'Force' }));

      expect(actionOk).toHaveBeenCalledTimes(1);
      expect(actionFail).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(loggerSpy).toHaveBeenCalled();
      });
    });
  });
});
