import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';

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
import { CatSighting, MOCK_SIGHTINGS, STATUS_LABELS, SightingStatus } from '../data/sightings';

type MapMode = 'community' | 'all' | 'track';

type ActiveMarkerInfo =
  | { type: 'community'; sighting: CatSighting }
  | { type: 'all'; cat: PublicReport }
  | { type: 'lastSeen'; cat: PublicReport }
  | { type: 'trackSighting'; sighting: OwnedSighting };

const DEFAULT_CENTER: [number, number] = [51.2194, 4.4025];

const STATUS_COLORS: Record<SightingStatus, string> = {
  MISSING: '#b52330',
  RECENTLY_SEEN: '#d97706',
  FOUND: '#2D8C3C',
  CLOSED: '#5f5e5e',
};

const STATUS_BADGE: Record<SightingStatus, { bg: string; text: string }> = {
  MISSING: { bg: 'bg-primary', text: 'text-on-primary' },
  RECENTLY_SEEN: { bg: 'bg-secondary-container', text: 'text-on-secondary-container' },
  FOUND: { bg: 'bg-[#2D8C3C]', text: 'text-white' },
  CLOSED: { bg: 'bg-surface-container-high', text: 'text-secondary' },
};

const CONFIDENCE_LABEL: Record<string, string> = {
  LOW: 'Low confidence',
  MEDIUM: 'Medium confidence',
  HIGH: 'High confidence',
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SightingCard({ sighting }: { sighting: CatSighting }) {
  const badge = STATUS_BADGE[sighting.status];
  return (
    <div className="flex-shrink-0 w-80 group">
      <div className="bg-surface-container-lowest rounded-[24px] overflow-hidden border border-outline-variant hover:shadow-lg transition-all duration-300">
        <div className="h-48 overflow-hidden relative bg-surface-container">
          {sighting._mockImageUrl ? (
            <img
              src={sighting._mockImageUrl}
              alt={sighting.cat_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-[64px] text-secondary">pets</span>
            </div>
          )}
          <div className={`absolute top-sm right-sm ${badge.bg} ${badge.text} px-sm py-xs rounded-full font-label-sm`}>
            {STATUS_LABELS[sighting.status]}
          </div>
        </div>
        <div className="p-md">
          <div className="flex justify-between items-start mb-sm">
            <h4 className="font-headline-md text-[18px] text-on-surface">{sighting.cat_name}</h4>
            <span className="text-secondary font-label-sm uppercase shrink-0 ml-sm">{timeAgo(sighting.created_at)}</span>
          </div>
          <p className="text-secondary font-body-md text-sm mb-md line-clamp-2">{sighting.description}</p>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-xs text-on-surface-variant text-sm font-medium">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              {sighting.last_seen_address.split(',')[0]}
            </span>
            <button type="button" className="text-primary font-label-md hover:underline">View Details</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Unified inner map component (lives inside a single MapContainer) ─────────

interface MapContentProps {
  mode: MapMode;
  publicReports: PublicReport[];
  selectedCat: PublicReport | null;
  sightings: OwnedSighting[];
  geocodedCenter: [number, number];
  onMarkerClick: (info: ActiveMarkerInfo | null) => void;
}

function MapContent({ mode, publicReports, selectedCat, sightings, geocodedCenter, onMarkerClick }: MapContentProps) {
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
    if (mode === 'community') {
      map.flyTo(geocodedCenter, 13, { duration: 1 });
    } else if (mode === 'all') {
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

  // ── Community mode ──────────────────────────────────────────────────────────
  if (mode === 'community') {
    return (
      <>
        {MOCK_SIGHTINGS.map((s) => {
          const color = STATUS_COLORS[s.status];
          return (
            <CircleMarker
              key={s.id}
              center={[s.last_seen_lat, s.last_seen_lng]}
              radius={12}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent.stopPropagation();
                  onMarkerClick({ type: 'community', sighting: s });
                },
              }}
            />
          );
        })}
      </>
    );
  }

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
    <div className="absolute bottom-4 left-4 right-4 z-[1000] p-4 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white/40">
      <div className="flex justify-between items-start gap-md">
        <div className="min-w-0">
          {info.type === 'community' && (
            <>
              <p className="font-bold text-on-background text-sm">{info.sighting.cat_name}</p>
              <p className="text-secondary text-xs">{STATUS_LABELS[info.sighting.status]}</p>
              <p className="text-secondary text-xs mt-1">{info.sighting.last_seen_address}</p>
            </>
          )}

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('community');
  const [publicReports, setPublicReports] = useState<PublicReport[]>([]);
  const [trackPublicId, setTrackPublicId] = useState('');
  const [trackSightings, setTrackSightings] = useState<OwnedSighting[]>([]);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeMarker, setActiveMarker] = useState<ActiveMarkerInfo | null>(null);

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

  function scrollFeed(direction: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
  }

  const locationLabel = query || 'your area';
  const resolvedCenter = mapCenter ?? DEFAULT_CENTER;
  // Derive effective mode — if user logs out, fall back to community without a setState effect
  const effectiveMode: MapMode = (!user && mapMode === 'track') ? 'community' : mapMode;
  const selectedCat = publicReports.find((r) => r.public_id === trackPublicId) ?? null;
  const effectiveSightings = user ? trackSightings : [];

  const MODE_OPTIONS: { id: MapMode; icon: string; label: string; desc: string }[] = [
    { id: 'community', icon: 'share_location', label: 'Community Sightings', desc: 'Recent sighting activity' },
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
                  filterOpen || effectiveMode !== 'community'
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

              <button
                type="button"
                className="flex items-center gap-xs px-md py-sm rounded-xl bg-on-background text-on-primary font-label-md hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[20px]">share</span>
                Share Map
              </button>
            </div>
          </div>

          {/* Active mode info strip */}
          {effectiveMode !== 'community' && (
            <div className="mt-md flex items-center gap-sm flex-wrap">
              {effectiveMode === 'all' && (
                <>
                  <span className="inline-flex items-center gap-xs bg-primary/10 text-primary px-md py-xs rounded-full font-label-sm">
                    <span className="w-2 h-2 rounded-full bg-[#ff5a5f]" />
                    All missing cats
                  </span>
                  <span className="font-body-sm text-secondary">
                    {publicReports.filter((c) => c.approximate_location !== null).length} with known location
                  </span>
                </>
              )}
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

        {/* Recent community feed */}
        <section className="bg-surface-container-low py-xl">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-xl">
            <div className="flex items-center justify-between mb-lg">
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Recent Community Feed</h2>
              <div className="flex gap-xs">
                <button
                  type="button"
                  aria-label="Scroll left"
                  onClick={() => scrollFeed('left')}
                  className="p-base rounded-full bg-surface-container-lowest border border-outline-variant hover:bg-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button
                  type="button"
                  aria-label="Scroll right"
                  onClick={() => scrollFeed('right')}
                  className="p-base rounded-full bg-surface-container-lowest border border-outline-variant hover:bg-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
            <div
              ref={scrollRef}
              className="flex gap-md overflow-x-auto pb-md -mx-margin-mobile px-margin-mobile md:mx-0 md:px-0"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {MOCK_SIGHTINGS.map((s) => (
                <SightingCard key={s.id} sighting={s} />
              ))}
            </div>
          </div>
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
                <button
                  type="button"
                  className="border border-on-primary text-on-primary px-xl py-md rounded-xl font-headline-md text-[18px] hover:bg-white/10 transition-colors duration-200"
                >
                  Download App
                </button>
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

      {/* Filter Map bottom sheet */}
      {filterOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-[500] flex flex-col justify-end"
          onClick={() => setFilterOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setFilterOpen(false); }}
        >
          <div
            role="presentation"
            className="mx-4 mb-4 p-4 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white/40"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <p className="font-bold text-on-background text-sm uppercase tracking-widest">Map View</p>
              <button
                type="button"
                aria-label="Close filter"
                onClick={() => setFilterOpen(false)}
                className="p-2 rounded-full bg-white text-on-background shadow-sm hover:scale-110 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-[2px]">
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
                  className={`w-full text-left flex items-center gap-md px-md py-sm rounded-xl transition-colors ${
                    mapMode === opt.id
                      ? 'bg-white/60 text-on-surface'
                      : 'hover:bg-white/40 text-on-surface'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${mapMode === opt.id ? 'text-primary-container' : 'text-secondary'}`}>
                    {opt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md">{opt.label}</p>
                    <p className="text-[12px] text-secondary truncate">{opt.desc}</p>
                  </div>
                  {mapMode === opt.id && (
                    <span className="material-symbols-outlined text-primary-container text-[18px] shrink-0">check</span>
                  )}
                </button>
              ))}

              {/* Cat selector — only visible when logged in AND in track mode */}
              {user && mapMode === 'track' && (
                <div className="pt-sm border-t border-white/40 mt-sm px-md pb-sm">
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
                    className="w-full bg-white/60 border-none rounded-xl px-md py-sm font-body-md text-on-surface focus:ring-2 focus:ring-primary-container"
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
