import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n';
import type { PetMood, PetState } from '../../../types/pet';
import { PetWidget } from '../widget/PetWidget';
import { usePetWidgetController } from '../widget/hooks/usePetWidgetController';

vi.mock('../widget/hooks/usePetWidgetController', () => ({
  usePetWidgetController: vi.fn(),
}));

vi.mock('../PetAvatar', () => ({
  PetAvatar: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      pet-avatar
    </button>
  ),
}));

vi.mock('../PetCreationDialog', () => ({
  PetCreationDialog: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: (name: string) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSubmit('Nova')}>
        create-pet
      </button>
      <button type="button" onClick={onCancel}>
        cancel-create
      </button>
    </div>
  ),
}));

vi.mock('../PetStatsBar', () => ({
  PetStatsBar: () => <div>pet-stats</div>,
}));

function createPetState(overrides: Partial<PetState> = {}): PetState {
  const now = new Date('2026-02-06T10:00:00.000Z');
  return {
    id: overrides.id ?? 'pet-1',
    name: overrides.name ?? 'Momo',
    hunger: overrides.hunger ?? 40,
    happiness: overrides.happiness ?? 70,
    health: overrides.health ?? 80,
    level: overrides.level ?? 2,
    experience: overrides.experience ?? 30,
    stage: overrides.stage ?? 'baby',
    createdAt: overrides.createdAt ?? now,
    lastFedAt: overrides.lastFedAt ?? now,
    lastInteractedAt: overrides.lastInteractedAt ?? now,
    lastDecayCalculatedAt: overrides.lastDecayCalculatedAt ?? now,
    isVisible: overrides.isVisible ?? true,
    isMinimized: overrides.isMinimized ?? false,
    position: overrides.position ?? { x: 80, y: 80 },
    minimizedPosition: overrides.minimizedPosition ?? { x: 92, y: 2 },
  };
}

function createControllerMock(
  overrides: Partial<ReturnType<typeof usePetWidgetController>> = {},
) {
  return {
    mood: 'happy' as PetMood,
    isDragging: false,
    setIsDragging: vi.fn(),
    showCreationDialog: false,
    setShowCreationDialog: vi.fn(),
    dismissedCreationDialog: true,
    setDismissedCreationDialog: vi.fn(),
    isFeeding: false,
    widgetRef: createRef<HTMLDivElement>(),
    hasDraggedRef: { current: false },
    handleFeed: vi.fn(),
    handleMouseDown: vi.fn(),
    handleTouchStart: vi.fn(),
    handleMouseUp: vi.fn(),
    handleCreatePet: vi.fn(),
    handleMinimize: vi.fn(),
    handleExpand: vi.fn(),
    ...overrides,
  };
}

function renderWidget(
  overrides: Partial<ComponentProps<typeof PetWidget>> = {},
) {
  const defaultProps: ComponentProps<typeof PetWidget> = {
    pet: null,
    mood: 'happy' as PetMood,
    isLoading: false,
    hasPet: false,
    onCreatePet: vi.fn(async () => createPetState({ name: 'Nova' })),
    onFeedPet: vi.fn(async () => null),
    onUpdatePosition: vi.fn(async () => undefined),
    onUpdateMinimizedPosition: vi.fn(async () => undefined),
    onToggleVisibility: vi.fn(async () => undefined),
    onMinimize: vi.fn(async () => undefined),
    onExpand: vi.fn(async () => undefined),
    ...overrides,
  };

  return render(
    <I18nProvider>
      <PetWidget {...defaultProps} />
    </I18nProvider>,
  );
}

