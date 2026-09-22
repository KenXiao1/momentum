import { afterEach, describe, expect, it, vi } from 'vitest';
import { webFileAdapter } from '../web-file';

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(
  URL,
  'createObjectURL',
);
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(
  URL,
  'revokeObjectURL',
);

function restoreUrlMethod(
  name: 'createObjectURL' | 'revokeObjectURL',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(URL, name, descriptor);
  } else {
    delete (URL as unknown as Record<string, unknown>)[name];
  }
}

afterEach(() => {
  restoreUrlMethod('createObjectURL', originalCreateObjectURL);
  restoreUrlMethod('revokeObjectURL', originalRevokeObjectURL);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('webFileAdapter', () => {
  it('reports file capabilities only when the document API exists', () => {
    expect(webFileAdapter.getCapabilities()).toEqual({
      canSaveFile: true,
      canOpenFile: true,
    });

    vi.stubGlobal('document', undefined);

    expect(webFileAdapter.getCapabilities()).toEqual({
      canSaveFile: false,
      canOpenFile: false,
    });
  });

  it('downloads JSON through a temporary anchor and revokes its object URL', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:momentum-export');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await expect(
      webFileAdapter.saveFile('{"chains":[]}', 'momentum.json'),
    ).resolves.toBe(true);

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const clickedAnchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(blob.type).toBe('application/json');
    expect(blob.size).toBe(13);
    expect(clickedAnchor).toBeDefined();
    expect(clickedAnchor?.download).toBe('momentum.json');
    expect(clickedAnchor?.href).toBe('blob:momentum-export');
    expect(clickedAnchor?.isConnected).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:momentum-export');
  });

  it('reads the selected file and configures the accepted extensions', async () => {
    const click = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(function (this: HTMLInputElement) {
        Object.defineProperty(this, 'files', {
          configurable: true,
          value: [new File(['{"ok":true}'], 'settings.json')],
        });
        this.onchange?.(new Event('change'));
      });

    await expect(webFileAdapter.openFile(['json', 'txt'])).resolves.toBe(
      '{"ok":true}',
    );
    const clickedInput = click.mock.instances[0] as HTMLInputElement;
    expect(clickedInput?.type).toBe('file');
    expect(clickedInput?.accept).toBe('.json,.txt');
  });

  it('returns null when the picker closes without a selected file', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      Object.defineProperty(this, 'files', {
        configurable: true,
        value: [],
      });
      this.onchange?.(new Event('change'));
    });

    await expect(webFileAdapter.openFile(['json'])).resolves.toBeNull();
  });

  it('returns null when reading the selected file fails', async () => {
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (
      this: FileReader,
    ) {
      this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
    });
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      Object.defineProperty(this, 'files', {
        configurable: true,
        value: [new File(['invalid'], 'settings.json')],
      });
      this.onchange?.(new Event('change'));
    });

    await expect(webFileAdapter.openFile(['json'])).resolves.toBeNull();
  });

  it('returns null when the user cancels the picker', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      this.oncancel?.(new Event('cancel'));
    });

    await expect(webFileAdapter.openFile(['json'])).resolves.toBeNull();
  });
});
