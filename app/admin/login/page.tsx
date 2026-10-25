import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { LoginForm } from '@/components/admin/AdminClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin');
  return (
    <div className="wrap narrow" style={{ maxWidth: 480 }}>
      <h1>Admin sign in</h1>
      <LoginForm />
    </div>
  );
}
