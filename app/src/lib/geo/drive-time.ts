import type { GeoPoint } from '../ahs/types';
import { estimateDriveMinutes, haversineKm } from './haversine';

/**
 * Pluggable drive-time providers.
 *
 * The product must be launchable with no paid accounts, so `estimate` is the
 * default and requires nothing. `openrouteservice` is a free-tier upgrade
 * (2,000 requests/day, no credit card) that adds real road routing, and
 * `google` is the paid option for live traffic once revenue justifies it.
 *
 * Every provider degrades to the estimator rather than failing, because a
 * routing outage must never take down the wait-time board.
 */
export type DriveTimeProviderName = 'estimate' | 'openrouteservice' | 'google';

export interface DriveTimeResult {
  minutes: number;
  distanceKm: number;
  /** Which provider actually produced this number, after any fallback. */
  source: DriveTimeProviderName;
  /** True when the number reflects current traffic rather than a model. */
  liveTraffic: boolean;
}

export interface DriveTimeProvider {
  name: DriveTimeProviderName;
  /** Resolve travel times from one origin to many destinations, in order. */
  matrix(origin: GeoPoint, destinations: GeoPoint[]): Promise<DriveTimeResult[]>;
}

/** Zero-cost geometric estimator. Always available, never fails. */
export const estimateProvider: DriveTimeProvider = {
  name: 'estimate',
  async matrix(origin, destinations) {
    return destinations.map((dest) => ({
      minutes: estimateDriveMinutes(origin, dest),
      distanceKm: haversineKm(origin, dest),
      source: 'estimate' as const,
      liveTraffic: false,
    }));
  },
};

function fallback(origin: GeoPoint, destinations: GeoPoint[]): DriveTimeResult[] {
  return destinations.map((dest) => ({
    minutes: estimateDriveMinutes(origin, dest),
    distanceKm: haversineKm(origin, dest),
    source: 'estimate' as const,
    liveTraffic: false,
  }));
}

/**
 * OpenRouteService matrix provider.
 *
 * Free tier, no credit card, no traffic model. Real road distances, which is a
 * meaningful accuracy gain over straight-line estimation in a river-valley city
 * where the geometric neighbour is often not the fastest drive.
 */
export function openRouteServiceProvider(apiKey: string): DriveTimeProvider {
  return {
    name: 'openrouteservice',
    async matrix(origin, destinations) {
      if (destinations.length === 0) return [];
      try {
        const response = await fetch(
          'https://api.openrouteservice.org/v2/matrix/driving-car',
          {
            method: 'POST',
            headers: {
              Authorization: apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // ORS takes [lng, lat], which is the reverse of every other
              // coordinate in this codebase. Getting this backwards silently
              // places every facility in the Indian Ocean.
              locations: [
                [origin.lng, origin.lat],
                ...destinations.map((d) => [d.lng, d.lat]),
              ],
              sources: [0],
              destinations: destinations.map((_, i) => i + 1),
              metrics: ['duration', 'distance'],
              units: 'km',
            }),
            signal: AbortSignal.timeout(6000),
          },
        );

        if (!response.ok) return fallback(origin, destinations);

        const data = (await response.json()) as {
          durations?: number[][];
          distances?: number[][];
        };
        const durations = data.durations?.[0];
        const distances = data.distances?.[0];
        if (!durations || durations.length !== destinations.length) {
          return fallback(origin, destinations);
        }

        return destinations.map((dest, i) => {
          const seconds = durations[i];
          if (seconds == null || !Number.isFinite(seconds)) {
            return fallback(origin, [dest])[0];
          }
          return {
            minutes: seconds / 60,
            distanceKm: distances?.[i] ?? haversineKm(origin, dest),
            source: 'openrouteservice' as const,
            liveTraffic: false,
          };
        });
      } catch {
        return fallback(origin, destinations);
      }
    },
  };
}

/**
 * Google Routes API provider — the only option that models live traffic.
 *
 * Billed per element, so this stays off until the business can absorb it.
 */
export function googleRoutesProvider(apiKey: string): DriveTimeProvider {
  return {
    name: 'google',
    async matrix(origin, destinations) {
      if (destinations.length === 0) return [];
      try {
        const response = await fetch(
          'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask':
                'originIndex,destinationIndex,duration,distanceMeters,condition',
            },
            body: JSON.stringify({
              origins: [
                {
                  waypoint: {
                    location: {
                      latLng: { latitude: origin.lat, longitude: origin.lng },
                    },
                  },
                },
              ],
              destinations: destinations.map((d) => ({
                waypoint: {
                  location: { latLng: { latitude: d.lat, longitude: d.lng } },
                },
              })),
              travelMode: 'DRIVE',
              routingPreference: 'TRAFFIC_AWARE',
            }),
            signal: AbortSignal.timeout(6000),
          },
        );

        if (!response.ok) return fallback(origin, destinations);

        const rows = (await response.json()) as Array<{
          destinationIndex: number;
          duration?: string;
          distanceMeters?: number;
          condition?: string;
        }>;

        const results = fallback(origin, destinations);
        for (const row of rows) {
          const seconds = Number.parseFloat(row.duration?.replace('s', '') ?? '');
          if (
            row.condition === 'ROUTE_EXISTS' &&
            Number.isFinite(seconds) &&
            results[row.destinationIndex]
          ) {
            results[row.destinationIndex] = {
              minutes: seconds / 60,
              distanceKm: (row.distanceMeters ?? 0) / 1000,
              source: 'google',
              liveTraffic: true,
            };
          }
        }
        return results;
      } catch {
        return fallback(origin, destinations);
      }
    },
  };
}

/** Build the provider the current environment is configured for. */
export function resolveDriveTimeProvider(env: {
  ORS_API_KEY?: string;
  GOOGLE_ROUTES_API_KEY?: string;
}): DriveTimeProvider {
  if (env.GOOGLE_ROUTES_API_KEY) return googleRoutesProvider(env.GOOGLE_ROUTES_API_KEY);
  if (env.ORS_API_KEY) return openRouteServiceProvider(env.ORS_API_KEY);
  return estimateProvider;
}
