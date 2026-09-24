import React from 'react';
import { normalizeUnknownError } from '../utils/errors/normalizeError';
import {
  attemptChunkLoadRecovery,
  isChunkLoadError,
} from '../utils/chunkLoadRecovery';
import { logger } from '../utils/logger';
import { t } from '../utils/runtimeI18n';

interface ChunkLoadErrorBoundaryProps {
  children: React.ReactNode;
}

interface ChunkLoadErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export class ChunkLoadErrorBoundary extends React.Component<
  ChunkLoadErrorBoundaryProps,
  ChunkLoadErrorBoundaryState
> {
  state: ChunkLoadErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: unknown): ChunkLoadErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: unknown): void {
    const recovered = attemptChunkLoadRecovery(error);
    logger.error(
      'UI',
      'Unhandled render error reached chunk boundary',
      {
        recovered,
        chunkError: isChunkLoadError(error),
      },
      normalizeUnknownError(error),
    );
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const chunkError = isChunkLoadError(this.state.error);
    const title = chunkError
      ? t('chunkLoadErrorBoundary.theAppWasUpdatedPleaseReload')
      : t('chunkLoadErrorBoundary.theAppHitAnErrorPleaseReload');

    const description = chunkError
      ? t(
          'chunkLoadErrorBoundary.aVersionMismatchWasDetectedThisUsuallyHappensAfter',
        )
      : t(
          'chunkLoadErrorBoundary.theCurrentViewCannotContinueRenderingReloadUsuallyRecovers',
        );

    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <h1 className="mb-2 font-chinese text-xl font-bold text-gray-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="mb-6 text-sm text-gray-600 dark:text-slate-300">
            {description}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="btn-primary btn-disabled w-full px-4 py-3"
          >
            {t('chunkLoadErrorBoundary.reloadApp')}
          </button>
        </div>
      </div>
    );
  }
}
