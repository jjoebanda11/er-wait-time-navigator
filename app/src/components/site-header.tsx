'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Live waits' },
  { href: '/triage', label: 'Where should I go?' },
  { href: '/alternatives', label: 'Faster options' },
  { href: '/trends', label: 'Best time to go' },
];

export function SiteHeader() {
  const pathname = usePathname();

  // City pages are the live board for one region, so they belong to "Live
  // waits" rather than leaving the nav with nothing selected.
  const isLiveWaits = pathname === '/' || pathname.endsWith('-er-wait-times');

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ background: 'color-mix(in srgb, var(--surface) 92%, transparent)' }}
    >
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-lg font-black text-white shadow-sm"
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
            className="shrink-0 rounded-full border-2 border-brand-600 px-3.5 py-1.5 text-sm font-bold text-brand-600 transition hover:bg-brand-600 hover:text-white"
          >
            Call 811
            <span className="sr-only-custom"> for free nurse advice</span>
          </a>
        </div>

        {/* Every item carries a visible container, so it reads as a control
            rather than a run of text. The current page is filled in, which is
            the only cue telling a user where they are. */}
        <nav aria-label="Main" className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {NAV.map((item) => {
            const active = item.href === '/' ? isLiveWaits : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',
                  active
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'text-muted hover:border-brand-600 hover:text-brand-600',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
