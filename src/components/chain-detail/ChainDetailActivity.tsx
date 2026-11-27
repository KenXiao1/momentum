import { useMemo, useState, type KeyboardEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import type {
  ActivityCalendar,
  ActivityDay,
  ActivityLevel,
} from '../../domain/activityCalendar';
import type { TranslationFn } from './types';

interface ChainDetailActivityProps {
  calendar: ActivityCalendar;
  locale: string;
  t: TranslationFn;
}

/** One violet ramp, light to dark; dark mode runs dark to light. */
const LEVEL_CLASSES: Record<ActivityLevel, string> = {
  0: 'bg-gray-100 dark:bg-slate-700/60',
  1: 'bg-violet-200 dark:bg-violet-900',
  2: 'bg-violet-400 dark:bg-violet-700',
  3: 'bg-violet-600 dark:bg-violet-500',
  4: 'bg-violet-800 dark:bg-violet-300',
};
const LEVELS: ActivityLevel[] = [0, 1, 2, 3, 4];

function cellClass(day: ActivityDay, active: boolean): string {
  const fill = day.future ? 'bg-transparent' : LEVEL_CLASSES[day.level];
  const ring = active
    ? ' ring-2 ring-gray-900/70 ring-offset-1 dark:ring-white/80 dark:ring-offset-slate-800'
    : '';
  return `h-3 w-3 rounded-[3px] ${fill}${ring}`;
}

/** A completion heatmap for one chain; the readout names the day in focus. */
export function ChainDetailActivity({
  calendar,
  locale,
  t,
}: ChainDetailActivityProps) {
  const lastWeek = calendar.weeks.length - 1;
  const todayIndex = Math.max(
    0,
    calendar.weeks[lastWeek].findIndex((day) => day.future) - 1,
  );
  const [active, setActive] = useState<{ week: number; day: number } | null>(
    null,
  );
  const activeDay = active ? calendar.weeks[active.week][active.day] : null;

  const monthLabels = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { month: 'short' });
    return calendar.weeks.map((week, index) => {
      const first = week.find((day) => day.date.endsWith('-01'));
      if (!first && index > 0) return '';
      const [year, month] = (first ?? week[0]).date.split('-').map(Number);
      return format.format(new Date(year, month - 1, 1));
    });
  }, [calendar.weeks, locale]);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = step[event.key];
    if (!delta) return;
    event.preventDefault();
    const from = active ?? { week: lastWeek, day: todayIndex };
    const week = Math.min(lastWeek, Math.max(0, from.week + delta[0]));
    const day = Math.min(6, Math.max(0, from.day + delta[1]));
    if (!calendar.weeks[week][day].future) setActive({ week, day });
  };

  const dayLabel = (day: ActivityDay) =>
    t('chainDetail.activity.day', {
      date: day.date,
      completions: day.successes,
      failures: day.failures,
    });

  const summary = t('chainDetail.activity.summary', {
    completions: calendar.totalSuccesses,
    days: calendar.activeDays,
    streak: calendar.longestRun,
  });

  return (
    <div className="bento-card animate-scale-in">
      <h3 className="mb-6 flex items-center space-x-3 font-chinese text-xl font-bold text-[#161615] dark:text-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
          <CalendarDays className="text-violet-500" size={20} />
        </div>
        <div>
          <span>{t('chainDetail.activity.title')}</span>
          <p className="font-mono text-xs tracking-wide text-gray-500 dark:text-slate-400">
            {t('chainDetail.activity.subtitle', {
              weeks: calendar.weeks.length,
            })}
          </p>
        </div>
      </h3>

      <div className="overflow-x-auto pb-1">
        <div
          aria-hidden="true"
          className="mb-1 flex gap-0.5 text-[10px] text-gray-500 dark:text-slate-400"
        >
          {monthLabels.map((label, index) => (
            <span
              key={calendar.weeks[index][0].date}
              className="w-3 shrink-0 overflow-visible whitespace-nowrap"
            >
              {label}
            </span>
          ))}
        </div>
        <div
          role="grid"
          aria-label={summary}
          aria-activedescendant={
            activeDay ? `activity-${activeDay.date}` : undefined
          }
          tabIndex={0}
          onKeyDown={move}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="inline-flex flex-col gap-0.5 rounded-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
            <div key={dayIndex} role="row" className="flex gap-0.5">
              {calendar.weeks.map((week, weekIndex) => {
                const day = week[dayIndex];
                return (
                  <div
                    key={day.date}
                    id={`activity-${day.date}`}
                    role="gridcell"
                    aria-label={dayLabel(day)}
                    data-level={day.future ? undefined : day.level}
                    onPointerEnter={() =>
                      setActive(
                        day.future ? null : { week: weekIndex, day: dayIndex },
                      )
                    }
                    className={cellClass(
                      day,
                      active?.week === weekIndex && active.day === dayIndex,
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <p
          aria-live="polite"
          className="min-h-4 font-medium text-gray-700 dark:text-slate-300"
        >
          {activeDay ? dayLabel(activeDay) : summary}
        </p>
        <div className="flex items-center gap-1 text-gray-500 dark:text-slate-400">
          <span>{t('chainDetail.activity.less')}</span>
          {LEVELS.map((level) => (
            <span
              key={level}
              className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASSES[level]}`}
            />
          ))}
          <span>{t('chainDetail.activity.more')}</span>
        </div>
      </div>
    </div>
  );
}
