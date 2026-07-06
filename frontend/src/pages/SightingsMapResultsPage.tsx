import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { SightingsMap } from '../components/SightingsMap';
import { CatSighting, MOCK_SIGHTINGS, STATUS_LABELS, SightingStatus } from '../data/sightings';

const DEFAULT_CENTER: [number, number] = [51.2194, 4.4025];

const STATUS_BADGE: Record<
  SightingStatus,
  { bg: string; text: string }
> = {
  MISSING: { bg: 'bg-primary', text: 'text-on-primary' },
  RECENTLY_SEEN: { bg: 'bg-secondary-container', text: 'text-on-secondary-container' },
  FOUND: { bg: 'bg-[#2D8C3C]', text: 'text-white' },
  CLOSED: { bg: 'bg-surface-container-high', text: 'text-secondary' },
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface SightingCardProps {
  sighting: CatSighting;
}

function SightingCard({ sighting }: SightingCardProps) {
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
          <div
            className={`absolute top-sm right-sm ${badge.bg} ${badge.text} px-sm py-xs rounded-full font-label-sm`}
          >
            {STATUS_LABELS[sighting.status]}
          </div>
        </div>
        <div className="p-md">
          <div className="flex justify-between items-start mb-sm">
            <h4 className="font-headline-md text-[18px] text-on-surface">{sighting.cat_name}</h4>
            <span className="text-secondary font-label-sm uppercase shrink-0 ml-sm">
              {timeAgo(sighting.created_at)}
            </span>
          </div>
          <p className="text-secondary font-body-md text-sm mb-md line-clamp-2">
            {sighting.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-xs text-on-surface-variant text-sm font-medium">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              {sighting.last_seen_address.split(',')[0]}
            </span>
            <button
              type="button"
              className="text-primary font-label-md hover:underline"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SightingsMapResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [geocodingDone, setGeocodingDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query) {
      setGeocodingDone(true);
      return;
    }
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        }
      })
      .catch(() => {
        // fall through to default center
      })
      .finally(() => setGeocodingDone(true));
  }, [query]);

  function scrollFeed(direction: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
  }

  const locationLabel = query || 'your area';

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
                <span className="font-semibold text-on-background">{locationLabel}</span>. Use the
                map to identify recent feline movements and help bring lost pets home.
              </p>
            </div>
            <div className="flex gap-sm shrink-0">
              <button
                type="button"
                className="flex items-center gap-xs px-md py-sm rounded-xl bg-surface-container border border-outline-variant text-on-surface font-label-md hover:bg-secondary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">tune</span>
                Filter Map
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
        </section>

        {/* Map */}
        <section className="max-w-container-max mx-auto px-margin-mobile md:px-xl pb-xl">
          <div className="w-full h-[600px] rounded-[32px] overflow-hidden border border-outline-variant shadow-sm relative" style={{ isolation: 'isolate' }}>
            {geocodingDone ? (
              <SightingsMap sightings={MOCK_SIGHTINGS} center={mapCenter} />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-container">
                <span className="material-symbols-outlined text-[48px] text-secondary animate-spin">
                  progress_activity
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Recent community feed */}
        <section className="bg-surface-container-low py-xl">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-xl">
            <div className="flex items-center justify-between mb-lg">
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Recent Community Feed
              </h2>
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
                Our map is only as strong as our community. Every sighting report increases the
                chances of a happy reunion.
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
                <span className="material-symbols-outlined text-[300px] text-on-primary">
                  share_location
                </span>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-container blur-[100px] rounded-full opacity-30" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
