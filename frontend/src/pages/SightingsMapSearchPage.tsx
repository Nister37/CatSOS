import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';

const TRENDING = [
  { label: 'Brooklyn, NY', query: 'Brooklyn, NY' },
  { label: 'Portland, OR', query: 'Portland, OR' },
  { label: 'Austin, TX', query: 'Austin, TX' },
  { label: 'London, UK', query: 'London, UK' },
];

const STATS = [
  { value: '1,240', label: 'Active Sightings', highlight: true },
  { value: '850', label: 'Cats Reunited', highlight: false },
  { value: '15k+', label: 'Community Members', highlight: false },
];

export function SightingsMapSearchPage() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const watermarkRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
              Find sightings in your area
            </h1>
            <p className="font-body-lg text-body-lg text-secondary max-w-[600px] mx-auto">
              Enter your city or zip code to view active reports and help bring cats home.
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
                placeholder="San Francisco, CA or 94103"
                aria-label="Search sightings by city, postcode, or area"
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
              Search Map
            </button>
          </form>

          {/* Trending nearby */}
          <div className="mt-lg flex flex-wrap justify-center items-center gap-lg">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
              Trending Nearby:
            </span>
            <div className="flex flex-wrap justify-center gap-md">
              {TRENDING.map((item) => (
                <button
                  key={item.query}
                  type="button"
                  onClick={() => handleSearch(item.query)}
                  className="font-label-md text-label-md text-on-surface-variant hover:text-primary-container transition-colors border-b border-transparent hover:border-primary-container"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="relative z-10 w-full max-w-container-max mx-auto px-margin-mobile grid grid-cols-1 md:grid-cols-3 gap-md pb-xl">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-container-low p-lg rounded-xl border border-surface-container-high flex flex-col items-center text-center"
            >
              <span
                className={`font-headline-lg text-headline-lg mb-xs ${
                  stat.highlight ? 'text-primary' : 'text-on-background'
                }`}
              >
                {stat.value}
              </span>
              <span className="font-label-md text-label-md text-secondary">{stat.label}</span>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
