// @vitest-environment jsdom
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import fixture from '@/lib/ahs/__fixtures__/ahs-sample.json';
import { normalizePayload } from '@/lib/ahs/parse';
import type { AhsRawPayload, WaitTimeSnapshot } from '@/lib/ahs/types';
import { WaitBoard } from './wait-board';

/**
 * Regression tests for the render loop that made the app unusable.
 *
 * The board built its `origin` as an object literal during render and listed it
 * as a dependency of the ranking effect. A fresh reference every render meant
 * the effect re-fired, set state, re-rendered, and produced another new object
 * — an unbounded loop that pinned the main thread until the browser offered to
 * kill the tab.
 *
 * It only manifested once a location was known, which is the app's primary
 * feature, and the position is restored from localStorage, so it reproduced on
 * every later visit including hard refreshes. No status-code or server-render
 * check could have caught it; only mounting the component can.
 *
 * The guard below is a render counter. If a render budget is ever exceeded the
 * test fails rather than hanging, so this class of bug can never ship silently
 * again.
 */

const snapshot: WaitTimeSnapshot = {
  fetchedAt: new Date().toISOString(),
  facilities: normalizePayload(fixture as unknown as AhsRawPayload),
};

/**
 * Count renders with React's Profiler.
 *
 * A wrapper component that renders <WaitBoard /> and counts its own renders
 * does NOT work here, and getting that wrong is how a broken loop test passes:
 * when WaitBoard updates its own state, React re-renders WaitBoard alone and
 * never re-invokes the parent, so the parent's counter sits still while the
 * child spins. Profiler's onRender fires for every committed render in the
 * subtree, which is the thing we actually care about.
 */
function ProfiledBoard({
  counter,
  ...props
}: { counter: { renders: number } } & React.ComponentProps<typeof WaitBoard>) {
  return (
    <Profiler id="wait-board" onRender={() => { counter.renders += 1; }}>
      <WaitBoard {...props} />
    </Profiler>
  );
}

/**
 * Wait until rendering stops, then report the total.
 *
 * Asserting "zero further renders after the board appears" is too strict — the
 * async ranking legitimately commits once more just after the first cards show.
 * A loop is not "one more render", it is renders that never stop, so poll until
 * the count holds steady and fail if it never does.
 */
async function settle(counter: { renders: number }, budget = 25): Promise<number> {
  let previous = -1;
  for (let i = 0; i < 20; i += 1) {
    previous = counter.renders;
    await new Promise((r) => setTimeout(r, 100));
    if (counter.renders === previous) return counter.renders;
    if (counter.renders > budget) {
      throw new Error(
        `Render loop: ${counter.renders} renders and still going (budget ${budget}).`,
      );
    }
  }
  throw new Error(`Render loop: never settled, ${counter.renders} renders and counting.`);
}

function seedStoredLocation(lat: number, lng: number) {
  window.localStorage.setItem(
    'erwtn.prefs.v1',
    JSON.stringify({
      region: 'Edmonton',
      patientType: 'adult',
      includeUrgentCare: true,
      saved: [],
      lastOrigin: { lat, lng, at: Date.now() },
    }),
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('WaitBoard render stability', () => {
  it('settles without a location', async () => {
    const counter = { renders: 0 };
    render(<ProfiledBoard counter={counter} snapshot={snapshot} fixedRegion="Edmonton" />);

    await screen.findAllByText(/University of Alberta Hospital/);

    const settled = await settle(counter);
    expect(settled, `settled after an implausible ${settled} renders`).toBeLessThan(25);
  });

  it('settles when a stored location is restored — the exact case that hung', async () => {
    // Mill Woods, south-east Edmonton.
    seedStoredLocation(53.4668, -113.4408);

    const counter = { renders: 0 };
    render(<ProfiledBoard counter={counter} snapshot={snapshot} fixedRegion="Edmonton" />);

    // Ranking by total time is what the effect produces; wait for it to appear.
    await screen.findAllByText(/Total time to be seen/i, undefined, { timeout: 3000 });

    const settled = await settle(counter);
    expect(settled, `settled after an implausible ${settled} renders`).toBeLessThan(25);
  });

  it('settles after the user grants location live', async () => {
    const counter = { renders: 0 };
    vi.stubGlobal('navigator', {
      ...window.navigator,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({
            coords: { latitude: 53.4668, longitude: -113.4408, accuracy: 40 },
          } as GeolocationPosition),
      },
    });

    render(<ProfiledBoard counter={counter} snapshot={snapshot} fixedRegion="Edmonton" />);

    const button = await screen.findByRole('button', { name: /use my location/i });
    button.click();

    await screen.findAllByText(/Total time to be seen/i, undefined, { timeout: 3000 });

    const settled = await settle(counter);
    expect(settled, `settled after an implausible ${settled} renders`).toBeLessThan(25);
  });

  it('renders facilities immediately, before any effect runs', async () => {
    const counter = { renders: 0 };
    render(<ProfiledBoard counter={counter} snapshot={snapshot} fixedRegion="Edmonton" />);

    // The pre-location list is computed during render, so it must be present
    // without waiting — this is what makes the board work server-side.
    expect(screen.getAllByText(/Misericordia Community Hospital/).length).toBeGreaterThan(0);
    await waitFor(() => expect(counter.renders).toBeGreaterThan(0));
  });
});
