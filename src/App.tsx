import AppShell from './AppShell';
import { ToastViewport } from './components/ToastViewport';
import { useTrayMenuLanguage } from './utils/platform-adapters/tauri-tray';

export default function App() {
  useTrayMenuLanguage();
  return (
    <>
      <AppShell />
      <ToastViewport />
    </>
  );
}
