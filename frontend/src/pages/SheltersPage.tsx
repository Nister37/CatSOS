import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { ShelterCard } from '../components/ShelterCard';
import { SheltersMap } from '../components/SheltersMap';
import { MOCK_LOCATIONS, ShelterType } from '../data/shelters';

type FilterType = 'all' | ShelterType;

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  shelter: 'Shelters',
  vet: 'Vets',
};

export function SheltersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [mobileMapOpen, setMobileMapOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return MOCK_LOCATIONS.filter((loc) => {
      const matchesType = filter === 'all' || loc.type === filter;
      const matchesSearch =
        query === '' ||
        loc.name.toLowerCase().includes(query) ||
        loc.address.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [search, filter]);

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
              aria-label="Search shelters and vets"
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
            {/* Scrollable cards */}
            <div className="space-y-md overflow-y-auto lg:max-h-[800px] pr-1 custom-scrollbar">
              {filtered.length > 0 ? (
                filtered.map((loc) => <ShelterCard key={loc.id} location={loc} />)
              ) : (
                <div className="py-xl text-center text-secondary font-body-lg text-body-lg">
                  No results match your search.
                </div>
              )}
            </div>

            {/* Mobile map toggle — below the card list, not inside the scroll area */}
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMapOpen((prev) => !prev)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-on-background text-on-background font-bold font-label-md text-label-md hover:bg-on-background hover:text-white transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {mobileMapOpen ? 'close' : 'map'}
                </span>
                {mobileMapOpen ? 'Hide map' : 'View on map'}
              </button>

              {mobileMapOpen && (
                <div className="mt-md h-[350px] rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20 relative">
                  <SheltersMap locations={filtered} />
                  <div className="absolute bottom-4 left-4 right-4 p-3 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white/40 z-[1000]">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-on-background text-sm">
                          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-secondary text-xs">within 10 km</p>
                      </div>
                      <button
                        type="button"
                        className="p-2 rounded-full bg-white text-on-background shadow-sm"
                        aria-label="Center map on my location"
                      >
                        <span className="material-symbols-outlined text-[20px]">my_location</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop map */}
          <div className="hidden lg:block lg:col-span-5 sticky top-24 h-[600px] rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20 relative">
            <SheltersMap locations={filtered} />
            <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white/40 z-[1000]">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-on-background">
                    Showing {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                  </h4>
                  <p className="text-secondary text-sm">within 10 km of your location</p>
                </div>
                <button
                  type="button"
                  className="p-2 rounded-full bg-white text-on-background shadow-sm hover:scale-110 transition-transform"
                  aria-label="Center map on my location"
                >
                  <span className="material-symbols-outlined">my_location</span>
                </button>
              </div>
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
