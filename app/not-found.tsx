import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="wrap narrow">
      <h1>Page not found</h1>
      <p><Link className="btn" href="/">Back to home</Link></p>
    </div>
  );
}
