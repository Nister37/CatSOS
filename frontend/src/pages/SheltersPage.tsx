import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import { AccordionSection } from '../components/AccordionSection';
import { Footer } from '../components/Footer';
import { LoadMoreButton } from '../components/LoadMoreButton';
import { Navbar } from '../components/Navbar';
import { SheltersMap, type MapBounds, type MapPlace } from '../components/SheltersMap';
import { GLOBAL_PUBLIC_PLACES, WORLD_CITY_SEEDS } from '../data/shelters';
import { fetchNearbyHelp, buildGoogleMapsUrl, isSafeHttpUrl, type NearbyHelpPlace } from '../services/nearbyHelpApi';
import { useTranslation } from '../i18n/useTranslation';

function renderPortal(children: React.ReactNode) {
  if (typeof document !== 'undefined') {
    return createPortal(children, document.body);
  }
  return children;
}

type FilterType = 'all' | 'shelter' | 'vet' | 'cat_cafe';

const TYPE_ICON: Record<string, string> = {
  vet: 'medical_services',
  shelter: 'home',
  cat_cafe: 'local_cafe',
  pet_help: 'pets',
};

const TYPE_LABEL: Record<string, string> = {
  vet: 'Veterinary',
  shelter: 'Shelter',
  cat_cafe: 'Cat Cafes',
  pet_help: 'Pet-related',
};

const VISIBLE_STEP = 6;

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function getDefaultLocation(): [number, number] {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Warsaw') || tz.includes('Poland')) return [52.2297, 21.0122];
    if (tz.includes('London')) return [51.5074, -0.1278];
    if (tz.includes('Manchester')) return [53.4808, -2.2426];
    if (tz.includes('Paris')) return [48.8566, 2.3522];
    if (tz.includes('Berlin')) return [52.5200, 13.4050];
    if (tz.includes('Munich')) return [48.1351, 11.5820];
    if (tz.includes('Hamburg')) return [53.5511, 9.9937];
    if (tz.includes('Amsterdam')) return [52.3676, 4.9041];
    if (tz.includes('Brussels')) return [50.8503, 4.3517];
    if (tz.includes('New_York') || tz.includes('Eastern')) return [40.7128, -74.0060];
    if (tz.includes('Los_Angeles') || tz.includes('Pacific')) return [34.0522, -118.2437];
    if (tz.includes('Chicago') || tz.includes('Central')) return [41.8781, -87.6298];
    if (tz.includes('Denver') || tz.includes('Mountain')) return [39.7392, -104.9903];
    if (tz.includes('Toronto')) return [43.6532, -79.3832];
    if (tz.includes('Vancouver')) return [49.2827, -123.1207];
    if (tz.includes('Tokyo')) return [35.6762, 139.6503];
    if (tz.includes('Sydney')) return [-33.8688, 151.2093];
    if (tz.includes('Melbourne')) return [-37.8136, 144.9631];
    if (tz.includes('Madrid')) return [40.4168, -3.7038];
    if (tz.includes('Rome')) return [41.9028, 12.4964];
    if (tz.includes('Vienna')) return [48.2082, 16.3738];
    if (tz.includes('Zurich')) return [47.3769, 8.5417];
    if (tz.includes('Dublin')) return [53.3498, -6.2603];
    if (tz.includes('Stockholm')) return [59.3293, 18.0686];
    if (tz.includes('Oslo')) return [59.9139, 10.7522];
    if (tz.includes('Copenhagen')) return [55.6761, 12.5683];
    if (tz.includes('Helsinki')) return [60.1699, 24.9384];
    if (tz.includes('Sao_Paulo')) return [-23.5505, -46.6333];
    if (tz.includes('Buenos_Aires')) return [-34.6037, -58.3816];
    if (tz.includes('Singapore')) return [1.3521, 103.8198];
    if (tz.includes('Seoul')) return [37.5665, 126.9780];
    if (tz.startsWith('America/')) return [41.8781, -87.6298];
    if (tz.startsWith('Australia/')) return [-33.8688, 151.2093];
    if (tz.startsWith('Asia/')) return [35.6762, 139.6503];
    if (tz.startsWith('Europe/')) return [50.8503, 4.3517];
  } catch {}
  return [51.2194, 4.4025];
}

function getInitialPlaces(loc: [number, number]): NearbyHelpPlace[] {
  const nearest = GLOBAL_PUBLIC_PLACES.map((p) => ({
    ...p,
    distance_km: haversineDistanceKm(loc[0], loc[1], p.lat, p.lng),
  })).sort((a, b) => a.distance_km - b.distance_km);

  const within150 = nearest.filter((p) => p.distance_km <= 150);
  return within150;
}

