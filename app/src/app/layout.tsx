import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { config } from '@/lib/config';
import { SiteHeader } from '@/components/site-header';
import { EmergencyBanner } from '@/components/emergency-banner';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';

export const metadata: Metadata = {
  metadataBase: new URL(config.site.url),
  title: {
    default: 'ER Wait Time Navigator — Live Alberta emergency wait times',
    template: '%s | ER Wait Time Navigator',
  },
  description:
    'Live emergency department and urgent care wait times across Alberta, ranked by how long it will actually take you to be seen — including the drive.',
  applicationName: config.site.shortName,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: config.site.shortName,
  },
  formatDetection: { telephone: true },
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    siteName: config.site.name,
    title: 'Know before you go — live Alberta ER wait times',
    description:
      'Ranked by true door-to-doctor time: current wait plus the drive plus parking. Free.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Alberta ER wait times, ranked by real total time',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#070d18' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body className="min-h-dvh flex flex-col">
        <a
          href="#main"
          className="sr-only-custom focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>

        {/* Always the first thing on the page, above the fold, on every route. */}
        <EmergencyBanner />
        <SiteHeader />

        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="mt-16 border-t px-4 py-10 text-sm">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="rounded-lg border border-[var(--color-band-red)] bg-[var(--color-band-red-soft)] p-4">
              <p className="font-semibold text-[var(--color-band-red)]">
                This is not medical advice.
              </p>
              <p className="mt-1 text-muted">
                {config.site.name} helps you find care faster. It does not diagnose, treat, or
                decide whether you need care. Wait times are estimates published by Alberta Health
                Services and can change without warning. If you think you have an emergency, call
                911. If you are unsure, call Health Link at 811.
              </p>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/about" className="hover:underline">
                About
              </Link>
              <Link href="/alternatives" className="hover:underline">
                Faster alternatives
              </Link>
              <Link href="/triage" className="hover:underline">
                Where should I go?
              </Link>
              <Link href="/for-care-providers" className="hover:underline">
                For care providers
              </Link>
              <Link href="/data" className="hover:underline">
                Where our data comes from
              </Link>
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <Link href="/terms" className="hover:underline">
                Terms
              </Link>
            </nav>

            <p className="text-muted">
              Wait time data is published by{' '}
              <a
                href="https://www.albertahealthservices.ca/waittimes/waittimes.aspx"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Alberta Health Services
              </a>
              . {config.site.name} is an independent service and is not affiliated with, endorsed
              by, or operated by Alberta Health Services, Primary Care Alberta, or the Government of
              Alberta.
            </p>

            <p className="text-muted">
              © {new Date().getFullYear()} {config.site.legalEntity}. Built in Edmonton, Alberta.
            </p>
          </div>
        </footer>

        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
