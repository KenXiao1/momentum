import type { ReactNode } from 'react';

type HighlightRange = { start: number; end: number };

export function highlightText(
  text: string,
  ranges: HighlightRange[],
): ReactNode {
  const safeText = String(text || '');
  if (ranges.length === 0) return safeText;

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const range of ranges) {
    if (range.start > lastIndex) {
      parts.push(safeText.slice(lastIndex, range.start));
    }

    parts.push(
      <mark
        key={`${range.start}-${range.end}`}
        className="rounded-sm bg-yellow-200 px-1 dark:bg-yellow-600"
      >
        {safeText.slice(range.start, range.end)}
      </mark>,
    );

    lastIndex = range.end;
  }

  if (lastIndex < safeText.length) {
    parts.push(safeText.slice(lastIndex));
  }

  return parts;
}