describe('PetWidget', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'en');
    vi.clearAllMocks();
  });

  it('should render nothing when widget is loading', () => {
    vi.mocked(usePetWidgetController).mockReturnValue(createControllerMock());

    const { container } = renderWidget({ isLoading: true });

    expect(container).toBeEmptyDOMElement();
  });

  it('should open creation dialog when adopt button is clicked', async () => {
    const user = userEvent.setup();
    const setShowCreationDialog = vi.fn();
    vi.mocked(usePetWidgetController).mockReturnValue(
      createControllerMock({
        dismissedCreationDialog: true,
        showCreationDialog: false,
        setShowCreationDialog,
      }),
    );

    renderWidget({ pet: null, hasPet: false });

    await user.click(screen.getByRole('button', { name: /Adopt a pet/i }));

    expect(setShowCreationDialog).toHaveBeenCalledWith(true);
  });

  it('should call expand and feed/minimize handlers for minimized and expanded pet states', async () => {
    const user = userEvent.setup();
    const handleExpand = vi.fn();
    const handleFeed = vi.fn();
    const handleMinimize = vi.fn();
    const pet = createPetState({ isMinimized: true });

    vi.mocked(usePetWidgetController).mockReturnValue(
      createControllerMock({
        handleExpand,
        handleFeed,
        handleMinimize,
        hasDraggedRef: { current: false },
      }),
    );

    const { rerender } = render(
      <I18nProvider>
        <PetWidget
          pet={pet}
          mood="happy"
          isLoading={false}
          hasPet
          onCreatePet={vi.fn(async () => pet)}
          onFeedPet={vi.fn(async () => null)}
          onUpdatePosition={vi.fn(async () => undefined)}
          onUpdateMinimizedPosition={vi.fn(async () => undefined)}
          onToggleVisibility={vi.fn(async () => undefined)}
          onMinimize={vi.fn(async () => undefined)}
          onExpand={vi.fn(async () => undefined)}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Expand pet/i }));
    expect(handleExpand).toHaveBeenCalledTimes(1);

    const expandedPet = createPetState({ isMinimized: false, hunger: 60 });
    vi.mocked(usePetWidgetController).mockReturnValue(
      createControllerMock({
        handleExpand,
        handleFeed,
        handleMinimize,
        hasDraggedRef: { current: false },
      }),
    );

    rerender(
      <I18nProvider>
        <PetWidget
          pet={expandedPet}
          mood="happy"
          isLoading={false}
          hasPet
          onCreatePet={vi.fn(async () => expandedPet)}
          onFeedPet={vi.fn(async () => null)}
          onUpdatePosition={vi.fn(async () => undefined)}
          onUpdateMinimizedPosition={vi.fn(async () => undefined)}
          onToggleVisibility={vi.fn(async () => undefined)}
          onMinimize={vi.fn(async () => undefined)}
          onExpand={vi.fn(async () => undefined)}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: /^Feed$/i }));
    await user.click(screen.getByRole('button', { name: /Minimize/i }));

    expect(handleFeed).toHaveBeenCalledTimes(1);
    expect(handleMinimize).toHaveBeenCalledTimes(1);
  });

  it('should have touchAction none on the widget container', () => {
    const pet = createPetState({ isMinimized: false });
    vi.mocked(usePetWidgetController).mockReturnValue(
      createControllerMock({ hasDraggedRef: { current: false } }),
    );

    renderWidget({ pet, hasPet: true });

    const widget = document.querySelector('.fixed.z-40') as HTMLElement;
    expect(widget).not.toBeNull();
    expect(widget.style.touchAction).toBe('none');
  });

  it('should apply responsive width classes on expanded pet', () => {
    const pet = createPetState({ isMinimized: false });
    vi.mocked(usePetWidgetController).mockReturnValue(
      createControllerMock({ hasDraggedRef: { current: false } }),
    );

    renderWidget({ pet, hasPet: true });

    const widget = document.querySelector('.w-36.sm\\:w-44.md\\:w-52');
    expect(widget).not.toBeNull();
  });

  it('should bind onTouchStart on minimized pet button', () => {
    const handleTouchStart = vi.fn();
    const pet = createPetState({ isMinimized: true });
    vi.mocked(usePetWidgetController).mockReturnValue(
      createControllerMock({
        handleTouchStart,
        hasDraggedRef: { current: false },
      }),
    );

    renderWidget({ pet, hasPet: true });

    const expandBtn = screen.getByRole('button', { name: /Expand pet/i });
    fireEvent.touchStart(expandBtn, {
      touches: [{ clientX: 10, clientY: 20 }],
    });

    expect(handleTouchStart).toHaveBeenCalledTimes(1);
  });

  it('should bind onTouchStart on expanded pet drag handle', () => {
    const handleTouchStart = vi.fn();
    const pet = createPetState({ isMinimized: false });
    vi.mocked(usePetWidgetController).mockReturnValue(
      createControllerMock({
        handleTouchStart,
        hasDraggedRef: { current: false },
      }),
    );

    renderWidget({ pet, hasPet: true });

    const dragHandle = screen.getByRole('button', {
      name: /Drag to move pet/i,
    });
    fireEvent.touchStart(dragHandle, {
      touches: [{ clientX: 10, clientY: 20 }],
    });

    expect(handleTouchStart).toHaveBeenCalledTimes(1);
  });
});
