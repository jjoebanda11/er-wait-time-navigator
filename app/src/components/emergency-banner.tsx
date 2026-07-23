/**
 * The 911 banner.
 *
 * Rendered above everything, on every route, server-side, with no interactivity
 * and no dependency on JavaScript or data loading. If the entire rest of the
 * app fails, this still renders — which is the point.
 */
export function EmergencyBanner() {
  return (
    <div className="bg-[var(--color-band-red)] text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-medium">
        <span>Chest pain, trouble breathing, stroke signs, or severe bleeding?</span>
        <a
          href="tel:911"
          className="rounded-full bg-white/95 px-3 py-0.5 font-bold text-[var(--color-band-red)] underline-offset-2 hover:bg-white"
        >
          Call 911 now
        </a>
      </div>
    </div>
  );
}
