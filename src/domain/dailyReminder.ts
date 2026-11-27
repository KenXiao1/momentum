/** A daily reminder time, `HH:MM` in the user's local time. */
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseReminderTime(
  time: string,
): { hour: number; minute: number } | null {
  const match = TIME.exec(time);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

/** The next moment strictly after `now` when a reminder at `time` is due. */
export function nextReminderAt(time: string, now: Date): Date | null {
  const parsed = parseReminderTime(time);
  if (!parsed) return null;
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    parsed.hour,
    parsed.minute,
  );
  return today > now
    ? today
    : new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        parsed.hour,
        parsed.minute,
      );
}
