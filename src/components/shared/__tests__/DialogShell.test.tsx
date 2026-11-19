import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DialogShell } from '../DialogShell';

function DialogHarness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)}>
        Open dialog
      </button>
      {isOpen && (
        <DialogShell
          titleId="test-dialog-title"
          onClose={() => {
            onClose();
            setIsOpen(false);
          }}
        >
          <h2 id="test-dialog-title">Test dialog</h2>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </DialogShell>
      )}
    </>
  );
}

describe('DialogShell', () => {
  it('does not steal focus after the user selects another dialog control', () => {
    vi.useFakeTimers();
    try {
      function DelayedFocusDialog() {
        const preferredFocusRef = useRef<HTMLInputElement>(null);
        return (
          <DialogShell
            titleId="delayed-focus-title"
            onClose={vi.fn()}
            initialFocusRef={preferredFocusRef}
            initialFocusDelayMs={100}
          >
            <h2 id="delayed-focus-title">Delayed focus</h2>
            <input ref={preferredFocusRef} aria-label="Search" />
            <input aria-label="Duration" />
          </DialogShell>
        );
      }

      render(<DelayedFocusDialog />);
      const durationInput = screen.getByRole('textbox', {
        name: 'Duration',
      });
      durationInput.focus();

      vi.advanceTimersByTime(100);

      expect(durationInput).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('traps focus, closes with Escape, restores focus, and unlocks the page', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.appendChild(appRoot);

    render(<DialogHarness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);

    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-labelledby',
      'test-dialog-title',
    );
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    expect(appRoot).toHaveAttribute('inert');

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Last action' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
    expect(appRoot).not.toHaveAttribute('inert');
    appRoot.remove();
  });

  it('lets only the topmost nested dialog handle Escape', async () => {
    const user = userEvent.setup();

    function NestedHarness() {
      const [parentOpen, setParentOpen] = useState(true);
      const [childOpen, setChildOpen] = useState(false);
      return (
        <>
          {parentOpen && (
            <DialogShell
              titleId="parent-title"
              onClose={() => setParentOpen(false)}
            >
              <h2 id="parent-title">Parent</h2>
              <button type="button" onClick={() => setChildOpen(true)}>
                Open child
              </button>
            </DialogShell>
          )}
          {childOpen && (
            <DialogShell
              titleId="child-title"
              onClose={() => setChildOpen(false)}
              overlayClassName="z-60"
            >
              <h2 id="child-title">Child</h2>
              <button type="button">Child action</button>
            </DialogShell>
          )}
        </>
      );
    }

    render(<NestedHarness />);
    await user.click(screen.getByRole('button', { name: 'Open child' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Parent' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
