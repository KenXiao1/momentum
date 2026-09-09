import { useStorage } from '../storage/useStorage';
import { AppShellView } from './AppShellView';
import { useAppShellBootstrap } from './app-shell/useAppShellBootstrap';
import { useAppShellDomains } from './app-shell/useAppShellDomains';
import { useAppShellState } from './app-shell/useAppShellState';
import { useAppShellViewModels } from './app-shell/useAppShellViewModels';
import { RSIPTaskLinkConfirmationDialog } from '../components/rsip/RSIPTaskLinkConfirmationDialog';

export default function AppShellContainer() {
  const storage = useStorage();
  const state = useAppShellState();
  const bootstrap = useAppShellBootstrap(storage, state);
  const domains = useAppShellDomains(storage, state);
  const viewModels = useAppShellViewModels(state, bootstrap, domains);

  const { pending, respond } = domains.taskLinkConfirmation;
  return (
    <>
      <AppShellView {...viewModels} />
      {pending && (
        <RSIPTaskLinkConfirmationDialog
          link={pending.link}
          node={pending.node}
          onRespond={respond}
        />
      )}
    </>
  );
}
