import type { PlatformFileAdapter } from './types';

export const tauriFileAdapter: PlatformFileAdapter = {
  getCapabilities() {
    return {
      canSaveFile: true,
      canOpenFile: true,
    };
  },

  async saveFile(data: string, defaultName: string): Promise<boolean> {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!path) return false;
    await writeTextFile(path, data);
    return true;
  },

  async openFile(extensions: string[]): Promise<string | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');

    const path = await open({
      filters: [{ name: 'Data Files', extensions }],
    });

    if (!path) return null;
    return readTextFile(path);
  },
};
