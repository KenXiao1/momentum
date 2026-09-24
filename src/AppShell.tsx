import { Suspense, lazy } from 'react';
import { AuthWrapper } from './components/AuthWrapper';
import { ChunkLoadErrorBoundary } from './components/ChunkLoadErrorBoundary';
import { useI18n } from './i18n';
import { lazyWithChunkRecovery } from './utils/lazyWithChunkRecovery';

const AppShellContainer = lazy(
  lazyWithChunkRecovery(
    () => import('./app/AppShellContainer'),
    'AppShellContainer',
  ),
);

function AppShellLoadingFallback() {
  const { t } = useI18n();

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="gradient-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('common.loading')}
        </p>
      </div>
    </div>
  );
}

export default function AppShell() {
  return (
    <ChunkLoadErrorBoundary>
      <AuthWrapper>
        <Suspense fallback={<AppShellLoadingFallback />}>
          <AppShellContainer />
        </Suspense>
      </AuthWrapper>
    </ChunkLoadErrorBoundary>
  );
}
