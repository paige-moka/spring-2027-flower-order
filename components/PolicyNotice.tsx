import { POLICY } from '@/lib/config';

export function PolicyNotice({ deadlineText, title = 'Important order information' }: { deadlineText: string; title?: string }) {
  return (
    <div className="notice" role="note">
      <h3>{title}</h3>
      <ul>
        <li><b>Order deadline:</b> {deadlineText}</li>
        <li>{POLICY.pickup}</li>
        <li>{POLICY.noPickup}</li>
        <li>{POLICY.invoice}</li>
        <li>{POLICY.payment}</li>
        <li>{POLICY.pickupAddress}</li>
      </ul>
    </div>
  );
}
