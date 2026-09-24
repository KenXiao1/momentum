import { createTranslator } from '../../i18n/translate';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportExportModalContainer } from '../ImportExportModalContainer';

const useStorageMock = vi.hoisted(() => vi.fn());
const parseImportDataMock = vi.hoisted(() => vi.fn());
const createExportDataMock = vi.hoisted(() => vi.fn());
const exportRulesMock = vi.hoisted(() => vi.fn());
const importRulesMock = vi.hoisted(() => vi.fn());
const getSafeErrorDetailMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());
const saveFileMock = vi.hoisted(() => vi.fn(async () => true));
const openFileMock = vi.hoisted(() => vi.fn(async () => null));

vi.mock('../../storage/useStorage', () => ({
  useStorage: useStorageMock,
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: createTranslator('en'),
  }),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

vi.mock('../../utils/errorMessage', () => ({
  getSafeErrorDetail: getSafeErrorDetailMock,
  toError: vi.fn((value: unknown) =>
    value instanceof Error ? value : new Error(String(value)),
  ),
}));

vi.mock('../../services/ExceptionRuleManager', () => ({
  exceptionRuleManager: {
    exportRules: exportRulesMock,
    importRules: importRulesMock,
  },
}));

vi.mock('../../services/ImportExportService', () => ({
  importExportService: {
    parseImportData: parseImportDataMock,
    createExportData: createExportDataMock,
  },
}));

vi.mock('../../utils/platform-capabilities/center', () => ({
  getPlatformCapabilityCenter: () => ({
    file: {
      saveFile: saveFileMock,
      openFile: openFileMock,
    },
  }),
}));

vi.mock('../ImportExportModalView', () => ({
  ImportExportModalView: (props: {
    activeTab: 'export' | 'import';
    importStatus: string;
    importError: string;
    onImportDataChange: (value: string) => void;
    onImportOptionsChange: (value: {
      preserveStatistics: boolean;
      preserveTimestamps: boolean;
      importCompletionHistory: boolean;
    }) => void;
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onTabChange: (tab: 'export' | 'import') => void;
    onImport: () => Promise<void>;
    onExport: () => Promise<void>;
  }) => (
    <div>
      <div data-testid="active-tab">{props.activeTab}</div>
      <div data-testid="import-status">{props.importStatus}</div>
      <div data-testid="import-error">{props.importError}</div>
      <button onClick={() => props.onImportDataChange('{"version":2}')}>
        set-import-json
      </button>
      <button onClick={() => props.onTabChange('import')}>
        switch-to-import
      </button>
      <button
        onClick={() =>
          props.onImportOptionsChange({
            preserveStatistics: true,
            preserveTimestamps: true,
            importCompletionHistory: false,
          })
        }
      >
        set-options
      </button>
      <input
        data-testid="file-upload"
        type="file"
        onChange={props.onFileUpload}
      />
      <button
        onClick={async () => {
          await props.onImport();
        }}
      >
        run-import
      </button>
      <button
        onClick={async () => {
          await props.onExport();
        }}
      >
        run-export
      </button>
    </div>
  ),
}));

describe('ImportExportModalContainer', () => {
  const originalFileReader = globalThis.FileReader;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.FileReader = originalFileReader;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    getSafeErrorDetailMock.mockReturnValue('safe detail');
    loggerErrorMock.mockReset();

    class MockFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      readAsText(file: Blob) {
        this.onload?.({
          target: { result: `{"fromFile":"${file.size}"}` },
        } as unknown as ProgressEvent<FileReader>);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    useStorageMock.mockReturnValue({
      kind: 'supabase',
      waitForAuthentication: vi.fn(async () => ({
        ok: true,
        value: {
          isAuthenticated: true,
          user: { id: 'u1' },
        },
      })),
    });

    parseImportDataMock.mockReturnValue({
      chains: [{ id: 'c1' }],
      history: [{ id: 'h1' }],
      rsipNodes: [{ id: 'r1' }],
      rsipMeta: { allowMultiplePerDay: true },
      invalidReferences: {
        rsipExecutionRecordsSkipped: 0,
        rsipTaskLinksSkipped: 0,
      },
      exceptionRulesToImport: [{ id: 'rule-a' }],
    });
    importRulesMock.mockResolvedValue({
      imported: [{ id: 'rule-a' }],
      errors: [],
      skipped: [],
    });
    exportRulesMock.mockResolvedValue([{ id: 'rule-a' }]);
    saveFileMock.mockResolvedValue(true);
    createExportDataMock.mockReturnValue({
      version: 3,
      chains: [{ id: 'c1' }],
    });
  });

  it('selects import tab when there are no chains and export tab otherwise', () => {
    const first = render(
      <ImportExportModalContainer
        chains={[]}
        onImport={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('active-tab').textContent).toBe('import');

    first.unmount();

    render(
      <ImportExportModalContainer
        chains={[{ id: 'c1' } as never]}
        onImport={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('active-tab').textContent).toBe('export');
  });

  it('runs import flow with auth check, parsed payload, rule import, and delayed close', async () => {
    const onImport = vi.fn(async () => undefined);
    const onClose = vi.fn();

    render(
      <ImportExportModalContainer
        chains={[{ id: 'existing' } as never]}
        onImport={onImport}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('set-import-json'));
    await act(async () => {
      fireEvent.click(screen.getByText('run-import'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('import-status')).toHaveTextContent('success'),
    );
    expect(parseImportDataMock).toHaveBeenCalled();
    expect(importRulesMock).toHaveBeenCalledWith([{ id: 'rule-a' }], {
      skipDuplicates: true,
      updateExisting: false,
    });
    expect(onImport).toHaveBeenCalledWith(
      [{ id: 'c1' }],
      expect.objectContaining({
        history: [{ id: 'h1' }],
        rsipNodes: [{ id: 'r1' }],
        rsipMeta: { allowMultiplePerDay: true },
      }),
    );

    expect(screen.getByTestId('import-status').textContent).toBe('success');
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), {
      timeout: 4000,
    });
  });

  it('updates tab/options, handles file upload, and imports without auth for local storage', async () => {
    parseImportDataMock.mockReturnValue({
      chains: [{ id: 'c-local' }],
      history: [],
      rsipNodes: [],
      rsipMeta: { allowMultiplePerDay: false },
      invalidReferences: {
        rsipExecutionRecordsSkipped: 0,
        rsipTaskLinksSkipped: 0,
      },
      exceptionRulesToImport: [],
    });
    useStorageMock.mockReturnValue({
      kind: 'local',
    });
    const onImport = vi.fn(async () => undefined);

    render(
      <ImportExportModalContainer
        chains={[{ id: 'existing' } as never]}
        onImport={onImport}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('switch-to-import'));
    expect(screen.getByTestId('active-tab').textContent).toBe('import');

    fireEvent.click(screen.getByText('set-options'));
    fireEvent.change(screen.getByTestId('file-upload'), {
      target: { files: [] },
    });
    fireEvent.change(screen.getByTestId('file-upload'), {
      target: {
        files: [
          new File(['from-file'], 'import.json', { type: 'application/json' }),
        ],
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('run-import'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('import-status')).toHaveTextContent('success'),
    );
    expect(parseImportDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        json: '{"fromFile":"9"}',
        options: {
          preserveStatistics: true,
          preserveTimestamps: true,
          importCompletionHistory: false,
        },
      }),
    );
    expect(importRulesMock).not.toHaveBeenCalled();
    expect(onImport).toHaveBeenCalledWith(
      [{ id: 'c-local' }],
      expect.objectContaining({
        history: [],
      }),
    );
  });

  it('surfaces authentication failure as import error and skips parsing', async () => {
    useStorageMock.mockReturnValue({
      kind: 'supabase',
      waitForAuthentication: vi.fn(async () => ({
        ok: false,
        value: {
          isAuthenticated: false,
          user: null,
        },
      })),
    });

    render(
      <ImportExportModalContainer
        chains={[{ id: 'existing' } as never]}
        onImport={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('set-import-json'));
    await act(async () => {
      fireEvent.click(screen.getByText('run-import'));
    });

    expect(parseImportDataMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('import-status').textContent).toBe('error');
    await waitFor(() =>
      expect(screen.getByTestId('import-status')).toHaveTextContent('error'),
    );
    expect(screen.getByTestId('import-error').textContent).toBe(
      'Authentication failed: please make sure you are signed in and try importing again.',
    );
  });

  it('maps syntax, safe-detail, fallback, and unknown import errors', async () => {
    render(
      <ImportExportModalContainer
        chains={[{ id: 'existing' } as never]}
        onImport={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('set-import-json'));

    parseImportDataMock.mockImplementationOnce(() => {
      throw new SyntaxError('bad json');
    });
    await act(async () => {
      fireEvent.click(screen.getByText('run-import'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('import-status')).toHaveTextContent('error'),
    );
    expect(screen.getByTestId('import-error').textContent).toBe(
      'Invalid import format: please make sure you uploaded a valid JSON file.',
    );

    parseImportDataMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    getSafeErrorDetailMock.mockReturnValueOnce('sanitized detail');
    await act(async () => {
      fireEvent.click(screen.getByText('run-import'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('import-status')).toHaveTextContent('error'),
    );
    expect(screen.getByTestId('import-error').textContent).toBe(
      'Import failed: sanitized detail',
    );

    parseImportDataMock.mockImplementationOnce(() => {
      throw new Error('still bad');
    });
    getSafeErrorDetailMock.mockReturnValueOnce(null);
    await act(async () => {
      fireEvent.click(screen.getByText('run-import'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('import-status')).toHaveTextContent('error'),
    );
    expect(screen.getByTestId('import-error').textContent).toBe(
      'Import failed. Check the console for details, then try again.',
    );

    parseImportDataMock.mockImplementationOnce(() => {
      throw 'plain-string-error';
    });
    await act(async () => {
      fireEvent.click(screen.getByText('run-import'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('import-status')).toHaveTextContent('error'),
    );
    expect(screen.getByTestId('import-error').textContent).toBe(
      'Import failed: unknown error',
    );
  });

  it('runs export flow and delegates payload construction', async () => {
    render(
      <ImportExportModalContainer
        chains={[{ id: 'c1' } as never]}
        history={[{ id: 'h1' } as never]}
        rsipNodes={[{ id: 'r1' } as never]}
        rsipMeta={{ allowMultiplePerDay: true } as never}
        userPreferences={{ theme: 'dark' }}
        onImport={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('run-export'));
    });

    expect(exportRulesMock).toHaveBeenCalledWith(true);
    expect(createExportDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chains: [{ id: 'c1' }],
        history: [{ id: 'h1' }],
        rsipNodes: [{ id: 'r1' }],
      }),
    );
    expect(saveFileMock).toHaveBeenCalledTimes(1);
    expect(saveFileMock).toHaveBeenCalledWith(
      expect.stringContaining('"version": 3'),
      expect.stringMatching(/^momentum-data-\d{4}-\d{2}-\d{2}\.json$/),
    );
  });

  it('logs export failures', async () => {
    exportRulesMock.mockRejectedValueOnce(new Error('export failed'));

    render(
      <ImportExportModalContainer
        chains={[{ id: 'c1' } as never]}
        onImport={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('run-export'));
    });

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'IMPORT_EXPORT',
      'Export failed',
      undefined,
      expect.any(Error),
    );
  });
});
