import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

interface StepPoint {
  key: string;
  value: number;
  description: string;
}

interface StepLineChartProps {
  points: StepPoint[];
  /** Accessible name of the chart. */
  label: string;
  /** Shown in the readout while no point is selected. */
  summary: string;
}

const WIDTH = 600;
const HEIGHT = 120;
const PAD = 8;

/**
 * One value per record as a step line. Hovering, or the arrow keys on the
 * focused chart, select a record: a hairline and marker show it and the
 * readout below names it.
 */
export function StepLineChart({ points, label, summary }: StepLineChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...points.map((point) => point.value));
  const step = WIDTH / points.length;
  const y = (value: number) =>
    HEIGHT - PAD - (value / max) * (HEIGHT - 2 * PAD);

  const path = points
    .map((point, index) =>
      index === 0
        ? `M 0 ${y(point.value)} H ${step}`
        : `V ${y(point.value)} H ${(index + 1) * step}`,
    )
    .join(' ');

  const select = (event: PointerEvent<HTMLDivElement>) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const index = Math.floor(
      ((event.clientX - box.left) / box.width) * points.length,
    );
    setActive(Math.min(points.length - 1, Math.max(0, index)));
  };

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -Infinity,
      End: Infinity,
    }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const from = active ?? points.length - 1;
    setActive(Math.min(points.length - 1, Math.max(0, from + delta)));
  };

  const selected = active === null ? null : points[active];

  return (
    <div>
      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="flex h-[120px] flex-col justify-between text-right text-[10px] text-gray-500 dark:text-slate-400"
        >
          <span>{max}</span>
          <span>0</span>
        </div>
        <div
          ref={frame}
          role="slider"
          aria-label={label}
          aria-valuemin={1}
          aria-valuemax={points.length}
          aria-valuenow={(active ?? points.length - 1) + 1}
          aria-valuetext={selected?.description ?? summary}
          tabIndex={0}
          onKeyDown={move}
          onBlur={() => setActive(null)}
          onPointerMove={select}
          onPointerLeave={() => setActive(null)}
          className="relative h-[120px] flex-1 rounded-md border-b border-gray-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-600"
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <path
              d={path}
              fill="none"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="stroke-violet-500 dark:stroke-violet-400"
            />
            {active !== null && (
              <line
                x1={(active + 0.5) * step}
                x2={(active + 0.5) * step}
                y1={0}
                y2={HEIGHT}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className="stroke-gray-400 dark:stroke-slate-500"
              />
            )}
          </svg>
          {active !== null && selected && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600 ring-2 ring-white dark:bg-violet-300 dark:ring-slate-800"
              style={{
                left: `${((active + 0.5) / points.length) * 100}%`,
                top: `${(y(selected.value) / HEIGHT) * 100}%`,
              }}
            />
          )}
        </div>
      </div>
      <p
        aria-live="polite"
        className="mt-2 min-h-4 text-xs font-medium text-gray-700 dark:text-slate-300"
      >
        {selected?.description ?? summary}
      </p>
    </div>
  );
}
