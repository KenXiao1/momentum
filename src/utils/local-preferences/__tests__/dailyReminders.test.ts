import { describe, expect, it, vi } from 'vitest';

async function load() {
  vi.resetModules();
  return import('../dailyReminders');
}

describe('daily reminder times', () => {
  it('stores, replaces and removes a chain’s time and tells subscribers', async () => {
    localStorage.clear();
    const store = await load();
    const listener = vi.fn();
    const unsubscribe = store.subscribeDailyReminderTimes(listener);

    store.setDailyReminderTime('write', '20:00');
    store.setDailyReminderTime('read', '07:30');
    store.setDailyReminderTime('write', '21:15');
    store.setDailyReminderTime('read', null);

    expect(store.getDailyReminderTimes()).toEqual({ write: '21:15' });
    expect(
      JSON.parse(localStorage.getItem('momentum_daily_reminders')!),
    ).toEqual({ write: '21:15' });
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
  });

  it('ignores invalid times and damaged stored data', async () => {
    localStorage.setItem(
      'momentum_daily_reminders',
      JSON.stringify({ write: '25:00', read: '07:30', bad: 3 }),
    );
    const store = await load();

    expect(store.getDailyReminderTimes()).toEqual({ read: '07:30' });
    store.setDailyReminderTime('write', 'noon');
    expect(store.getDailyReminderTimes()).toEqual({ read: '07:30' });

    localStorage.setItem('momentum_daily_reminders', '{not json');
    expect((await load()).getDailyReminderTimes()).toEqual({});
  });
});
