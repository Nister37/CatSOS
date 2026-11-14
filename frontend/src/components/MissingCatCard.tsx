import { useState } from 'react';

export interface LatestSightingSummary {
  seen_at: string;
  location_description?: string;
  confidence?: string;
  verification_status?: string;
}

interface MissingCatCardProps {
  name: string;
  photo?: string;
  area: string;
  lastSeen: string;
  latestSighting?: LatestSightingSummary | null;
}

export function MissingCatCard({ name, photo, area, lastSeen, latestSighting }: MissingCatCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-surface-container cat-card-shadow group w-full min-w-0 max-w-full">
      <div className="relative h-64 overflow-hidden">
        {photo && !imgError ? (
          <img
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            alt={`${name}, a missing cat`}
            src={photo}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-6xl text-secondary opacity-40">pets</span>
          </div>
        )}
        <div className="absolute top-4 left-4 bg-primary text-on-primary px-3 py-1 rounded-full font-label-md text-label-md font-bold uppercase tracking-wider shadow-md">
          Missing
        </div>
      </div>
      <div className="p-md min-w-0">
        <h3 className="font-headline-md text-headline-md text-on-background mb-xs truncate">{name}</h3>
        <div className="flex items-center gap-xs text-secondary mb-1 min-w-0">
          <span className="material-symbols-outlined text-sm shrink-0">location_on</span>
          <span className="font-body-md text-body-md truncate">{area}</span>
        </div>
        <div className="flex items-center gap-xs text-secondary min-w-0">
          <span className="material-symbols-outlined text-sm shrink-0">calendar_today</span>
          <span className="font-body-md text-body-md italic truncate">Seen: {lastSeen}</span>
        </div>
        {latestSighting && (
          <div className="flex items-center gap-xs text-primary mt-2 pt-2 border-t border-surface-container text-xs font-medium min-w-0">
            <span className="material-symbols-outlined text-[16px] shrink-0">visibility</span>
            <span className="truncate">
              Latest sighting: {new Date(latestSighting.seen_at).toLocaleDateString()}
              {latestSighting.location_description ? ` · ${latestSighting.location_description}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
