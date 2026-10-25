import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { BUSINESS } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${BUSINESS.catalogueTitle} | ${BUSINESS.sellerName}`, template: `%s | ${BUSINESS.catalogueTitle}` },
  description: `Browse the ${BUSINESS.catalogueTitle} catalogue from ${BUSINESS.sellerName} in ${BUSINESS.location} and send your order request online.`,
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#24412f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Lora:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <header className="site-head">
          <div className="wrap">
            <Link href="/" className="brand">
              <b>{BUSINESS.catalogueTitle}</b>
              <span>{BUSINESS.sellerName} · {BUSINESS.location}</span>
            </Link>
            <nav className="site-nav" aria-label="Main">
              <Link href="/catalogue">View Catalogue</Link>
              <Link href="/order">Place an Order</Link>
              <Link href="/my-order">View My Order</Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-foot">
          <div className="wrap">
            <p>
              {BUSINESS.sellerName} · {BUSINESS.location} · <a href={`mailto:${BUSINESS.notifyEmail}`}>{BUSINESS.notifyEmail}</a>
            </p>
            <p className="small">This website takes order requests only. No payment is collected online.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
