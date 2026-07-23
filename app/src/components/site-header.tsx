import Link from 'next/link';

const NAV = [
  { href: '/', label: 'Live waits' },
  { href: '/triage', label: 'Where should I go?' },
  { href: '/alternatives', label: 'Faster options' },
  { href: '/trends', label: 'Best time to go' },
];

export function SiteHeader() {
  return (
    <header className="border-b" style={{ background: 'var(--surface)' }}>
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-lg font-black text-white"
            >
              ER
            </span>
            <span className="leading-tight">
              <span className="block text-base">Wait Time Navigator</span>
              <span className="block text-[11px] font-medium text-muted">
                Alberta · live from AHS
              </span>
            </span>
          </Link>

          <a
            href="tel:811"
            className="shrink-0 rounded-full border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-600 hover:text-white"
          >
            Call 811
            <span className="sr-only-custom"> for free nurse advice</span>
          </a>
        </div>

        <nav aria-label="Main" className="-mx-1 mt-3 flex gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
