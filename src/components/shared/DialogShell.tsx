import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
  type CSSProperties,
} from 'react';
import { Portal } from '../Portal';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const dialogStack: string[] = [];
let pageLockCount = 0;
let previousBodyOverflow = '';
let appRootWasInert = false;

function lockPage() {
  if (pageLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const appRoot = document.getElementById('root');
    if (appRoot) {
      appRootWasInert = appRoot.hasAttribute('inert');
      appRoot.setAttribute('inert', '');
    }
  }
  pageLockCount += 1;
}

function unlockPage() {
  pageLockCount = Math.max(0, pageLockCount - 1);
  if (pageLockCount > 0) return;

  document.body.style.overflow = previousBodyOverflow;
  const appRoot = document.getElementById('root');
  if (appRoot && !appRootWasInert) appRoot.removeAttribute('inert');
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
}

interface DialogShellProps {
  children: ReactNode;
  titleId: string;
  onClose: () => void;
  descriptionId?: string;
  role?: 'dialog' | 'alertdialog';
  className?: string;
  overlayClassName?: string;
  style?: CSSProperties;
  dialogRef?: { current: HTMLDivElement | null };
  initialFocusRef?: RefObject<HTMLElement | null>;
  initialFocusDelayMs?: number;
}

export function DialogShell({
  children,
  titleId,
  onClose,
  descriptionId,
  role = 'dialog',
  className = '',
  overlayClassName = '',
  style,
  dialogRef,
  initialFocusRef,
  initialFocusDelayMs = 0,
}: DialogShellProps) {
  const reactId = useId();
  const stackIdRef = useRef(`dialog-${reactId}`);
  const internalRef = useRef<HTMLDivElement | null>(null);

  const setDialogRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      if (dialogRef) dialogRef.current = node;
    },
    [dialogRef],
  );

  useEffect(() => {
    const stackId = stackIdRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    dialogStack.push(stackId);
    lockPage();

    const container = internalRef.current;
    const initialTarget =
      initialFocusRef?.current ??
      container?.querySelector<HTMLElement>('[data-dialog-initial-focus]') ??
      (container ? getFocusableElements(container)[0] : null) ??
      container;
    let focusTimer: number | undefined;
    if (initialFocusDelayMs > 0) {
      focusTimer = window.setTimeout(() => {
        if (!container?.contains(document.activeElement)) {
          initialTarget?.focus();
        }
      }, initialFocusDelayMs);
    } else {
      initialTarget?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== stackId) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !container) return;
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    const keepFocusInside = (event: FocusEvent) => {
      if (dialogStack[dialogStack.length - 1] !== stackId || !container) return;
      if (event.target instanceof Node && container.contains(event.target)) {
        return;
      }
      const fallback = getFocusableElements(container)[0] ?? container;
      fallback.focus();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', keepFocusInside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', keepFocusInside);
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      const index = dialogStack.lastIndexOf(stackId);
      if (index >= 0) dialogStack.splice(index, 1);
      unlockPage();
      previouslyFocused?.focus();
    };
  }, [initialFocusDelayMs, initialFocusRef, onClose]);

  return (
    <Portal>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm ${overlayClassName}`}
        data-dialog-overlay
      >
        <div
          ref={setDialogRef}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          style={style}
          className={`max-h-[calc(100dvh-2rem)] overscroll-contain ${className}`}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
