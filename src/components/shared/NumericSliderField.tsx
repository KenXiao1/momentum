import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from 'react';

interface NumericSliderFieldProps {
  id: string;
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  debounceMs?: number;
}

type SliderStyle = CSSProperties & { '--slider-progress': string };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function NumericSliderField({
  id,
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  formatValue = String,
  debounceMs = 0,
}: NumericSliderFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const [numberDraft, setNumberDraft] = useState(String(value));
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A new value from the parent replaces the local slider and draft values.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setLocalValue(value);
    setNumberDraft(String(value));
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const commitValue = useCallback(
    (nextValue: number) => {
      const clampedValue = clamp(nextValue, min, max);
      setLocalValue(clampedValue);
      setNumberDraft(String(clampedValue));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (debounceMs > 0) {
        timerRef.current = setTimeout(() => onChange(clampedValue), debounceMs);
      } else {
        onChange(clampedValue);
      }
    },
    [debounceMs, max, min, onChange],
  );

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const draft = event.target.value;
    setNumberDraft(draft);
    if (draft === '') return;
    const nextValue = Number(draft);
    if (Number.isFinite(nextValue)) commitValue(nextValue);
  };

  const progress = ((localValue - min) / (max - min)) * 100;
  const sliderStyle: SliderStyle = {
    '--slider-progress': `${Math.min(100, Math.max(0, progress))}%`,
  };
  const valueLabel = formatValue(localValue);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <label
          htmlFor={id}
          className="font-chinese font-medium text-gray-700 dark:text-slate-300"
        >
          {label}
        </label>
        <div className="min-w-0 flex-1">
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={localValue}
            onChange={(event) => commitValue(Number(event.target.value))}
            className="numeric-slider-field__range"
            style={sliderStyle}
            aria-describedby={description ? `${id}-description` : undefined}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={localValue}
            aria-valuetext={valueLabel}
          />
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <input
            type="number"
            aria-label={`${label} — ${valueLabel}`}
            min={min}
            max={max}
            step={step}
            value={numberDraft}
            onChange={handleNumberChange}
            onBlur={() => {
              if (numberDraft === '') commitValue(localValue);
            }}
            className="w-20 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center font-mono text-gray-900 transition duration-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-hidden dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          {unit && (
            <span className="font-chinese text-sm text-gray-500 dark:text-slate-400">
              {unit}
            </span>
          )}
        </div>
      </div>
      {description && (
        <p
          id={`${id}-description`}
          className="mt-2 font-chinese text-sm text-gray-500 dark:text-slate-400"
        >
          {description}
        </p>
      )}
    </div>
  );
}
