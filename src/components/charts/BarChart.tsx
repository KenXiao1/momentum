import { useId, useState, type KeyboardEvent } from 'react';

interface BarDatum {
  key: string;
  /** Axis label under the bar; empty leaves the slot blank. */
  tick: string;
  value: number;
  /** What the readout and screen readers say for this bar. */
  description: string;
  /** Not reached yet (a future day): drawn empty and skipped by the keyboard. */
  pending?: boolean;
}

interface BarChartProps {
  data: BarDatum[];
  /** Accessible name of the chart. */
  label: string;
  /** Shown in the readout while no bar is selected. */
  summary: string;
  heightClass?: string;
}

/**
 * One series of vertical bars on a shared baseline. Hovering or moving with
 * the arrow keys selects a bar and names it in the readout below.
 */
export function BarChart({
  data,
  label,
  summary,
  heightClass = 'h-28',
}: BarChartProps) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((datum) => datum.value));

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    let next = active ?? (step > 0 ? -1 : data.length);
    do next += step;
    while (data[next]?.pending);
    if (next >= 0 && next < data.length) setActive(next);
  };

  return (
    <div>
      <div
        role="grid"
        aria-label={label}
        aria-activedescendant={active === null ? undefined : `${id}-${active}`}
        tabIndex={0}
        onKeyDown={move}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        className="rounded-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <div
          role="row"
          className={`flex items-end gap-0.5 border-b border-gray-200 dark:border-slate-600 ${heightClass}`}
        >
          {data.map((datum, index) => {
            const selected = index === active;
            const height = (datum.value / max) * 100;
            let fill = 'bg-violet-500 dark:bg-violet-400';
            if (selected) fill = 'bg-violet-700 dark:bg-violet-200';
            if (datum.value === 0) fill = 'bg-gray-200 dark:bg-slate-600';
            return (
              <div
                key={datum.key}
                id={`${id}-${index}`}
                role="gridcell"
                aria-label={datum.description}
                onPointerEnter={() => setActive(datum.pending ? null : index)}
                className="flex h-full flex-1 items-end"
              >
                {!datum.pending && (
                  <div
                    className={`w-full rounded-t-[4px] ${fill}`}
                    style={{ height: datum.value === 0 ? 2 : `${height}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mt-1 flex gap-0.5 text-[10px] text-gray-500 dark:text-slate-400"
      >
        {data.map((datum) => (
          <span key={datum.key} className="flex-1 text-center">
            {datum.tick}
          </span>
        ))}
      </div>
      <p
        aria-live="polite"
        className="mt-2 min-h-4 text-xs font-medium text-gray-700 dark:text-slate-300"
      >
        {active === null ? summary : data[active].description}
      </p>
    </div>
  );
}
