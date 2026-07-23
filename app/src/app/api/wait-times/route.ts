import { NextResponse } from 'next/server';
import { getWaitTimes } from '@/lib/ahs/client';

export const revalidate = 180;

/**
 * Public read-only snapshot endpoint.
 *
 * Exposed deliberately: a free, well-documented JSON feed is a genuine
 * community contribution, an SEO and PR asset, and the seed of the future B2B
 * tier. It is a normalized, coordinate-bearing view of data AHS already
 * publishes, so republishing it costs us nothing and helps others build.
 */
export async function GET(request: Request) {
  const snapshot = await getWaitTimes();
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region');

  const facilities = region
    ? snapshot.facilities.filter((f) => f.region.toLowerCase() === region.toLowerCase())
    : snapshot.facilities;

  return NextResponse.json(
    {
      ...snapshot,
      facilities,
      attribution:
        'Wait time data published by Alberta Health Services. This service is independent and not affiliated with AHS.',
      disclaimer:
        'Estimates only, not medical advice, and not guaranteed. Call 911 for emergencies or 811 for free nurse advice.',
    },
    {
      status: snapshot.facilities.length === 0 ? 503 : 200,
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
