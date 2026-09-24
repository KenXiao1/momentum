import { isTauriDesktop } from '../platform';
import { logger } from '../logger';
import { normalizeUnknownError } from '../errors/normalizeError';
import { getCurrentLanguage, t } from '../runtimeI18n';
import { toast } from '../toast';

async function checkDesktopUpdates(): Promise<void> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return;

    logger.info('UPDATER', `Update available: ${update.version}`);
    const language = getCurrentLanguage();
    toast.info(
      t(
        'platformAdapters.updater.newVersionFoundUpdatingAndRestarting',
        undefined,
        language,
      ),
    );

    await update.downloadAndInstall();
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (error) {
    logger.error(
      'UPDATER',
      'Failed to check desktop updates',
      undefined,
      normalizeUnknownError(error),
    );
  }
}

export async function checkForUpdates(): Promise<void> {
  if (!isTauriDesktop) return;
  await checkDesktopUpdates();
}
