import type { TaskTimeStats } from '../../../types';
import { localPreferences } from '../../../utils/localPreferences';

// In-memory cache to reduce localStorage I/O operations
let statsCache: TaskTimeStats[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

export async function getTaskTimeStats(): Promise<TaskTimeStats[]> {
  const now = Date.now();

  // Return cached data if valid
  if (statsCache !== null && now - cacheTimestamp < CACHE_TTL) {
    return statsCache;
  }

  try {
    const data = localPreferences.getTaskTimeStats();
    const parsed: TaskTimeStats[] = data ? JSON.parse(data) : [];
    statsCache = parsed;
    cacheTimestamp = now;
    return parsed;
  } catch {
    statsCache = [];
    cacheTimestamp = now;
    return [];
  }
}

export async function saveTaskTimeStats(stats: TaskTimeStats[]): Promise<void> {
  try {
    localPreferences.setTaskTimeStats(JSON.stringify(stats));
    // Update cache to keep it in sync
    statsCache = stats;
    cacheTimestamp = Date.now();
  } catch {
    // best-effort: these stats only feed duration hints and are not user data
  }
}

export async function getLastCompletionTime(
  chainId: string,
): Promise<number | null> {
  const stats = await getTaskTimeStats();
  const chainStats = stats.find((s) => s.chainId === chainId);
  return chainStats?.lastCompletionTime || null;
}

export async function updateTaskTimeStats(
  chainId: string,
  actualDuration: number,
): Promise<void> {
  const stats = await getTaskTimeStats();
  const existingIndex = stats.findIndex((s) => s.chainId === chainId);

  if (existingIndex >= 0) {
    const existing = stats[existingIndex];
    const newTotalTime = existing.totalTime + actualDuration;
    const newTotalCompletions = existing.totalCompletions + 1;

    stats[existingIndex] = {
      ...existing,
      lastCompletionTime: actualDuration,
      averageCompletionTime: Math.round(newTotalTime / newTotalCompletions),
      totalCompletions: newTotalCompletions,
      totalTime: newTotalTime,
    };
  } else {
    stats.push({
      chainId,
      lastCompletionTime: actualDuration,
      averageCompletionTime: actualDuration,
      totalCompletions: 1,
      totalTime: actualDuration,
    });
  }

  await saveTaskTimeStats(stats);
}

export async function getTaskAverageTime(
  chainId: string,
): Promise<number | null> {
  const stats = await getTaskTimeStats();
  const chainStats = stats.find((s) => s.chainId === chainId);
  return chainStats?.averageCompletionTime || null;
}
