import { useState } from 'react';

import { ShelterLocation } from '../data/shelters';
import { ContactPopup, DetailsPopup } from './ShelterPopup';

interface ShelterCardProps {
  location: ShelterLocation;
}

type PopupType = 'contact' | 'details' | null;

export function ShelterCard({ location }: ShelterCardProps) {
  const [popup, setPopup] = useState<PopupType>(null);

  return (
    <>
      <div className="bg-white p-6 rounded-xl border border-outline-variant/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all group">
        {/* Stack vertically on mobile, side-by-side from sm up */}
        <div className="flex flex-col sm:flex-row gap-md">
          <div className="w-full h-44 sm:w-24 sm:h-24 rounded-lg bg-surface-container-low shrink-0 overflow-hidden">
            <img
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
              src={location.imageUrl}
              alt={location.name}
            />
          </div>
          <div className="flex-1 min-w-0">
            {/* Badge + status row */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="inline-block px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                {location.type === 'vet' ? 'Veterinary' : 'Shelter'}
              </span>
              {location.isOpen ? (
                <span className="inline-flex items-center gap-1 text-[#2D8C3C] font-label-sm text-label-sm whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2D8C3C] animate-pulse" />
                  Open Now
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-error font-label-sm text-label-sm whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  Closed
                </span>
              )}
            </div>

            {/* Name + distance */}
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-headline-md text-headline-md text-on-background leading-tight">
                {location.name}
              </h3>
              <p className="font-label-md text-label-md text-on-surface-variant whitespace-nowrap shrink-0">
                {location.distance}
              </p>
            </div>

            <p className="text-secondary mt-2 line-clamp-2 font-body-md text-body-md">
              {location.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPopup('contact')}
                className="bg-primary-container text-on-primary px-5 py-2.5 rounded-full font-bold flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all font-label-md text-label-md"
              >
                <span className="material-symbols-outlined text-[20px]">call</span>
                Call Now
              </button>
              <button
                type="button"
                onClick={() => setPopup('details')}
                className="px-5 py-2.5 rounded-full font-bold border-2 border-on-background text-on-background hover:bg-on-background hover:text-white transition-all font-label-md text-label-md"
              >
                Details
              </button>
            </div>
          </div>
        </div>
      </div>

      {popup === 'contact' && (
        <ContactPopup location={location} onClose={() => setPopup(null)} />
      )}
      {popup === 'details' && (
        <DetailsPopup location={location} onClose={() => setPopup(null)} />
      )}
    </>
  );
}
