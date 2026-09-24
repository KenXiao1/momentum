import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiagnosticsExport } from '../useDiagnosticsExport';
import {
  clearDiagnostics,
  exportDiagnostics,
  recordDiagnosticError,
} from '../../../utils/diagnostics';

const saveFile = vi.hoisted(() =>
  vi.fn<(data: string, name: string) => Promise<boolean>>(),
);
vi.mock('../../../utils/platform-capabilities/center', () => ({
  getPlatformCapabilityCenter: () => ({ file: { saveFile } }),
}));
beforeEach(() => {
  clearDiagnostics();
  saveFile.mockReset();
});

describe('diagnostic export', () => {
  it('exports the safe report only after a user action, then can clear it', async () => {
    recordDiagnosticError('RSIP', new Error('Network private data'));
    saveFile.mockResolvedValue(true);
    const { result } = renderHook(useDiagnosticsExport);
    expect(saveFile).not.toHaveBeenCalled();
    await act(() => result.current.exportFile());
    expect(result.current.status).toBe('saved');
    expect(saveFile).toHaveBeenCalledWith(
      expect.not.stringContaining('private'),
      expect.stringMatching(/^momentum-diagnostics-.*\.json$/),
    );
    act(() => result.current.clear());
    expect(result.current.status).toBe('cleared');
    expect(JSON.parse(exportDiagnostics()).entries).toEqual([]);
  });

  it('keeps data after cancellation or failure and permits another export', async () => {
    recordDiagnosticError('STORAGE', new Error('Quota exceeded'));
    saveFile
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('save failed'))
      .mockResolvedValueOnce(true);
    const { result } = renderHook(useDiagnosticsExport);
    await act(() => result.current.exportFile());
    expect(result.current.status).toBe('idle');
    await act(() => result.current.exportFile());
    expect(result.current.status).toBe('failed');
    expect(result.current.busy).toBe(false);
    expect(JSON.parse(exportDiagnostics()).entries).toHaveLength(1);
    await act(() => result.current.exportFile());
    expect(result.current.status).toBe('saved');
  });
});
