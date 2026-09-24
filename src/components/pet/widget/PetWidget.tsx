import { useI18n } from '../../../i18n';
import type { FeedResult, PetMood, PetState } from '../../../types/pet';
import { Cookie, Minimize2 } from 'lucide-react';
import { PetAvatar } from '../PetAvatar';
import { PetCreationDialog } from '../PetCreationDialog';
import { PetStatsBar } from '../PetStatsBar';
import { usePetWidgetController } from './hooks/usePetWidgetController';

interface PetWidgetProps {
  pet: PetState | null;
  mood: PetMood;
  isLoading: boolean;
  hasPet: boolean;
  onCreatePet: (name: string) => Promise<PetState>;
  onFeedPet: () => Promise<FeedResult | null>;
  onUpdatePosition: (x: number, y: number) => Promise<void>;
  onUpdateMinimizedPosition: (x: number, y: number) => Promise<void>;
  onToggleVisibility: () => Promise<void>;
  onMinimize: () => Promise<void>;
  onExpand: () => Promise<void>;
}

export function PetWidget({
  pet,
  mood,
  isLoading,
  hasPet,
  onCreatePet,
  onFeedPet,
  onUpdatePosition,
  onUpdateMinimizedPosition,
  onMinimize,
  onExpand,
}: PetWidgetProps) {
  const { t } = useI18n();

  const {
    isDragging,
    showCreationDialog,
    setShowCreationDialog,
    dismissedCreationDialog,
    setDismissedCreationDialog,
    isFeeding,
    widgetRef,
    hasDraggedRef,
    handleFeed,
    handleMouseDown,
    handleTouchStart,
    handleCreatePet,
    handleMinimize,
    handleExpand,
  } = usePetWidgetController({
    pet,
    mood,
    isLoading,
    hasPet,
    onCreatePet,
    onFeedPet,
    onUpdatePosition,
    onUpdateMinimizedPosition,
    onMinimize,
    onExpand,
    t,
  });

  if (isLoading) return null;

  const currentPosition = pet?.isMinimized
    ? pet.minimizedPosition
    : pet?.position;

  return (
    <>
      {!hasPet && dismissedCreationDialog && !showCreationDialog && (
        <button
          type="button"
          onClick={() => setShowCreationDialog(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-full border border-gray-200/60 bg-white/90 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-xl dark:border-gray-700/60 dark:bg-gray-800/90"
          title={t('pet.widget.petWidget.adoptAPet')}
          aria-label={t('pet.widget.petWidget.adoptAPet')}
        >
          <div className="flex h-12 w-12 select-none items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-blue-100 text-3xl dark:from-green-900/30 dark:to-blue-900/30">
            🥚
          </div>
          <div className="pr-1 text-left leading-tight">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {t('pet.widget.petWidget.adoptAPetVariant2')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('pet.widget.petWidget.nameYourNewCompanion')}
            </div>
          </div>
        </button>
      )}

      {pet && currentPosition && (
        <div
          ref={widgetRef}
          className={`fixed z-40 select-none ${isDragging ? 'transition-none' : 'transition duration-200'} ${pet.isMinimized ? '' : 'w-36 sm:w-44 md:w-52'} ${isDragging ? 'scale-105 cursor-grabbing' : 'cursor-default'} `}
          style={{
            left: `${currentPosition.x}%`,
            top: `${currentPosition.y}%`,
            willChange: isDragging ? 'left, top' : undefined,
            touchAction: 'none',
          }}
        >
          {pet.isMinimized ? (
            <button
              type="button"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onClick={(event) => {
                if (!hasDraggedRef.current) {
                  event.stopPropagation();
                  void handleExpand();
                }
              }}
              className="cursor-grab rounded-full border border-gray-200/50 bg-white/95 p-2 shadow-lg backdrop-blur-md transition hover:scale-105 hover:shadow-xl active:cursor-grabbing dark:border-gray-700/50 dark:bg-gray-800/95"
              title={t('pet.widget.petWidget.expandPet')}
              aria-label={t('pet.widget.petWidget.expandPet')}
            >
              <PetAvatar stage={pet.stage} mood={mood} size="sm" />
            </button>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200/50 bg-white/95 shadow-lg backdrop-blur-md dark:border-gray-700/50 dark:bg-gray-800/95">
              <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 px-3 py-2 dark:from-green-900/20 dark:to-emerald-900/20">
                <button
                  type="button"
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  className="min-w-0 flex-1 cursor-grab text-left active:cursor-grabbing"
                  aria-label={t('pet.widget.petWidget.dragToMovePet')}
                  title={t('pet.widget.petWidget.dragToMove')}
                >
                  <span className="block max-w-24 truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                    {pet.name}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleMinimize();
                    }}
                    className="rounded p-1 transition-colors hover:bg-white/50 dark:hover:bg-gray-700/50"
                    title={t('pet.widget.petWidget.minimize')}
                    aria-label={t('pet.widget.petWidget.minimize')}
                  >
                    <Minimize2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="p-3">
                <div className="mb-2 flex justify-center">
                  <PetAvatar
                    stage={pet.stage}
                    mood={mood}
                    size="md"
                    onClick={handleFeed}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleFeed}
                  disabled={isFeeding || pet.hunger <= 5}
                  aria-label={t('pet.widget.petWidget.feed')}
                  className={`mb-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 ${
                    pet.hunger <= 5
                      ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700'
                      : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600'
                  } text-sm font-medium transition ${isFeeding ? 'animate-pulse' : ''} `}
                >
                  <Cookie size={16} aria-hidden="true" />
                  {isFeeding
                    ? t('pet.widget.petWidget.feeding')
                    : t('pet.widget.petWidget.feed')}
                </button>

                <PetStatsBar
                  hunger={pet.hunger}
                  happiness={pet.happiness}
                  health={pet.health}
                  level={pet.level}
                  experience={pet.experience}
                  stage={pet.stage}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {showCreationDialog && (
        <PetCreationDialog
          onSubmit={handleCreatePet}
          onCancel={() => {
            setShowCreationDialog(false);
            setDismissedCreationDialog(true);
          }}
        />
      )}
    </>
  );
}
