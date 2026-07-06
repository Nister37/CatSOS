import { useEffect } from 'react';

import { ShelterLocation } from '../data/shelters';

interface PopupProps {
  location: ShelterLocation;
  onClose: () => void;
}

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-on-background/50 backdrop-blur-sm z-[1999]"
      aria-hidden
      onClick={onClose}
    />
  );
}

function PopupShell({
  location,
  onClose,
  children,
}: {
  location: ShelterLocation;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <Backdrop onClose={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={location.name}
        className="fixed inset-0 z-[2000] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] w-full max-w-sm pointer-events-auto animate-[popIn_0.18s_ease-out]">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-outline-variant/20">
            <div>
              <span className="inline-block px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-1">
                {location.type === 'vet' ? 'Veterinary' : 'Shelter'}
              </span>
              <h3 className="font-headline-md text-headline-md text-on-background leading-tight">
                {location.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 mt-0.5 p-1.5 rounded-full hover:bg-surface-container transition-colors text-secondary"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">{children}</div>
        </div>
      </div>
    </>
  );
}

export function DetailsPopup({ location, onClose }: PopupProps) {
  const rows = [
    { label: 'Mon – Fri', value: location.hours.weekdays },
    { label: 'Saturday', value: location.hours.saturday },
    { label: 'Sunday', value: location.hours.sunday },
  ];

  return (
    <PopupShell location={location} onClose={onClose}>
      {/* Address */}
      <div className="flex gap-3 items-start">
        <div className="shrink-0 p-2 rounded-xl bg-surface-container-low text-secondary">
          <span className="material-symbols-outlined text-[22px]">location_on</span>
        </div>
        <div>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-0.5">
            Address
          </p>
          <p className="font-body-md text-body-md text-on-background">{location.address}</p>
        </div>
      </div>

      {/* Hours */}
      <div className="flex gap-3 items-start">
        <div className="shrink-0 p-2 rounded-xl bg-surface-container-low text-secondary">
          <span className="material-symbols-outlined text-[22px]">schedule</span>
        </div>
        <div className="flex-1">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
            Opening Hours
          </p>
          <div className="space-y-1.5">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="font-label-md text-label-md text-secondary">{label}</span>
                <span
                  className={`font-label-md text-label-md ${value === 'Closed' ? 'text-error' : 'text-on-background'}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PopupShell>
  );
}

export function ContactPopup({ location, onClose }: PopupProps) {
  return (
    <PopupShell location={location} onClose={onClose}>
      {/* Phone */}
      <div className="flex gap-3 items-center">
        <div className="shrink-0 p-2 rounded-xl bg-surface-container-low text-secondary">
          <span className="material-symbols-outlined text-[22px]">call</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-0.5">
            Phone
          </p>
          <a
            href={`tel:${location.phone}`}
            className="font-body-md text-body-md text-on-background font-semibold hover:text-primary transition-colors"
          >
            {location.phone}
          </a>
        </div>
        <a
          href={`tel:${location.phone}`}
          className="shrink-0 bg-primary-container text-on-primary px-4 py-2 rounded-full font-label-md text-label-md font-bold hover:brightness-110 transition-all"
        >
          Call
        </a>
      </div>

      {/* Email */}
      <div className="flex gap-3 items-center">
        <div className="shrink-0 p-2 rounded-xl bg-surface-container-low text-secondary">
          <span className="material-symbols-outlined text-[22px]">mail</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-0.5">
            Email
          </p>
          <a
            href={`mailto:${location.email}`}
            className="font-body-md text-body-md text-on-background font-semibold hover:text-primary transition-colors truncate block"
          >
            {location.email}
          </a>
        </div>
        <a
          href={`mailto:${location.email}`}
          className="shrink-0 border-2 border-on-background text-on-background px-4 py-2 rounded-full font-label-md text-label-md font-bold hover:bg-on-background hover:text-white transition-all"
        >
          Email
        </a>
      </div>
    </PopupShell>
  );
}
