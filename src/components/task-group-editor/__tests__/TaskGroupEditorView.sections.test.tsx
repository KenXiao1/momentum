import React from 'react';
import { render, screen } from '@testing-library/react';

import { I18nProvider } from '../../../i18n';
import { TaskGroupEditorView } from '../../TaskGroupEditorView';

const renderWithI18n = (ui: React.ReactElement) =>
  render(ui, { wrapper: I18nProvider });

describe('TaskGroupEditorView sections', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'zh');
  });

  test('renders stable section test ids', () => {
    renderWithI18n(
      <TaskGroupEditorView
        isEditing={false}
        name=""
        description=""
        auxiliarySignal=""
        customAuxiliarySignal=""
        auxiliaryDuration={15}
        isCustomAuxiliaryDuration={false}
        auxiliaryCompletionTrigger=""
        errors={{}}
        keyboardHeight={0}
        onNameChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onAuxiliarySignalSelect={vi.fn()}
        onCustomAuxiliarySignalChange={vi.fn()}
        onAuxiliaryDurationChange={vi.fn()}
        onAuxiliaryDurationModeChange={vi.fn()}
        onAuxiliaryCompletionTriggerChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId('task-group-editor-basic-info'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('task-group-editor-auxiliary-signal'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('task-group-editor-duration'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('task-group-editor-rsip-links'),
    ).toBeInTheDocument();
  });
});
