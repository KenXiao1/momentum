import { translate } from '../i18n/translate';
import type {
  PetConfig,
  PetMood,
  PetStage,
  PetState,
  TaskCompletionReward,
} from '../types/pet';

// Default configuration constants
export const DEFAULT_PET_CONFIG: PetConfig = {
  hungerDecayRate: 2, // 2 points per hour
  happinessDecayRate: 1, // 1 point per hour
  healthDecayRate: 0.5, // 0.5 per hour when starving

  taskCompletionXP: 10,
  feedingHungerReduction: 30,

  xpPerLevel: (level: number) => Math.floor(100 * Math.pow(1.2, level - 1)),

  stageThresholds: {
    egg: 0,
    baby: 1,
    child: 5,
    teen: 15,
    adult: 30,
    elder: 60,
  },
};

// Initial pet state (excluding id and createdAt which are set on creation)
const INITIAL_PET_STATE: Omit<PetState, 'id' | 'createdAt'> = {
  name: '',
  hunger: 50,
  happiness: 70,
  health: 100,
  level: 1,
  experience: 0,
  stage: 'egg',
  lastFedAt: new Date(),
  lastInteractedAt: new Date(),
  lastDecayCalculatedAt: new Date(),
  isVisible: true,
  isMinimized: false,
  position: { x: 80, y: 80 }, // Bottom-right position in percentage (expanded)
  minimizedPosition: { x: 92, y: 2 }, // Top-right position (next to theme toggle)
};

/**
 * Get the XP required for a specific level
 */
export function getXpForLevel(level: number): number {
  return DEFAULT_PET_CONFIG.xpPerLevel(level);
}

/**
 * Get the stage for a given level
 */
function getStageForLevel(level: number): PetStage {
  const thresholds = DEFAULT_PET_CONFIG.stageThresholds;

  if (level >= thresholds.elder) return 'elder';
  if (level >= thresholds.adult) return 'adult';
  if (level >= thresholds.teen) return 'teen';
  if (level >= thresholds.child) return 'child';
  if (level >= thresholds.baby) return 'baby';
  return 'egg';
}

/**
 * Calculate decay based on time since last calculation
 */
export function calculateDecay(
  pet: PetState,
  now: Date,
): Pick<PetState, 'hunger' | 'happiness' | 'health' | 'lastDecayCalculatedAt'> {
  const hoursSinceLastCalc =
    (now.getTime() - pet.lastDecayCalculatedAt.getTime()) / (1000 * 60 * 60);

  // Skip if less than 1 minute has passed
  if (hoursSinceLastCalc < 1 / 60) {
    return {
      hunger: pet.hunger,
      happiness: pet.happiness,
      health: pet.health,
      lastDecayCalculatedAt: pet.lastDecayCalculatedAt,
    };
  }

  // Calculate new hunger (capped at 100)
  const newHunger = Math.min(
    100,
    pet.hunger + DEFAULT_PET_CONFIG.hungerDecayRate * hoursSinceLastCalc,
  );

  // Calculate new happiness (capped at 0)
  const newHappiness = Math.max(
    0,
    pet.happiness - DEFAULT_PET_CONFIG.happinessDecayRate * hoursSinceLastCalc,
  );

  // Health only decays when starving (hunger > 80)
  let newHealth = pet.health;
  if (pet.hunger > 80) {
    const starvingFactor = (pet.hunger - 80) / 20; // 0-1 based on how starving
    const healthDecay =
      DEFAULT_PET_CONFIG.healthDecayRate * hoursSinceLastCalc * starvingFactor;
    newHealth = Math.max(0, pet.health - healthDecay);
  } else if (pet.hunger < 50 && pet.health < 100) {
    // Health slowly recovers when well-fed
    const recoveryRate = 0.5; // 0.5 per hour
    newHealth = Math.min(100, pet.health + recoveryRate * hoursSinceLastCalc);
  }

  return {
    hunger: Math.round(newHunger * 10) / 10,
    happiness: Math.round(newHappiness * 10) / 10,
    health: Math.round(newHealth * 10) / 10,
    lastDecayCalculatedAt: now,
  };
}

