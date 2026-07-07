import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { fetchNearbyHelp, type NearbyHelpPlace } from '../services/nearbyHelpApi';

type FilterType = 'all' | 'shelter' | 'vet';

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  shelter: 'Shelters',
  vet: 'Vets',
};

const TYPE_ICON: Record<string, string> = {
  vet: 'medical_services',
  shelter: 'home',
  pet_help: 'pets',
};

const TYPE_LABEL: Record<string, string> = {
  vet: 'Veterinary',
  shelter: 'Shelter',
  pet_help: 'Pet-related',
};

export function SheltersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [places, setPlaces] = useState<NearbyHelpPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => setUserLocation([51.2194, 4.4025]), // Default: Antwerp
      { timeout: 5000 },
    );
  }, []);

  // Fetch real data from Overpass API
  useEffect(() => {
    if (!userLocation) return;
    setLoading(true);
    setError(false);
    fetchNearbyHelp(userLocation[0], userLocation[1], 15)
      .then((response) => setPlaces(response.places))
      .catch(() => { setError(true); setPlaces([]); })
      .finally(() => setLoading(false));
  }, [userLocation]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return places.filter((place) => {
      const matchesType = filter === 'all' || place.type === filter;
      const matchesSearch =
        query === '' ||
        (place.name ?? '').toLowerCase().includes(query) ||
        (place.address ?? '').toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [search, filter, places]);

  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth">
      <Navbar />
      <main className="pt-24 pb-xl min-h-screen max-w-container-max mx-auto px-margin-mobile md:px-lg">
        {/* Hero */}
        <section className="mb-lg">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-base">
            Find Professional Help Nearby
          </h1>
          <p className="font-body-lg text-body-lg text-secondary max-w-2xl">
            Connect with trusted shelters and veterinary clinics in your immediate area to ensure
            the safety and well-being of our feline friends.
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
              <strong>Data may be incomplete.</strong> Call before visiting.
            </p>
          </div>
        </section>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-md items-center mb-xl">
          <div className="relative w-full md:w-96 group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-secondary pointer-events-none group-focus-within:text-on-background transition-colors">
              search
            </span>
            <input
              className="w-full bg-[#F0F0F0] border-none rounded-xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-on-background transition-all font-body-md"
              placeholder="Search by name or city..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search shelters and veterinary clinics"
            />
          </div>
          <div
            className="flex bg-surface-container rounded-xl p-1 w-full md:w-auto"
            role="group"
            aria-label="Filter by type"
          >
            {(['all', 'shelter', 'vet'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                aria-pressed={filter === type}
                className={`flex-1 md:flex-none px-6 py-3 rounded-lg font-label-md text-label-md transition-all ${
                  filter === type
                    ? 'bg-white shadow-sm text-on-background'
                    : 'text-secondary hover:text-on-background'
                }`}
              >
                {FILTER_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
          {/* Card list column */}
          <div className="lg:col-span-7 flex flex-col gap-md">
            <div className="space-y-md overflow-y-auto lg:max-h-[800px] pr-1 custom-scrollbar">
              {loading ? (
                <div className="py-xl text-center">
                  <span className="material-symbols-outlined text-[48px] text-secondary animate-spin">progress_activity</span>
                  <p className="mt-md text-secondary font-body-md">Loading nearby places...</p>
                </div>
              ) : error ? (
                <div className="py-xl text-center text-secondary font-body-lg">
                  Could not load nearby places. Please try again later.
                </div>
              ) : filtered.length > 0 ? (
                filtered.map((place) => (
                  <div key={place.id} className="bg-white rounded-2xl overflow-hidden border border-surface-container hover:shadow-md transition-shadow">
                    <div className="p-md flex gap-md">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        place.type === 'vet' ? 'bg-green-100 text-green-700' :
                        place.type === 'shelter' ? 'bg-blue-100 text-blue-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        <span className="material-symbols-outlined">{TYPE_ICON[place.type] ?? 'pets'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-sm mb-xs">
                          <h3 className="font-headline-md text-on-background truncate">
                            {place.name || 'Unnamed place'}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            place.type === 'vet' ? 'bg-green-100 text-green-700' :
                            place.type === 'shelter' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {TYPE_LABEL[place.type] ?? 'Place'}
                          </span>
                        </div>
                        {place.address && (
                          <p className="text-secondary font-body-md text-sm flex items-center gap-xs">
                            <span className="material-symbols-outlined text-[16px]">location_on</span>
                            {place.address}
                          </p>
                        )}
                        <div className="flex items-center gap-md mt-sm flex-wrap">
                          <span className="text-secondary text-sm">{place.distance_km} km away</span>
                          {place.phone && (
                            <a href={`tel:${place.phone}`} className="text-primary text-sm flex items-center gap-xs hover:underline">
                              <span className="material-symbols-outlined text-[16px]">call</span>
                              {place.phone}
                            </a>
                          )}
                          {place.opening_hours && (
                            <span className="text-secondary text-sm flex items-center gap-xs">
                              <span className="material-symbols-outlined text-[16px]">schedule</span>
                              {place.opening_hours}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-sm mt-sm">
                          {place.website && (
                            <a
                              href={place.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-xs"
                            >
                              <span className="material-symbols-outlined text-[16px]">language</span>
                              Website
                            </a>
                          )}
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=16/${place.lat}/${place.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-xs"
                          >
                            <span className="material-symbols-outlined text-[16px]">map</span>
                            Open in maps
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-xl text-center text-secondary font-body-lg text-body-lg">
                  No results match your search.
                </div>
              )}
            </div>
          </div>

          {/* Desktop info panel */}
          <div className="hidden lg:block lg:col-span-5 sticky top-24">
            <div className="bg-surface-container-low rounded-2xl p-lg border border-outline-variant/20">
              <div className="flex justify-between items-center mb-md">
                <div>
                  <h4 className="font-bold text-on-background">
                    {loading ? 'Loading...' : `${filtered.length} places found`}
                  </h4>
                  <p className="text-secondary text-sm">within 15 km of your location</p>
                </div>
              </div>
              <div className="space-y-sm text-sm text-secondary">
                <div className="flex items-center gap-sm">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span>{places.filter(p => p.type === 'vet').length} Veterinary clinics</span>
                </div>
                <div className="flex items-center gap-sm">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>{places.filter(p => p.type === 'shelter').length} Animal shelters</span>
                </div>
                <div className="flex items-center gap-sm">
                  <span className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>{places.filter(p => p.type === 'pet_help').length} Pet-related places</span>
                </div>
              </div>
              <p className="mt-md text-xs text-secondary border-t border-outline-variant/30 pt-md">
                Data © OpenStreetMap contributors. Call before visiting.
              </p>
            </div>
          </div>
        </div>

        {/* Community callout */}
        <section className="mt-xl grid grid-cols-1 md:grid-cols-2 gap-lg items-center">
          <div className="p-lg bg-on-background text-white rounded-3xl overflow-hidden relative">
            <div className="relative z-10">
              <h2 className="font-headline-lg text-headline-lg mb-md">Can't find a shelter?</h2>
              <p className="text-white/70 font-body-lg text-body-lg mb-lg">
                Our community network often provides temporary fostering or immediate assistance
                while professional help is contacted.
              </p>
              <Link
                to="/map"
                className="bg-primary-container text-on-primary px-8 py-3 rounded-full font-bold hover:brightness-110 transition-all inline-flex items-center gap-2"
              >
                Post to Community Map
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
                <h4 className="font-bold text-lg mb-1">Emergency Protocols</h4>
                <p className="text-secondary text-sm">
                  Learn the immediate steps to take if you find an injured cat before professional
                  help arrives.
                </p>
              </div>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-outline-variant/30 flex gap-md items-start">
              <div className="p-3 bg-surface rounded-xl text-on-background shrink-0">
                <span className="material-symbols-outlined text-[32px]">volunteer_activism</span>
              </div>
              <div>
                <h4 className="font-bold text-lg mb-1">Call Ahead</h4>
                <p className="text-secondary text-sm">
                  Listings can change quickly. Confirm opening hours, services, and appointment
                  rules before you go.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
