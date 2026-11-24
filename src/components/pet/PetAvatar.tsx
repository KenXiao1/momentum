import type { PetMood, PetStage } from '../../types/pet';
import { getStageEmoji, getMoodEmoji } from '../../domain/pet';

interface PetAvatarProps {
  stage: PetStage;
  mood: PetMood;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function PetAvatar({
  stage,
  mood,
  onClick,
  size = 'md',
}: PetAvatarProps) {
  const sizeClasses = {
    sm: 'text-3xl',
    md: 'text-5xl',
    lg: 'text-7xl',
  };

  const containerSizes = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  const stageEmoji = getStageEmoji(stage);
  const moodEmoji = getMoodEmoji(mood);

  return (
    <div
      className={` ${containerSizes[size]} relative flex items-center justify-center rounded-full bg-linear-to-br from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''} transition-transform duration-200`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Main pet emoji */}
      <span
        className={`${sizeClasses[size]} animate-bounce-gentle select-none`}
      >
        {stageEmoji}
      </span>

      {/* Mood indicator */}
      <span
        className="absolute -right-1 -bottom-1 rounded-full bg-white p-0.5 text-lg shadow-xs dark:bg-gray-800"
        title={`Mood: ${mood}`}
      >
        {moodEmoji}
      </span>
    </div>
  );
}
