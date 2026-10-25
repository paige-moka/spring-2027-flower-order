import { BUSINESS } from '@/lib/config';
import { formatDeadline, type OrderingState } from '@/lib/deadline';

export function ClosedNotice({ state }: { state: OrderingState }) {
  return (
    <div className="notice closed" role="status">
      <h3>Online ordering is closed</h3>
      <p>
        {state.reason === 'deadline_passed'
          ? `The order deadline was ${formatDeadline(state.deadline)}.`
          : 'Monica is not taking online orders right now.'}{' '}
        You can still browse the catalogue. For questions, email{' '}
        <a href={`mailto:${BUSINESS.notifyEmail}`}>{BUSINESS.notifyEmail}</a>.
      </p>
    </div>
  );
}
