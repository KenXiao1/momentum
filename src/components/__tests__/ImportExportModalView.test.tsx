import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ImportExportModalView } from '../ImportExportModalView';
import type { ImportExportImportOptions } from '../../services/ImportExportService';

const tr = (_zh: string, en: string) => en;

function createProps(
  overrides: Partial<React.ComponentProps<typeof ImportExportModalView>> = {},
) {
  const importOptions: ImportExportImportOptions = {
    preserveStatistics: true,
    preserveTimestamps: true,
    importCompletionHistory: true,
  };

  return {
    chainsCount: 2,
    activeTab: 'export' as const,
    importData: '',
    importStatus: 'idle' as const,
    importError: '',
    importOptions,
    language: 'en' as const,
    onTabChange: vi.fn(),
    onImportDataChange: vi.fn(),
    onImportOptionsChange: vi.fn(),
    onFileUpload: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onClose: vi.fn(),
    tr,
    ...overrides,
  };
}

describe('ImportExportModalView', () => {
  it('renders export flow and handles tab/close/export events', () => {
    const props = createProps();
    render(<ImportExportModalView {...props} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Export as JSON' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export as JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(props.onTabChange).toHaveBeenCalledWith('import');
    expect(props.onExport).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('disables import button when input is empty', () => {
    const props = createProps({
      activeTab: 'import',
      importData: '',
      chainsCount: 1,
    });
    render(<ImportExportModalView {...props} />);

    const importButton = screen.getByRole('button', { name: 'Import data' });
    expect(importButton).toBeDisabled();
  });

  it('enables import flow and propagates form/file/options changes', () => {
    const props = createProps({
      activeTab: 'import',
      importData: '{"foo":1}',
      chainsCount: 1,
    });
    render(<ImportExportModalView {...props} />);

    const importButton = screen.getByRole('button', { name: 'Import data' });
    expect(importButton).toBeEnabled();

    fireEvent.click(importButton);
    expect(props.onImport).toHaveBeenCalledTimes(1);

    const textArea = screen.getByRole('textbox', { name: 'JSON data' });
    fireEvent.change(textArea, { target: { value: '{"bar":2}' } });
    expect(props.onImportDataChange).toHaveBeenCalledWith('{"bar":2}');

    const fileInput = screen.getByLabelText('Choose a file to import');
    const file = new File(['{"a":1}'], 'import.json', {
      type: 'application/json',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(props.onFileUpload).toHaveBeenCalledTimes(1);

    const preserveStats = screen.getByLabelText('Preserve statistics');
    fireEvent.click(preserveStats);
    expect(props.onImportOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ preserveStatistics: false }),
    );
  });

  it('shows status messaging and keeps import button disabled while importing', () => {
    const props = createProps({
      activeTab: 'import',
      importData: '{"foo":1}',
      importStatus: 'checking-auth',
    });

    render(<ImportExportModalView {...props} />);

    expect(screen.getByText('Verifying your account...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import data' })).toBeDisabled();
  });

  it('allows exporting without any chains', () => {
    const props = createProps({
      activeTab: 'export',
      chainsCount: 0,
      importData: '{"foo":1}',
    });
    render(<ImportExportModalView {...props} />);

    expect(
      screen.queryByRole('button', { name: 'Export as JSON' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
  });
});
