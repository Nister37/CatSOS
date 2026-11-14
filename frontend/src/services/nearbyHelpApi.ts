import { runtimeEnv } from '../config/runtimeEnv';

const BASE_URL = runtimeEnv.VITE_API_BASE_URL ?? 'http://localhost:8000';

export type NearbyHelpType = 'vet' | 'shelter' | 'cat_cafe' | 'pet_help';

export type NearbyHelpPlace = {
  osm_id?: number;
  osm_type?: string;
  id: string;
  type: NearbyHelpType;
  name: string | null;
  lat: number;
  lng: number;
  distance_km: number;
  quality_score?: number;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  opening_hours?: string | null;
  source: string;
};

export type NearbyHelpResponse = {
  center: { lat: number; lng: number };
  radius_km: number;
  source: string;
  warning?: string;
  places: NearbyHelpPlace[];
};

export async function fetchNearbyHelp(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<NearbyHelpResponse> {
  const url = `${BASE_URL}/api/maps/nearby-help/?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw await res.json().catch(() => ({ detail: 'Request failed' }));
  }

  return res.json() as Promise<NearbyHelpResponse>;
}

export function buildGoogleMapsUrl(place: {
  name?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
}): string {
  const name = place.name?.trim();
  const address = place.address?.trim();
  const genericNames = ['unnamed place', 'unnamed', 'unknown', 'n/a', '-'];
  const genericAddresses = ['unnamed address', 'unnamed', 'unknown', 'n/a', '-'];
  const isGenericName = !name || genericNames.includes(name.toLowerCase());
  const isGenericAddress = !address || genericAddresses.includes(address.toLowerCase());

  if (!isGenericName && name && !isGenericAddress && address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
}

export function isSafeHttpUrl(url?: string | null): boolean {
  if (!url) {
    return false;
  }
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed);
}

