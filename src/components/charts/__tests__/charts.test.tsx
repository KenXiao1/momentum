import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart } from '../BarChart';
import { StepLineChart } from '../StepLineChart';

const bars = [
  { key: 'mon', tick: 'Mon', value: 2, description: 'Mon: 2' },
  { key: 'tue', tick: 'Tue', value: 0, description: 'Tue: 0' },
  { key: 'wed', tick: 'Wed', value: 4, description: 'Wed: 4' },
  {
    key: 'thu',
    tick: 'Thu',
    value: 0,
    description: 'Thu: upcoming',
    pending: true,
  },
];

describe('BarChart', () => {
  it('names every bar and reads out the hovered one', () => {
    render(<BarChart data={bars} label="Week" summary="6 this week" />);

    expect(screen.getByRole('grid', { name: 'Week' })).toBeInTheDocument();
    expect(
      screen.getByRole('gridcell', { name: 'Wed: 4' }),
    ).toBeInTheDocument();
    expect(screen.getByText('6 this week')).toBeInTheDocument();

    fireEvent.pointerEnter(screen.getByRole('gridcell', { name: 'Mon: 2' }));
    expect(screen.getByText('Mon: 2', { selector: 'p' })).toBeInTheDocument();

    fireEvent.pointerLeave(screen.getByRole('grid'));
    expect(screen.getByText('6 this week')).toBeInTheDocument();
  });

  it('moves with the arrow keys and skips bars still to come', () => {
    render(<BarChart data={bars} label="Week" summary="6 this week" />);
    const grid = screen.getByRole('grid');

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });

    expect(grid).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('gridcell', { name: 'Wed: 4' }).id,
    );
    expect(screen.getByText('Wed: 4', { selector: 'p' })).toBeInTheDocument();
  });
});

describe('StepLineChart', () => {
  const points = [
    { key: '1', value: 1, description: 'Nov 20: streak 1' },
    { key: '2', value: 2, description: 'Nov 21: streak 2' },
    { key: '3', value: 0, description: 'Nov 22: failed' },
  ];

  it('selects records with the keyboard and reads them out', () => {
    render(
      <StepLineChart points={points} label="Streak" summary="Best streak 2" />,
    );
    const slider = screen.getByRole('slider', { name: 'Streak' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Best streak 2');

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByText('Nov 21: streak 2')).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Nov 20: streak 1');

    fireEvent.blur(slider);
    expect(screen.getByText('Best streak 2')).toBeInTheDocument();
  });
});
