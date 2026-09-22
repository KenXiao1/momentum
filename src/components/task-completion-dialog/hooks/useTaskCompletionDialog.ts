import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '../../../storage/useStorage';
import { logger } from '../../../utils/logger';
import { toError } from '../../../utils/errorMessage';

export function useTaskCompletionDialog(params: {
  isOpen: boolean;
  chainId: string;
  isDurationless: boolean;
  onComplete: (
    description: string,
    notes?: string,
  ) => void | Promise<boolean | void>;
  onCancel: () => void;
}) {
  const { isOpen, chainId, isDurationless, onComplete, onCancel } = params;

  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [notes, setNotes] = useState('');
  const [isNotesVisible, setIsNotesVisible] = useState(false);
  const [recentDescriptionsState, setRecentDescriptionsState] = useState<{
    chainId: string;
    descriptions: string[];
  }>({ chainId: '', descriptions: [] });
  const [showQuickFill, setShowQuickFill] = useState(false);

  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  const storage = useStorage();

  useEffect(() => {
    if (!isOpen || !chainId) return;

    let isActive = true;
    const loadRecentDescriptions = async () => {
      try {
        const history = await storage.getCompletionHistory();
        const chainHistory = history
          .filter(
            (h) => h.chainId === chainId && h.wasSuccessful && h.description,
          )
          .sort(
            (a, b) =>
              new Date(b.completedAt).getTime() -
              new Date(a.completedAt).getTime(),
          );

        const descriptions = chainHistory
          .map((h) => h.description!)
          .filter(Boolean);
        const uniqueDescriptions = Array.from(new Set(descriptions)).slice(
          0,
          5,
        );
        if (isActive) {
          setRecentDescriptionsState({
            chainId,
            descriptions: uniqueDescriptions,
          });
        }
      } catch (error) {
        logger.error(
          'TASK_COMPLETION',
          'Failed to load recent descriptions',
          { chainId },
          toError(error),
        );
      }
    };

    void loadRecentDescriptions();
    return () => {
      isActive = false;
    };
  }, [isOpen, chainId, storage]);

  const recentDescriptions = useMemo(
    () =>
      isOpen && recentDescriptionsState.chainId === chainId
        ? recentDescriptionsState.descriptions
        : [],
    [chainId, isOpen, recentDescriptionsState],
  );

  const sanitizeInput = useCallback((input: string): string => {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }, []);

  const resetForm = useCallback(() => {
    setDescription('');
    setNotes('');
    setIsNotesVisible(false);
    setShowQuickFill(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting.current) return;
    if (isDurationless && !description.trim()) {
      return;
    }

    const sanitizedDescription = sanitizeInput(description);
    const sanitizedNotes = notes.trim() ? sanitizeInput(notes) : undefined;

    submitting.current = true;
    setIsSubmitting(true);
    try {
      const result = await onComplete(
        sanitizedDescription || '',
        sanitizedNotes,
      );
      if (result !== false) resetForm();
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }, [
    description,
    isDurationless,
    notes,
    onComplete,
    resetForm,
    sanitizeInput,
  ]);

  const handleCancel = useCallback(() => {
    resetForm();
    onCancel();
  }, [onCancel, resetForm]);

  const showNotes = useCallback(() => {
    setIsNotesVisible(true);
    window.setTimeout(() => {
      notesTextareaRef.current?.focus();
    }, 100);
  }, []);

  const toggleQuickFill = useCallback(() => {
    setShowQuickFill((prev) => !prev);
  }, []);

  const handleQuickFill = useCallback((desc: string) => {
    setDescription(desc);
    setShowQuickFill(false);
    descriptionInputRef.current?.focus();
  }, []);

  const handleDescriptionKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) {
          setShowQuickFill((prev) => !prev);
        } else {
          if (description.trim()) {
            showNotes();
          } else if (recentDescriptions.length > 0) {
            setDescription(recentDescriptions[0]);
          }
        }
      } else if (event.key === 'Enter') {
        event.preventDefault();
        handleSubmit();
      }
    },
    [description, handleSubmit, recentDescriptions, showNotes],
  );

  const handleNotesKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return {
    description,
    isSubmitting,
    setDescription,
    notes,
    setNotes,
    isNotesVisible,
    setIsNotesVisible,
    recentDescriptions,
    showQuickFill,
    setShowQuickFill,
    descriptionInputRef,
    notesTextareaRef,
    handleSubmit,
    handleCancel,
    showNotes,
    toggleQuickFill,
    handleQuickFill,
    handleDescriptionKeyDown,
    handleNotesKeyDown,
  };
}
