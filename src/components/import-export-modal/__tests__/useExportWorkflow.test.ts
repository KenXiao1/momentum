import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnitChain } from '../../../test/factories';
import { useExportWorkflow } from '../useExportWorkflow';

const saveFile = vi.hoisted(() =>
  vi.fn(async (_content: string, _fileName: string) => true),
);

// The native file dialog is the only collaborator replaced.
vi.mock('../../../utils/platform-capabilities/center', () => ({
  getPlatformCapabilityCenter: () => ({ file: { saveFile } }),
}));

function renderExport() {
  const chains = [createUnitChain({ id: 'chain-1', name: 'Morning run' })];
  return renderHook(() => useExportWorkflow({ chains }));
}

describe('useExportWorkflow', () => {
  beforeEach(() => {
    localStorage.clear();
    saveFile.mockReset().mockResolvedValue(true);
  });

  it('saves the chains as a dated JSON backup', async () => {
    const { result } = renderExport();

    await act(() => result.current.handleExport());

    const [content, fileName] = saveFile.mock.calls[0];
    expect(fileName).toMatch(/^momentum-data-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(content).chains).toEqual([
      expect.objectContaining({ id: 'chain-1', name: 'Morning run' }),
    ]);
    expect(result.current.exportFailed).toBe(false);
  });

  it('treats a canceled save dialog as no error', async () => {
    saveFile.mockResolvedValueOnce(false);
    const { result } = renderExport();

    await act(() => result.current.handleExport());

    expect(result.current.exportFailed).toBe(false);
  });

  it('reports a failed save and clears it on the next successful export', async () => {
    saveFile.mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderExport();

    await act(() => result.current.handleExport());
    expect(result.current.exportFailed).toBe(true);

    await act(() => result.current.handleExport());
    expect(result.current.exportFailed).toBe(false);
  });
});
