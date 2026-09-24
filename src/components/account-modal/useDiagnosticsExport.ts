import { useState } from 'react';
import { clearDiagnostics, exportDiagnostics } from '../../utils/diagnostics';
import { getPlatformCapabilityCenter } from '../../utils/platform-capabilities/center';

export function useDiagnosticsExport() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed' | 'cleared'>(
    'idle',
  );
  const exportFile = async () => {
    setBusy(true);
    setStatus('idle');
    try {
      const saved = await getPlatformCapabilityCenter().file.saveFile(
        exportDiagnostics(),
        `momentum-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
      );
      if (saved) setStatus('saved');
    } catch {
      setStatus('failed');
    } finally {
      setBusy(false);
    }
  };
  const clear = () => {
    clearDiagnostics();
    setStatus('cleared');
  };
  return { busy, status, exportFile, clear };
}
