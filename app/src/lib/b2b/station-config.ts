import type { PatientType } from '../rank';
import type { StationConfig } from '@/components/station-display';

/**
 * Encode/decode a station display's configuration in its URL.
 *
 * The whole point of putting config in the URL is that the wall display needs
 * no account and no server-side record of where a care home is. A facility
 * configures it once, bookmarks the resulting link on a mounted tablet, and it
 * runs untouched. We store nothing.
 *
 * Parsing is strict and total: any malformed or out-of-range parameter yields
 * `null` so the page can show a setup prompt instead of rendering a display
 * pointed at the wrong place. A kiosk quietly aimed at the wrong city would be
 * worse than one that says "not configured".
 */

export function encodeStationConfig(config: StationConfig): URLSearchParams {
  const params = new URLSearchParams();
  params.set('name', config.label);
  params.set('lat', config.lat.toFixed(6));
  params.set('lng', config.lng.toFixed(6));
  params.set('region', config.region);
  if (config.patientType === 'child') params.set('for', 'child');
  return params;
}

export function decodeStationConfig(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): StationConfig | null {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const name = get('name')?.trim();
  const lat = Number.parseFloat(get('lat') ?? '');
  const lng = Number.parseFloat(get('lng') ?? '');
  const region = get('region')?.trim();
  const patientType: PatientType = get('for') === 'child' ? 'child' : 'adult';

  if (!name || name.length > 80) return null;
  if (!region) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Confine to Alberta's bounding box, so a corrupted link cannot point the
  // display at the wrong province.
  if (lat < 48 || lat > 61 || lng < -121 || lng > -109) return null;

  return { label: name, lat, lng, region, patientType };
}