/**
 * Calculate task completion reward
 */
export function calculateTaskReward(
  pet: PetState,
  taskDuration: number, // in minutes
  wasSuccessful: boolean,
): TaskCompletionReward {
  if (!wasSuccessful) {
    return {
      xpGained: 0,
      hungerReduced: 0,
      happinessGained: -5, // Small penalty for failed tasks
      leveledUp: false,
      evolved: false,
    };
  }

  // XP scales with task duration (base + duration bonus)
  const durationBonus = Math.floor(taskDuration / 10);
  const xpGained = DEFAULT_PET_CONFIG.taskCompletionXP + durationBonus;

  // Feeding effect (hunger reduced, max reduction 20 per task)
  const hungerReduced = Math.min(20, taskDuration / 3);

  // Happiness boost
  const happinessGained = Math.min(10, 5 + Math.floor(taskDuration / 15));

  // Calculate level up
  const newXP = pet.experience + xpGained;
  const xpRequired = getXpForLevel(pet.level);
  const leveledUp = newXP >= xpRequired;
  const newLevel = leveledUp ? pet.level + 1 : pet.level;

  // Check for evolution
  const currentStage = pet.stage;
  const expectedStage = getStageForLevel(newLevel);
  const evolved = expectedStage !== currentStage;

  return {
    xpGained,
    hungerReduced: Math.round(hungerReduced * 10) / 10,
    happinessGained,
    leveledUp,
    evolved,
    newLevel: leveledUp ? newLevel : undefined,
    newStage: evolved ? expectedStage : undefined,
  };
}

/**
 * Calculate mood based on pet stats
 */
export function calculateMood(pet: PetState): PetMood {
  // Weighted average of stats (happiness weighted more)
  const score =
    pet.happiness * 0.5 + (100 - pet.hunger) * 0.3 + pet.health * 0.2;

  if (score >= 85) return 'ecstatic';
  if (score >= 65) return 'happy';
  if (score >= 45) return 'neutral';
  if (score >= 25) return 'sad';
  return 'depressed';
}

/**
 * Get emoji for pet stage
 */
export function getStageEmoji(stage: PetStage): string {
  const emojiMap: Record<PetStage, string> = {
    egg: '🥒',
    baby: '🐣',
    child: '🐥',
    teen: '🐤',
    adult: '🐔',
    elder: '🦅',
  };
  return emojiMap[stage];
}

/**
 * Get emoji for pet mood
 */
export function getMoodEmoji(mood: PetMood): string {
  const emojiMap: Record<PetMood, string> = {
    ecstatic: '🤩',
    happy: '😊',
    neutral: '😐',
    sad: '😢',
    depressed: '😭',
  };
  return emojiMap[mood];
}

/**
 * Get stage display name
 */
export function getStageName(
  stage: PetStage,
  language: 'zh' | 'en' = 'zh',
): string {
  const names: Record<PetStage, string> = {
    egg: translate(language, 'pet.stage.egg'),
    baby: translate(language, 'pet.stage.baby'),
    child: translate(language, 'pet.stage.child'),
    teen: translate(language, 'pet.stage.teen'),
    adult: translate(language, 'pet.stage.adult'),
    elder: translate(language, 'pet.stage.elder'),
  };
  return names[stage];
}

/**
 * Calculate progress to next level (0-100)
 */
export function getLevelProgress(
  pet: Pick<PetState, 'level' | 'experience'>,
): number {
  const xpRequired = getXpForLevel(pet.level);
  return Math.min(100, Math.round((pet.experience / xpRequired) * 100));
}

/**
 * Create a new pet with default values
 */
export function createNewPet(
  name: string,
  options?: {
    position?: { x: number; y: number };
    minimizedPosition?: { x: number; y: number };
  },
): PetState {
  const now = new Date();
  return {
    ...INITIAL_PET_STATE,
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    lastFedAt: now,
    lastInteractedAt: now,
    lastDecayCalculatedAt: now,
    ...(options?.position && { position: options.position }),
    ...(options?.minimizedPosition && {
      minimizedPosition: options.minimizedPosition,
    }),
  };
}
