import Link from 'next/link';
import { SignOutButton } from './AdminClient';

export function AdminNav({ title }: { title: string }) {
  return (
    <div className="admin-bar no-print">
      <h1 style={{ margin: 0 }}>{title}</h1>
      <nav className="admin-nav" aria-label="Admin">
        <Link className="btn alt small" href="/admin">Orders</Link>
        <Link className="btn alt small" href="/admin/settings">Settings</Link>
        <SignOutButton />
      </nav>
    </div>
  );
}
