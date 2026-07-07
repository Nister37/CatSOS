import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup } from 'react-leaflet';

import { BaseTileLayer } from '../components/BaseTileLayer';
import { CatDetailModal } from '../components/CatDetailModal';
import { Footer } from '../components/Footer';
import { MissingCatCard } from '../components/MissingCatCard';
import { Navbar } from '../components/Navbar';
import { fetchMissingCatsPage, fetchPublicReports, type PublicReport } from '../services/reportsApi';

const PAGE_SIZE = 12;
const MAP_PREFETCH = 100;

function formatDate(iso: string | null) {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MissingCatsPage() {
  const [mapCats, setMapCats] = useState<PublicReport[]>([]);
  const [cards, setCards] = useState<PublicReport[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Fetch map pins (large batch, one-off)
  useEffect(() => {
    fetchPublicReports(MAP_PREFETCH).then(setMapCats).catch(() => {});
  }, []);

  // Fetch first page of cards
  useEffect(() => {
    setLoadingCards(true);
    fetchMissingCatsPage(1, PAGE_SIZE)
      .then(({ results, count, hasNext: hn }) => {
        setCards(results);
        setTotalCount(count);
        setHasNext(hn);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => setLoadingCards(false));
  }, []);

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const { results, hasNext: hn } = await fetchMissingCatsPage(nextPage, PAGE_SIZE);
      setCards((prev) => [...prev, ...results]);
      setPage(nextPage);
      setHasNext(hn);
    } finally {
      setLoadingMore(false);
    }
  }

  const openModal = useCallback((id: string) => setSelectedId(id), []);

  const pinIcon = useMemo(
    () =>
      new L.DivIcon({
        className: '',
        html: `<span class="material-symbols-outlined" style="font-size:36px;color:#ff5a5f;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));display:block;line-height:1;">location_on</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      }),
    [],
  );

  const catsWithCoords = mapCats.filter((c) => c.approximate_location !== null);

  const mapCenter: [number, number] =
    catsWithCoords.length > 0
      ? [catsWithCoords[0].approximate_location!.latitude, catsWithCoords[0].approximate_location!.longitude]
      : [51.505, -0.09];

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-20">
        {/* Page header */}
        <div className="px-margin-mobile md:px-xl max-w-container-max mx-auto pt-xl pb-lg">
          <p className="font-label-md text-label-md text-primary uppercase tracking-widest mb-sm">
            Community search
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-sm">
            <h1 className="font-display-lg text-display-lg text-on-surface">Missing Cats</h1>
            {totalCount > 0 && !loadingCards && (
              <p className="font-body-md text-body-md text-secondary pb-1">
                {totalCount} active {totalCount === 1 ? 'report' : 'reports'}
              </p>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="px-margin-mobile md:px-xl max-w-container-max mx-auto mb-xl">
          <div className="rounded-2xl overflow-hidden border border-surface-container shadow-sm isolate" style={{ height: 380 }}>
          <MapContainer
            ref={mapRef}
            center={mapCenter}
            zoom={catsWithCoords.length > 0 ? 12 : 5}
            scrollWheelZoom
            zoomControl={false}
            style={{ height: '100%', width: '100%' }}
          >
            <BaseTileLayer />
            {catsWithCoords.map((cat) => (
              <Marker
                key={cat.public_id}
                position={[
                  cat.approximate_location!.latitude,
                  cat.approximate_location!.longitude,
                ]}
                icon={pinIcon}
              >
                <Popup closeButton={false} className="cat-map-popup">
                  <div className="w-48 font-body-md">
                    {cat.main_photo?.url && (
                      <div className="h-28 -mx-[11px] -mt-[11px] mb-sm overflow-hidden rounded-t-lg">
                        <img
                          src={cat.main_photo.url}
                          alt={cat.cat_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <p className="font-label-md text-label-md font-bold text-on-surface leading-snug">
                      {cat.cat_name}
                    </p>
                    {cat.last_seen_landmark && (
                      <p className="text-secondary text-[12px] mt-[2px] leading-snug">{cat.last_seen_landmark}</p>
                    )}
                    {cat.disappeared_at && (
                      <p className="text-secondary text-[12px] leading-snug">
                        Missing since {formatDate(cat.disappeared_at)}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => openModal(cat.public_id)}
                      className="mt-sm w-full bg-primary text-on-primary text-[12px] font-bold py-[6px] rounded-lg hover:brightness-110 transition-all"
                    >
                      View details
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          </div>
        </div>

        {/* Cards grid */}
        <div className="px-margin-mobile md:px-xl max-w-container-max mx-auto pb-xl">
          {loadingCards ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-surface-container rounded-2xl h-80 animate-pulse" />
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center py-xl gap-md text-center">
              <span className="material-symbols-outlined text-[64px] text-secondary">sentiment_satisfied</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">No active reports</h2>
              <p className="font-body-lg text-body-lg text-secondary max-w-sm">
                There are no missing cats reported in your area right now.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
                {cards.map((cat) => (
                  <button
                    key={cat.public_id}
                    type="button"
                    className="text-left w-full rounded-2xl focus-visible:outline-2 focus-visible:outline-primary-container"
                    onClick={() => openModal(cat.public_id)}
                  >
                    <MissingCatCard
                      name={cat.cat_name}
                      area={cat.location_summary || cat.last_seen_landmark || 'Unknown area'}
                      lastSeen={formatDate(cat.disappeared_at)}
                      photo={cat.main_photo?.url}
                    />
                  </button>
                ))}
              </div>

              {hasNext && (
                <div className="flex justify-center mt-xl">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-xl py-md rounded-xl border-2 border-on-background text-on-background font-label-md text-label-md hover:bg-on-background hover:text-background transition-colors disabled:opacity-50 flex items-center gap-sm"
                  >
                    {loadingMore ? (
                      <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                        Loading…
                      </>
                    ) : (
                      <>
                        Load more
                        <span className="material-symbols-outlined text-[18px]">expand_more</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {!hasNext && cards.length > 0 && (
                <p className="text-center font-body-md text-body-md text-secondary mt-xl">
                  Showing all {totalCount} {totalCount === 1 ? 'report' : 'reports'}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      {selectedId && (
        <CatDetailModal publicId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
