import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChainTagError } from '../../../domain/chainTags';
import { createTranslator } from '../../../i18n/translate';
import type { ChainTag, TagColor } from '../../../types';
import { TagPicker } from '../TagPicker';

const t = createTranslator('en');
const focus: ChainTag = { id: 'focus', name: 'Focus', color: 'violet' };
const health: ChainTag = { id: 'health', name: 'Health', color: 'emerald' };

function Harness({
  onCreate = vi.fn(),
  onUpdate = vi.fn(async () => undefined),
  onDelete = vi.fn(async () => undefined),
}: {
  onCreate?: (input: { name: string; color: TagColor }) => Promise<ChainTag>;
  onUpdate?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>(['focus']);
  return (
    <>
      <TagPicker
        tagSet={{ tags: [focus, health], assignments: {} }}
        selectedIds={selected}
        onChange={setSelected}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        t={t}
      />
      <output>{selected.join(',')}</output>
    </>
  );
}

describe('TagPicker', () => {
  it('toggles tags', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Focus' }));
    await userEvent.click(screen.getByRole('button', { name: 'Health' }));

    expect(screen.getByRole('status')).toHaveTextContent('health');
    expect(screen.getByRole('button', { name: 'Health' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('creates a tag with Enter, without submitting a surrounding form, and selects it', async () => {
    const onCreate = vi.fn(
      async (input: { name: string; color: TagColor }) => ({
        id: 'new',
        ...input,
      }),
    );
    const onSubmit = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    render(
      <form onSubmit={onSubmit}>
        <Harness onCreate={onCreate} />
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'New tag' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Blue' }));
    await userEvent.type(screen.getByLabelText('Tag name'), 'Reading{Enter}');

    expect(onCreate).toHaveBeenCalledWith({ name: 'Reading', color: 'blue' });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('focus,new');
  });

  it('explains a rejected name', async () => {
    const onCreate = vi.fn(async () => {
      throw new ChainTagError('duplicate-name');
    });
    render(<Harness onCreate={onCreate} />);

    await userEvent.click(screen.getByRole('button', { name: 'New tag' }));
    await userEvent.type(screen.getByLabelText('Tag name'), 'focus');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A tag with this name already exists.',
    );
  });

  it('deletes a tag from the manager after confirmation and deselects it', async () => {
    const onDelete = vi.fn(async () => undefined);
    render(<Harness onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: 'Manage tags' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manage tags' });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete Focus' }),
    );
    expect(
      within(dialog).getByText('Delete "Focus" from every chain?'),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' }),
    );

    expect(onDelete).toHaveBeenCalledWith('focus');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
});
