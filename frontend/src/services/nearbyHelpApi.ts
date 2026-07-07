const BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:8000';

export type NearbyHelpType = 'vet' | 'shelter' | 'pet_help';

export type NearbyHelpPlace = {
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
