import type { Metadata } from 'next';
import Link from 'next/link';
import { getWaitTimes } from '@/lib/ahs/client';
import { CareDashboard } from '@/components/care-dashboard';

export const revalidate = 180;

export const metadata: Metadata = {
  title: 'Care coordinator dashboard',
  description:
    'Track live emergency wait times across every address your organization serves. See at a glance which clients face the longest waits and where each would be seen soonest.',
  alternates: { canonical: '/dashboard' },
};

export default async function DashboardPage() {
  const snapshot = await getWaitTimes();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <Link href="/for-care-providers" className="hover:underline">
          For care providers
        </Link>{' '}
        / <span className="text-[var(--text)]">Dashboard</span>
      </nav>

      <h1 className="text-3xl font-black leading-tight">Care coordinator dashboard</h1>
      <p className="mt-2 max-w-2xl text-lg text-muted">
        Every address you serve, ranked by how long someone there would actually wait to be seen —
        longest first, so the ones in trouble are at the top.
      </p>

      <div className="mt-6">
        <CareDashboard snapshot={snapshot} />
      </div>
    </div>
  );
}
