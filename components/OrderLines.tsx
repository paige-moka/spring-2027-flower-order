import { money } from '@/lib/money';

export type ViewLine = { itemNo: number; family: string; name: string; size: string; priceCents: number; qty: number; lineCents: number };

/** Read only order table with totals. Used on the review step, confirmation, View My Order, the admin area and print. */
export function OrderLines({
  lines,
  subtotalCents,
  gstCents,
  totalCents,
  disclaimer,
}: {
  lines: ViewLine[];
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  disclaimer?: string;
}) {
  return (
    <>
      <div className="table-scroll">
        <table className="review-table">
          <thead>
            <tr>
              <th>Item #</th>
              <th>Product</th>
              <th>Size</th>
              <th className="num">Price</th>
              <th className="num">Qty</th>
              <th className="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.itemNo}>
                <td><b>#{l.itemNo}</b></td>
                <td>
                  <span className="muted small">{l.family}</span>
                  <br />
                  <b>{l.name}</b>
                </td>
                <td>{l.size}</td>
                <td className="num">{money(l.priceCents)}</td>
                <td className="num">{l.qty}</td>
                <td className="num">{money(l.lineCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="num">Subtotal</td>
              <td className="num">{money(subtotalCents)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="num">GST (5%)</td>
              <td className="num">{money(gstCents)}</td>
            </tr>
            <tr className="grand">
              <td colSpan={5} className="num">Estimated total (CAD)</td>
              <td className="num">{money(totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {disclaimer && <p className="disclaimer">{disclaimer}</p>}
    </>
  );
}
