import { useEffect, useMemo, useState } from 'react';

import {
  fetchNearbyHelp,
  type NearbyHelpPlace,
  type NearbyHelpResponse,
  type NearbyHelpType,
} from '../services/nearbyHelpApi';

interface NearbyHelpSectionProps {
  lat: number;
  lng: number;
}

const RADIUS_OPTIONS = [5, 10, 20, 30] as const;

const TYPE_CONFIG: Record<NearbyHelpType, { label: string; icon: string; bg: string; text: string }> = {
  vet: { label: 'Vet', icon: 'vaccines', bg: 'bg-primary-container/20', text: 'text-primary' },
  shelter: { label: 'Shelter', icon: 'home', bg: 'bg-secondary-container', text: 'text-on-secondary-container' },
  pet_help: { label: 'Pet-related', icon: 'pets', bg: 'bg-surface-container', text: 'text-on-surface-variant' },
};

function PlaceCard({ place }: { place: NearbyHelpPlace }) {
  const typeConf = TYPE_CONFIG[place.type] ?? TYPE_CONFIG.pet_help;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=16/${place.lat}/${place.lng}`;

  return (
    <div className="bg-white p-md rounded-xl border border-outline-variant/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all">
      <div className="flex items-start justify-between gap-sm mb-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-sm mb-xs">
            <span
              className={`inline-flex items-center gap-xs px-sm py-xs rounded-full font-label-sm text-label-sm ${typeConf.bg} ${typeConf.text}`}
            >
              <span className="material-symbols-outlined text-[14px]">{typeConf.icon}</span>
              {typeConf.label}
            </span>
          </div>
          <h4 className="font-headline-md text-headline-md text-on-background leading-tight">
            {place.name ?? 'Unnamed place'}
          </h4>
        </div>
        <span className="font-label-md text-label-md text-on-surface-variant whitespace-nowrap shrink-0">
          {place.distance_km.toFixed(1)} km
        </span>
      </div>

      {place.address && (
        <div className="flex items-center gap-xs text-secondary font-body-sm text-body-sm mb-xs">
          <span className="material-symbols-outlined text-[16px]">location_on</span>
          {place.address}
        </div>
      )}

      {place.phone && (
        <div className="flex items-center gap-xs text-secondary font-body-sm text-body-sm mb-xs">
          <span className="material-symbols-outlined text-[16px]">call</span>
          <a href={`tel:${place.phone}`} className="text-primary hover:underline">
            {place.phone}
          </a>
        </div>
      )}

      {place.website && (
        <div className="flex items-center gap-xs text-secondary font-body-sm text-body-sm mb-xs">
          <span className="material-symbols-outlined text-[16px]">language</span>
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline truncate"
          >
            {place.website.replace(/^https?:\/\//, '')}
          </a>
        </div>
      )}

      {place.opening_hours && (
        <div className="flex items-center gap-xs text-secondary font-body-sm text-body-sm mb-xs">
          <span className="material-symbols-outlined text-[16px]">schedule</span>
          {place.opening_hours}
        </div>
      )}

      <div className="mt-sm pt-sm border-t border-surface-container flex items-center gap-sm">
        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-xs px-md py-sm rounded-xl bg-surface-container border border-outline-variant text-on-surface font-label-md text-label-md hover:bg-secondary-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          Open in maps
        </a>
        {place.phone && (
          <a
            href={`tel:${place.phone}`}
            className="inline-flex items-center gap-xs px-md py-sm rounded-xl bg-primary-container text-on-primary font-label-md text-label-md hover:brightness-110 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">call</span>
            Call
          </a>
        )}
      </div>
    </div>
  );
}

export function NearbyHelpSection({ lat, lng }: NearbyHelpSectionProps) {
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [data, setData] = useState<NearbyHelpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterVet, setFilterVet] = useState(true);
  const [filterShelter, setFilterShelter] = useState(true);
  const [filterPetHelp, setFilterPetHelp] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchNearbyHelp(lat, lng, radiusKm)
      .then((response) => {
        setData(response);
      })
      .catch(() => {
        setError('Failed to load nearby places. Please try again later.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [lat, lng, radiusKm]);

  const filteredPlaces: NearbyHelpPlace[] = useMemo(() => {
    if (!data) return [];
    return data.places.filter((place) => {
      if (place.type === 'vet' && !filterVet) return false;
      if (place.type === 'shelter' && !filterShelter) return false;
      if (place.type === 'pet_help' && !filterPetHelp) return false;
      return true;
    });
  }, [data, filterVet, filterShelter, filterPetHelp]);

  return (
    <div className="bg-white rounded-2xl border border-surface-container-highest shadow-sm p-md md:p-lg">
      <div className="flex items-center gap-sm mb-md">
        <span className="material-symbols-outlined text-primary text-[24px]">local_hospital</span>
        <h2 className="font-headline-md text-headline-md text-on-surface">Nearby Help</h2>
      </div>

      {/* Radius selector */}
      <div className="flex flex-wrap items-center gap-sm mb-md">
        <span className="font-label-md text-label-md text-secondary">Radius:</span>
        <div className="flex bg-surface-container rounded-xl p-1" role="group" aria-label="Search radius">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRadiusKm(r)}
              aria-pressed={radiusKm === r}
              className={`px-md py-xs rounded-lg font-label-md text-label-md transition-all ${
                radiusKm === r
                  ? 'bg-white shadow-sm text-on-background'
                  : 'text-secondary hover:text-on-background'
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>

      {/* Filter toggles */}
      <div className="flex flex-wrap gap-sm mb-md">
        <button
          type="button"
          onClick={() => setFilterVet((v) => !v)}
          aria-pressed={filterVet}
          className={`inline-flex items-center gap-xs px-md py-sm rounded-full font-label-md text-label-md border transition-colors ${
            filterVet
              ? 'bg-primary-container/20 text-primary border-primary/30'
              : 'bg-surface-container text-secondary border-outline-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">vaccines</span>
          Vets
        </button>
        <button
          type="button"
          onClick={() => setFilterShelter((v) => !v)}
          aria-pressed={filterShelter}
          className={`inline-flex items-center gap-xs px-md py-sm rounded-full font-label-md text-label-md border transition-colors ${
            filterShelter
              ? 'bg-secondary-container text-on-secondary-container border-secondary/30'
              : 'bg-surface-container text-secondary border-outline-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">home</span>
          Shelters
        </button>
        <button
          type="button"
          onClick={() => setFilterPetHelp((v) => !v)}
          aria-pressed={filterPetHelp}
          className={`inline-flex items-center gap-xs px-md py-sm rounded-full font-label-md text-label-md border transition-colors ${
            filterPetHelp
              ? 'bg-surface-container-high text-on-surface border-outline-variant'
              : 'bg-surface-container text-secondary border-outline-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">pets</span>
          Pet-related
        </button>
      </div>

      {/* Warning */}
      {data?.warning && !loading && (
        <div
          className="flex gap-sm rounded-xl border border-[#E0A526]/30 bg-[#FFF7E6] p-sm mb-md"
          role="note"
          aria-label="Nearby help data warning"
        >
          <span className="material-symbols-outlined text-[#8A5A00] shrink-0" aria-hidden="true">
            warning
          </span>
          <p className="font-body-sm text-body-sm text-on-background">{data.warning}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-xl gap-sm">
          <span className="material-symbols-outlined text-[32px] text-secondary animate-spin">
            progress_activity
          </span>
          <span className="font-body-md text-body-md text-secondary">Loading nearby places...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center py-lg gap-sm text-center">
          <span className="material-symbols-outlined text-[48px] text-secondary">cloud_off</span>
          <p className="font-body-md text-body-md text-secondary">{error}</p>
          <button
            type="button"
            onClick={() => setRadiusKm((r) => r)}
            className="mt-sm px-md py-sm rounded-xl bg-primary-container text-on-primary font-label-md hover:brightness-110 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredPlaces.length === 0 && (
        <div className="flex flex-col items-center py-lg gap-sm text-center">
          <span className="material-symbols-outlined text-[48px] text-secondary">search_off</span>
          <p className="font-headline-sm text-headline-sm text-on-surface">No places found</p>
          <p className="font-body-md text-body-md text-secondary max-w-sm">
            Try increasing the search radius or adjusting the filters.
          </p>
        </div>
      )}

      {/* Results list */}
      {!loading && !error && filteredPlaces.length > 0 && (
        <div className="space-y-md">
          <p className="font-body-sm text-body-sm text-secondary">
            {filteredPlaces.length} place{filteredPlaces.length !== 1 ? 's' : ''} found within{' '}
            {radiusKm} km
          </p>
          {filteredPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}

      {/* OSM attribution */}
      <div className="mt-md pt-sm border-t border-surface-container">
        <p className="font-body-sm text-body-sm text-secondary">
          Map and place data ©{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            OpenStreetMap contributors
          </a>
          .
        </p>
      </div>
    </div>
  );
}
