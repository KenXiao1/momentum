import { useEffect } from 'react';
import { useI18n } from '../../i18n';
import { fireAndForget } from '../fireAndForget';
import { isTauriDesktop } from '../platform';
import { invokeCommand } from '../tauri-bridge';

/** Keeps the desktop tray menu in the app's current language. */
export function useTrayMenuLanguage(): void {
  const { t } = useI18n();
  const show = t('tray.show');
  const quit = t('tray.quit');

  useEffect(() => {
    if (!isTauriDesktop) return;
    fireAndForget(invokeCommand('set_tray_labels', { show, quit }), {
      label: 'tray-labels',
    });
  }, [show, quit]);
}
