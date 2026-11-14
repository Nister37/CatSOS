import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { useTranslation } from '../i18n/useTranslation';
import {
  fetchPublicStats,
  fetchTrendingNearby,
  type TrendingLocation,
} from '../services/reportsApi';

export function formatRoundedStat(val: number | null | undefined): string {
  if (val == null || isNaN(val) || val <= 0) return '0';
  if (val >= 1000) {
    const k = Math.round(val / 100) / 10;
    return `${k}k+`;
  }
  if (val >= 50) {
    return `${Math.floor(val / 10) * 10}+`;
  }
  return `${val}`;
}

export function SightingsMapSearchPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [stats, setStats] = useState([
    { value: '0', labelKey: 'sightings.statActiveSightings' as const, highlight: true },
    { value: '0', labelKey: 'sightings.statCatsReunited' as const, highlight: false },
    { value: '0', labelKey: 'sightings.statCommunityMembers' as const, highlight: false },
  ]);
  const [trendingNearby, setTrendingNearby] = useState<TrendingLocation[]>([]);
  const [trendingLoaded, setTrendingLoaded] = useState(false);
  const watermarkRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    fetchPublicStats()
      .then((data) => {
        if (cancelled) return;
        setStats([
          {
            value: formatRoundedStat(data.active_sightings),
            labelKey: 'sightings.statActiveSightings',
            highlight: true,
          },
          {
            value: formatRoundedStat(data.cats_reunited),
            labelKey: 'sightings.statCatsReunited',
            highlight: false,
          },
          {
            value: formatRoundedStat(data.community_members),
            labelKey: 'sightings.statCommunityMembers',
            highlight: false,
          },
        ]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    function loadTrends(coords?: { lat: number; lng: number }) {
      const promise = coords ? fetchTrendingNearby(coords) : fetchTrendingNearby();
      promise
        .then((items) => {
          if (cancelled) return;
          setTrendingNearby(items);
          setTrendingLoaded(true);
        })

        .catch(() => {
          if (cancelled) return;
          setTrendingNearby([]);
          setTrendingLoaded(true);
        });
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          loadTrends({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          if (cancelled) return;
          loadTrends();
        },
        { timeout: 5000 },
      );
    } else {
      loadTrends();
    }

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!watermarkRef.current) return;
      const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
      const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
      watermarkRef.current.style.transform = `translate(${moveX}px, ${moveY}px)`;
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  function handleSearch(searchQuery: string) {
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/map/results?q=${encodeURIComponent(q)}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSearch(query);
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col scroll-smooth">
      <Navbar />

      <main className="flex-grow pt-20 relative overflow-hidden flex flex-col items-center justify-center">
        {/* Background map watermark */}
        <div
          ref={watermarkRef}
          className="absolute inset-0 z-0 pointer-events-none opacity-10"
          style={{
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
          }}
        >
          <div
            className="w-full h-full bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=1200&h=800&fit=crop')",
            }}
            aria-hidden="true"
          />
        </div>

        {/* Search section */}
        <section className="relative z-10 w-full max-w-[800px] px-margin-mobile text-center py-xl">
          <div className="mb-lg">
            <h1 className="font-display-lg text-display-lg text-on-background mb-base">
              {t('sightings.searchTitle')}
            </h1>
            <p className="font-body-lg text-body-lg text-secondary max-w-[600px] mx-auto">
              {t('sightings.searchSubtitle')}
            </p>
          </div>

          {/* Search bar */}
          <form
            onSubmit={handleSubmit}
            className={`bg-surface-container-lowest p-base rounded-2xl shadow-sm border border-surface-container-highest flex flex-col md:flex-row items-center gap-base transition-all duration-200 ${
              focused
                ? 'scale-[1.02] shadow-md ring-2 ring-primary-container/20'
                : ''
            }`}
          >
            <div className="flex-grow flex items-center px-md w-full">
              <span className="material-symbols-outlined text-secondary mr-sm">location_on</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={t('sightings.searchPlaceholder')}
                aria-label={t('sightings.searchAriaLabel')}
                className="w-full py-md bg-transparent border-none focus:ring-0 text-body-lg font-body-lg text-on-background"
              />
            </div>
            <button
              type="submit"
              className="w-full md:w-auto whitespace-nowrap bg-primary-container text-on-primary px-xl py-md rounded-xl font-label-md text-label-md hover:bg-primary transition-colors active:scale-95 duration-100 flex items-center justify-center gap-base"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                map
              </span>
              {t('sightings.searchButton')}
            </button>
          </form>

          {/* Trending nearby */}
          <div className="mt-lg flex flex-wrap justify-center items-center gap-lg">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
              {t('sightings.trendingNearby')}
            </span>
            {trendingNearby.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-md">
                {trendingNearby.map((item) => (
                  <button
                    key={item.id || item.query}
                    type="button"
                    onClick={() => handleSearch(item.query)}
                    className="font-label-md text-label-md text-on-surface-variant hover:text-primary-container transition-colors border-b border-transparent hover:border-primary-container flex items-center gap-xs"
                  >
                    <span>{item.label}</span>
                    {item.count > 0 && (
                      <span className="text-label-xs bg-surface-container-high text-secondary px-1.5 py-0.5 rounded-full font-medium">
                        {item.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : trendingLoaded ? (
              <span className="font-label-sm text-label-sm text-secondary italic">
                {t('sightings.noTrendingNearby')}
              </span>
            ) : null}
          </div>
        </section>

        {/* Stats */}
        <div className="relative z-10 w-full max-w-container-max mx-auto px-margin-mobile grid grid-cols-1 md:grid-cols-3 gap-md pb-xl">
          {stats.map((stat) => (
            <div
              key={stat.labelKey}
              className="bg-surface-container-low p-lg rounded-xl border border-surface-container-high flex flex-col items-center text-center"
            >
              <span
                className={`font-headline-lg text-headline-lg mb-xs ${
                  stat.highlight ? 'text-primary' : 'text-on-background'
                }`}
              >
                {stat.value}
              </span>
              <span className="font-label-md text-label-md text-secondary">
                {t(stat.labelKey)}
              </span>
            </div>
          ))}
        </div>

      </main>

      <Footer />
    </div>
  );
}
