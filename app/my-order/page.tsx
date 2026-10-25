import { MyOrderLookup } from '@/components/MyOrderLookup';
import { POLICY, TOTAL_DISCLAIMER } from '@/lib/config';
import { loadOrderingState } from '@/lib/state';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'View My Order' };

export default async function MyOrderPage() {
  const { deadlineText } = await loadOrderingState();
  return (
    <div className="wrap narrow">
      <h1>View My Order</h1>
      <p>Enter the order reference from your confirmation (it starts with SP27) and the email you used when ordering.</p>
      <MyOrderLookup disclaimer={TOTAL_DISCLAIMER} policy={POLICY} deadlineText={deadlineText} />
    </div>
  );
}
