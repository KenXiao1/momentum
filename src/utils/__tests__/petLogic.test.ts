import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPetState } from '../../test/factories/petStateFactory';
import {
  calculateDecay,
  calculateMood,
  calculateTaskReward,
  createNewPet,
  getLevelProgress,
  getMoodEmoji,
  getStageEmoji,
  getStageName,
} from '../petLogic';

describe('petLogic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateDecay', () => {
    it('should skip decay when less than one minute passed', () => {
      const pet = createPetState({
        hunger: 50,
        happiness: 70,
        health: 100,
        lastDecayCalculatedAt: new Date('2026-02-06T10:00:00.000Z'),
      });

      const result = calculateDecay(pet, new Date('2026-02-06T10:00:30.000Z'));

      expect(result).toEqual({
        hunger: 50,
        happiness: 70,
        health: 100,
        lastDecayCalculatedAt: new Date('2026-02-06T10:00:00.000Z'),
      });
    });

    it('should clamp hunger to 100 and happiness to 0', () => {
      const pet = createPetState({
        hunger: 95,
        happiness: 1,
        health: 100,
        lastDecayCalculatedAt: new Date('2026-02-06T10:00:00.000Z'),
      });

      const result = calculateDecay(pet, new Date('2026-02-06T15:00:00.000Z'));

      expect(result.hunger).toBe(100);
      expect(result.happiness).toBe(0);
      expect(result.lastDecayCalculatedAt).toEqual(
        new Date('2026-02-06T15:00:00.000Z'),
      );
    });

    it('should reduce health when pet is starving', () => {
      const pet = createPetState({
        hunger: 90,
        health: 80,
        lastDecayCalculatedAt: new Date('2026-02-06T10:00:00.000Z'),
      });

      const result = calculateDecay(pet, new Date('2026-02-06T12:00:00.000Z'));

      expect(result.health).toBe(79.5);
    });

    it('should recover health when pet is well fed', () => {
      const pet = createPetState({
        hunger: 40,
        health: 90,
        lastDecayCalculatedAt: new Date('2026-02-06T10:00:00.000Z'),
      });

      const result = calculateDecay(pet, new Date('2026-02-06T12:00:00.000Z'));

      expect(result.health).toBe(91);
    });
  });

  describe('calculateTaskReward', () => {
    it('should return penalty when task fails', () => {
      const pet = createPetState();

      const reward = calculateTaskReward(pet, 30, false);

      expect(reward).toEqual({
        xpGained: 0,
        hungerReduced: 0,
        happinessGained: -5,
        leveledUp: false,
        evolved: false,
      });
    });

    it('should scale reward by task duration', () => {
      const pet = createPetState({ experience: 0, level: 1, stage: 'egg' });

      const reward = calculateTaskReward(pet, 30, true);

      expect(reward.xpGained).toBe(13);
      expect(reward.hungerReduced).toBe(10);
      expect(reward.happinessGained).toBe(7);
      expect(reward.leveledUp).toBe(false);
      expect(reward.evolved).toBe(true);
      expect(reward.newStage).toBe('baby');
    });

    it('should cap hunger reduction at 20 for long tasks', () => {
      const pet = createPetState();
      const reward = calculateTaskReward(pet, 500, true);

      expect(reward.hungerReduced).toBe(20);
    });

    it('should detect level up and evolution', () => {
      const pet = createPetState({
        level: 1,
        experience: 95,
        stage: 'egg',
      });

      const reward = calculateTaskReward(pet, 50, true);

      expect(reward.leveledUp).toBe(true);
      expect(reward.newLevel).toBe(2);
      expect(reward.evolved).toBe(true);
      expect(reward.newStage).toBe('baby');
    });
  });

  describe('calculateMood', () => {
    it('should map score ranges to mood levels', () => {
      expect(
        calculateMood(
          createPetState({ happiness: 100, hunger: 0, health: 100 }),
        ),
      ).toBe('ecstatic');
      expect(
        calculateMood(
          createPetState({ happiness: 70, hunger: 30, health: 70 }),
        ),
      ).toBe('happy');
      expect(
        calculateMood(
          createPetState({ happiness: 60, hunger: 80, health: 60 }),
        ),
      ).toBe('neutral');
      expect(
        calculateMood(
          createPetState({ happiness: 30, hunger: 80, health: 30 }),
        ),
      ).toBe('sad');
      expect(
        calculateMood(
          createPetState({ happiness: 10, hunger: 90, health: 10 }),
        ),
      ).toBe('depressed');
    });
  });

  describe('mappings and display helpers', () => {
    it.each([
      ['egg', '🥒'],
      ['baby', '🐣'],
      ['child', '🐥'],
      ['teen', '🐤'],
      ['adult', '🐔'],
      ['elder', '🦅'],
    ] as const)(
      'should map the %s stage to its exact emoji',
      (stage, emoji) => {
        expect(getStageEmoji(stage)).toBe(emoji);
      },
    );

    it.each([
      ['ecstatic', '🤩'],
      ['happy', '😊'],
      ['neutral', '😐'],
      ['sad', '😢'],
      ['depressed', '😭'],
    ] as const)('should map the %s mood to its exact emoji', (mood, emoji) => {
      expect(getMoodEmoji(mood)).toBe(emoji);
    });

    it('should provide stage names in both languages', () => {
      const en = getStageName('adult', 'en');
      const zh = getStageName('adult', 'zh');

      expect(en).toBe('Adult');
      expect(zh).not.toBe('');
      expect(zh).not.toBe(en);
    });

    it('should compute level progress and clamp to 100', () => {
      expect(getLevelProgress({ level: 1, experience: 0 })).toBe(0);
      expect(getLevelProgress({ level: 1, experience: 50 })).toBe(50);
      expect(getLevelProgress({ level: 1, experience: 1000 })).toBe(100);
    });
  });

  describe('createNewPet', () => {
    it('should create a new pet with generated id and defaults', () => {
      vi.useFakeTimers();
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        '00000000-0000-4000-8000-000000000001',
      );
      const now = new Date('2026-02-06T12:34:56.000Z');
      vi.setSystemTime(now);

      const pet = createNewPet('Momo');

      expect(pet.id).toBe('00000000-0000-4000-8000-000000000001');
      expect(pet.name).toBe('Momo');
      expect(pet.level).toBe(1);
      expect(pet.stage).toBe('egg');
      expect(pet.createdAt.getTime()).toBe(now.getTime());
      expect(pet.lastFedAt.getTime()).toBe(now.getTime());
      expect(pet.lastInteractedAt.getTime()).toBe(now.getTime());
      expect(pet.lastDecayCalculatedAt.getTime()).toBe(now.getTime());
    });
  });
});
