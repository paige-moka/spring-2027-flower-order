import Link from 'next/link';
import { BUSINESS } from '@/lib/config';
import { loadOrderingState } from '@/lib/state';
import { PolicyNotice } from '@/components/PolicyNotice';
import { ClosedNotice } from '@/components/ClosedNotice';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { state, deadlineText } = await loadOrderingState();
  return (
    <div className="wrap">
      <section className="hero">
        <div>
          <div className="eyebrow">{BUSINESS.sellerName} · {BUSINESS.location}</div>
          <h1>{BUSINESS.catalogueTitle}</h1>
          <p style={{ fontSize: 20 }}>
            Browse this season&apos;s catalogue, then send Monica your order request right here. Every pot size has its own
            item number, and your totals add up as you go.
          </p>
          <div className="big-actions">
            <Link className="btn" href="/catalogue">VIEW CATALOGUE</Link>
            <Link className="btn pink" href="/order">PLACE AN ORDER</Link>
            <Link className="btn alt" href="/my-order">VIEW MY ORDER</Link>
          </div>
          <p className="small muted">
            Prefer a page turning flipbook? <a href={BUSINESS.heyzineUrl} target="_blank" rel="noopener noreferrer">Open the catalogue on HeyZine</a>.
          </p>
        </div>
        <div className="cover-wrap">
          <Link href="/catalogue" aria-label="View the catalogue">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cover" src="/catalogue-cover.jpg" alt={`${BUSINESS.catalogueTitle} catalogue cover`} width={510} height={660} />
          </Link>
        </div>
      </section>
      {!state.open && <ClosedNotice state={state} />}
      <PolicyNotice deadlineText={deadlineText} />
    </div>
  );
}