export function SheltersPage() {
  const { t } = useTranslation();
  const filterLabels: Record<FilterType, string> = {
    all: t('shelters.tabAll'),
    shelter: t('shelters.tabShelters'),
    vet: t('shelters.tabVets'),
    cat_cafe: t('shelters.tabCatCafes') || 'Cat Cafes',
  };
  const typeLabels: Record<string, string> = {
    vet: t('shelters.tabVets'),
    shelter: t('shelters.tabShelters'),
    cat_cafe: t('shelters.tabCatCafes'),
    pet_help: t('shelters.tabAll'),
  };
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const initialLoc = useMemo(() => getDefaultLocation(), []);
  const [places, setPlaces] = useState<NearbyHelpPlace[]>(() => getInitialPlaces(initialLoc));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number]>(initialLoc);
  const [mapCenter, setMapCenter] = useState<[number, number]>(initialLoc);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(12);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [isFilteringByMap, setIsFilteringByMap] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | number | null>(null);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const mapMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedCenterRef = useRef<[number, number]>(initialLoc);

  // Suggestions state (debounced 1.5s, top 5)
  const [suggestions, setSuggestions] = useState<NearbyHelpPlace[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const placesRef = useRef<NearbyHelpPlace[]>(places);

  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  // Community modals
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestSlidUp, setSuggestSlidUp] = useState(false);
  const [suggestRendered, setSuggestRendered] = useState(false);

  useEffect(() => {
    if (suggestOpen) {
      setSuggestRendered(true);
      const raf = requestAnimationFrame(() => setSuggestSlidUp(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setSuggestSlidUp(false);
      const timer = setTimeout(() => setSuggestRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [suggestOpen]);

  const [suggestSuccess, setSuggestSuccess] = useState<string | null>(null);
  const [suggestAlertClosing, setSuggestAlertClosing] = useState(false);
  const [reportingPlace, setReportingPlace] = useState<NearbyHelpPlace | null>(null);
  const [reportAlertClosing, setReportAlertClosing] = useState(false);
  const [reportSlidUp, setReportSlidUp] = useState(false);
  const [reportRendered, setReportRendered] = useState(false);

  const handleCloseSuggestAlert = () => {
    setSuggestAlertClosing(true);
    setTimeout(() => {
      setSuggestOpen(false);
      setSuggestSuccess(null);
      setSuggestAlertClosing(false);
    }, 250);
  };

  const handleCloseReportAlert = () => {
    setReportAlertClosing(true);
    setTimeout(() => {
      setReportingPlace(null);
      setReportSuccess(null);
      setReportAlertClosing(false);
    }, 250);
  };

  useEffect(() => {
    if (reportingPlace) {
      setReportRendered(true);
      const raf = requestAnimationFrame(() => setReportSlidUp(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setReportSlidUp(false);
      const timer = setTimeout(() => setReportRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [reportingPlace]);

  useEffect(() => {
    if (!suggestOpen && !reportingPlace) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (suggestOpen) setSuggestOpen(false);
        if (reportingPlace) setReportingPlace(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [suggestOpen, reportingPlace]);

  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [suggestForm, setSuggestForm] = useState({
    name: '',
    type: 'vet',
    address: '',
    phone: '',
    notes: '',
  });
  const [reportIssueNote, setReportIssueNote] = useState('');

  // Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLoading(true);
        setError(false);
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        setMapCenter(loc);
      },
      undefined,
      { timeout: 5000 },
    );
  }, []);

  // Fetch real data from Overpass API (fallback to verified public data on error/empty)
  useEffect(() => {
    let cancelled = false;
    fetchNearbyHelp(userLocation[0], userLocation[1], 15)
      .then((response) => {
        if (cancelled) return;
        if (response.places && response.places.length > 0) {
          const recalculated = response.places.map((p) => ({
            ...p,
            id: p.id || String(p.osm_id || `${p.lat}-${p.lng}`),
            distance_km: haversineDistanceKm(userLocation[0], userLocation[1], p.lat, p.lng),
          }));
          setPlaces(recalculated);
        } else {
          setPlaces(getInitialPlaces(userLocation));
        }
        setVisibleCount(VISIBLE_STEP);
      })
      .catch(() => {
        if (cancelled) return;
        setPlaces(getInitialPlaces(userLocation));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userLocation]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // Handle typing in search input: 1.5s debounce for top 5 suggestions
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setVisibleCount(VISIBLE_STEP);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedSuggestionIdx(-1);
      return;
    }

    // Wait exactly 1.5 seconds of inactivity before calculating top 5 suggestions
    searchTimerRef.current = setTimeout(() => {
      const q = trimmed.toLowerCase();
      const currentPlaces = placesRef.current;
      const tokens = q.split(/\s+/).filter(Boolean);

      // Search across currentPlaces AND GLOBAL_PUBLIC_PLACES
      const allPool = [...currentPlaces, ...GLOBAL_PUBLIC_PLACES];
      const poolSeen = new Set<string>();
      const poolUnique: NearbyHelpPlace[] = [];
      for (const p of allPool) {
        const idKey = String(p.id ?? `${p.lat}-${p.lng}`);
        if (!poolSeen.has(idKey)) {
          poolSeen.add(idKey);
          poolUnique.push(p);
        }
      }

      const scored = poolUnique.map((p) => {
        const name = (p.name ?? '').toLowerCase();
        const addr = (p.address ?? '').toLowerCase();
        let score = 0;

        if (name === q) score += 100;
        else if (name.startsWith(q)) score += 60;
        else if (name.includes(q)) score += 30;

        if (addr === q) score += 80;
        else if (addr.startsWith(q)) score += 40;
        else if (addr.includes(q)) score += 20;

        const matched = tokens.filter((t) => name.includes(t) || addr.includes(t));
        score += matched.length * 15;

        return { place: p, score };
      });

      const matchedList = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
      const seenIds = new Set<string>();
      const top5: NearbyHelpPlace[] = [];

      for (const item of matchedList) {
        const idKey = String(item.place.id ?? `${item.place.lat}-${item.place.lng}`);
        if (!seenIds.has(idKey)) {
          seenIds.add(idKey);
          top5.push(item.place);
          if (top5.length === 5) break;
        }
      }

      if (top5.length < 5) {
        for (const place of poolUnique) {
          const idKey = String(place.id ?? `${place.lat}-${place.lng}`);
          if (!seenIds.has(idKey)) {
            seenIds.add(idKey);
            top5.push(place);
            if (top5.length === 5) break;
          }
        }
      }

      setSuggestions(top5);
      setShowSuggestions(top5.length > 0);
      setSelectedSuggestionIdx(-1);
    }, 1500);
  };

  const handleSelectSuggestion = (place: NearbyHelpPlace) => {
    setSearch(place.name || place.address || '');
    setMapCenter([place.lat, place.lng]);
    setMapZoom(15);
    setSelectedPlaceId(place.id);
    setIsFilteringByMap(true);
    setShowSuggestions(false);
    setSelectedSuggestionIdx(-1);
    fetchPlacesForArea([place.lat, place.lng], 15);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedSuggestionIdx >= 0 && selectedSuggestionIdx < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedSuggestionIdx]);
      } else if (search.trim()) {
        e.preventDefault();
        setShowSuggestions(false);
        handleWorldwideSearch(search.trim());
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIdx(-1);
    }
  };

  // Worldwide search by city name, country, or address using Nominatim geocoding & Overpass
  const handleWorldwideSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Check if query matches known global cities
    const matchedCity = WORLD_CITY_SEEDS.find(
      (c) =>
        c.name.toLowerCase() === trimmed.toLowerCase() ||
        `${c.name}, ${c.country}`.toLowerCase() === trimmed.toLowerCase() ||
        c.name.toLowerCase().startsWith(trimmed.toLowerCase()),
    );

    if (matchedCity) {
      setMapCenter([matchedCity.lat, matchedCity.lng]);
      setMapZoom(13);
      setIsFilteringByMap(true);
      fetchPlacesForArea([matchedCity.lat, matchedCity.lng], 15);
      return;
    }

    // Check if query matches known global seed place
    const matchedGlobal = GLOBAL_PUBLIC_PLACES.find(
      (gp) =>
        (gp.address ?? '').toLowerCase().includes(trimmed.toLowerCase()) ||
        (gp.name ?? '').toLowerCase().includes(trimmed.toLowerCase()),
    );

    if (matchedGlobal) {
      setMapCenter([matchedGlobal.lat, matchedGlobal.lng]);
      setMapZoom(13);
      setIsFilteringByMap(true);
      fetchPlacesForArea([matchedGlobal.lat, matchedGlobal.lng], 15);
      return;
    }

    try {
      setIsMapLoading(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1`,
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          setMapCenter([lat, lon]);
          setMapZoom(13);
          setIsFilteringByMap(true);
          fetchPlacesForArea([lat, lon], 15);
        }
      }
    } catch {
      // Graceful failure
    } finally {
      setIsMapLoading(false);
    }
  };

  // Fetch public places for viewed map area from Overpass API (fallback to global public places)
  const fetchPlacesForArea = (center: [number, number], radiusKm: number) => {
    setIsMapLoading(true);
    fetchNearbyHelp(center[0], center[1], radiusKm)
      .then((response) => {
        if (response.places && response.places.length > 0) {
          lastFetchedCenterRef.current = center;
          setPlaces((prev) => {
            const seen = new Set(prev.map((p) => String(p.id)));
            const fresh = response.places
              .filter((p) => !seen.has(String(p.id)))
              .map((p) => ({
                ...p,
                id: p.id || String(p.osm_id || `${p.lat}-${p.lng}`),
                distance_km: haversineDistanceKm(center[0], center[1], p.lat, p.lng),
              }));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
        } else {
          // If public API returned 0 places, check if any global seed places match this region
          const nearbyGlobal = GLOBAL_PUBLIC_PLACES.map((p) => ({
            ...p,
            distance_km: haversineDistanceKm(center[0], center[1], p.lat, p.lng),
          })).filter((p) => p.distance_km <= Math.max(120, radiusKm * 3));

          if (nearbyGlobal.length > 0) {
            setPlaces((prev) => {
              const seen = new Set(prev.map((p) => String(p.id)));
              const fresh = nearbyGlobal.filter((p) => !seen.has(String(p.id)));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        }
      })
      .catch(() => {
        const nearbyGlobal = GLOBAL_PUBLIC_PLACES.map((p) => ({
          ...p,
          distance_km: haversineDistanceKm(center[0], center[1], p.lat, p.lng),
        })).filter((p) => p.distance_km <= Math.max(120, radiusKm * 3));

        if (nearbyGlobal.length > 0) {
          setPlaces((prev) => {
            const seen = new Set(prev.map((p) => String(p.id)));
            const fresh = nearbyGlobal.filter((p) => !seen.has(String(p.id)));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
        }
      })
      .finally(() => {
        setIsMapLoading(false);
      });
  };

  // Map bounds change handler: dynamically updates place list & loads public data when moving
  const handleMapBoundsChange = (bounds: MapBounds, center: [number, number]) => {
    setMapBounds(bounds);
    setMapCenter(center);
    setIsFilteringByMap(true);
    setVisibleCount(VISIBLE_STEP);

    // Calculate approximate radius from map center to northern edge
    const distKm = haversineDistanceKm(center[0], center[1], bounds.north, center[1]);
    const radius = Math.min(30, Math.max(5, Math.round(distKm)));

    // Debounce fetching public data when exploring anywhere in the world
    if (mapMoveTimerRef.current) {
      clearTimeout(mapMoveTimerRef.current);
    }
    mapMoveTimerRef.current = setTimeout(() => {
      const distFromLast = haversineDistanceKm(
        lastFetchedCenterRef.current[0],
        lastFetchedCenterRef.current[1],
        center[0],
        center[1],
      );
      if (distFromLast >= 3) {
        lastFetchedCenterRef.current = center;
        fetchPlacesForArea(center, radius);
      }
    }, 400);
  };

  // Explicit "Search this area" button action
  const handleSearchThisArea = () => {
    if (!mapBounds) {
      fetchPlacesForArea(mapCenter, 15);
      return;
    }
    const distKm = haversineDistanceKm(mapCenter[0], mapCenter[1], mapBounds.north, mapCenter[1]);
    const radius = Math.min(30, Math.max(5, Math.round(distKm)));
    fetchPlacesForArea(mapCenter, radius);
  };

  // Clean up map movement timer on unmount
  useEffect(() => {
    return () => {
      if (mapMoveTimerRef.current) {
        clearTimeout(mapMoveTimerRef.current);
      }
    };
  }, []);

  // Reset map bounds filter
  const handleResetMapFilter = () => {
    setIsFilteringByMap(false);
    setMapBounds(null);
    setMapCenter(userLocation);
    setMapZoom(12);
    setSelectedPlaceId(null);
  };

  // Filtered places calculation
  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return places.filter((place) => {
      const matchesType = filter === 'all' || place.type === filter;
      const matchesSearch =
        query === '' ||
        (place.name ?? '').toLowerCase().includes(query) ||
        (place.address ?? '').toLowerCase().includes(query);

      const matchesBounds =
        !isFilteringByMap || !mapBounds
          ? true
          : place.lat >= mapBounds.south &&
            place.lat <= mapBounds.north &&
            place.lng >= mapBounds.west &&
            place.lng <= mapBounds.east;

      return matchesType && matchesSearch && matchesBounds;
    });
  }, [search, filter, places, isFilteringByMap, mapBounds]);

  const visiblePlaces = filtered.slice(0, visibleCount);
  const canLoadMore = visibleCount < filtered.length;

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth">
      <Navbar />
      <main className="pt-24 pb-xl min-h-screen max-w-container-max mx-auto px-margin-mobile md:px-lg">
        {/* Hero */}
        <section className="motion-reveal mb-lg">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-base">
            {t('shelters.heroTitle')}
          </h1>
          <p className="font-body-lg text-body-lg text-secondary max-w-2xl">
            {t('shelters.heroSubtitle')}
          </p>
          <div
            className="mt-md flex max-w-2xl gap-3 rounded-xl border border-[#E0A526]/30 bg-[#FFF7E6] p-4 text-on-background"
            role="note"
            aria-label="Nearby help data warning"
          >
            <span className="material-symbols-outlined text-[#8A5A00]" aria-hidden="true">
              warning
            </span>
            <p className="font-body-md text-body-md">
              <strong>{t('shelters.warningBold')}</strong> {t('shelters.warningNote').replace(t('shelters.warningBold'), '').trim()}
            </p>
          </div>
        </section>

        {/* Search & Filter */}
        <div className="motion-reveal flex flex-col md:flex-row gap-md items-center mb-md">
          {/* Autocomplete Search input */}
          <div ref={searchContainerRef} className="relative w-full md:w-96 group z-30">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-secondary pointer-events-none group-focus-within:text-on-background transition-colors">
              search
            </span>
            <input
              className="w-full bg-[#F0F0F0] border-0 border-transparent rounded-xl py-4 pl-12 pr-4 outline-none focus:outline-none focus:ring-2 focus:ring-on-background focus:ring-offset-0 focus:border-transparent transition-all font-body-md"
              placeholder={t('shelters.searchPlaceholder')}
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              aria-label={t('shelters.searchAriaLabel')}
              aria-autocomplete="list"
              aria-controls="place-suggestions"
              aria-expanded={showSuggestions}
            />

            {/* Suggestions Dropdown (Top 5 matched after 1.5s typing pause) */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                id="place-suggestions"
                role="listbox"
                aria-label="Suggested places"
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-3 py-2 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between text-xs text-secondary font-medium">
                  <span>{t('shelters.topMatchingPlaces')}</span>
                  <span className="text-[11px] opacity-75">{t('shelters.clickOrEnterToView')}</span>
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {suggestions.map((item, idx) => {
                    const isHighlighted = idx === selectedSuggestionIdx;
                    return (
                      <button
                        key={String(item.id ?? idx)}
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        onClick={() => handleSelectSuggestion(item)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                          isHighlighted ? 'bg-primary/10' : 'hover:bg-surface-container-low'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            item.type === 'vet'
                              ? 'bg-green-100 text-green-700'
                              : item.type === 'shelter'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {TYPE_ICON[item.type] ?? 'pets'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-on-background truncate">
                              {item.name || 'Unnamed place'}
                            </span>
                            <span className="text-xs text-secondary shrink-0 font-medium">
                              {item.distance_km} km
                            </span>
                          </div>
                          {item.address && (
                            <p className="text-xs text-secondary truncate mt-0.5">{item.address}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Type Filter Pills */}
          <div
            className="relative flex bg-surface-container rounded-xl p-1 w-full md:w-auto overflow-hidden"
            role="group"
            aria-label="Filter by type"
          >
            {/* Sliding highlight indicator */}
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 rounded-lg bg-white shadow-sm transition-transform duration-300 ease-in-out pointer-events-none"
              style={{
                width: 'calc((100% - 8px) / 4)',
                transform: `translateX(${
                  filter === 'all'
                    ? '0%'
                    : filter === 'shelter'
                    ? '100%'
                    : filter === 'vet'
                    ? '200%'
                    : '300%'
                })`,
              }}
            />
            {(['all', 'shelter', 'vet', 'cat_cafe'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setFilter(type);
                  setVisibleCount(VISIBLE_STEP);
                }}
                aria-pressed={filter === type}
                className={`relative z-10 flex-1 md:w-28 text-center px-3 py-3 rounded-lg font-label-md text-label-md transition-colors ${
                  filter === type
                    ? 'font-bold text-on-background'
                    : 'text-secondary hover:text-on-background'
                }`}
              >
                {filterLabels[type]}
              </button>
            ))}
          </div>

          {/* Suggest place button */}
          <button
            type="button"
            onClick={() => {
              setSuggestSuccess(null);
              setSuggestOpen(true);
            }}
            className="ml-auto w-full md:w-auto px-5 py-3 rounded-xl border border-outline-variant/40 hover:bg-surface-container font-label-md text-label-md text-on-background flex items-center justify-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add_location_alt</span>
            {t('shelters.suggestPlace')}
          </button>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
          {/* Card list column */}
          <div className="lg:col-span-7 flex flex-col gap-md">
            <AccordionSection
              title={t('shelters.placesHeading')}
              count={filtered.length}
              summary={
                loading
                  ? t('shelters.loadingPlaces')
                  : t('shelters.showingMatchingPlaces')
                      .replace('{count}', String(visiblePlaces.length))
                      .replace('{total}', String(filtered.length))
              }
            >
              <div className="motion-stagger space-y-md overflow-y-auto lg:max-h-[800px] pr-1 custom-scrollbar">
                {loading ? (
                  <div className="py-xl text-center">
                    <span className="material-symbols-outlined text-[48px] text-secondary animate-spin">
                      progress_activity
                    </span>
                    <p className="mt-md text-secondary font-body-md">{t('shelters.loadingPlaces')}</p>
                  </div>
                ) : error ? (
                  <div className="py-xl text-center text-secondary font-body-lg">
                    {t('shelters.errorPlaces')}
                  </div>
                ) : filtered.length > 0 ? (
                  visiblePlaces.map((place) => {
                    const isSelected =
                      selectedPlaceId != null && String(place.id) === String(selectedPlaceId);
                    return (
                      <div
                        key={String(place.id ?? `${place.lat}-${place.lng}`)}
                        onClick={() => {
                          setSelectedPlaceId(place.id);
                          setMapCenter([place.lat, place.lng]);
                          setMapZoom(15);
                          setMobileMapOpen(true);
                        }}
                        className={`bg-white rounded-2xl overflow-hidden border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/20 shadow-md'
                            : 'border-surface-container hover:shadow-md'
                        }`}
                      >
                        <div className="p-md flex gap-md">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              place.type === 'vet'
                                ? 'bg-green-100 text-green-700'
                                : place.type === 'shelter'
                                  ? 'bg-blue-100 text-blue-700'
                                  : place.type === 'cat_cafe'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            <span className="material-symbols-outlined">
                              {TYPE_ICON[place.type] ?? 'pets'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-sm mb-xs">
                              <h3 className="font-headline-md text-on-background truncate">
                                {place.name || t('shelters.unnamedPlace')}
                              </h3>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                  place.type === 'vet'
                                    ? 'bg-green-100 text-green-700'
                                    : place.type === 'shelter'
                                      ? 'bg-blue-100 text-blue-700'
                                      : place.type === 'cat_cafe'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {typeLabels[place.type] ?? place.type}
                              </span>
                            </div>
                            {place.address && (
                              <p className="text-secondary font-body-md text-sm flex items-center gap-xs">
                                <span className="material-symbols-outlined text-[16px]">
                                  location_on
                                </span>
                                {place.address}
                              </p>
                            )}
                            <div className="flex items-center gap-md mt-sm flex-wrap">
                              <span className="text-secondary text-sm">
                                {place.distance_km} {t('shelters.kmAway')}
                              </span>
                              {place.phone && (
                                <a
                                  href={`tel:${place.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-primary text-sm flex items-center gap-xs hover:underline"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    call
                                  </span>
                                  {place.phone}
                                </a>
                              )}
                              {place.opening_hours && (
                                <span className="text-secondary text-sm flex items-center gap-xs">
                                  <span className="material-symbols-outlined text-[16px]">
                                    schedule
                                  </span>
                                  {place.opening_hours}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-md mt-sm flex-wrap items-center">
                              {isSafeHttpUrl(place.website) && (
                                <a
                                  href={place.website!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm text-primary hover:underline flex items-center gap-xs"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    language
                                  </span>
                                  {t('shelters.website')}
                                </a>
                              )}
                              <a
                                href={buildGoogleMapsUrl(place)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm text-secondary hover:text-on-background flex items-center gap-xs"
                              >
                                <span className="material-symbols-outlined text-[16px]">map</span>
                                {t('shelters.googleMaps')}
                              </a>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportingPlace(place);
                                  setReportSuccess(null);
                                  setReportIssueNote('');
                                }}
                                className="text-xs text-secondary hover:text-error ml-auto flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">flag</span>
                                {t('shelters.reportIssue')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-xl text-center text-secondary font-body-lg text-body-lg">
                    {t('shelters.noResults')}
                    {isFilteringByMap && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleResetMapFilter}
                          className="px-4 py-2 bg-on-background text-white rounded-xl text-sm font-bold"
                        >
                          {t('shelters.showAllNearby')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {canLoadMore && !loading && !error && (
                <div className="flex justify-center mt-md">
                  <LoadMoreButton
                    onClick={() => setVisibleCount((count) => count + VISIBLE_STEP)}
                    label={t('shelters.loadMorePlaces')}
                  />
                </div>
              )}
            </AccordionSection>

            {/* Mobile map toggle */}
            <div className="lg:hidden mt-md">
              <button
                type="button"
                onClick={() => setMobileMapOpen((prev) => !prev)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-on-background text-on-background font-bold font-label-md text-label-md hover:bg-on-background hover:text-white transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {mobileMapOpen ? 'close' : 'map'}
                </span>
                {mobileMapOpen ? t('shelters.hideMap') : t('shelters.viewOnMap')}
              </button>

              {mobileMapOpen && (
                <div className="mt-md h-[380px] rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30 relative">
                  <SheltersMap
                    locations={filtered}
                    center={mapCenter}
                    zoom={mapZoom}
                    userLocation={userLocation}
                    selectedPlaceId={selectedPlaceId}
                    onBoundsChange={handleMapBoundsChange}
                    onZoomChange={(newZoom) => setMapZoom(newZoom)}
                    onSelectPlace={(loc: MapPlace) => {
                      setSelectedPlaceId(loc.id);
                      setMapCenter([loc.lat ?? 0, loc.lng ?? 0]);
                      setMapZoom(15);
                    }}
                    isSearchingArea={isMapLoading}
                    onSearchThisArea={handleSearchThisArea}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Desktop map column */}
          <div className="hidden lg:flex lg:col-span-5 flex-col gap-md sticky top-24">
            <div className="h-[460px] rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30 relative">
              <SheltersMap
                locations={filtered}
                center={mapCenter}
                zoom={mapZoom}
                userLocation={userLocation}
                selectedPlaceId={selectedPlaceId}
                onBoundsChange={handleMapBoundsChange}
                onZoomChange={(newZoom) => setMapZoom(newZoom)}
                onSelectPlace={(loc: MapPlace) => {
                  setSelectedPlaceId(loc.id);
                  setMapCenter([loc.lat ?? 0, loc.lng ?? 0]);
                  setMapZoom(15);
                }}
                isSearchingArea={isMapLoading}
                onSearchThisArea={handleSearchThisArea}
              />
            </div>
            <div className="bg-surface-container-low rounded-2xl p-md border border-outline-variant/20">
              <div className="flex justify-between items-center mb-sm">
                <div>
                  <h4 className="font-bold text-on-background text-sm">
                    {loading ? t('shelters.loading') : `${filtered.length} ${t('shelters.placesFound')}`}
                  </h4>
                  <p className="text-secondary text-xs">
                    {isFilteringByMap
                      ? t('shelters.withinCurrentMapView')
                      : t('shelters.within15km')}
                  </p>
                </div>
                {isFilteringByMap && (
                  <button
                    type="button"
                    onClick={handleResetMapFilter}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    {t('shelters.resetView')}
                  </button>
                )}
              </div>
              <div className="flex gap-md text-xs text-secondary flex-wrap">
                <div className="flex items-center gap-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#b52330]" />
                  <span>{places.filter((p) => p.type === 'vet').length} {t('shelters.vetsCount')}</span>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2D8C3C]" />
                  <span>{places.filter((p) => p.type === 'shelter').length} {t('shelters.sheltersCount')}</span>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span>{places.filter((p) => p.type === 'pet_help').length} {t('shelters.otherCount')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Community callout */}
        <section className="mt-xl grid grid-cols-1 md:grid-cols-2 gap-lg items-center">
          <div className="p-lg bg-on-background text-white rounded-3xl overflow-hidden relative">
            <div className="relative z-10">
              <h2 className="font-headline-lg text-headline-lg mb-md">{t('shelters.communityCalloutTitle')}</h2>
              <p className="text-white/70 font-body-lg text-body-lg mb-lg">
                {t('shelters.communityCalloutSubtitle')}
              </p>
              <Link
                to="/map"
                className="bg-primary-container text-on-primary px-8 py-3 rounded-full font-bold hover:brightness-110 transition-all inline-flex items-center gap-2"
              >
                {t('shelters.postToCommunityMap')}
                <span className="material-symbols-outlined">chevron_right</span>
              </Link>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          </div>

          <div className="flex flex-col gap-md">
            <div className="p-6 bg-white rounded-2xl border border-outline-variant/30 flex gap-md items-start">
              <div className="p-3 bg-surface rounded-xl text-primary-container shrink-0">
                <span className="material-symbols-outlined text-[32px]">emergency_home</span>
              </div>
              <div>
                <h4 className="font-bold text-lg mb-1">{t('shelters.emergencyProtocols')}</h4>
                <p className="text-secondary text-sm">
                  {t('shelters.emergencyProtocolsDesc')}
                </p>
              </div>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-outline-variant/30 flex gap-md items-start">
              <div className="p-3 bg-surface rounded-xl text-on-background shrink-0">
                <span className="material-symbols-outlined text-[32px]">volunteer_activism</span>
              </div>
              <div>
                <h4 className="font-bold text-lg mb-1">{t('shelters.callAhead')}</h4>
                <p className="text-secondary text-sm">
                  {t('shelters.callAheadDesc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Suggest Place Modal */}
        {suggestRendered &&
          renderPortal(
            <div
              className={`fixed inset-0 z-[9999] w-screen h-screen bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto transition-opacity duration-300 ease-out ${
                suggestSlidUp ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="suggest-modal-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSuggestOpen(false);
              }}
            >
              <div
                className={`relative m-auto w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high p-6 md:p-8 transition-all duration-300 ease-out transform ${
                  suggestSlidUp ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-95 opacity-0'
                }`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 id="suggest-modal-title" className="font-headline-md text-headline-md text-on-background">
                    {t('shelters.suggestModalTitle')}
                  </h3>
                  <button
                    type="button"
                    aria-label={t('shelters.closeAriaLabel')}
                    onClick={() => {
                      if (suggestSuccess) {
                        handleCloseSuggestAlert();
                      } else {
                        setSuggestOpen(false);
                      }
                    }}
                    className="w-8 h-8 aspect-square flex items-center justify-center rounded-full hover:bg-surface-container text-secondary p-0 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] select-none leading-none">
                      close
                    </span>
                  </button>
                </div>
                {suggestSuccess ? (
                  <div
                    role="alert"
                    aria-live="polite"
                    className={`p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-center font-body-md transition-all duration-300 ${
                      suggestAlertClosing ? 'animate-alert-out' : 'animate-alert-in'
                    }`}
                  >
                    <span className="material-symbols-outlined text-4xl mb-2 text-emerald-600 block mx-auto">
                      check_circle
                    </span>
                    <p className="font-semibold text-base">{suggestSuccess}</p>
                    <button
                      type="button"
                      onClick={handleCloseSuggestAlert}
                      className="mt-5 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold font-label-md shadow hover:brightness-105 transition-all"
                    >
                      {t('shelters.done')}
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!suggestForm.name.trim() || !suggestForm.address.trim()) return;
                      setPlaces((prev) => [
                        {
                          id: String(Date.now()),
                          type: suggestForm.type as 'vet' | 'shelter' | 'cat_cafe',
                          name: suggestForm.name.trim(),
                          lat: userLocation[0] + 0.005,
                          lng: userLocation[1] + 0.005,
                          distance_km: 1.2,
                          address: suggestForm.address.trim(),
                          phone: suggestForm.phone.trim() || null,
                          website: null,
                          opening_hours: null,
                          source: 'verified_directory',
                        },
                        ...prev,
                      ]);
                      setSuggestSuccess(t('shelters.suggestSuccess'));
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-label-sm uppercase tracking-wider text-secondary mb-1">
                        {t('shelters.suggestPlaceName')} *
                      </label>
                      <input
                        required
                        type="text"
                        value={suggestForm.name}
                        onChange={(e) =>
                          setSuggestForm({ ...suggestForm, name: e.target.value })
                        }
                        placeholder={t('shelters.suggestPlaceNamePlaceholder')}
                        className="w-full bg-[#F0F0F0] rounded-xl px-4 py-2.5 font-body-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-label-sm uppercase tracking-wider text-secondary mb-1">
                        {t('shelters.suggestType')} *
                      </label>
                      <select
                        value={suggestForm.type}
                        onChange={(e) =>
                          setSuggestForm({ ...suggestForm, type: e.target.value })
                        }
                        className="w-full bg-[#F0F0F0] rounded-xl px-4 py-2.5 font-body-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="vet">{t('shelters.suggestTypeVet')}</option>
                        <option value="shelter">{t('shelters.suggestTypeShelter')}</option>
                        <option value="cat_cafe">{t('shelters.suggestTypeCatCafe')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-label-sm uppercase tracking-wider text-secondary mb-1">
                        {t('shelters.suggestAddress')} *
                      </label>
                      <input
                        required
                        type="text"
                        value={suggestForm.address}
                        onChange={(e) =>
                          setSuggestForm({ ...suggestForm, address: e.target.value })
                        }
                        placeholder={t('shelters.suggestAddressPlaceholder')}
                        className="w-full bg-[#F0F0F0] rounded-xl px-4 py-2.5 font-body-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-label-sm uppercase tracking-wider text-secondary mb-1">
                        {t('shelters.suggestPhone')}
                      </label>
                      <input
                        type="tel"
                        value={suggestForm.phone}
                        onChange={(e) =>
                          setSuggestForm({ ...suggestForm, phone: e.target.value })
                        }
                        placeholder={t('shelters.suggestPhonePlaceholder')}
                        className="w-full bg-[#F0F0F0] rounded-xl px-4 py-2.5 font-body-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSuggestOpen(false)}
                        className="px-4 py-2 rounded-xl text-secondary hover:text-on-background font-label-md"
                      >
                        {t('shelters.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold font-label-md shadow-sm hover:brightness-105 transition-all"
                      >
                        {t('shelters.suggestSubmit')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

        {/* Report Incorrect Place Data Modal */}
        {reportRendered &&
          renderPortal(
            <div
              className={`fixed inset-0 z-[9999] w-screen h-screen bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto transition-opacity duration-300 ease-out ${
                reportSlidUp ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-modal-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setReportingPlace(null);
              }}
            >
              <div
                className={`relative m-auto w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high p-6 md:p-8 transition-all duration-300 ease-out transform ${
                  reportSlidUp ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-95 opacity-0'
                }`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 id="report-modal-title" className="font-headline-md text-headline-md text-on-background">
                    {t('shelters.reportModalTitle')}
                  </h3>
                  <button
                    type="button"
                    aria-label={t('shelters.closeAriaLabel')}
                    onClick={() => {
                      if (reportSuccess) {
                        handleCloseReportAlert();
                      } else {
                        setReportingPlace(null);
                      }
                    }}
                    className="w-8 h-8 aspect-square flex items-center justify-center rounded-full hover:bg-surface-container text-secondary p-0 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] select-none leading-none">
                      close
                    </span>
                  </button>
                </div>
                {reportSuccess ? (
                  <div
                    role="alert"
                    aria-live="polite"
                    className={`p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-center font-body-md transition-all duration-300 ${
                      reportAlertClosing ? 'animate-alert-out' : 'animate-alert-in'
                    }`}
                  >
                    <span className="material-symbols-outlined text-4xl mb-2 text-emerald-600 block mx-auto">
                      check_circle
                    </span>
                    <p className="font-semibold text-base">{reportSuccess}</p>
                    <button
                      type="button"
                      onClick={handleCloseReportAlert}
                      className="mt-5 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold font-label-md shadow hover:brightness-105 transition-all"
                    >
                      {t('shelters.close')}
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setReportSuccess(t('shelters.reportSuccess'));
                    }}
                    className="space-y-4"
                  >
                    <p className="font-body-md text-secondary">
                      {t('shelters.reportDetailsFor')} <strong>{reportingPlace?.name}</strong>.
                    </p>
                    <div>
                      <label className="block text-xs font-label-sm uppercase tracking-wider text-secondary mb-1">
                        {t('shelters.reportQuestion')} *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={reportIssueNote}
                        onChange={(e) => setReportIssueNote(e.target.value)}
                        placeholder={t('shelters.reportPlaceholder')}
                        className="w-full bg-[#F0F0F0] rounded-xl px-4 py-2.5 font-body-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setReportingPlace(null)}
                        className="px-4 py-2 rounded-xl text-secondary hover:text-on-background font-label-md"
                      >
                        {t('shelters.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-error text-white font-bold font-label-md shadow-sm hover:brightness-105 transition-all"
                      >
                        {t('shelters.reportSubmit')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
      </main>
      <Footer />
    </div>
  );
}
