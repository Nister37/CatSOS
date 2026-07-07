import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';

import { BaseTileLayer } from '../components/BaseTileLayer';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { useAppSelector } from '../app/hooks';
import {
  fetchOwnedReports,
  fetchPublicReports,
  fetchReportSightings,
  type OwnedSighting,
  type PublicReport,
} from '../services/reportsApi';
import {
  fetchNearbyHelp,
  type NearbyHelpPlace,
  type NearbyHelpType,
} from '../services/nearbyHelpApi';

type MapMode = 'all' | 'track';

type ActiveMarkerInfo =
  | { type: 'all'; cat: PublicReport }
  | { type: 'lastSeen'; cat: PublicReport }
  | { type: 'trackSighting'; sighting: OwnedSighting };

const DEFAULT_CENTER: [number, number] = [51.2194, 4.4025];

const CONFIDENCE_LABEL: Record<string, string> = {
  LOW: 'Low confidence',
  MEDIUM: 'Medium confidence',
  HIGH: 'High confidence',
};

const NEARBY_HELP_COLORS: Record<NearbyHelpType, { color: string; fillColor: string; label: string; icon: string }> = {
  vet: { color: '#15803d', fillColor: '#22c55e', label: 'Vet', icon: 'vaccines' },
  shelter: { color: '#1d4ed8', fillColor: '#3b82f6', label: 'Shelter', icon: 'home' },
  pet_help: { color: '#c2410c', fillColor: '#f97316', label: 'Pet-related', icon: 'pets' },
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Unified inner map component (lives inside a single MapContainer) ─────────

interface MapContentProps {
  mode: MapMode;
  publicReports: PublicReport[];
  selectedCat: PublicReport | null;
  sightings: OwnedSighting[];
  geocodedCenter: [number, number];
  onMarkerClick: (info: ActiveMarkerInfo | null) => void;
  nearbyPlaces: NearbyHelpPlace[];
  showNearby: boolean;
}

function MapContent({ mode, publicReports, selectedCat, sightings, geocodedCenter, onMarkerClick, nearbyPlaces, showNearby }: MapContentProps) {
  const map = useMap();

  // Close panel on bare map click
  useMapEvents({ click: () => onMarkerClick(null) });

  const pinIcon = useMemo(
    () =>
      new L.DivIcon({
        className: '',
        html: `<span class="material-symbols-outlined" style="font-size:30px;color:#ff5a5f;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));display:block;line-height:1;">location_on</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      }),
    [],
  );

  const lastSeenIcon = useMemo(
    () =>
      new L.DivIcon({
        className: '',
        html: `<div style="width:34px;height:34px;background:#b52330;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:white;font-weight:900;font-size:14px;font-family:sans-serif;line-height:1">A</span></div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      }),
    [],
  );

  useEffect(() => {
    if (mode === 'all') {
      const first = publicReports.find((c) => c.approximate_location !== null);
      if (first?.approximate_location) {
        map.flyTo([first.approximate_location.latitude, first.approximate_location.longitude], 12, { duration: 1 });
      }
    } else if (mode === 'track' && selectedCat?.approximate_location) {
      map.flyTo(
        [selectedCat.approximate_location.latitude, selectedCat.approximate_location.longitude],
        14,
        { duration: 1 },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedCat, geocodedCenter]);

  // ── All Missing Cats mode ───────────────────────────────────────────────────
  if (mode === 'all') {
    return (
      <>
        {publicReports
          .filter((c) => c.approximate_location !== null)
          .map((cat) => (
            <Marker
              key={cat.public_id}
              position={[cat.approximate_location!.latitude, cat.approximate_location!.longitude]}
              icon={pinIcon}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent.stopPropagation();
                  onMarkerClick({ type: 'all', cat });
                },
              }}
            />
          ))}
        {showNearby && nearbyPlaces.map((place) => {
          const conf = NEARBY_HELP_COLORS[place.type] ?? NEARBY_HELP_COLORS.pet_help;
          return (
            <CircleMarker
              key={`nearby-${place.id}`}
              center={[place.lat, place.lng]}
              radius={8}
              pathOptions={{ color: conf.color, fillColor: conf.fillColor, fillOpacity: 0.8, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="font-label-sm">{place.name ?? conf.label} ({place.distance_km.toFixed(1)} km)</span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </>
    );
  }

  // ── Track a Cat mode ────────────────────────────────────────────────────────
  if (mode === 'track' && selectedCat?.approximate_location) {
    const loc = selectedCat.approximate_location;
    const sightingsWithCoords = sightings.filter((s) => s.latitude !== null && s.longitude !== null);
    return (
      <>
        <Marker
          position={[loc.latitude, loc.longitude]}
          icon={lastSeenIcon}
          eventHandlers={{
            click: (e) => {
              e.originalEvent.stopPropagation();
              onMarkerClick({ type: 'lastSeen', cat: selectedCat });
            },
          }}
        />
        {sightingsWithCoords.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.latitude!, s.longitude!]}
            radius={10}
            pathOptions={{ color: '#d97706', fillColor: '#fbbf24', fillOpacity: 0.9, weight: 2 }}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                onMarkerClick({ type: 'trackSighting', sighting: s });
              },
            }}
          />
        ))}
        {showNearby && nearbyPlaces.map((place) => {
          const conf = NEARBY_HELP_COLORS[place.type] ?? NEARBY_HELP_COLORS.pet_help;
          return (
            <CircleMarker
              key={`nearby-${place.id}`}
              center={[place.lat, place.lng]}
              radius={8}
              pathOptions={{ color: conf.color, fillColor: conf.fillColor, fillOpacity: 0.8, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="font-label-sm">{place.name ?? conf.label} ({place.distance_km.toFixed(1)} km)</span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </>
    );
  }

  // ── No mode matched but nearby is on — still show nearby markers ────────────
  if (showNearby && nearbyPlaces.length > 0) {
    return (
      <>
        {nearbyPlaces.map((place) => {
          const conf = NEARBY_HELP_COLORS[place.type] ?? NEARBY_HELP_COLORS.pet_help;
          return (
            <CircleMarker
              key={`nearby-${place.id}`}
              center={[place.lat, place.lng]}
              radius={8}
              pathOptions={{ color: conf.color, fillColor: conf.fillColor, fillOpacity: 0.8, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="font-label-sm">{place.name ?? conf.label} ({place.distance_km.toFixed(1)} km)</span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </>
    );
  }

  return null;
}

// ─── Bottom info panel ────────────────────────────────────────────────────────

function MarkerPanel({
  info,
  onClose,
}: {
  info: ActiveMarkerInfo;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-4 right-4 md:right-auto md:left-4 md:max-w-sm z-[1000] p-4 bg-white rounded-xl shadow-lg border border-surface-container">
      <div className="flex justify-between items-start gap-md">
        <div className="min-w-0">
          {info.type === 'all' && (
            <>
              <p className="font-bold text-on-background text-sm">{info.cat.cat_name}</p>
              <p style={{ color: '#b52330' }} className="text-xs">Missing</p>
              {info.cat.last_seen_landmark && (
                <p className="text-secondary text-xs mt-1">{info.cat.last_seen_landmark}</p>
              )}
              {info.cat.disappeared_at && (
                <p className="text-secondary text-xs">
                  Since{' '}
                  {new Date(info.cat.disappeared_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </>
          )}

          {info.type === 'lastSeen' && (
            <>
              <p className="font-bold text-on-background text-sm">{info.cat.cat_name}</p>
              <p style={{ color: '#b52330' }} className="text-xs">Last known location</p>
              {info.cat.last_seen_landmark && (
                <p className="text-secondary text-xs mt-1">{info.cat.last_seen_landmark}</p>
              )}
            </>
          )}

          {info.type === 'trackSighting' && (
            <>
              <p className="font-bold text-on-background text-sm">Reported sighting</p>
              {info.sighting.location_description && (
                <p className="text-secondary text-xs mt-1">{info.sighting.location_description}</p>
              )}
              <p className="text-secondary text-xs">
                {new Date(info.sighting.seen_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              {info.sighting.confidence && (
                <p className="text-secondary text-xs">{CONFIDENCE_LABEL[info.sighting.confidence] ?? info.sighting.confidence}</p>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="p-2 rounded-full bg-white text-on-background shadow-sm shrink-0 hover:scale-110 transition-transform"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SightingsMapResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(query ? null : DEFAULT_CENTER);

  const [filterOpen, setFilterOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('all');
  const [publicReports, setPublicReports] = useState<PublicReport[]>([]);
  const [trackPublicId, setTrackPublicId] = useState('');
  const [trackSightings, setTrackSightings] = useState<OwnedSighting[]>([]);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeMarker, setActiveMarker] = useState<ActiveMarkerInfo | null>(null);

  // Nearby help state
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyHelpPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [showNearby, setShowNearby] = useState(true);

  // Use `user` (not `accessToken`) for UI gating — accessToken persists stale in
  // localStorage across page refreshes, but user is only set on an active login.
  const user = useAppSelector((state) => state.auth.user);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  useEffect(() => {
    if (!query) return;
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else {
          setMapCenter(DEFAULT_CENTER);
        }
      })
      .catch(() => setMapCenter(DEFAULT_CENTER));
  }, [query]);

  useEffect(() => {
    fetchPublicReports(100).then(setPublicReports).catch(() => {});
  }, []);

  // Fetch nearby vets/shelters when map center is known
  useEffect(() => {
    if (!mapCenter) return;
    // setState calls are inside promise callbacks, not the synchronous effect body
    Promise.resolve()
      .then(() => { setNearbyLoading(true); return fetchNearbyHelp(mapCenter[0], mapCenter[1], 10); })
      .then((response) => {
        setNearbyPlaces(response.places);
      })
      .catch(() => {
        // Silently fail — don't break the map if API is down
        setNearbyPlaces([]);
      })
      .finally(() => {
        setNearbyLoading(false);
      });
  }, [mapCenter]);

  useEffect(() => {
    const shouldFetch = mapMode === 'track' && !!trackPublicId && !!accessToken && !!user;
    if (!shouldFetch) return;
    // setState calls are inside promise callbacks, not the synchronous effect body
    Promise.resolve()
      .then(() => { setLoadingTrack(true); return fetchOwnedReports(); })
      .then((owned) => {
        const match = owned.find((r) => r.public_id === trackPublicId);
        if (!match) return [];
        return fetchReportSightings(match.id);
      })
      .then((s) => setTrackSightings(s ?? []))
      .catch(() => setTrackSightings([]))
      .finally(() => setLoadingTrack(false));
  }, [mapMode, trackPublicId, accessToken, user]);

  const locationLabel = query || 'your area';
  const resolvedCenter = mapCenter ?? DEFAULT_CENTER;
  // Derive effective mode — if user logs out, fall back to all without a setState effect
  const effectiveMode: MapMode = (!user && mapMode === 'track') ? 'all' : mapMode;
  const selectedCat = publicReports.find((r) => r.public_id === trackPublicId) ?? null;
  const effectiveSightings = user ? trackSightings : [];

  const MODE_OPTIONS: { id: MapMode; icon: string; label: string; desc: string }[] = [
    { id: 'all', icon: 'pets', label: 'All Missing Cats', desc: 'Every cat & where they went missing' },
    { id: 'track', icon: 'manage_search', label: 'Track a Cat', desc: 'Pick a cat to see location & sightings' },
  ];

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth">
      <Navbar />

      <main className="pt-20 min-h-screen">
        {/* Hero */}
        <section className="max-w-container-max mx-auto px-margin-mobile md:px-xl pt-xl pb-md">
          <div className="flex flex-col md:flex-row justify-between items-end gap-md">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-xs text-primary font-label-md uppercase tracking-widest mb-sm">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Live in {locationLabel}
              </span>
              <h1 className="font-display-lg text-display-lg text-on-surface mb-sm">
                Active Sightings Map
              </h1>
              <p className="font-body-lg text-body-lg text-secondary max-w-xl">
                A real-time overview of community reports near{' '}
                <span className="font-semibold text-on-background">{locationLabel}</span>. Use the map to
                identify recent feline movements and help bring lost pets home.
              </p>
            </div>

            <div className="flex gap-sm shrink-0">
              {/* Filter Map button */}
              <button
                type="button"
                onClick={() => setFilterOpen((o) => !o)}
                className={`flex items-center gap-xs px-md py-sm rounded-xl border font-label-md transition-colors ${
                  filterOpen || effectiveMode !== 'all'
                    ? 'bg-primary-container text-on-primary border-primary-container'
                    : 'bg-surface-container border-outline-variant text-on-surface hover:bg-secondary-container'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">tune</span>
                Filter Map
                <span className="material-symbols-outlined text-[16px]">
                  {filterOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>
          </div>

          {/* Active mode info strip */}
          {effectiveMode === 'track' && (
            <div className="mt-md flex items-center gap-sm flex-wrap">
              {effectiveMode === 'track' && selectedCat && (
                <>
                  <span className="inline-flex items-center gap-xs bg-[#b52330]/10 text-[#b52330] px-md py-xs rounded-full font-label-sm">
                    <span className="w-2 h-2 rounded-full bg-[#b52330]" />A Last known location
                  </span>
                  <span className="inline-flex items-center gap-xs bg-amber-100 text-amber-700 px-md py-xs rounded-full font-label-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {effectiveSightings.length} reported {effectiveSightings.length === 1 ? 'sighting' : 'sightings'}
                  </span>
                  {loadingTrack && (
                    <span className="material-symbols-outlined text-secondary animate-spin text-[16px]">sync</span>
                  )}
                </>
              )}
              {user && effectiveMode === 'track' && !selectedCat && (
                <span className="font-body-sm text-secondary">Open Filter Map and select a cat to track it</span>
              )}
            </div>
          )}
        </section>

        {/* Single persistent map */}
        <section className="max-w-container-max mx-auto px-margin-mobile md:px-xl pb-xl">
          {/* Outer wrapper is position:relative so the panel can overlay it */}
          <div className="relative" style={{ borderRadius: 32 }}>
            {/* Clipped map div */}
            <div
              className="w-full h-[600px] border border-outline-variant shadow-sm"
              style={{ borderRadius: 32, clipPath: 'inset(0 round 32px)', isolation: 'isolate' }}
            >
              {mapCenter === null ? (
                <div className="w-full h-full flex items-center justify-center bg-surface-container">
                  <span className="material-symbols-outlined text-[48px] text-secondary animate-spin">progress_activity</span>
                </div>
              ) : (
                <MapContainer
                  center={resolvedCenter}
                  zoom={13}
                  scrollWheelZoom={false}
                  className="w-full h-full"
                  aria-label="Sightings map"
                >
                  <BaseTileLayer />
                  <MapContent
                    mode={effectiveMode}
                    publicReports={publicReports}
                    selectedCat={selectedCat}
                    sightings={effectiveSightings}
                    geocodedCenter={resolvedCenter}
                    onMarkerClick={setActiveMarker}
                    nearbyPlaces={nearbyPlaces}
                    showNearby={showNearby}
                  />
                </MapContainer>
              )}
            </div>

            {/* Bottom info panel — sibling of the clipped div, not inside it */}
            {activeMarker && (
              <MarkerPanel info={activeMarker} onClose={() => setActiveMarker(null)} />
            )}
          </div>
        </section>

        {/* Nearby Help Toggle & Legend */}
        <section className="max-w-container-max mx-auto px-margin-mobile md:px-xl pb-md">
          <div className="flex flex-wrap items-center justify-between gap-md">
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setShowNearby((v) => !v)}
              aria-pressed={showNearby}
              className={`inline-flex items-center gap-sm px-md py-sm rounded-xl border font-label-md transition-colors ${
                showNearby
                  ? 'bg-primary-container/20 text-primary border-primary/30'
                  : 'bg-surface-container text-secondary border-outline-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {showNearby ? 'visibility' : 'visibility_off'}
              </span>
              {showNearby ? 'Hide' : 'Show'} Nearby Help
              {nearbyLoading && (
                <span className="material-symbols-outlined text-[16px] animate-spin ml-xs">progress_activity</span>
              )}
              {!nearbyLoading && nearbyPlaces.length > 0 && (
                <span className="bg-primary/10 text-primary px-sm py-0.5 rounded-full text-xs font-semibold">
                  {nearbyPlaces.length}
                </span>
              )}
            </button>

            {/* Legend */}
            {showNearby && nearbyPlaces.length > 0 && (
              <div className="flex flex-wrap items-center gap-md">
                {Object.entries(NEARBY_HELP_COLORS).map(([type, conf]) => (
                  <div key={type} className="flex items-center gap-xs">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: conf.fillColor, border: `2px solid ${conf.color}` }}
                    />
                    <span className="font-label-sm text-secondary">{conf.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nearby Help list */}
          {showNearby && nearbyPlaces.length > 0 && (
            <div className="mt-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-sm">
              {nearbyPlaces.slice(0, 9).map((place) => {
                const conf = NEARBY_HELP_COLORS[place.type] ?? NEARBY_HELP_COLORS.pet_help;
                return (
                  <div
                    key={place.id}
                    className="bg-white p-sm rounded-xl border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-sm mb-xs">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs"
                        style={{ backgroundColor: conf.fillColor }}
                      >
                        <span className="material-symbols-outlined text-[14px]">{conf.icon}</span>
                      </span>
                      <span className="font-label-md text-on-surface truncate">
                        {place.name ?? conf.label}
                      </span>
                      <span className="ml-auto font-label-sm text-secondary whitespace-nowrap">
                        {place.distance_km.toFixed(1)} km
                      </span>
                    </div>
                    {place.address && (
                      <p className="text-xs text-secondary truncate">{place.address}</p>
                    )}
                    <div className="flex items-center gap-sm mt-xs">
                      {place.phone && (
                        <a
                          href={`tel:${place.phone}`}
                          className="text-xs text-primary hover:underline flex items-center gap-xs"
                        >
                          <span className="material-symbols-outlined text-[12px]">call</span>
                          {place.phone}
                        </a>
                      )}
                      {place.website && (
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-xs"
                        >
                          <span className="material-symbols-outlined text-[12px]">language</span>
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* OSM attribution for nearby data */}
          {showNearby && nearbyPlaces.length > 0 && (
            <p className="mt-sm font-body-sm text-body-sm text-secondary">
              Place data ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                OpenStreetMap contributors
              </a>
              . Data may be incomplete — call before visiting.
            </p>
          )}
        </section>

        {/* CTA */}
        <section className="py-xl max-w-container-max mx-auto px-margin-mobile md:px-xl">
          <div className="bg-on-background rounded-[32px] p-lg md:p-xl flex flex-col md:flex-row items-center justify-between gap-lg overflow-hidden relative">
            <div className="relative z-10 text-center md:text-left">
              <h2 className="font-display-lg text-[32px] md:text-display-lg text-on-primary mb-md leading-tight">
                Help Us Grow the <br className="hidden md:block" /> Safety Network
              </h2>
              <p className="text-on-primary opacity-80 text-body-lg max-w-md mb-lg">
                Our map is only as strong as our community. Every sighting report increases the chances of a happy reunion.
              </p>
              <div className="flex flex-col sm:flex-row gap-md justify-center md:justify-start">
                <Link
                  to="/report-sighting"
                  className="bg-primary-container text-on-primary px-xl py-md rounded-xl font-headline-md text-[18px] hover:scale-105 transition-transform duration-200 text-center"
                >
                  Post a Sighting
                </Link>
              </div>
            </div>
            <div className="relative w-full md:w-1/2 h-64 md:h-80 pointer-events-none select-none">
              <div className="absolute inset-0 opacity-20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[300px] text-on-primary">share_location</span>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-container blur-[100px] rounded-full opacity-30" />
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Filter Map panel — responsive: bottom sheet on mobile, popover on desktop */}
      {filterOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-[500] flex items-end md:items-start md:justify-end"
          onClick={() => setFilterOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setFilterOpen(false); }}
        >
          <div
            role="presentation"
            className="w-full md:w-96 mx-0 mb-0 md:mt-36 md:mr-8 p-5 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-surface-container"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <p className="font-headline-md text-headline-md text-on-background">Map View</p>
              <button
                type="button"
                aria-label="Close filter"
                onClick={() => setFilterOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container text-on-background transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-1">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === 'track' && !user) {
                      setFilterOpen(false);
                      setShowLoginModal(true);
                      return;
                    }
                    setMapMode(opt.id);
                    setActiveMarker(null);
                    if (opt.id !== 'track') setFilterOpen(false);
                  }}
                  className={`w-full text-left flex items-center gap-md px-md py-md rounded-xl transition-colors ${
                    mapMode === opt.id
                      ? 'bg-primary-container/10 border border-primary-container/30'
                      : 'hover:bg-surface-container-low border border-transparent'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[22px] ${mapMode === opt.id ? 'text-primary-container' : 'text-secondary'}`}>
                    {opt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-on-surface">{opt.label}</p>
                    <p className="text-[12px] text-secondary">{opt.desc}</p>
                  </div>
                  {mapMode === opt.id && (
                    <span className="material-symbols-outlined text-primary-container text-[18px] shrink-0">check_circle</span>
                  )}
                </button>
              ))}

              {/* Cat selector — only visible when logged in AND in track mode */}
              {user && mapMode === 'track' && (
                <div className="pt-sm border-t border-surface-container mt-sm px-md pb-sm">
                  <label
                    htmlFor="trackCatSelect"
                    className="block font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-xs"
                  >
                    Select a cat
                  </label>
                  <select
                    id="trackCatSelect"
                    value={trackPublicId}
                    onChange={(e) => {
                      setTrackPublicId(e.target.value);
                      setActiveMarker(null);
                      if (e.target.value) setFilterOpen(false);
                    }}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm font-body-md text-on-surface focus:ring-2 focus:ring-primary-container"
                  >
                    <option value="">— choose a cat —</option>
                    {publicReports.map((r) => (
                      <option key={r.public_id} value={r.public_id}>
                        {r.cat_name}
                        {r.disappeared_at
                          ? ` · missing since ${new Date(r.disappeared_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Login required modal for Track a Cat */}
      {showLoginModal && (
        <div
          role="presentation"
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 backdrop-blur-sm px-md"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLoginModal(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowLoginModal(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sign in required"
            className="bg-white rounded-2xl p-xl shadow-2xl w-full max-w-sm"
          >
            <div className="flex items-center gap-md mb-md">
              <div className="w-12 h-12 bg-primary-container/20 rounded-full flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-primary-container text-[24px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  lock
                </span>
              </div>
              <div>
                <p className="font-headline-sm text-headline-sm text-on-surface">Sign in required</p>
                <p className="font-body-sm text-body-sm text-secondary">to track a cat's sightings</p>
              </div>
            </div>
            <p className="font-body-md text-body-md text-secondary mb-lg">
              Only the report owner can view reported sightings for a specific cat on the map.
            </p>
            <div className="flex gap-md">
              <Link
                to="/login"
                state={{ from: '/map/results' }}
                className="flex-1 bg-primary-container text-on-primary py-md rounded-xl font-label-md text-center hover:brightness-110 transition-all"
              >
                Sign in
              </Link>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="flex-1 border-2 border-outline-variant text-on-surface py-md rounded-xl font-label-md hover:bg-surface-container transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
