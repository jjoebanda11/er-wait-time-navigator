import { describe, expect, it } from 'vitest';
import { decodeStationConfig, encodeStationConfig } from './station-config';
import type { StationConfig } from '@/components/station-display';

const valid: StationConfig = {
  label: 'Riverbend Supportive Living',
  lat: 53.4668,
  lng: -113.4408,
  region: 'Edmonton',
  patientType: 'adult',
};

describe('station config round-trip', () => {
  it('encodes and decodes without loss', () => {
    const decoded = decodeStationConfig(encodeStationConfig(valid));
    expect(decoded).toEqual(valid);
  });

  it('preserves a child configuration', () => {
    const child = { ...valid, patientType: 'child' as const };
    expect(decodeStationConfig(encodeStationConfig(child))).toEqual(child);
  });

  it('accepts a plain params object as well as URLSearchParams', () => {
    const decoded = decodeStationConfig({
      name: 'Test Home',
      lat: '53.5',
      lng: '-113.5',
      region: 'Edmonton',
    });
    expect(decoded?.label).toBe('Test Home');
  });
});

describe('station config rejects bad input rather than pointing a kiosk wrong', () => {
  it('rejects missing fields', () => {
    expect(decodeStationConfig({ name: 'x', lat: '53.5', lng: '-113.5' })).toBeNull();
    expect(decodeStationConfig({ lat: '53.5', lng: '-113.5', region: 'Edmonton' })).toBeNull();
    expect(decodeStationConfig({ name: 'x', region: 'Edmonton' })).toBeNull();
  });

  it('rejects coordinates outside Alberta', () => {
    // Toronto — a corrupted or hand-edited link must not silently work.
    expect(
      decodeStationConfig({ name: 'x', lat: '43.65', lng: '-79.38', region: 'Edmonton' }),
    ).toBeNull();
    expect(
      decodeStationConfig({ name: 'x', lat: '0', lng: '0', region: 'Edmonton' }),
    ).toBeNull();
  });

  it('rejects non-numeric coordinates', () => {
    expect(
      decodeStationConfig({ name: 'x', lat: 'abc', lng: '-113.5', region: 'Edmonton' }),
    ).toBeNull();
  });

  it('rejects an absurdly long name', () => {
    expect(
      decodeStationConfig({ name: 'x'.repeat(200), lat: '53.5', lng: '-113.5', region: 'Edmonton' }),
    ).toBeNull();
  });

  it('defaults an unknown patient type to adult rather than failing', () => {
    const decoded = decodeStationConfig({
      name: 'x',
      lat: '53.5',
      lng: '-113.5',
      region: 'Edmonton',
      for: 'banana',
    });
    expect(decoded?.patientType).toBe('adult');
  });
});
