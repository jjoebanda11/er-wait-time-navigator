import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-black">Page not found</h1>
      <p className="mt-2 text-lg text-muted">
        That page doesn&rsquo;t exist. If you were looking for wait times, they&rsquo;re one tap
        away.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Live wait times
        </Link>
        <Link
          href="/triage"
          className="rounded-lg border px-5 py-3 font-semibold hover:bg-[var(--bg-subtle)]"
        >
          Where should I go?
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted">
        For a medical emergency call{' '}
        <a href="tel:911" className="font-bold underline">
          911
        </a>
        . For free nurse advice, call{' '}
        <a href="tel:811" className="font-bold underline">
          811
        </a>
        .
      </p>
    </div>
  );
}
