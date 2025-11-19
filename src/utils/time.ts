export const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getTimeRemaining = (expiresAt: Date): number => {
  return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
};

export const isSessionExpired = (expiresAt: Date): boolean => {
  return Date.now() > expiresAt.getTime();
};