import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { MissingCatCard } from './MissingCatCard';
import { CatDetailModal } from './CatDetailModal';
import { fetchPublicReports, type PublicReport } from '../services/reportsApi';

export function RecentlyReported() {
  const [cats, setCats] = useState<PublicReport[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicReports(4)
      .then((results) => setCats(results))
      .catch(() => setCats([]));
  }, []);

  return (
    <>
      <section className="py-xl bg-background">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-xl">
          <div className="flex flex-col md:flex-row justify-between items-end mb-xl gap-md">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-background mb-xs">
                Recently Reported
              </h2>
              <p className="font-body-lg text-body-lg text-secondary">
                Keep an eye out for these neighbors in your area.
              </p>
            </div>
            <Link
              className="text-on-background font-bold border-b-2 border-on-background pb-1 hover:text-primary-container hover:border-primary-container transition-colors"
              to="/missing"
            >
              View All Missing Cats
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            {cats === null
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-surface-container rounded-2xl h-80 animate-pulse" />
                ))
              : cats.map((cat) => (
                  <button
                    key={cat.public_id}
                    className="text-left w-full rounded-2xl focus-visible:outline-2 focus-visible:outline-primary-container"
                    onClick={() => setSelectedId(cat.public_id)}
                  >
                    <MissingCatCard
                      name={cat.cat_name}
                      area={cat.location_summary || cat.last_seen_landmark || 'Unknown area'}
                      lastSeen={
                        cat.disappeared_at
                          ? new Date(cat.disappeared_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Unknown'
                      }
                      photo={cat.main_photo?.url}
                    />
                  </button>
                ))}
          </div>
        </div>
      </section>

      {selectedId && (
        <CatDetailModal
          publicId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
