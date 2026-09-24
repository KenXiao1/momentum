import { type Translator } from '../../../i18n';
import type { ChainTreeNode, ScheduledSession } from '../../../types';
import { ChainExecutionActions } from '../../shared/ChainExecutionActions';

export function GroupCardActions(props: {
  group: ChainTreeNode;
  nextUnit: ChainTreeNode | null;
  scheduledSession: ScheduledSession | null;
  timeRemaining: number;
  onStartChain: (id: string) => void;
  onScheduleChain: (id: string) => void;
  onCancelScheduledSession?: (id: string) => void;
  onCompleteBooking?: (id: string) => void;
  t: Translator;
}) {
  const targetId = props.nextUnit?.id ?? props.group.id;
  const scheduledSession = props.scheduledSession;
  return (
    <ChainExecutionActions
      scheduled={
        scheduledSession
          ? {
              signal: scheduledSession.auxiliarySignal,
              timeRemaining: props.timeRemaining,
            }
          : undefined
      }
      signalPrefix={props.t('chainCard.chainCardView.signal')}
      completeLabel={props.t('chainCard.chainCardView.completeBooking')}
      interruptLabel={props.t('chainCard.chainCardView.interruptAdjudicate')}
      startLabel={props.t('groupCard.groupCardActions.startNext')}
      scheduleLabel={props.t('chainCard.chainCardView.schedule')}
      onComplete={() =>
        scheduledSession && props.onCompleteBooking?.(scheduledSession.chainId)
      }
      onInterrupt={() =>
        scheduledSession &&
        props.onCancelScheduledSession?.(scheduledSession.chainId)
      }
      onStart={() => props.onStartChain(targetId)}
      onSchedule={() => props.onScheduleChain(targetId)}
    />
  );
}
