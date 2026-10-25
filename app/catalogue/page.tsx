import Link from 'next/link';
import { BUSINESS } from '@/lib/config';

export const metadata = { title: 'Catalogue' };

export default function CataloguePage() {
  return (
    <div className="wrap">
      <h1>Spring 2027 Catalogue</h1>
      <p>
        This is the full catalogue. Note the <b>item #</b> beside each pot size, then use the order form. Tap the table of
        contents inside the catalogue to jump to a plant family.
      </p>
      <div className="action-row">
        <Link className="btn pink" href="/order">PLACE AN ORDER</Link>
        <a className="btn alt" href={BUSINESS.catalogueUrl} target="_blank" rel="noopener">Open full screen</a>
        <a className="btn alt" href={BUSINESS.catalogueUrl} download={BUSINESS.catalogueFileName}>Download PDF</a>
        <a className="btn alt" href={BUSINESS.heyzineUrl} target="_blank" rel="noopener noreferrer">Flipbook on HeyZine</a>
      </div>
      <object data={`${BUSINESS.catalogueUrl}#view=FitH`} type="application/pdf" className="pdf-frame" aria-label="Spring 2027 catalogue PDF">
        <div className="card">
          <p>Your browser cannot show the catalogue inside this page.</p>
          <p>
            <a className="btn" href={BUSINESS.catalogueUrl} target="_blank" rel="noopener">Open the catalogue PDF</a>
          </p>
        </div>
      </object>
      <p className="small muted" style={{ marginTop: 10 }}>
        On some phones only the first page shows here. If so, use <b>Open full screen</b> or the HeyZine flipbook.
      </p>
    </div>
  );
}
