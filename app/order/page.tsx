import { OrderForm, type CatalogueItem } from '@/components/OrderForm';
import { ClosedNotice } from '@/components/ClosedNotice';
import { PolicyNotice } from '@/components/PolicyNotice';
import { BUSINESS, CONFIRM_CHECKBOX_TEXT, POLICY, TOTAL_DISCLAIMER } from '@/lib/config';
import { PRODUCTS } from '@/lib/products';
import { loadOrderingState } from '@/lib/state';
import gallery from '@/data/gallery.json';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Place an Order' };

export default async function OrderPage() {
  const { state, deadlineText } = await loadOrderingState();

  if (!state.open) {
    return (
      <div className="wrap narrow">
        <h1>Place an Order</h1>
        <ClosedNotice state={state} />
        <p><Link className="btn" href="/catalogue">VIEW CATALOGUE</Link></p>
      </div>
    );
  }

  const items: CatalogueItem[] = PRODUCTS.map((p) => ({
    itemNo: p.itemNo,
    family: p.family,
    name: p.name,
    size: p.size,
    priceCents: p.priceCents,
  }));

  return (
    <div className="wrap">
      <h1>Place an Order</h1>
      <p>
        Enter how many of each plant you would like. Search by name, plant family or item number. Quantities start at zero, and
        your totals update as you go. <a href={BUSINESS.catalogueUrl} target="_blank" rel="noopener">Open the catalogue in a new tab</a>.
      </p>
      <PolicyNotice deadlineText={deadlineText} />
      <OrderForm
        items={items}
        gallery={gallery}
        deadlineText={deadlineText}
        disclaimer={TOTAL_DISCLAIMER}
        confirmText={CONFIRM_CHECKBOX_TEXT}
        policy={POLICY}
      />
    </div>
  );
}
